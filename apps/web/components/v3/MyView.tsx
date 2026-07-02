'use client';

// My View — three sub-tabs:
//   1 Index         — score + both indexes + insights. NO actions here.
//   2 Live coaching — SIMULATED replay of seeded v3.coaching_events on a timer.
//   3 Growth        — courses + improvement areas + real v3.user_context writes.

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CoachingEventRow, IndexDailyRow, InsightRow, RecommendationRow, UserContextRow } from '@prism/contract';
import { IndexHero, InsightList, RecList } from './detail';
import { CoachingReplay } from './CoachingReplay';
import { GrowthTab, type Area, type CourseVM } from './GrowthTab';

interface Props {
  pin: { version: number; date: string | null };
  dev: { id: string; handle: string; name: string; archetype: string };
  devOptions: Array<{ handle: string; name: string }>;
  main: IndexDailyRow | null;
  harness: IndexDailyRow | null;
  insights: InsightRow[];
  recommendations: RecommendationRow[];
  coaching: CoachingEventRow[];
  courses: CourseVM[];
  areas: Area[];
  userContext: UserContextRow[];
}

const TABS = ['Index', 'Live coaching', 'Growth'] as const;

export function MyView(p: Props) {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Index');
  const router = useRouter();
  const nudgeRecs = useMemo(
    () => p.recommendations.filter((r) => r.channel === 'nudge' || r.channel === 'rec'),
    [p.recommendations],
  );

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
        <h1 className="v3-h1">My View — {p.dev.name}</h1>
        <select
          className="v3-select"
          value={p.dev.handle}
          onChange={(e) => router.push(`/v3/me?dev=${e.target.value}`)}
          aria-label="Switch developer (demo)"
        >
          {p.devOptions.map((d) => (
            <option key={d.handle} value={d.handle}>{d.name} (@{d.handle})</option>
          ))}
        </select>
      </div>
      <p className="v3-sub">
        archetype: {p.dev.archetype.replaceAll('_', ' ')} · config v{p.pin.version}, as-of {p.pin.date ?? '—'} ·
        the switcher exists because this is a demo — in production you only ever see yourself.
      </p>

      <div className="v3-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Index' ? (
        <>
          <IndexHero main={p.main} harness={p.harness} />
          <div style={{ height: 18 }} />
          <InsightList
            insights={p.insights}
            title="Your insights"
            hint="read-only here — actions live in Live coaching (in-flow) and Growth (self-driven)"
          />
        </>
      ) : null}

      {tab === 'Live coaching' ? (
        <>
          <CoachingReplay events={p.coaching} />
          <RecList recs={nudgeRecs} title="Open recommendations tied to your coaching" />
        </>
      ) : null}

      {tab === 'Growth' ? (
        <GrowthTab
          developerId={p.dev.id}
          courses={p.courses}
          areas={p.areas}
          userContext={p.userContext}
        />
      ) : null}
    </>
  );
}
