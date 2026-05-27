// PipelineKanban — every case rendered as a card in the column that
// matches its current pipeline stage. Reviewers see the whole queue's
// flow at a glance.

import Link from 'next/link';
import type { QueueCase } from '@/lib/types';
import { PriorityBadge, VerdictBadge } from '@/components/status/StatusBadge';

type ColumnId =
  | 'metadata'
  | 'static'
  | 'gate'
  | 'dynamic'
  | 'report'
  | 'closed';

type Column = {
  id: ColumnId;
  title: string;
  accent: 'green' | 'blue' | 'amber' | 'violet' | 'muted';
  caption: string;
};

const COLUMNS: Column[] = [
  { id: 'metadata', title: 'Metadata', accent: 'green', caption: 'Scout + metadata gate' },
  { id: 'static',   title: 'Static',   accent: 'blue',  caption: 'Install · slice · scorecard' },
  { id: 'gate',     title: 'Gate',     accent: 'amber', caption: 'Routing decision' },
  { id: 'dynamic',  title: 'Dynamic',  accent: 'violet',caption: 'Consumer evidence' },
  { id: 'report',   title: 'Report',   accent: 'green', caption: 'Reviewer-ready' },
  { id: 'closed',   title: 'Closed',   accent: 'muted', caption: 'Terminal states' },
];

const ACCENT_BORDER: Record<Column['accent'], string> = {
  green: 'border-accent-green/30',
  blue: 'border-accent-blue/30',
  amber: 'border-accent-amber/30',
  violet: 'border-accent-violet/30',
  muted: 'border-ink-muted/30',
};
const ACCENT_TEXT: Record<Column['accent'], string> = {
  green: 'text-accent-green',
  blue: 'text-accent-blue',
  amber: 'text-accent-amber',
  violet: 'text-accent-violet',
  muted: 'text-ink-secondary',
};

function classifyCase(c: QueueCase): ColumnId {
  const ps = c.producer_status;
  // Closed-terminal states first
  if (ps === 'METADATA_INSUFFICIENT_CLOSED' || ps === 'STATIC_INSUFFICIENT_CLOSED' || ps === 'FALSE_POSITIVE_CLOSED' || ps === 'SUBMITTED' || ps === 'CLOSED') return 'closed';
  // Reporting
  if (ps === 'DEEP_REPORT_READY' || ps === 'HUMAN_REVIEW_READY' || ps === 'EXPLORATORY_FINDING_READY' || ps === 'SCORES_RECONCILED') return 'report';
  // Dynamic
  if (ps === 'DYNAMIC_ANALYSIS_REQUIRED' || ps === 'DYNAMIC_MISSION_READY' || ps === 'DYNAMIC_MISSION_SENT' || ps === 'CONSUMER_ACKED' || ps === 'CONSUMER_RUNNING' || ps === 'EVIDENCE_RECEIVED') return 'dynamic';
  // Gate
  if (ps === 'HUMAN_REVIEW_STATIC_GATE') return 'gate';
  // Static
  if (ps === 'INSTALL_VERIFY_RUNNING' || ps === 'INSTALL_VERIFY_FAILED' || ps === 'STATIC_SLICE_RUNNING' || ps === 'STATIC_SCORECARD_READY') return 'static';
  // Metadata
  return 'metadata';
}

export function PipelineKanban({ cases }: { cases: QueueCase[] }) {
  const grouped = COLUMNS.reduce<Record<ColumnId, QueueCase[]>>((acc, col) => {
    acc[col.id] = [];
    return acc;
  }, { metadata: [], static: [], gate: [], dynamic: [], report: [], closed: [] });

  for (const c of cases) {
    grouped[classifyCase(c)].push(c);
  }

  return (
    <div className="grid grid-cols-6 gap-3">
      {COLUMNS.map(col => (
        <div key={col.id} className={`panel border ${ACCENT_BORDER[col.accent]} p-2 min-h-[200px]`}>
          <header className="px-1 pb-2 border-b divider mb-2">
            <div className="flex items-baseline justify-between">
              <span className={`text-xs tracking-widest font-semibold ${ACCENT_TEXT[col.accent]}`}>
                {col.title.toUpperCase()}
              </span>
              <span className="text-[10px] text-ink-muted tabular-nums">{grouped[col.id].length}</span>
            </div>
            <div className="text-[10px] text-ink-muted mt-0.5">{col.caption}</div>
          </header>
          <div className="space-y-2">
            {grouped[col.id].length === 0 && (
              <div className="text-[10px] text-ink-muted text-center py-4">empty</div>
            )}
            {grouped[col.id].map(c => (
              <Link
                key={c.case_identity.app_review_id}
                href={`/producer/case/${c.case_identity.app_review_id}`}
                className="block card p-2 hover:border-accent-green/40"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="text-[11px] font-semibold leading-tight truncate flex-1">
                    {c.case_identity.app_name}
                  </div>
                  <PriorityBadge priority={c.priority} />
                </div>
                <div className="text-[9px] text-ink-muted font-mono truncate">
                  {c.case_identity.package_name}
                </div>
                <div className="text-[9px] text-ink-muted truncate">v{c.case_identity.version_code}</div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[9px] text-ink-muted">
                    score <span className="text-ink-primary tabular-nums">{c.final_score || c.static_score}</span>
                  </span>
                  {c.report && <VerdictBadge verdict={c.report.verdict_candidate} />}
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
