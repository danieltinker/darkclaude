// Verdict + phase badges for the new TP/FP scoring model and the
// simplified journey-phase status vocabulary.

import type { DynamicVerdict, QueueCase } from '@/lib/types';
import { DYNAMIC_VERDICT_LABEL } from '@/lib/types';
import { dynamicVerdict } from '@/lib/scoring';
import { casePhase, PHASE_LABEL, PHASE_PASSED_NEXT, type JourneyPhase } from '@/lib/phase';

const VERDICT_TONE: Record<DynamicVerdict, string> = {
  strong_tp: 'text-accent-red border-accent-red/50 bg-accent-red/10',
  tp: 'text-accent-amber border-accent-amber/50 bg-accent-amber/10',
  inconclusive: 'text-accent-blue border-accent-blue/50 bg-accent-blue/10',
  strong_fp: 'text-accent-green border-accent-green/50 bg-accent-green/10',
};

const VERDICT_SHORT: Record<DynamicVerdict, string> = {
  strong_tp: 'STRONG TP',
  tp: 'TP',
  inconclusive: 'INCONCLUSIVE',
  strong_fp: 'STRONG FP',
};

// A case only has a verdict once dynamic evidence returned. Respect a
// human verdict override if present.
export function caseVerdict(c: QueueCase): DynamicVerdict | 'pending' {
  if (c.verdict_override) return c.verdict_override.final_verdict;
  const returned = c.evidence_package || c.dynamic_score > 0 || c.producer_status === 'FALSE_POSITIVE_CLOSED';
  if (!returned) return 'pending';
  return dynamicVerdict(c.dynamic_score);
}

export function DynamicVerdictBadge({ verdict, overridden }: { verdict: DynamicVerdict | 'pending'; overridden?: boolean }) {
  if (verdict === 'pending') {
    return <span className="inline-flex items-center px-2 py-0.5 text-[11px] tracking-widest border rounded border-ink-muted/30 bg-bg-card text-ink-muted">PENDING</span>;
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] tracking-widest border rounded ${VERDICT_TONE[verdict]}`}
      title={DYNAMIC_VERDICT_LABEL[verdict]}
    >
      {VERDICT_SHORT[verdict]}
      {overridden && <span className="text-[9px] opacity-70">·H</span>}
    </span>
  );
}

const PHASE_TONE: Record<JourneyPhase, string> = {
  queued: 'text-ink-secondary border-ink-muted/30',
  metadata_review: 'text-accent-green border-accent-green/30',
  closed_metadata: 'text-ink-secondary border-ink-muted/40',
  slicing: 'text-accent-blue border-accent-blue/30',
  rubric_hunt: 'text-accent-blue border-accent-blue/40',
  closed_evasion: 'text-ink-secondary border-ink-muted/40',
  installing: 'text-accent-blue border-accent-blue/30',
  transfer: 'text-accent-violet border-accent-violet/30',
  on_device: 'text-accent-amber border-accent-amber/30',
  evidence_returned: 'text-accent-green border-accent-green/30',
  scored: 'text-accent-green border-accent-green/40',
  human_review: 'text-accent-amber border-accent-amber/30',
  submitted: 'text-accent-green border-accent-green/50',
};

// A status chip that says what phase the case is in + a passed/next hint.
export function PhaseBadge({ c, showNext = true }: { c: QueueCase; showNext?: boolean }) {
  const phase = casePhase(c);
  const pn = PHASE_PASSED_NEXT[phase];
  return (
    <span className="inline-flex flex-col gap-0.5">
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] tracking-widest border rounded bg-bg-card ${PHASE_TONE[phase]}`}>
        <span className="w-1 h-1 rounded-full bg-current" />
        {PHASE_LABEL[phase]}
      </span>
      {showNext && <span className="text-[9px] text-ink-muted pl-1">{pn.passed} → {pn.next}</span>}
    </span>
  );
}
