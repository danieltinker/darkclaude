import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getConsumerMission } from '@/lib/consumer-inbox';
import { Panel, KV } from '@/components/chrome/Panel';
import { StatusBadge, PriorityBadge, IocLevelBadge } from '@/components/status/StatusBadge';
import { EscalatedByRuleBanner } from '@/components/pipeline/EscalatedByRuleBanner';
import { FlowGraphProof } from '@/components/evidence/FlowGraphProof';
import { GeoSweepGrid } from '@/components/pipeline/GeoSweepGrid';
import { getFlow } from '@/lib/rubric-flows';

// Consumer mission workspace reads ONLY from the consumer inbox —
// no Producer-side fields (metadata, scorecard, worker analytics,
// deep report) are accessible from this page.
export default async function MissionWorkspace({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = getConsumerMission(id);
  if (!c) notFound();

  const m = c.mission_package;
  const e = c.evidence_package;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/consumer" className="text-xs text-ink-muted hover:text-accent-amber tracking-widest">
            ← BACK TO INBOX
          </Link>
          <div className="text-[10px] text-ink-muted tracking-[0.3em] mt-3 mb-1">
            // MISSION WORKSPACE · {c.case_identity.category_name.toUpperCase()}
          </div>
          <h1 className="text-2xl font-semibold">{c.case_identity.app_name}</h1>
          <div className="text-xs text-ink-secondary font-mono mt-1">
            {c.case_identity.app_review_id} · {c.case_identity.package_name} v{c.case_identity.version_code}
          </div>
        </div>
        <div className="flex flex-col gap-2 items-end">
          <PriorityBadge priority={c.priority} />
          <StatusBadge status={c.consumer_status} side="consumer" />
        </div>
      </div>

      {c.gate_context && (
        <EscalatedByRuleBanner
          gate={{
            // Synthesize a GateDecision-shaped object from the inbox-
            // visible slice the Producer embedded for context.
            ...c.gate_context,
            case_identity: c.case_identity,
            next_step: 'BUILD_DYNAMIC_MISSION_PACKAGE',
            decided_at: '',
          }}
        />
      )}

      {/* Typed experiment body — switches on mission kind */}
      {c.mission_kind === 'geo_screenshot_sweep' && c.geo_sweep && c.geo_sweep_cells && (
        <Panel
          title="Geo Screenshot Sweep"
          section="·"
          subtitle="basic mission — capture the target across many VPN exits; diverging countries are highlighted"
        >
          <GeoSweepGrid mission={c.geo_sweep} cells={c.geo_sweep_cells} />
        </Panel>
      )}

      {c.mission_kind === 'ioc_proof_chain' && c.ioc_proofs && c.ioc_proofs.length > 0 && (
        <Panel
          title="IOC Proof Graph"
          section="·"
          subtitle="each node is a path-pinned static signature proven (or not) by dynamic evidence — points are awarded only when the chain is proven"
        >
          <div className="space-y-6">
            {c.ioc_proofs.map(pf => {
              const flow = getFlow(pf.flow_id);
              if (!flow) return null;
              return (
                <FlowGraphProof
                  key={pf.ioc_id}
                  flow={flow}
                  proof={pf}
                  dynamicScore={c.evidence_package?.execution_summary.dynamic_score ?? 0}
                />
              );
            })}
          </div>
        </Panel>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Left: Mission brief */}
        <div className="col-span-1 space-y-6">
          <Panel title="Mission Brief" section="01" subtitle="received from Producer">
            <div className="space-y-1">
              <KV k="Message ID" v={<span className="text-[10px]">{m.message_id}</span>} />
              <KV k="Rubric" v={`${m.rubric_reference.rubric_id} v${m.rubric_reference.rubric_version}`} />
              <KV k="Rubric hash" v={<span className="text-[10px]">{m.rubric_reference.rubric_hash.slice(0, 24)}…</span>} />
              <KV k="Schema" v={m.schema_version} />
              <KV k="Checksum" v={<span className="text-[10px]">{m.checksum.slice(0, 24)}…</span>} />
            </div>
          </Panel>

          <Panel title="Budget" section="02">
            <div className="space-y-1">
              <KV k="Max total minutes" v={`${m.consumer_budget.max_total_minutes}m`} />
              <KV k="Max iterations" v={m.consumer_budget.max_iterations} />
              <KV k="Max VPN countries" v={m.consumer_budget.max_vpn_countries} />
              <KV k="Max hook revisions" v={m.consumer_budget.max_hook_revisions} />
              <KV k="Early stop on strong" v={m.consumer_budget.early_stop_on_strong_evidence ? 'yes' : 'no'} />
            </div>
            {e && (
              <div className="mt-3 pt-3 border-t divider">
                <div className="label mb-2">actual usage</div>
                <div className="space-y-1">
                  <KV k="Minutes used" v={`${e.budget_usage.actual_total_minutes}m`} />
                  <KV k="Iterations" v={e.budget_usage.actual_iterations} />
                  <KV k="VPN tested" v={e.budget_usage.vpn_countries_tested.join(', ')} />
                  <KV k="Stop reason" v={<span className="text-accent-green text-[10px]">{e.budget_usage.stop_reason}</span>} />
                </div>
              </div>
            )}
          </Panel>

          <Panel title="Hypothesis" section="03">
            {m.hypotheses.map(h => (
              <div key={h.hypothesis_id} className="space-y-3">
                <div>
                  <div className="text-sm font-semibold">{h.title}</div>
                  <div className="text-[10px] text-ink-muted font-mono mt-0.5">{h.hypothesis_id}</div>
                </div>
                <div>
                  <div className="label mb-1">related IOCs</div>
                  <div className="flex flex-wrap gap-1">
                    {h.related_iocs.map(i => (
                      <span key={i} className="px-2 py-0.5 text-[10px] border divider rounded bg-bg-card font-mono">
                        {i}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="label mb-1">strong evidence definition</div>
                  <ul className="text-[11px] text-ink-secondary space-y-1">
                    {h.strong_evidence_definition.map((d, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-accent-green">✓</span>
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="label mb-1">stop condition</div>
                  <p className="text-[11px] text-ink-secondary">{h.stop_condition}</p>
                </div>
              </div>
            ))}
          </Panel>
        </div>

        {/* Center+Right: Experiments and evidence */}
        <div className="col-span-2 space-y-6">
          <Panel title="Experiments" section="04" subtitle="time-ordered iterations · each produces structured artifacts">
            {e ? (
              <ol className="space-y-3">
                {e.experiments.map(x => (
                  <li key={x.iteration} className="card p-3">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 text-[10px] tracking-widest border divider rounded bg-bg-base">
                            ITER {String(x.iteration).padStart(2, '0')}
                          </span>
                          <span className="text-sm font-semibold">{x.goal}</span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 text-[10px] tracking-widest border rounded bg-bg-card text-accent-amber border-accent-amber/30">
                        {x.country}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-[11px] mt-3">
                      <div>
                        <div className="label mb-1">tools</div>
                        <div className="flex flex-wrap gap-1">
                          {x.tools_used.map(t => (
                            <span key={t} className="px-1.5 py-0.5 text-[10px] border divider rounded font-mono">
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="label mb-1">hooks</div>
                        {x.hooks_enabled.length ? (
                          <div className="flex flex-wrap gap-1">
                            {x.hooks_enabled.map(h => (
                              <span
                                key={h}
                                className="px-1.5 py-0.5 text-[10px] border border-accent-green/30 rounded font-mono text-accent-green break-all"
                              >
                                {h.split('.').slice(-1)[0]}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[10px] text-ink-muted">none</span>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 text-xs text-ink-secondary">{x.result}</div>
                    {x.artifacts.length > 0 && (
                      <div className="mt-2">
                        <div className="label mb-1">artifacts</div>
                        <ul className="text-[10px] font-mono text-ink-muted space-y-0.5">
                          {x.artifacts.map(a => (
                            <li key={a}>{a}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div className="mt-3 pt-2 border-t border-edge/40 text-[10px] text-ink-muted">
                      next: <span className="text-ink-secondary">{x.next_decision}</span>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="text-xs text-ink-muted text-center py-8">
                Consumer is running. No completed experiments yet.
                <div className="mt-2 inline-flex items-center gap-2 text-[10px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-amber dot-pulse" />
                  in progress…
                </div>
              </div>
            )}
          </Panel>

          {e && (
            <Panel
              title="Evidence Board"
              section="05"
              subtitle="every IOC score must reference at least one artifact"
            >
              <div className="grid grid-cols-1 gap-3">
                {e.evidence_items.map(ev => (
                  <div key={ev.evidence_id} className="card p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-1.5 py-0.5 text-[10px] tracking-widest border divider rounded bg-bg-base">
                            {ev.type.replace(/_/g, ' ').toUpperCase()}
                          </span>
                          <span className="text-[10px] text-ink-muted font-mono">{ev.evidence_id}</span>
                        </div>
                        <div className="text-sm font-semibold">{ev.title}</div>
                        <div className="text-xs text-ink-secondary mt-1">{ev.description}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-ink-muted">confidence</div>
                        <div className="text-sm font-semibold tabular-nums">{(ev.confidence * 100).toFixed(0)}%</div>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-edge/40 flex flex-wrap items-center gap-2">
                      <div className="label">linked IOCs</div>
                      {ev.ioc_ids.map(i => (
                        <span key={i} className="px-1.5 py-0.5 text-[10px] border divider rounded bg-bg-base font-mono">
                          {i}
                        </span>
                      ))}
                    </div>
                    <div className="mt-2 text-[10px] font-mono text-ink-muted break-all">
                      {ev.artifact.path} · sha256:{ev.artifact.sha256.slice(7, 23)}…
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t divider">
                <div className="label mb-2">runtime trace</div>
                <ol className="space-y-1 text-[11px]">
                  {e.runtime_trace.map(t => (
                    <li key={t.step} className="flex gap-3 font-mono">
                      <span className="text-ink-muted tabular-nums">{String(t.step).padStart(2, '0')}</span>
                      <span className="text-ink-secondary">{t.event}</span>
                      {t.artifact_ref && (
                        <span className="text-accent-green text-[10px]">→ {t.artifact_ref}</span>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            </Panel>
          )}

          {e && (
            <Panel title="IOC Scores (dynamic)" section="06">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] tracking-widest text-ink-muted border-b divider">
                    <th className="text-left py-2 pr-3">ioc</th>
                    <th className="text-left px-3">level</th>
                    <th className="text-right px-3">conf</th>
                    <th className="text-left pl-3">reason</th>
                  </tr>
                </thead>
                <tbody>
                  {e.ioc_scores.map(s => {
                    const def = c.rubric.iocs.find(i => i.ioc_id === s.ioc_id);
                    return (
                      <tr key={s.ioc_id} className="border-b border-edge/40">
                        <td className="py-2 pr-3">
                          <div className="font-semibold">{def?.name ?? s.ioc_id}</div>
                          <div className="text-[10px] text-ink-muted font-mono">{s.ioc_id}</div>
                        </td>
                        <td className="px-3"><IocLevelBadge level={s.level} /></td>
                        <td className="px-3 text-right tabular-nums">{s.confidence.toFixed(2)}</td>
                        <td className="pl-3 text-ink-secondary text-[11px]">{s.reason}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
