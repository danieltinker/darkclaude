import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCaseByReviewId } from '@/lib/mock-data';
import { Panel, KV } from '@/components/chrome/Panel';
import { GateBadge, IocLevelBadge, VerdictBadge } from '@/components/status/StatusBadge';
import { ScoreBar } from '@/components/score/ScoreBar';
import { TraceWithEvidence } from '@/components/evidence/TraceWithEvidence';
import { EvidenceBoard } from '@/components/evidence/EvidenceBoard';

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = getCaseByReviewId(id);
  if (!c || !c.report) notFound();

  const r = c.report;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/producer/case/${c.case_identity.app_review_id}`}
          className="text-xs text-ink-muted hover:text-accent-green tracking-widest"
        >
          ← BACK TO CASE FILE
        </Link>
        <div className="text-[10px] text-ink-muted tracking-[0.3em] mt-3 mb-1">
          // DEEP INSPECTION REPORT · MissionControlReportWorker
        </div>
        <h1 className="text-2xl font-semibold">{c.case_identity.app_name}</h1>
        <div className="text-xs text-ink-secondary font-mono mt-1">
          {r.report_id} · drafted {new Date(r.created_at).toLocaleString()}
        </div>
      </div>

      {/* Executive verdict */}
      <Panel title="Executive Verdict" section="01">
        <div className="grid grid-cols-4 gap-6">
          <div>
            <div className="label mb-2">verdict candidate</div>
            <VerdictBadge verdict={r.verdict_candidate} />
            <div className="mt-3 text-xs text-ink-secondary">
              Confidence <span className="text-ink-primary font-semibold tabular-nums">{(r.confidence * 100).toFixed(0)}%</span>
            </div>
          </div>
          <ScoreBar label="static score" value={r.static_score} max={32} color="blue" />
          <ScoreBar label="dynamic score" value={r.dynamic_score} max={32} color="amber" />
          <ScoreBar label="final score" value={r.final_score} max={32} color="green" />
        </div>
        <div className="mt-4 pt-4 border-t divider">
          <div className="label mb-2">recommendation</div>
          <p className="text-sm">{r.recommendation}</p>
        </div>
      </Panel>

      {/* Funnel chain — show that BOTH gates passed */}
      {r.metadata_gate && (
        <Panel title="Funnel Chain" section="·" subtitle="this case passed two gates before deep analysis">
          <div className="grid grid-cols-5 gap-2">
            <FunnelStep label="Queue lock" sub={r.queue_lock.locked_by} done />
            <FunnelStep
              label="Metadata gate"
              sub={`${r.metadata_gate.signal_score} / ${r.metadata_gate.policy_applied.signal_score_threshold} · ${r.metadata_gate.status}`}
              done={r.metadata_gate.status === 'PROCEED_TO_STATIC_FUNNEL'}
            />
            <FunnelStep
              label="Install verify"
              sub={r.install_verification.status}
              done={r.install_verification.status === 'success'}
            />
            {r.slice_verification && (
              <FunnelStep
                label="Slice verify"
                sub={`${r.slice_verification.decompiler} · ${r.slice_verification.classes_decompiled}cls`}
                done={r.slice_verification.status === 'success'}
              />
            )}
            <FunnelStep
              label="Static gate"
              sub={`${r.gate_decision.candidate_score} / ${r.gate_decision.policy_applied.dynamic_analysis_threshold}`}
              done={r.gate_decision.status === 'DYNAMIC_ANALYSIS_REQUIRED'}
            />
          </div>
        </Panel>
      )}

      {/* Why dynamic was triggered */}
      <Panel title="Why Dynamic Was Triggered" section="02" subtitle="gate decision audit">
        <div className="grid grid-cols-3 gap-4 mb-3">
          <div className="card p-3">
            <div className="label mb-2">candidate score</div>
            <div className="text-2xl font-semibold tabular-nums">
              {r.scorecard.rubric_potential.candidate_score}
              <span className="text-sm text-ink-muted">
                {' '}/ {r.scorecard.rubric_potential.threshold_for_dynamic_analysis}
              </span>
            </div>
          </div>
          <div className="card p-3">
            <div className="label mb-2">gate decision</div>
            <GateBadge status={r.gate_decision.status} />
          </div>
          <div className="card p-3">
            <div className="label mb-2">force-rules triggered</div>
            {r.gate_decision.triggered_force_rules.length ? (
              <div className="flex flex-wrap gap-1">
                {r.gate_decision.triggered_force_rules.map(rule => (
                  <span
                    key={rule}
                    className="px-2 py-0.5 text-[10px] tracking-widest border border-accent-violet/30 rounded bg-accent-violet/10 text-accent-violet font-mono"
                  >
                    {rule}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-[10px] text-ink-muted">none</span>
            )}
          </div>
        </div>
        <p className="text-xs text-ink-secondary">{r.why_dynamic_was_triggered}</p>
      </Panel>

      {/* Reconciled scores table */}
      <Panel title="IOC Score Reconciliation" section="03" subtitle="strongest level per IOC · static vs dynamic">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] tracking-widest text-ink-muted border-b divider">
              <th className="text-left py-2 pr-3">ioc</th>
              <th className="text-left px-3">static</th>
              <th className="text-left px-3">dynamic</th>
              <th className="text-left px-3">final</th>
              <th className="text-right px-3">points</th>
              <th className="text-left pl-3">evidence</th>
            </tr>
          </thead>
          <tbody>
            {r.reconciled_scores.map(s => (
              <>
                <tr key={`${s.ioc_id}-row`} className="border-b border-edge/40">
                  <td className="py-3 pr-3">
                    <div className="font-semibold">{s.ioc_name}</div>
                    <div className="text-[10px] text-ink-muted font-mono">{s.ioc_id}</div>
                  </td>
                  <td className="px-3"><IocLevelBadge level={s.static_level} /></td>
                  <td className="px-3"><IocLevelBadge level={s.dynamic_level} /></td>
                  <td className="px-3"><IocLevelBadge level={s.final_level} /></td>
                  <td className="px-3 text-right tabular-nums font-semibold">{s.final_points}</td>
                  <td className="pl-3 text-[10px] text-ink-muted">
                    {(() => {
                      const ids = s.evidence_ids.filter(x => x.startsWith('ev_'));
                      if (ids.length === 0) return '—';
                      return ids.map(id => (
                        <a key={id} href={`#evidence-${id}`} className="text-accent-green hover:underline mr-2 last:mr-0">
                          {id}
                        </a>
                      ));
                    })()}
                  </td>
                </tr>
                {(s.static_reason || s.dynamic_reason) && (
                  <tr key={`${s.ioc_id}-reason`} className="border-b border-edge/40">
                    <td colSpan={6} className="py-2 px-3 pl-6 bg-bg-base">
                      <div className="grid grid-cols-2 gap-6">
                        <div className="text-[11px]">
                          <div className="text-[9px] tracking-widest text-ink-muted mb-1">
                            STATIC{s.static_scored_by ? ` · ${s.static_scored_by}` : ''}
                            {s.static_confidence !== undefined ? ` · conf ${s.static_confidence.toFixed(2)}` : ''}
                          </div>
                          <p className="text-ink-secondary">{s.static_reason ?? '—'}</p>
                        </div>
                        <div className="text-[11px]">
                          <div className="text-[9px] tracking-widest text-ink-muted mb-1">
                            DYNAMIC{s.dynamic_scored_by ? ` · ${s.dynamic_scored_by}` : ''}
                            {s.dynamic_confidence !== undefined ? ` · conf ${s.dynamic_confidence.toFixed(2)}` : ''}
                          </div>
                          <p className="text-ink-secondary">{s.dynamic_reason ?? '—'}</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
            <tr>
              <td colSpan={4} className="py-3 pr-3 text-right text-ink-muted tracking-widest text-[10px]">
                TOTAL FINAL SCORE
              </td>
              <td className="px-3 text-right tabular-nums font-semibold text-accent-green text-base">
                {r.final_score}
              </td>
              <td />
            </tr>
          </tbody>
        </table>
      </Panel>

      {r.function_call_trace && r.function_call_trace.length > 0 && r.rubric && (
        <Panel
          title="Trace ↔ Evidence"
          section="04"
          subtitle="every static step paired with the dynamic evidence that confirmed (or didn't confirm) it · anchors below"
        >
          <TraceWithEvidence
            steps={r.function_call_trace}
            evidenceItems={r.evidence_package?.evidence_items}
            rubric={r.rubric}
          />
        </Panel>
      )}

      {r.evidence_package?.evidence_items && r.evidence_package.evidence_items.length > 0 && r.rubric && (
        <Panel
          title="Evidence Board"
          section="05"
          subtitle="every artifact the Investigator returned · trace anchors land here"
        >
          <EvidenceBoard items={r.evidence_package.evidence_items} rubric={r.rubric} />
        </Panel>
      )}

      <div className="grid grid-cols-2 gap-6">
        <Panel title="Static Summary" section="06">
          <p className="text-xs text-ink-secondary">{r.static_summary}</p>
        </Panel>
        <Panel title="Dynamic Summary" section="07">
          <p className="text-xs text-ink-secondary">{r.dynamic_summary}</p>
        </Panel>
      </div>

      <Panel title="Execution Flow" section="06" subtitle="runtime trace as evidence">
        <ol className="space-y-1.5 text-xs">
          {r.execution_flow.map((step, i) => (
            <li key={i} className="flex gap-3 font-mono">
              <span className="text-ink-muted tabular-nums">{String(i + 1).padStart(2, '0')}</span>
              <span className="text-ink-secondary">{step}</span>
            </li>
          ))}
        </ol>
      </Panel>

      <div className="grid grid-cols-2 gap-6">
        <Panel title="Queue Lock + Install" section="07">
          <div className="space-y-1">
            <KV k="Locked by" v={r.queue_lock.locked_by} />
            <KV k="Locked at" v={new Date(r.queue_lock.locked_at).toLocaleString()} />
            <KV k="Install method" v={r.install_verification.install_method} />
            <KV
              k="Install status"
              v={
                <span className={r.install_verification.status === 'success' ? 'text-accent-green' : 'text-accent-red'}>
                  {r.install_verification.status.toUpperCase()}
                </span>
              }
            />
            <KV k="First launch" v={r.install_verification.first_launch_success ? 'success' : 'failed'} />
          </div>
        </Panel>

        <Panel title="Metadata Intelligence" section="08">
          <div className="space-y-1">
            <KV k="Developer country" v={r.metadata.developer_country} />
            <KV k="Reputation" v={r.metadata.developer_reputation} />
            <KV k="Account age" v={`${r.metadata.developer_account_age_days} days`} />
            <KV k="Target markets" v={r.metadata.target_markets.join(', ') || '—'} />
          </div>
          {r.metadata.prior_flags.length > 0 && (
            <div className="mt-3 pt-3 border-t divider">
              <div className="label mb-2">prior flags</div>
              <ul className="text-[11px] text-ink-secondary space-y-1">
                {r.metadata.prior_flags.map((f, i) => <li key={i}>· {f}</li>)}
              </ul>
            </div>
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Panel title="Limitations" section="09" subtitle="what was NOT proven">
          {r.limitations.length ? (
            <ul className="text-xs text-ink-secondary space-y-1.5">
              {r.limitations.map((l, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-accent-amber">!</span>
                  <span>{l}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-xs text-ink-muted">No limitations recorded.</div>
          )}
        </Panel>

        <Panel title="Human Review Checklist" section="10" subtitle="reviewer cannot submit until required items pass">
          <ul className="space-y-2 text-xs">
            {r.human_review_checklist.map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <input
                  type="checkbox"
                  disabled
                  className="mt-0.5 accent-accent-green"
                />
                <span className={item.required ? 'text-ink-primary' : 'text-ink-secondary'}>
                  {item.item}
                  {item.required && <span className="text-accent-red ml-1">*</span>}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 text-[10px] text-ink-muted">
            <span className="text-accent-red">*</span> required to submit
          </div>
        </Panel>
      </div>
    </div>
  );
}

function FunnelStep({ label, sub, done }: { label: string; sub: string; done: boolean }) {
  return (
    <div className={`card p-2 border ${done ? 'border-accent-green/30' : 'border-ink-muted/30'}`}>
      <div className="flex items-center gap-2">
        <span className={done ? 'text-accent-green' : 'text-ink-muted'}>{done ? '✓' : '·'}</span>
        <span className="text-[10px] tracking-widest text-ink-secondary">{label.toUpperCase()}</span>
      </div>
      <div className="text-[10px] text-ink-muted mt-1 truncate">{sub}</div>
    </div>
  );
}
