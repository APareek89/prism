'use client';

// Growth tab: (A) embedded-course grid with generated CSS/SVG thumbnails,
// (B) improvement areas derived from confirmed-hypothesis insights,
// (C) "Mark complete / I adopted this" → REAL insert into v3.user_context
//     (optimistic UI) + the "what's driving improvement" strip fed from it.

import { useMemo, useState } from 'react';
import type { UserContextRow } from '@prism/contract';

export interface CourseVM {
  id: string;
  title: string;
  minutes: number;
  level: string;
  blurb: string;
  targets: string[];
  hue: number;
  recommended: boolean;
}

export interface Area {
  key: string;      // `${kpi_id}/${hypothesis}` — the user_context ref
  title: string;
  body: string;
  kpiId: string;
  courseIds: string[];
}

interface Props {
  developerId: string;
  courses: CourseVM[];
  areas: Area[];
  userContext: UserContextRow[];
}

export function GrowthTab({ developerId, courses, areas, userContext }: Props) {
  // Optimistic completion state seeded from the real table.
  const [done, setDone] = useState<Set<string>>(
    () => new Set(userContext.map((u) => `${u.kind}:${u.ref}`)),
  );
  const [pending, setPending] = useState<Set<string>>(new Set());

  const record = async (kind: 'course_completed' | 'adopted', ref: string, label: string) => {
    const key = `${kind}:${ref}`;
    if (done.has(key) || pending.has(key)) return;
    setPending((s) => new Set(s).add(key));
    setDone((s) => new Set(s).add(key));               // optimistic
    try {
      const res = await fetch('/api/v3/user-context', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ developerId, kind, ref, meta: { label } }),
      });
      if (!res.ok) throw new Error(await res.text());
    } catch {
      setDone((s) => { const n = new Set(s); n.delete(key); return n; });   // roll back
    } finally {
      setPending((s) => { const n = new Set(s); n.delete(key); return n; });
    }
  };

  const drivingItems = useMemo(() => {
    const labels: string[] = [];
    for (const key of done) {
      const [kind, ...refParts] = key.split(':');
      const ref = refParts.join(':');
      if (kind === 'course_completed') {
        const c = courses.find((x) => x.id === ref);
        if (c) labels.push(`✓ completed: ${c.title}`);
      } else {
        const a = areas.find((x) => x.key === ref);
        if (a) labels.push(`✓ adopted: ${a.title}`);
      }
    }
    return labels;
  }, [done, courses, areas]);

  return (
    <>
      {/* (C) the management-facing evidence strip — fed from v3.user_context */}
      <div className="v3-panel">
        <h2>What&apos;s driving your improvement <span className="hint">real rows in v3.user_context — re-verified from data in 14 days, never self-reported alone</span></h2>
        {drivingItems.length === 0
          ? <div className="v3-empty">Nothing recorded yet — complete a course or adopt an improvement below and it lands here (and in the management view).</div>
          : <div className="v3-driving">{drivingItems.map((l) => <span className="item" key={l}>{l}</span>)}</div>}
      </div>

      {/* (B) improvement areas from confirmed-hypothesis insights */}
      <div className="v3-panel">
        <h2>Improvement areas for self-learning <span className="hint">derived from YOUR confirmed hypotheses — not generic advice</span></h2>
        {areas.length === 0 ? <div className="v3-empty">No actionable areas — every hypothesis test came back clean.</div> : null}
        {areas.map((a) => {
          const key = `adopted:${a.key}`;
          const isDone = done.has(key);
          return (
            <div className="v3-insight ch-rec" key={a.key}>
              <div className="t">{a.title}<span className="v3-chip" style={{ marginLeft: 8 }}>{a.kpiId.replaceAll('_', ' ')}</span></div>
              <div className="b">{a.body}</div>
              <div style={{ marginTop: 9 }}>
                <button
                  className={`v3-btn ${isDone ? 'done' : ''}`}
                  disabled={pending.has(key)}
                  onClick={() => record('adopted', a.key, a.title)}
                >
                  {isDone ? '✓ Adopted — tracked' : 'I adopted this'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* (A) embedded course grid — generated CSS thumbnails, no external images */}
      <div className="v3-panel">
        <h2>Courses <span className="hint">recommended first, matched to your weak KPIs · thumbnails generated, no external images</span></h2>
        <div className="v3-courses">
          {courses.map((c) => {
            const key = `course_completed:${c.id}`;
            const isDone = done.has(key);
            return (
              <div className="v3-course" key={c.id}>
                <div className="thumb" style={{ background: `linear-gradient(135deg, hsl(${c.hue} 65% 38%), hsl(${(c.hue + 40) % 360} 70% 22%))` }}>
                  <svg viewBox="0 0 100 40" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.5 }} aria-hidden>
                    <polyline
                      points={`0,${34 - (c.hue % 9)} 20,${26 + (c.hue % 7)} 40,${18 - (c.hue % 5) + 8} 60,${22 - (c.hue % 8)} 80,${12 + (c.hue % 6)} 100,8`}
                      fill="none" stroke="white" strokeWidth="1.6"
                    />
                    <circle cx={80} cy={12 + (c.hue % 6)} r="2.4" fill="white" />
                  </svg>
                  <span className="badge">{c.minutes} min · {c.level}</span>
                  {c.recommended ? <span className="badge" style={{ left: 'auto', right: 10, background: 'rgba(62,207,142,0.35)' }}>recommended</span> : null}
                </div>
                <div className="body">
                  <div className="t">{c.title}</div>
                  <div className="b">{c.blurb}</div>
                  <button
                    className={`v3-btn ${isDone ? 'done' : ''}`}
                    disabled={pending.has(key)}
                    onClick={() => record('course_completed', c.id, c.title)}
                  >
                    {isDone ? '✓ Completed' : 'Mark complete'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
