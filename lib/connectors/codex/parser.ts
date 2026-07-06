// lib/connectors/codex/parser.ts
//
// PURE parser for ONE OpenAI Codex CLI rollout .jsonl file. Mirrors the Claude Code
// parser's contract exactly: no I/O, no clock, NEVER throws — malformed lines are
// skipped, and a session with zero evidence is never emitted (no fabricated rows).
//
// The on-disk format (Codex CLI "rollout" files, ~/.codex/sessions/YYYY/MM/DD/
// rollout-<ts>-<uuid>.jsonl). Each line is {timestamp, type, payload}:
//
//   - session_meta    payload.id (the session id) · payload.cwd · payload.timestamp
//                     · payload.git {branch, repository_url, commit_hash}
//   - turn_context    payload.cwd · payload.model  (emitted per turn; cwd/model can
//                     change mid-file)
//   - response_item   payload.type='message' · payload.role 'user'|'assistant' ·
//                     payload.content [{type:'input_text'|'output_text'|'text', text}]
//   - event_msg       payload.type='token_count' · payload.info
//                     {total_token_usage, last_token_usage} where each carries
//                     {input_tokens, cached_input_tokens, output_tokens}
//
// ⚠ FORMAT ASSUMPTIONS TO VERIFY ON REAL LOGS (H0 discipline — the parser is
// defensive either way; wrong assumptions yield honest under-counts, never invented
// numbers):
//   1. token accounting: per-turn `last_token_usage` is preferred and summed;
//      cumulative `total_token_usage` is the fallback (max observed wins).
//   2. Codex `input_tokens` INCLUDES `cached_input_tokens`, so tokens_in is stored
//      as (input − cached) with cacheRead = cached — mirroring Claude semantics
//      where tokens_in excludes cache reads.
//   3. Codex emits NO first-party pr-link event and no Skill tool: prRefs/skills
//      stay empty, so AI→PR linking rides the weaker branch/sha/coauthor methods.
//
// Cost: there is no Codex rate card in Prism — costUsd is 0, never estimated
// (tokens-only is the product rule anyway; USD is dropped in model v3.0).

import type { RawSession } from '@/lib/connectors/claude-code/parser';
import { makeSessionKey } from '@/lib/connectors/claude-code/byo';

/** Loose shape of one decoded rollout line. Everything optional — validated
 *  defensively because the format evolves across Codex CLI versions. */
interface RolloutLine {
  timestamp?: string;
  type?: string;
  payload?: {
    // session_meta
    id?: string;
    timestamp?: string;
    cwd?: string;
    git?: { branch?: string | null; repository_url?: string; commit_hash?: string };
    // turn_context
    model?: string;
    // response_item
    type?: string;
    role?: string;
    content?: unknown;
    // event_msg (token_count)
    info?: {
      total_token_usage?: TokenUsage;
      last_token_usage?: TokenUsage;
    };
  };
}

interface TokenUsage {
  input_tokens?: number;
  cached_input_tokens?: number;
  output_tokens?: number;
}

/** A per-(session,repo) accumulator while folding lines. */
interface Acc {
  sessionId: string;
  repo: string;
  branch: string | null;
  ts: string | null;
  turns: number;
  /** summed per-turn usage (preferred). */
  sumIn: number;
  sumCached: number;
  sumOut: number;
  /** max cumulative usage seen (fallback when no per-turn events exist). */
  maxTotalIn: number;
  maxTotalCached: number;
  maxTotalOut: number;
  sawLast: boolean;
  model: string | null;
  promptLenSum: number;
  promptCount: number;
}

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0;
}

/** Keep the EARLIER of two ISO timestamps (string compare is valid for ISO-Z). */
function earlier(a: string | null, b: string | undefined): string | null {
  if (!b) return a;
  if (!a) return b;
  return b < a ? b : a;
}

/** Sum the text length of user-authored input blocks (string or block-array). */
function userPromptLen(content: unknown): number | null {
  if (typeof content === 'string') {
    const t = content.trim();
    return t.length > 0 ? t.length : null;
  }
  if (!Array.isArray(content)) return null;
  let len = 0;
  let sawText = false;
  for (const block of content) {
    if (!block || typeof block !== 'object') continue;
    const b = block as { type?: string; text?: unknown };
    if ((b.type === 'input_text' || b.type === 'text') && typeof b.text === 'string') {
      len += b.text.length;
      sawText = true;
    }
  }
  return sawText ? len : null;
}

/** True when a folded accumulator carries no scoreable evidence at all. */
function accIsEmpty(a: Acc): boolean {
  return (
    a.turns === 0 &&
    a.sumIn === 0 &&
    a.sumOut === 0 &&
    a.maxTotalIn === 0 &&
    a.maxTotalOut === 0 &&
    a.promptCount === 0
  );
}

/**
 * Parse the full text of ONE Codex rollout .jsonl into 0+ RawSessions, one per
 * (sessionId, repo) group — a session can `cd` between repos mid-file, exactly like
 * the Claude parser. `fallbackSessionId` is the filename stem; `fallbackRepo` is
 * used only until a cwd is observed. NEVER throws.
 */
export function parseCodexRollout(
  text: string,
  opts: { fallbackSessionId: string; fallbackRepo: string },
): RawSession[] {
  const groups = new Map<string, Acc>();

  // File-level fold state: rollout lines are ordered, and cwd/model/branch arrive on
  // meta/context lines while evidence (messages, token counts) arrives on later lines
  // that carry NO cwd — so we track the CURRENT session/cwd and attribute evidence
  // to it, mirroring how the file was actually produced.
  let sessionId = opts.fallbackSessionId;
  let cwd = opts.fallbackRepo;
  let branch: string | null = null;

  function group(): Acc {
    const key = makeSessionKey(sessionId, cwd);
    let acc = groups.get(key);
    if (!acc) {
      acc = {
        sessionId,
        repo: cwd,
        branch,
        ts: null,
        turns: 0,
        sumIn: 0,
        sumCached: 0,
        sumOut: 0,
        maxTotalIn: 0,
        maxTotalCached: 0,
        maxTotalOut: 0,
        sawLast: false,
        model: null,
        promptLenSum: 0,
        promptCount: 0,
      };
      groups.set(key, acc);
    }
    return acc;
  }

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let ev: RolloutLine;
    try {
      ev = JSON.parse(trimmed) as RolloutLine;
    } catch {
      continue; // malformed line — skip, never throw.
    }
    if (!ev || typeof ev !== 'object') continue;
    const p = ev.payload;

    if (ev.type === 'session_meta' && p) {
      if (typeof p.id === 'string' && p.id.length > 0) sessionId = p.id;
      if (typeof p.cwd === 'string' && p.cwd.length > 0) cwd = p.cwd;
      if (p.git && typeof p.git.branch === 'string' && p.git.branch.length > 0) {
        branch = p.git.branch;
      }
      const acc = group();
      acc.ts = earlier(acc.ts, p.timestamp ?? ev.timestamp);
      if (acc.branch === null && branch !== null) acc.branch = branch;
      continue;
    }

    if (ev.type === 'turn_context' && p) {
      if (typeof p.cwd === 'string' && p.cwd.length > 0) cwd = p.cwd;
      const acc = group();
      acc.ts = earlier(acc.ts, ev.timestamp);
      if (acc.branch === null && branch !== null) acc.branch = branch;
      if (typeof p.model === 'string' && p.model.length > 0) acc.model = p.model;
      continue;
    }

    if (ev.type === 'response_item' && p && p.type === 'message') {
      const acc = group();
      acc.ts = earlier(acc.ts, ev.timestamp);
      if (p.role === 'assistant') {
        acc.turns += 1;
      } else if (p.role === 'user') {
        const len = userPromptLen(p.content);
        if (len !== null) {
          acc.promptLenSum += len;
          acc.promptCount += 1;
        }
      }
      continue;
    }

    if (ev.type === 'event_msg' && p && p.type === 'token_count') {
      const acc = group();
      acc.ts = earlier(acc.ts, ev.timestamp);
      const last = p.info?.last_token_usage;
      const total = p.info?.total_token_usage;
      if (last) {
        acc.sawLast = true;
        acc.sumIn += num(last.input_tokens);
        acc.sumCached += num(last.cached_input_tokens);
        acc.sumOut += num(last.output_tokens);
      }
      if (total) {
        acc.maxTotalIn = Math.max(acc.maxTotalIn, num(total.input_tokens));
        acc.maxTotalCached = Math.max(acc.maxTotalCached, num(total.cached_input_tokens));
        acc.maxTotalOut = Math.max(acc.maxTotalOut, num(total.output_tokens));
      }
      continue;
    }
  }

  const out: RawSession[] = [];
  for (const acc of groups.values()) {
    if (accIsEmpty(acc)) continue;
    // Prefer summed per-turn usage; fall back to the max cumulative totals.
    const grossIn = acc.sawLast ? acc.sumIn : acc.maxTotalIn;
    const cached = acc.sawLast ? acc.sumCached : acc.maxTotalCached;
    const tokensOut = acc.sawLast ? acc.sumOut : acc.maxTotalOut;
    // Assumption #2 (header): Codex input_tokens include cached — split them out so
    // tokens_in matches Claude semantics (cache reads excluded, reported separately).
    const tokensIn = Math.max(grossIn - cached, 0);
    out.push({
      sessionId: acc.sessionId,
      repo: acc.repo,
      branch: acc.branch,
      ts: acc.ts,
      turns: acc.turns,
      tokensIn,
      tokensOut,
      cacheRead: cached,
      cacheCreation: 0, // not reported by Codex token counts.
      costUsd: 0, // no Codex rate card — tokens only, never estimated.
      model: acc.model,
      suggestionsOffered: 0,
      suggestionsAccepted: 0,
      skillsUsed: [],
      promptLenAvg:
        acc.promptCount > 0 ? Math.round((acc.promptLenSum / acc.promptCount) * 100) / 100 : null,
      prRefs: [], // no first-party pr-link event in Codex (header assumption #3).
    });
  }
  return out;
}
