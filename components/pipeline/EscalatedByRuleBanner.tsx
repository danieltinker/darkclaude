// EscalatedByRuleBanner — shown on the case file when the gate escalated
// a case to dynamic BECAUSE of a force-rule, not the score. This makes
// the "low score but still escalated" path (e.g. Mira Music Player)
// readable at a glance.

import type { GateDecision } from '@/lib/types';

export function EscalatedByRuleBanner({ gate }: { gate: GateDecision }) {
  const belowThreshold = gate.candidate_score < gate.policy_applied.dynamic_analysis_threshold;
  const ruleFired = gate.triggered_force_rules.length > 0;
  if (!(belowThreshold && ruleFired && gate.status === 'DYNAMIC_ANALYSIS_REQUIRED')) return null;

  return (
    <div className="panel border-accent-amber/40 bg-accent-amber/5 p-4">
      <div className="flex items-start gap-3">
        <span className="px-2 py-1 text-[10px] tracking-widest border border-accent-amber/40 rounded bg-accent-amber/10 text-accent-amber whitespace-nowrap">
          ESCALATED BY OVERRIDE RULE
        </span>
        <div className="flex-1">
          <p className="text-xs text-ink-secondary leading-relaxed">
            Static candidate score{' '}
            <span className="text-accent-amber font-semibold tabular-nums">
              {gate.candidate_score}
            </span>{' '}
            sits below the dynamic threshold (
            <span className="tabular-nums">
              {gate.policy_applied.dynamic_analysis_threshold}
            </span>
            ), but a force-dynamic rule fired — so the gate escalates anyway. This is the
            "ambiguous but worth confirming" path: dynamic will either confirm the suspicion
            or return a clean false-positive verdict.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {gate.triggered_force_rules.map(r => (
              <span
                key={r}
                className="px-2 py-0.5 text-[10px] tracking-widest border border-accent-violet/40 rounded bg-accent-violet/10 text-accent-violet font-mono"
              >
                {r}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
