import type { ProducerStatus, ConsumerStatus } from '@/lib/types';

const PRODUCER_COLORS: Record<ProducerStatus, string> = {
  QUEUE_IMPORTED: 'bg-ink-muted/15 text-ink-secondary border-ink-muted/30',
  STATIC_PREPARING: 'bg-accent-blue/10 text-accent-blue border-accent-blue/30',
  STATIC_TRIAGED: 'bg-accent-blue/10 text-accent-blue border-accent-blue/30',
  MISSION_PACKAGE_READY: 'bg-accent-violet/10 text-accent-violet border-accent-violet/30',
  MISSION_SENT: 'bg-accent-violet/10 text-accent-violet border-accent-violet/30',
  CONSUMER_ACKED: 'bg-accent-violet/10 text-accent-violet border-accent-violet/30',
  CONSUMER_RUNNING: 'bg-accent-amber/10 text-accent-amber border-accent-amber/30',
  EVIDENCE_RECEIVED: 'bg-accent-green/10 text-accent-green border-accent-green/30',
  SCORES_RECONCILED: 'bg-accent-green/10 text-accent-green border-accent-green/30',
  REPORT_DRAFTED: 'bg-accent-green/15 text-accent-green border-accent-green/40',
  HUMAN_REVIEW: 'bg-accent-amber/10 text-accent-amber border-accent-amber/30',
  SUBMITTED: 'bg-accent-green/20 text-accent-green border-accent-green/50',
  CLOSED: 'bg-ink-muted/20 text-ink-secondary border-ink-muted/40',
};

const CONSUMER_COLORS: Record<ConsumerStatus, string> = {
  MISSION_RECEIVED: 'bg-accent-blue/10 text-accent-blue border-accent-blue/30',
  MISSION_VALIDATED: 'bg-accent-blue/10 text-accent-blue border-accent-blue/30',
  PLAN_CREATED: 'bg-accent-blue/10 text-accent-blue border-accent-blue/30',
  BASELINE_RUNNING: 'bg-accent-amber/10 text-accent-amber border-accent-amber/30',
  DYNAMIC_RUNNING: 'bg-accent-amber/10 text-accent-amber border-accent-amber/30',
  EVIDENCE_COLLECTED: 'bg-accent-green/10 text-accent-green border-accent-green/30',
  SCORING: 'bg-accent-green/10 text-accent-green border-accent-green/30',
  PACKAGE_READY: 'bg-accent-green/15 text-accent-green border-accent-green/40',
  PACKAGE_SENT: 'bg-accent-green/20 text-accent-green border-accent-green/50',
  DONE: 'bg-ink-muted/20 text-ink-secondary border-ink-muted/40',
};

export function StatusBadge({
  status,
  side,
}: {
  status: ProducerStatus | ConsumerStatus | null;
  side: 'producer' | 'consumer';
}) {
  if (!status) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] tracking-widest border rounded border-ink-muted/30 bg-bg-card text-ink-muted">
        — not yet —
      </span>
    );
  }
  const cls =
    side === 'producer'
      ? PRODUCER_COLORS[status as ProducerStatus]
      : CONSUMER_COLORS[status as ConsumerStatus];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] tracking-widest border rounded ${cls}`}
    >
      <span className="w-1 h-1 rounded-full bg-current" />
      {status}
    </span>
  );
}

const PRIORITY_COLORS: Record<string, string> = {
  low: 'text-ink-secondary border-ink-muted/30',
  medium: 'text-accent-blue border-accent-blue/30',
  high: 'text-accent-amber border-accent-amber/30',
  critical: 'text-accent-red border-accent-red/30',
};

export function PriorityBadge({ priority }: { priority: 'low' | 'medium' | 'high' | 'critical' }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-[10px] tracking-widest border rounded bg-bg-card ${PRIORITY_COLORS[priority]}`}
    >
      {priority.toUpperCase()}
    </span>
  );
}

const VERDICT_COLORS: Record<string, string> = {
  malicious: 'bg-accent-red/15 text-accent-red border-accent-red/40',
  riskware: 'bg-accent-amber/15 text-accent-amber border-accent-amber/40',
  inconclusive: 'bg-accent-blue/15 text-accent-blue border-accent-blue/40',
  benign: 'bg-accent-green/15 text-accent-green border-accent-green/40',
};

export function VerdictBadge({ verdict }: { verdict: string }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 text-xs tracking-widest border rounded ${VERDICT_COLORS[verdict] ?? VERDICT_COLORS.inconclusive}`}
    >
      {verdict.toUpperCase()}
    </span>
  );
}

const LEVEL_COLORS: Record<string, string> = {
  weak: 'text-ink-secondary border-ink-muted/30',
  medium: 'text-accent-amber border-accent-amber/30',
  strong: 'text-accent-red border-accent-red/40',
};

export function IocLevelBadge({ level }: { level: 'weak' | 'medium' | 'strong' | null }) {
  if (!level) return <span className="text-ink-muted text-[10px]">—</span>;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-[10px] tracking-widest border rounded bg-bg-card ${LEVEL_COLORS[level]}`}
    >
      {level.toUpperCase()}
    </span>
  );
}
