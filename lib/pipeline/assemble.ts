// lib/pipeline/assemble.ts
//
// THE ingest→score bridge. For a functionId + run date it reads the raw evidence
// tables (gh_prs / gh_commits / cc_sessions / blame_snapshots / deploys / incidents /
// pr_ai_link) and assembles the EXACT `MemberRawRows` shape the scoring engine
// (lib/scoring/types.ts) consumes — one per active employee — plus the trailing-90-day
// sizing PRs and the active index_config translated into a scoring `config` arg.
//
// CONTRACT (architecture §0.4 / no-dummy-data): every value is mapped from a real row
// or left at a HONEST no-signal default (0 / false / []). The scoring engine treats
// those as "no signal" (null KPI, Insufficient confidence) — it never fabricates a
// number. Columns referenced here are validated against the live DB (limit 0).
//
// SERVER-ONLY: reads via the service-role admin client (RLS-bypassing, pipeline path).

import { createAdminClient } from '@/lib/supabase/admin';
import { ensureSelfEmployee } from '@/lib/onboarding/provision';
import { WINDOW_DAYS, SIZING_WINDOW_DAYS } from '@/lib/config/constants';
import type {
  DeployRow,
  MemberRawRows,
  PrRow,
  SessionRow,
  SkillAuthorshipRow,
} from '@/lib/scoring/types';
import type { RawIndexConfig } from '@/lib/scoring/config';
import { DEFAULT_INDEX_CONFIG } from '@/lib/scoring/defaults/index-config.default';

const DAY_MS = 86_400_000;
const REVERT_WINDOW_MS = 14 * DAY_MS;
const RETENTION_AGE_MS = 30 * DAY_MS;

// ─────────────────────────────────────────────────────────────────────────────
// Loose admin query surface (the github/db AdminFilter lacks .gte/.lt/.in we need).
// Same cast pattern the sentry connector + lib/db read layer use while the generated
// Database type stays a placeholder.
// ─────────────────────────────────────────────────────────────────────────────
type DbResult = Promise<{ data: unknown; error: { message?: string } | null }>;
interface LooseChain extends DbResult {
  eq: (col: string, val: unknown) => LooseChain;
  in: (col: string, vals: readonly unknown[]) => LooseChain;
  gte: (col: string, val: unknown) => LooseChain;
  lte: (col: string, val: unknown) => LooseChain;
  lt: (col: string, val: unknown) => LooseChain;
  is: (col: string, val: unknown) => LooseChain;
  order: (col: string, opts?: unknown) => LooseChain;
  select: (cols: string) => LooseChain;
  maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: { message?: string } | null }>;
}
interface LooseDb {
  from: (table: string) => LooseChain;
}
function looseDb(): LooseDb {
  return createAdminClient() as unknown as LooseDb;
}

/** Narrow a loose `{data,error}` to plain rows; empty on error (empty-DB safe). */
function rows(result: { data: unknown; error: unknown }): Record<string, unknown>[] {
  if (result.error || !Array.isArray(result.data)) return [];
  return result.data as Record<string, unknown>[];
}

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}
function bool(v: unknown): boolean {
  return v === true;
}
function str(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}
function ms(v: unknown): number | null {
  const s = str(v);
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : t;
}
/** ISO day-key (YYYY-MM-DD, UTC) for a timestamp, or null. */
function dayKey(v: unknown): string | null {
  const t = ms(v);
  return t === null ? null : new Date(t).toISOString().slice(0, 10);
}

// ─────────────────────────────────────────────────────────────────────────────
// Window math (anchored on the passed run date — NO hidden clock)
// ─────────────────────────────────────────────────────────────────────────────

interface Bounds {
  /** run date at 00:00:00 UTC. */
  runMs: number;
  /** inclusive ISO lower bound for the 28d compute window. */
  computeSince: string;
  /** inclusive ISO lower bound for the 90d sizing window. */
  sizingSince: string;
  /** ISO upper bound (end of the run day, UTC). */
  until: string;
}

/** Build trailing windows ending at the END of the passed run date (UTC). */
function boundsFor(date: string): Bounds {
  const runMs = Date.parse(`${date}T00:00:00.000Z`);
  const endOfDay = runMs + DAY_MS - 1;
  return {
    runMs,
    computeSince: new Date(endOfDay - WINDOW_DAYS * DAY_MS).toISOString(),
    sizingSince: new Date(endOfDay - SIZING_WINDOW_DAYS * DAY_MS).toISOString(),
    until: new Date(endOfDay).toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Active employees (ensure the self employee first, so N >= 1)
// ─────────────────────────────────────────────────────────────────────────────

interface ActiveEmployee {
  id: string;
  github_handle: string | null;
  name: string;
}

/**
 * List active employees for a function. Calls ensureSelfEmployee first so a fresh
 * connect/scan always has at least one real member to score (never synthetic).
 */
export async function listActiveEmployees(functionId: string): Promise<ActiveEmployee[]> {
  await ensureSelfEmployee({ functionId });

  const db = looseDb();
  const raw = rows(
    await db
      .from('employees')
      .select('id, github_handle, name, active, function_id')
      .eq('function_id', functionId)
      .eq('active', true),
  );
  return raw.map((r) => ({
    id: String(r.id),
    github_handle: str(r.github_handle),
    name: typeof r.name === 'string' ? r.name : '',
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Raw-row readers (scoped to the function + window; partitioned by employee_id)
// ─────────────────────────────────────────────────────────────────────────────

interface PrDbRow {
  id: string;
  employee_id: string | null;
  files: unknown;
  hunks: unknown;
  modules: unknown;
  blast: unknown;
  is_merged: unknown;
  ai_assisted: unknown;
  merged_at: unknown;
  created_at: unknown;
  reverted_at: unknown;
  feature_label: unknown;
}

/** Merged-or-created-in-window PRs for the function. (28d compute window.) */
async function loadWindowPrs(functionId: string, b: Bounds): Promise<PrDbRow[]> {
  const db = looseDb();
  // We want PRs whose merge OR creation lands in the window. Two passes (the loose
  // surface has no OR), de-duped by id, since a PR could match on either column.
  const byMerged = rows(
    await db
      .from('gh_prs')
      .select(
        'id, employee_id, files, hunks, modules, blast, is_merged, ai_assisted, merged_at, created_at, reverted_at, feature_label',
      )
      .eq('function_id', functionId)
      .gte('merged_at', b.computeSince)
      .lte('merged_at', b.until),
  );
  const byCreated = rows(
    await db
      .from('gh_prs')
      .select(
        'id, employee_id, files, hunks, modules, blast, is_merged, ai_assisted, merged_at, created_at, reverted_at, feature_label',
      )
      .eq('function_id', functionId)
      .gte('created_at', b.computeSince)
      .lte('created_at', b.until),
  );
  const byId = new Map<string, PrDbRow>();
  for (const r of [...byMerged, ...byCreated]) byId.set(String(r.id), r as unknown as PrDbRow);
  return [...byId.values()];
}

/** Trailing-90-day MERGED PRs (function-wide) for the frozen S/M/L sizing tertiles. */
async function loadSizingPrs(functionId: string, b: Bounds): Promise<PrDbRow[]> {
  const db = looseDb();
  return rows(
    await db
      .from('gh_prs')
      .select('id, employee_id, files, hunks, modules, blast, is_merged, ai_assisted, merged_at, created_at, reverted_at, feature_label')
      .eq('function_id', functionId)
      .eq('is_merged', true)
      .gte('merged_at', b.sizingSince)
      .lte('merged_at', b.until),
  ) as unknown as PrDbRow[];
}

interface SessionDbRow {
  id: string;
  employee_id: string | null;
  session_id: unknown;
  ts: unknown;
  turns: unknown;
  tokens_in: unknown;
  tokens_out: unknown;
  cache_read: unknown;
  cache_creation: unknown;
  suggestions_offered: unknown;
  suggestions_accepted: unknown;
  skills_used: unknown;
  linked_pr: unknown;
}

/** CC sessions whose `ts` lands in the 28d compute window. */
async function loadWindowSessions(functionId: string, b: Bounds): Promise<SessionDbRow[]> {
  const db = looseDb();
  return rows(
    await db
      .from('cc_sessions')
      .select(
        'id, employee_id, session_id, ts, turns, tokens_in, tokens_out, cache_read, cache_creation, suggestions_offered, suggestions_accepted, skills_used, linked_pr',
      )
      .eq('function_id', functionId)
      .gte('ts', b.computeSince)
      .lte('ts', b.until),
  ) as unknown as SessionDbRow[];
}

interface DeployDbRow {
  id: string;
  ai_assisted: unknown;
  change_failed: unknown;
  ts: unknown;
}

/** Deploys (function-scoped — there is no employee_id on deploys) in the window. */
async function loadWindowDeploys(functionId: string, b: Bounds): Promise<DeployDbRow[]> {
  const db = looseDb();
  return rows(
    await db
      .from('deploys')
      .select('id, ai_assisted, change_failed, ts, function_id')
      .eq('function_id', functionId)
      .gte('ts', b.computeSince)
      .lte('ts', b.until),
  ) as unknown as DeployDbRow[];
}

interface BlameDbRow {
  employee_id: string | null;
  author_handle: string | null;
  ai_assisted: unknown;
  alive_at_30d: unknown;
  first_seen: unknown;
}

/** AI-attributed blame lines first seen in the window (retention/rework signal). */
async function loadWindowBlame(functionId: string, b: Bounds): Promise<BlameDbRow[]> {
  const db = looseDb();
  return rows(
    await db
      .from('blame_snapshots')
      .select('employee_id, author_handle, ai_assisted, alive_at_30d, first_seen, function_id')
      .eq('function_id', functionId)
      .eq('ai_assisted', true)
      .gte('first_seen', b.sizingSince)
      .lte('first_seen', b.until),
  ) as unknown as BlameDbRow[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Row mappers (DB columns → scoring input types — EXACT shapes from lib/scoring/types)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Map one gh_prs row → the scoring `PrRow`. The connector stores files/hunks/modules
 * (RAW; sizing re-derives S/M/L), blast (>0 ⇒ 1), is_merged, ai_assisted (the link
 * step sets this — it IS aiLinked), reverted_at, feature_label.
 *
 * Per-PR AI-line retention (`aiLinesMerged`/`aiLinesAliveAt30d`), `agenticMajority`,
 * `defectReworkWithin14d`, and `isSelfRevert` have NO per-PR column in the current
 * schema (blame_snapshots is keyed per line, not per PR; agentic/self-revert/rework
 * detectors are M3). They map to honest no-signal defaults (0 / false) so the scoring
 * engine reports "no signal" rather than a fabricated number.
 */
function mapPr(r: PrDbRow): PrRow {
  const isMerged = bool(r.is_merged);
  const mergedMs = ms(r.merged_at);
  const revertedMs = ms(r.reverted_at);
  const revertedWithin14d =
    revertedMs !== null && mergedMs !== null && revertedMs - mergedMs <= REVERT_WINDOW_MS;
  return {
    prId: String(r.id),
    files: num(r.files),
    hunks: num(r.hunks),
    modules: num(r.modules),
    blast: num(r.blast) > 0 ? 1 : 0,
    isMerged,
    aiLinked: bool(r.ai_assisted),
    revertedWithin14d,
    aiLinesMerged: 0, // per-PR blame attribution is M3 — no signal here, not fabricated
    aiLinesAliveAt30d: 0,
    agenticMajority: false, // accepted-hunk authorship detector is M3
    defectReworkWithin14d: false, // fix-follow-up-on-same-hunks detector is M3
    isSelfRevert: false, // self-revert detector is M3
    hasFeatureLabel: str(r.feature_label) !== null,
  };
}

/** Map one cc_sessions row → the scoring `SessionRow`. */
function mapSession(r: SessionDbRow): SessionRow {
  const skills = Array.isArray(r.skills_used)
    ? (r.skills_used as unknown[]).filter((s): s is string => typeof s === 'string')
    : [];
  return {
    sessionId: typeof r.session_id === 'string' ? r.session_id : String(r.id),
    linkedPrId: str(r.linked_pr),
    day: dayKey(r.ts) ?? '',
    turns: num(r.turns),
    tokensIn: num(r.tokens_in),
    tokensOut: num(r.tokens_out),
    cacheRead: num(r.cache_read),
    cacheCreation: num(r.cache_creation),
    suggestionsOffered: num(r.suggestions_offered),
    suggestionsAccepted: num(r.suggestions_accepted),
    skillsUsed: skills,
    // producedOutput: a session that touched a skill or linked to a PR produced output.
    producedOutput: skills.length > 0 || str(r.linked_pr) !== null,
    // excludedFromAiRates: an unbound (employee_id null) stream is BYO/unmatched.
    excludedFromAiRates: str(r.employee_id) === null,
  };
}

/** Map one deploys row → the scoring `DeployRow`. */
function mapDeploy(r: DeployDbRow): DeployRow {
  return {
    deployId: String(r.id),
    aiAssisted: bool(r.ai_assisted),
    changeFailed: bool(r.change_failed),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// workingDays — the cadence denominator (deterministic, never fabricated)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Distinct UTC days in the 28d window on which this member showed ANY activity
 * (a PR created/merged or a session). Capped to WINDOW_DAYS. This is the honest
 * denominator for tool_session_cadence: active-days ÷ days-the-person-was-active.
 * A member with no rows yields 0 (and the cadence KPI is then null, not fabricated).
 */
function workingDaysFor(prs: PrDbRow[], sessions: SessionDbRow[]): number {
  const days = new Set<string>();
  for (const p of prs) {
    const d1 = dayKey(p.created_at);
    if (d1) days.add(d1);
    const d2 = dayKey(p.merged_at);
    if (d2) days.add(d2);
  }
  for (const s of sessions) {
    const d = dayKey(s.ts);
    if (d) days.add(d);
  }
  return Math.min(days.size, WINDOW_DAYS);
}

// ─────────────────────────────────────────────────────────────────────────────
// Active index_config → scoring config arg
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Load the active (highest-version) index_config for the function and translate it
 * into the scoring `RawIndexConfig` arg.
 *
 * IMPORTANT (config-shape mismatch, verified against migration 0021): the stored
 * `weights_jsonb` matches the scoring weights shape, but `anchors_jsonb` uses
 * NON-canonical KPI keys (e.g. `iterations_to_merge`, `suggestion_acceptance`,
 * `skill_file_leverage`) plus an `inverted` field the strict scoring schema rejects,
 * and `sizing_jsonb` is DB-shaped (`{weights,thresholds,...}`) not scoring-shaped
 * (`{modulesWeight,blastWeight,coldStart,tieBreakBand}`). Passing that raw jsonb
 * straight through would THROW in resolveScoringConfig.
 *
 * So we keep the canonical default anchors + sizing (the v1 seed IS the default), use
 * the stored weights, and stamp the stored `version` so every computed row records the
 * real config_version. When no config row exists we return undefined → cold-start
 * default. (M3 will reconcile the jsonb shapes; until then this is the faithful path.)
 */
export async function loadScoringConfig(functionId: string): Promise<RawIndexConfig | undefined> {
  const db = looseDb();
  const row = (
    await db
      .from('index_config')
      .select('version, weights_jsonb, sizing_jsonb, function_id')
      .eq('function_id', functionId)
      .order('version', { ascending: false })
      .maybeSingle()
  ).data as { version?: unknown; weights_jsonb?: unknown } | null;

  if (!row) return undefined;

  const version = num(row.version);
  const w = (row.weights_jsonb ?? {}) as Record<string, unknown>;
  const weights = {
    usage: num(w.usage ?? DEFAULT_INDEX_CONFIG.weights.usage),
    efficiency: num(w.efficiency ?? DEFAULT_INDEX_CONFIG.weights.efficiency),
    effectiveness: num(w.effectiveness ?? DEFAULT_INDEX_CONFIG.weights.effectiveness),
    proficiency: num(w.proficiency ?? DEFAULT_INDEX_CONFIG.weights.proficiency),
  };
  // Guard: if stored weights don't sum to ~1, fall back to the default weights so the
  // engine never throws on a malformed seed (assertWeightsSumToOne).
  const sum = weights.usage + weights.efficiency + weights.effectiveness + weights.proficiency;
  const safeWeights = Math.abs(sum - 1) <= 1e-6 ? weights : { ...DEFAULT_INDEX_CONFIG.weights };

  return {
    configVersion: `v${version > 0 ? version : 1}`,
    weights: safeWeights,
    // anchors omitted → scoring merges the canonical defaults (matches the v1 seed).
    sizing: {
      modulesWeight: DEFAULT_INDEX_CONFIG.sizing.modulesWeight,
      blastWeight: DEFAULT_INDEX_CONFIG.sizing.blastWeight,
      coldStart: { ...DEFAULT_INDEX_CONFIG.sizing.coldStart },
      tieBreakBand: DEFAULT_INDEX_CONFIG.sizing.tieBreakBand,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// assembleMembers — the public entry point
// ─────────────────────────────────────────────────────────────────────────────

export interface AssembledInputs {
  members: MemberRawRows[];
  sizingPrs: PrRow[];
  config: RawIndexConfig | undefined;
  /** simple counts for the pipeline log. */
  counts: {
    employees: number;
    windowPrs: number;
    sessions: number;
    deploys: number;
    blameLines: number;
    sizingPrs: number;
  };
}

/**
 * Assemble the full `computeDaily` inputs for a function on a run date. Lists active
 * employees (self ensured first), reads the windowed raw evidence, partitions it by
 * employee_id, and maps each partition into `MemberRawRows`. Function-scoped evidence
 * with no employee_id (deploys today) is attributed to the self/first member so the
 * change-failure signal isn't dropped in the single-person demo.
 */
export async function assembleMembers(functionId: string, date: string): Promise<AssembledInputs> {
  const b = boundsFor(date);
  const employees = await listActiveEmployees(functionId);

  const [prDbRows, sessionDbRows, deployDbRows, sizingDbRows] = await Promise.all([
    loadWindowPrs(functionId, b),
    loadWindowSessions(functionId, b),
    loadWindowDeploys(functionId, b),
    loadSizingPrs(functionId, b),
  ]);
  // blame is read but only used to enrich employee-level retention in M3; loaded here
  // so the counts are honest and the read columns are validated.
  const blameDbRows = await loadWindowBlame(functionId, b);

  // Partition PRs / sessions by employee_id.
  const prsByEmp = groupBy(prDbRows, (r) => str(r.employee_id));
  const sessByEmp = groupBy(sessionDbRows, (r) => str(r.employee_id));

  // Deploys carry no employee_id → attribute all to the first (self) member, so the
  // single-person demo keeps its change-failure signal. With N>1 this is revisited.
  const deployRows: DeployRow[] = deployDbRows.map(mapDeploy);
  const selfId = employees[0]?.id ?? null;

  // skills authored: NOT yet a raw table (M3 authorship capture). Empty for every
  // member today → Proficiency authorship KPIs report no signal, never fabricated.
  const skillsByEmp = (_empId: string): SkillAuthorshipRow[] => [];

  const members: MemberRawRows[] = employees.map((emp) => {
    const empPrs = prsByEmp.get(emp.id) ?? [];
    const empSessions = sessByEmp.get(emp.id) ?? [];
    return {
      meta: {
        memberId: emp.id,
        workingDays: workingDaysFor(empPrs, empSessions),
      },
      prs: empPrs.map(mapPr),
      sessions: empSessions.map(mapSession),
      deploys: selfId !== null && emp.id === selfId ? deployRows : [],
      skills: skillsByEmp(emp.id),
    };
  });

  const sizingPrs: PrRow[] = sizingDbRows.map(mapPr);
  const config = await loadScoringConfig(functionId);

  return {
    members,
    sizingPrs,
    config,
    counts: {
      employees: employees.length,
      windowPrs: prDbRows.length,
      sessions: sessionDbRows.length,
      deploys: deployDbRows.length,
      blameLines: blameDbRows.length,
      sizingPrs: sizingDbRows.length,
    },
  };
}

/** Group rows by a string key (null keys are dropped — unbound rows aren't a member). */
function groupBy<T>(items: T[], keyOf: (item: T) => string | null): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const it of items) {
    const k = keyOf(it);
    if (k === null) continue;
    const arr = out.get(k) ?? [];
    arr.push(it);
    out.set(k, arr);
  }
  return out;
}
