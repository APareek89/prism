'use client';

// My View — three sub-tabs in the app's own segmented-control treatment (.seg):
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
  const actionRecs = useMemo(
    () => p.recommendations.filter((r) => r.channel === 'nudge' || r.channel === 'rec'),
    [p.recommendations],
  );

  return (
    <>
      <div className="daterow" style={{ marginBottom: 4 }}>
        <nav className="seg" role="tablist" aria-label="My View tabs">
          {TABS.map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </nav>
        <span className="pill">
          demo switcher: <b>@{p.dev.handle}</b> — in production you only ever see yourself
        </span>
        <select
          className="linkbtn"
          style={{ background: 'var(--panel)' }}
          value={p.dev.handle}
          onChange={(e) => router.push(`/v3/me?dev=${e.target.value}`)}
          aria-label="Switch developer (demo)"
        >
          {p.devOptions.map((d) => (
            <option key={d.handle} value={d.handle}>{d.name} (@{d.handle})</option>
          ))}
        </select>
      </div>

      {tab === 'Index' ? (
        <>
          <IndexHero main={p.main} harness={p.harness} />
          <InsightList
            insights={p.insights}
            title="Your insights"
            sub="read-only — actions live in Live coaching (in-flow) and Growth (self-driven)"
          />
        </>
      ) : null}

      {tab === 'Live coaching' ? (
        <>
          <CoachingReplay events={p.coaching} />
          <RecList recs={actionRecs} title="Open recommendations tied to your coaching" />
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
