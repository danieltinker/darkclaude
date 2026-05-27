// LogViewer — renders synthesized runtime logs with insight annotations.
// Tabs: network (HTTP Toolkit-like), logcat (Android logs), hooks (Frida).
// Each row can carry an "insight" annotation that points to a rubric IOC.

'use client';
import { useMemo, useState } from 'react';

export type LogRow = {
  ts: string;
  channel: 'network' | 'logcat' | 'hook';
  level?: 'info' | 'warn' | 'error';
  text: string;
  insight?: { ioc_id: string; severity: 'low' | 'medium' | 'high'; note: string };
};

type Props = {
  rows: LogRow[];
};

const CHANNEL_COLORS = {
  network: 'text-accent-blue',
  logcat: 'text-accent-amber',
  hook: 'text-accent-green',
} as const;

const LEVEL_COLORS = {
  info: 'text-ink-secondary',
  warn: 'text-accent-amber',
  error: 'text-accent-red',
} as const;

const SEVERITY_COLORS = {
  low: 'border-ink-muted/30 bg-bg-card text-ink-secondary',
  medium: 'border-accent-amber/40 bg-accent-amber/10 text-accent-amber',
  high: 'border-accent-red/40 bg-accent-red/10 text-accent-red',
} as const;

export function LogViewer({ rows }: Props) {
  const [filter, setFilter] = useState<'all' | 'network' | 'logcat' | 'hook' | 'insights'>('all');

  const filtered = useMemo(() => {
    if (filter === 'all') return rows;
    if (filter === 'insights') return rows.filter(r => r.insight);
    return rows.filter(r => r.channel === filter);
  }, [rows, filter]);

  const counts = useMemo(() => ({
    all: rows.length,
    network: rows.filter(r => r.channel === 'network').length,
    logcat: rows.filter(r => r.channel === 'logcat').length,
    hook: rows.filter(r => r.channel === 'hook').length,
    insights: rows.filter(r => !!r.insight).length,
  }), [rows]);

  return (
    <div>
      <div className="flex gap-1 mb-3">
        {(['all', 'network', 'logcat', 'hook', 'insights'] as const).map(k => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`px-2.5 py-1 text-[10px] tracking-widest rounded border ${
              filter === k
                ? 'border-accent-green/40 bg-accent-green/10 text-accent-green'
                : 'border-ink-muted/30 bg-bg-card text-ink-secondary hover:text-ink-primary'
            }`}
          >
            {k.toUpperCase()} <span className="text-ink-muted ml-1">{counts[k]}</span>
          </button>
        ))}
      </div>

      <div className="bg-bg-base border divider rounded font-mono text-[11px] max-h-[480px] overflow-auto">
        {filtered.length === 0 && (
          <div className="px-3 py-6 text-center text-ink-muted">no matching log rows</div>
        )}
        {filtered.map((r, i) => (
          <div
            key={i}
            className={`px-3 py-1.5 border-b border-ink-muted/10 ${r.insight ? 'bg-accent-amber/5' : ''}`}
          >
            <div className="flex items-baseline gap-3">
              <span className="text-ink-muted tabular-nums w-20 flex-shrink-0">{r.ts}</span>
              <span className={`uppercase tracking-widest w-12 flex-shrink-0 ${CHANNEL_COLORS[r.channel]}`}>
                {r.channel}
              </span>
              {r.level && (
                <span className={`uppercase tracking-widest w-8 flex-shrink-0 ${LEVEL_COLORS[r.level]}`}>
                  {r.level}
                </span>
              )}
              <span className="text-ink-primary break-all">{r.text}</span>
            </div>
            {r.insight && (
              <div className="ml-23 mt-1 flex items-start gap-2 pl-2 border-l border-accent-amber/30">
                <span className={`px-1.5 py-0.5 text-[9px] tracking-widest border rounded ${SEVERITY_COLORS[r.insight.severity]}`}>
                  INSIGHT
                </span>
                <a
                  href={`#evidence-${r.insight.ioc_id}`}
                  className="text-[10px] text-accent-amber hover:underline"
                >
                  {r.insight.ioc_id}
                </a>
                <span className="text-[10px] text-ink-secondary">{r.insight.note}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
