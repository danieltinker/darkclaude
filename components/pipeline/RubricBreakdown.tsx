// RubricBreakdown — when a case is under review for multiple rubrics
// simultaneously, render each rubric as its own scoped section with
// its own candidate IOCs, missing signals, gate decision, and (if
// dynamic returned) per-rubric reconciliation.

import type { RubricRunState } from '@/lib/types';
import { IocLevelBadge } from '@/components/status/StatusBadge';
import { ScoreNumber } from '@/components/score/ScoreNumber';

type Props = { rubrics: RubricRunState[] };

const GATE_TONE: Record<string, string> = {
  DYNAMIC_ANALYSIS_REQUIRED: 'text-accent-violet border-accent-violet/40 bg-accent-violet/10',
  CLOSE_EARLY_STATIC_INSUFFICIENT: 'text-ink-secondary border-ink-muted/40 bg-bg-card',
  HUMAN_REVIEW_STATIC_GATE: 'text-accent-amber border-accent-amber/40 bg-accent-amber/10',
};

export function RubricBreakdown({ rubrics }: Props) {
  if (!rubrics.length) return null;
  return (
    <div className="space-y-4">
      {rubrics.map(rr => {
        const reconciledScore = rr.reconciled?.reduce((acc, r) => acc + r.final_points, 0) ?? 0;
        const showReconciled = rr.reconciled && rr.reconciled.length > 0;
        return (
          <section key={rr.rubric.rubric_id} className="card p-4">
            <header className="flex items-baseline justify-between gap-4 mb-3">
              <div>
                <div className="text-[10px] text-ink-muted tracking-widest mb-1">RUBRIC</div>
                <div className="text-sm font-semibold">{rr.rubric.category_name}</div>
                <div className="text-[10px] text-ink-muted font-mono">{rr.rubric.rubric_id} v{rr.rubric.rubric_version}</div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-[10px] text-ink-muted tracking-widest">CANDIDATE</div>
                  <ScoreNumber value={rr.candidate_score} threshold={8} mode="higher_is_worse" size="md" />
                </div>
                {showReconciled && (
                  <div className="text-right">
                    <div className="text-[10px] text-ink-muted tracking-widest">RECONCILED</div>
                    <ScoreNumber value={reconciledScore} threshold={12} mode="higher_is_worse" size="md" />
                  </div>
                )}
                <span
                  className={`px-2 py-1 text-[10px] tracking-widest border rounded ${GATE_TONE[rr.gate_status] ?? 'border-ink-muted/30 bg-bg-card text-ink-secondary'}`}
                >
                  {rr.gate_status.replace(/_/g, ' ')}
                </span>
              </div>
            </header>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-[10px] text-ink-muted tracking-widest mb-2">CANDIDATE IOCs</div>
                {rr.candidate_iocs.length ? (
                  <ul className="space-y-1.5">
                    {rr.candidate_iocs.map(i => (
                      <li key={i.ioc_id} className="flex items-baseline justify-between gap-3 text-[11px]">
                        <span className="truncate">{rr.rubric.iocs.find(r => r.ioc_id === i.ioc_id)?.name ?? i.ioc_id}</span>
                        <span className="flex items-center gap-2 flex-shrink-0">
                          <IocLevelBadge level={i.level} />
                          <span className="text-[9px] text-ink-muted">conf {i.confidence.toFixed(2)}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-[10px] text-ink-muted">No static candidates for this rubric.</div>
                )}
              </div>
              <div>
                <div className="text-[10px] text-ink-muted tracking-widest mb-2">MISSING STRONG SIGNALS</div>
                {rr.missing_signals.length ? (
                  <ul className="space-y-1.5 text-[11px] text-ink-secondary">
                    {rr.missing_signals.map(m => (
                      <li key={m.ioc_id}>
                        <div className="text-ink-primary">{m.ioc_name}</div>
                        <div className="text-[10px] text-ink-muted">{m.reason}</div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-[10px] text-ink-muted">No missing strong signals.</div>
                )}
              </div>
            </div>

            {showReconciled && (
              <div className="mt-4 pt-4 border-t border-edge/40">
                <div className="text-[10px] text-ink-muted tracking-widest mb-2">RECONCILED PER IOC</div>
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="text-[9px] tracking-widest text-ink-muted">
                      <th className="text-left py-1 pr-3">ioc</th>
                      <th className="text-left px-2">static</th>
                      <th className="text-left px-2">dynamic</th>
                      <th className="text-left px-2">final</th>
                      <th className="text-right pl-2">points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rr.reconciled!.map(r => (
                      <tr key={r.ioc_id} className="border-t border-edge/40">
                        <td className="py-1.5 pr-3">{r.ioc_name}</td>
                        <td className="px-2"><IocLevelBadge level={r.static_level} /></td>
                        <td className="px-2"><IocLevelBadge level={r.dynamic_level} /></td>
                        <td className="px-2"><IocLevelBadge level={r.final_level} /></td>
                        <td className="pl-2 text-right tabular-nums font-semibold">{r.final_points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
