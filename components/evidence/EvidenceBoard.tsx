'use client';

// EvidenceBoard — a per-case gallery of typed evidence items, grouped
// by artifact_type. Each item has an anchor (id="evidence-<id>") so
// trace links and IOC scores can jump to it. Top bar filters by
// artifact type so 20+ items stay scannable.

import { useMemo, useState } from 'react';
import type { EvidenceItem, IocRubric } from '@/lib/types';

const TYPE_TONE: Record<string, string> = {
  screenshot: 'text-accent-violet border-accent-violet/30',
  hook_log: 'text-accent-green border-accent-green/30',
  network_capture: 'text-accent-blue border-accent-blue/30',
  logcat: 'text-accent-amber border-accent-amber/30',
  geo_matrix: 'text-accent-amber border-accent-amber/30',
  runtime_trace: 'text-accent-green border-accent-green/30',
  static_report: 'text-ink-secondary border-ink-muted/30',
  apk: 'text-ink-secondary border-ink-muted/30',
};

export function EvidenceBoard({
  items,
  rubric,
}: {
  items: EvidenceItem[];
  rubric: IocRubric;
}) {
  const [typeFilter, setTypeFilter] = useState<'all' | string>('all');

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length };
    for (const ev of items) c[ev.type] = (c[ev.type] ?? 0) + 1;
    return c;
  }, [items]);

  if (!items.length) {
    return <div className="text-xs text-ink-muted">No evidence collected yet.</div>;
  }

  // Group by type, after filter
  const filtered = typeFilter === 'all' ? items : items.filter(ev => ev.type === typeFilter);
  const groups = filtered.reduce<Record<string, EvidenceItem[]>>((acc, ev) => {
    (acc[ev.type] ??= []).push(ev);
    return acc;
  }, {});

  const filterKeys = ['all', ...Object.keys(counts).filter(k => k !== 'all')];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1">
        {filterKeys.map(k => (
          <button
            key={k}
            onClick={() => setTypeFilter(k)}
            className={`px-2.5 py-1 text-[10px] tracking-widest rounded border ${
              typeFilter === k
                ? 'border-accent-green/40 bg-accent-green/10 text-accent-green'
                : 'border-ink-muted/30 bg-bg-card text-ink-secondary hover:text-ink-primary'
            }`}
          >
            {k === 'all' ? 'ALL' : k.replace(/_/g, ' ').toUpperCase()}
            <span className="text-ink-muted ml-1">{counts[k] ?? 0}</span>
          </button>
        ))}
      </div>
      {Object.entries(groups).map(([type, group]) => (
        <div key={type}>
          <div className="flex items-baseline justify-between mb-2">
            <span className={`text-[10px] tracking-widest font-mono ${TYPE_TONE[type]?.split(' ')[0] ?? ''}`}>
              {type.replace(/_/g, ' ').toUpperCase()}
            </span>
            <span className="text-[10px] text-ink-muted">{group.length} item{group.length === 1 ? '' : 's'}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {group.map(ev => (
              <article
                key={ev.evidence_id}
                id={`evidence-${ev.evidence_id}`}
                className={`card p-3 border ${TYPE_TONE[ev.type] ?? 'border-ink-muted/20'}`}
              >
                <div className="flex items-baseline justify-between mb-2">
                  <span className={`text-[10px] tracking-widest ${TYPE_TONE[ev.type]?.split(' ')[0] ?? ''}`}>
                    {ev.type.replace(/_/g, ' ').toUpperCase()}
                  </span>
                  <span className="text-[10px] text-ink-muted font-mono">{ev.evidence_id}</span>
                </div>
                <div className="text-sm font-semibold mb-1">{ev.title}</div>
                <p className="text-xs text-ink-secondary leading-relaxed">{ev.description}</p>
                <div className="mt-3 pt-2 border-t border-edge/40 flex items-center justify-between text-[10px]">
                  <div className="flex flex-wrap gap-1 flex-1">
                    {ev.ioc_ids.map(id => {
                      const ioc = rubric.iocs.find(i => i.ioc_id === id);
                      return (
                        <span
                          key={id}
                          className="px-1.5 py-0.5 tracking-widest border border-ink-muted/30 rounded bg-bg-base text-ink-secondary"
                        >
                          {ioc?.name ?? id}
                        </span>
                      );
                    })}
                  </div>
                  <span className="text-ink-muted ml-2">conf {(ev.confidence * 100).toFixed(0)}%</span>
                </div>
                <div className="mt-2 text-[10px] font-mono text-ink-muted break-all">
                  {ev.artifact.path}
                </div>
              </article>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
