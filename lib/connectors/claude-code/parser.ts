// lib/connectors/claude-code/parser.ts
//
// PURE parser for ONE Claude Code session .jsonl file (Landmine #1). It never does
// I/O, never reads a clock, and NEVER throws on a malformed line — bad lines are
// skipped. The real on-disk format (verified against ~/.claude):
//
//   - per-session file: ~/.claude/projects/<encoded-cwd>/<sessionId>.jsonl
//   - each line is one JSON event with a top-level `type`
//       (assistant | user | system | progress | queue-operation | ...)
//   - assistant lines carry message.usage {input_tokens, output_tokens,
//       cache_read_input_tokens, cache_creation_input_tokens} and message.model
//   - top-level `cwd` (repo) + `gitBranch` (branch) + `timestamp` (ISO Z) + `sessionId`
//   - NO top-level account_uuid
//   - Skill usage shows up as an assistant tool_use block named "Skill" with
//       input.skill (the skill name)
//
// IMPORTANT: a single .jsonl can span MULTIPLE cwds (the user `cd`s mid-session).
// Sessions are keyed by (sessionId, repo) per migration 0008, so this parser
// returns ONE RawSession PER (sessionId, repo) group it observes — usually one,
// but more when a file touched several repos.

import { deriveCostUsd } from './pricing';
import { makeSessionKey } from './byo';

/** One ingest-ready Claude Code session, aligned to cc_sessions columns. The
 *  connector's session-map.ts maps these onto the table (adding function_id /
 *  employee_id / ingested_at). repo+sessionId is the dedup key. */
export interface RawSession {
  sessionId: string;
  /** derived from cwd (the working dir at the time of the events). */
  repo: string;
  /** derived from gitBranch (may be null / 'HEAD' / a branch name). */
  branch: string | null;
  /** earliest event timestamp seen for this (session, repo) — ISO string. */
  ts: string | null;
  /** assistant turns (iteration proxy). */
  turns: number;
  tokensIn: number;
  tokensOut: number;
  cacheRead: number;
  cacheCreation: number;
  /** derived from the per-model rate card (the .jsonl never carries cost). */
  costUsd: number;
  /** dominant model id observed (most-recent non-synthetic), or null. */
  model: string | null;
  /** present in some clients; 0 when absent (never fabricated). */
  suggestionsOffered: number;
  suggestionsAccepted: number;
  /** distinct Skill tool-use names invoked in this (session, repo). */
  skillsUsed: string[];
  /** mean user-prompt character length (null when no human prompts seen). */
  promptLenAvg: number | null;
}

/** Loose shape of one decoded .jsonl line. Everything optional — we validate
 *  defensively because real logs carry dozens of event variants. */
interface RawEvent {
  type?: string;
  sessionId?: string;
  cwd?: string;
  gitBranch?: string | null;
  timestamp?: string;
  userType?: string;
  isMeta?: boolean;
  isSidechain?: boolean;
  message?: {
    role?: string;
    model?: string;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
    };
    content?: unknown;
  };
}

/** A per-(session,repo) accumulator while folding events. */
interface Acc {
  sessionId: string;
  repo: string;
  branch: string | null;
  ts: string | null;
  turns: number;
  tokensIn: number;
  tokensOut: number;
  cacheRead: number;
  cacheCreation: number;
  model: string | null;
  suggestionsOffered: number;
  suggestionsAccepted: number;
  skills: Set<string>;
  promptLenSum: number;
  promptCount: number;
}

/** Normalize a non-finite/absent number to 0. */
function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

/** Keep the EARLIER of two ISO timestamps (string compare is valid for ISO-Z). */
function earlier(a: string | null, b: string | undefined): string | null {
  if (!b) return a;
  if (!a) return b;
  return b < a ? b : a;
}

/**
 * Extract human-prompt text length from a `user` event's content. Content is
 * either a string or an array of blocks; we only count `text` blocks authored by
 * the human (tool_result / image blocks are not prompts).
 */
function userPromptLen(content: unknown): number | null {
  if (typeof content === 'string') {
    const t = content.trim();
    return t.length > 0 ? t.length : null;
  }
  if (Array.isArray(content)) {
    let len = 0;
    let sawText = false;
    for (const block of content) {
      if (block && typeof block === 'object' && (block as { type?: string }).type === 'text') {
        const txt = (block as { text?: unknown }).text;
        if (typeof txt === 'string') {
          len += txt.length;
          sawText = true;
        }
      }
    }
    return sawText ? len : null;
  }
  return null;
}

/** Pull distinct Skill names from an assistant content array. */
function scanAssistantContent(content: unknown, acc: Acc): void {
  if (!Array.isArray(content)) return;
  for (const block of content) {
    if (!block || typeof block !== 'object') continue;
    const b = block as { type?: string; name?: string; input?: Record<string, unknown> };
    if (b.type !== 'tool_use') continue;
    const name = typeof b.name === 'string' ? b.name : '';
    const input = b.input && typeof b.input === 'object' ? b.input : {};
    // Skill invocations: tool name "Skill" with input.skill (the skill id).
    if (name === 'Skill') {
      const skill = input['skill'] ?? input['command'];
      if (typeof skill === 'string' && skill.length > 0) acc.skills.add(skill);
    }
  }
}

/** A model id we should keep as the session's model (skip synthetic placeholders). */
function isRealModel(model: string | undefined): model is string {
  return typeof model === 'string' && model.length > 0 && !model.toLowerCase().includes('synthetic');
}

/** True when a folded accumulator carries no scoreable evidence at all. */
function accIsEmpty(a: Acc): boolean {
  return (
    a.turns === 0 &&
    a.tokensIn === 0 &&
    a.tokensOut === 0 &&
    a.cacheRead === 0 &&
    a.cacheCreation === 0 &&
    a.promptCount === 0 &&
    a.skills.size === 0
  );
}

/**
 * Parse the full text of ONE .jsonl session file into 1+ RawSessions, one per
 * (sessionId, repo) group. `fallbackSessionId` is the filename stem (the file is
 * named <sessionId>.jsonl) used when a line omits sessionId. `fallbackRepo` is
 * the decoded project dir, used when a line omits cwd. NEVER throws.
 */
export function parseSessionFile(
  text: string,
  opts: { fallbackSessionId: string; fallbackRepo: string },
): RawSession[] {
  const groups = new Map<string, Acc>();

  const lines = text.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let ev: RawEvent;
    try {
      ev = JSON.parse(trimmed) as RawEvent;
    } catch {
      continue; // malformed line — skip, never throw.
    }
    if (!ev || typeof ev !== 'object') continue;

    // Only substantive turns (assistant/user) carry the evidence we score, and they
    // always carry a top-level cwd in this format. Book-keeping events
    // (queue-operation, last-prompt, mode, progress, system, ...) are skipped so a
    // cwd-less control line never spawns a phantom (sessionId, fallbackRepo) group.
    if (ev.type !== 'assistant' && ev.type !== 'user') continue;

    const sessionId = ev.sessionId || opts.fallbackSessionId;
    const repo = ev.cwd || opts.fallbackRepo;
    const key = makeSessionKey(sessionId, repo);

    let acc = groups.get(key);
    if (!acc) {
      acc = {
        sessionId,
        repo,
        branch: null,
        ts: null,
        turns: 0,
        tokensIn: 0,
        tokensOut: 0,
        cacheRead: 0,
        cacheCreation: 0,
        model: null,
        suggestionsOffered: 0,
        suggestionsAccepted: 0,
        skills: new Set<string>(),
        promptLenSum: 0,
        promptCount: 0,
      };
      groups.set(key, acc);
    }

    // Timestamp: keep the earliest event time as the session ts.
    acc.ts = earlier(acc.ts, ev.timestamp);
    // Branch: first non-null gitBranch wins (HEAD is a valid value here).
    if (acc.branch === null && ev.gitBranch != null) acc.branch = ev.gitBranch;

    const msg = ev.message;

    if (ev.type === 'assistant') {
      // Count a real assistant turn (skip sidechain/meta book-keeping rows).
      if (!ev.isSidechain && !ev.isMeta) acc.turns += 1;
      if (msg) {
        if (isRealModel(msg.model)) acc.model = msg.model;
        const u = msg.usage;
        if (u) {
          acc.tokensIn += num(u.input_tokens);
          acc.tokensOut += num(u.output_tokens);
          acc.cacheRead += num(u.cache_read_input_tokens);
          acc.cacheCreation += num(u.cache_creation_input_tokens);
        }
        scanAssistantContent(msg.content, acc);
      }
    } else {
      // user: count genuine human prompts (not tool results / meta).
      if (!ev.isMeta && ev.userType !== 'tool' && msg) {
        const len = userPromptLen(msg.content);
        if (len !== null) {
          acc.promptLenSum += len;
          acc.promptCount += 1;
        }
      }
    }
  }

  const out: RawSession[] = [];
  for (const acc of groups.values()) {
    // Never emit a session with zero evidence (no fabricated rows).
    if (accIsEmpty(acc)) continue;
    const costUsd = deriveCostUsd(acc.model, {
      tokensIn: acc.tokensIn,
      tokensOut: acc.tokensOut,
      cacheRead: acc.cacheRead,
      cacheCreation: acc.cacheCreation,
    });
    out.push({
      sessionId: acc.sessionId,
      repo: acc.repo,
      branch: acc.branch,
      ts: acc.ts,
      turns: acc.turns,
      tokensIn: acc.tokensIn,
      tokensOut: acc.tokensOut,
      cacheRead: acc.cacheRead,
      cacheCreation: acc.cacheCreation,
      costUsd,
      model: acc.model,
      suggestionsOffered: acc.suggestionsOffered,
      suggestionsAccepted: acc.suggestionsAccepted,
      skillsUsed: Array.from(acc.skills).sort(),
      promptLenAvg:
        acc.promptCount > 0 ? Math.round((acc.promptLenSum / acc.promptCount) * 100) / 100 : null,
    });
  }
  return out;
}
