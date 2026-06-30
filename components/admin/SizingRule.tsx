// components/admin/SizingRule.tsx
//
// The PR-sizing-rule card body (Admin) — deterministic, no LLM on the core path.
// Faithful port of the design: a prose paragraph carrying the size_score `formula`
// (bolded in mono), a row of frozen-tertile `.szbadge` threshold chips, and the
// "size only groups like-with-like" footnote. Values are real SizingRuleDTO fields;
// the `frozen` flag drives the "frozen tertiles" wording.
//
// Server Component (pure presentation).

import type { SizingRuleDTO } from '@/lib/ui/view-models';
import { SIZING_WINDOW_DAYS } from '@/lib/config/constants';

export interface SizingRuleProps {
  rule: SizingRuleDTO;
}

export function SizingRule({ rule }: SizingRuleProps) {
  return (
    <>
      <p style={{ fontSize: 12.5, color: 'var(--mut)', lineHeight: 1.6 }}>
        After dropping ignore-globs (lockfiles, generated, vendored), size_score ={' '}
        <b style={{ color: 'var(--ink)', fontFamily: 'var(--mono)' }}>{rule.formula}</b>. Buckets are{' '}
        {rule.frozen ? 'frozen' : 'rolling'} tertiles of the repo&rsquo;s trailing{' '}
        {SIZING_WINDOW_DAYS}-day PRs.
      </p>
      <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
        {rule.thresholds.map((t) => (
          <span className="szbadge" key={t}>
            {t}
          </span>
        ))}
      </div>
      <p style={{ fontSize: 11.5, color: 'var(--mut2)', marginTop: 12 }}>
        Size only groups like-with-like for fair comparison — it is never rewarded.
      </p>
    </>
  );
}
