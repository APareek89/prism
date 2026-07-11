// lib/connectors/github/state.ts
//
// Signed `state` for the GitHub App install round-trip (multi-tenant). The initiator
// signs the initiating org's function id into `state`; GitHub echoes it back on the
// install callback, and we verify it to attribute the installation to the RIGHT tenant
// deterministically — not just via whatever session the redirect happens to carry.
//
// PURE (HMAC only) so it's unit-testable; the route supplies the secret.

import { createHmac, timingSafeEqual } from 'node:crypto';

/** `<functionId>.<hmac>` — url-safe (uuid + hex). */
export function signState(functionId: string, secret: string): string {
  const mac = createHmac('sha256', secret).update(functionId).digest('hex');
  return `${functionId}.${mac}`;
}

/** Recover the function id from a signed state, or null if missing/tampered/wrong-secret. */
export function verifyState(state: string | null, secret: string): string | null {
  if (!state) return null;
  const i = state.lastIndexOf('.');
  if (i <= 0) return null;
  const functionId = state.slice(0, i);
  const mac = state.slice(i + 1);
  const expected = createHmac('sha256', secret).update(functionId).digest('hex');
  try {
    if (mac.length === expected.length && timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) {
      return functionId;
    }
  } catch {
    /* length mismatch → invalid */
  }
  return null;
}
