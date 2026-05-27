import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCaseByReviewId, getCaseKey, getCaseLogs } from '@/lib/mock-data';
import { LogViewer } from '@/components/evidence/LogViewer';
import { Panel, KV } from '@/components/chrome/Panel';
import { GateBadge, IocLevelBadge, PriorityBadge, StatusBadge, VerdictBadge } from '@/components/status/StatusBadge';
import { ScoreBar } from '@/components/score/ScoreBar';
import { ScoreChip } from '@/components/score/ScoreNumber';
import { ArtifactJsonViewer } from '@/components/artifact/ArtifactJsonViewer';
import { TraceWithEvidence } from '@/components/evidence/TraceWithEvidence';
import { QueueLockHeartbeat } from '@/components/pipeline/QueueLockHeartbeat';
import { EvidenceBoard } from '@/components/evidence/EvidenceBoard';
import { EscalatedByRuleBanner } from '@/components/pipeline/EscalatedByRuleBanner';

export default async function CaseDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = getCaseByReviewId(id);
  if (!c) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/producer" className="text-xs text-ink-muted hover:text-accent-green tracking-widest">
            ← BACK TO QUEUE
          </Link>
          <div className="text-[10px] text-ink-muted tracking-[0.3em] mt-3 mb-1">
            // CASE FILE · {c.case_identity.category_name.toUpperCase()}
          </div>
          <h1 className="text-2xl font-semibold">{c.case_identity.app_name}</h1>
          <div className="text-xs text-ink-secondary font-mono mt-1">
            {c.case_identity.app_review_id} · {c.case_identity.package_name} v{c.case_identity.version_code}
          </div>
        </div>
        <div className="flex flex-col gap-2 items-end">
          <QueueLockHeartbeat lock={c.queue_lock} />
          <PriorityBadge priority={c.priority} />
          <StatusBadge status={c.producer_status} side="producer" />
          {c.consumer_status && <StatusBadge status={c.consumer_status} side="consumer" />}
          {c.gate_decision && <GateBadge status={c.gate_decision.status} />}
        </div>
      </div>

      <FunnelChain c={c} />

      {c.gate_decision && <EscalatedByRuleBanner gate={c.gate_decision} />}

      {c.exploratory_finding && (
        <div className="panel border-accent-violet/40 bg-accent-violet/5 p-5">
          <div className="flex items-baseline justify-between mb-3">
            <div className="flex items-baseline gap-3">
              <span className="px-2 py-1 text-[10px] tracking-widest border border-accent-violet/40 rounded bg-accent-violet/10 text-accent-violet">
                EXPLORATORY FINDING
              </span>
              <span className="text-[10px] text-accent-violet font-mono">
                {c.exploratory_finding.unanticipated_ioc_id}
              </span>
            </div>
            <span className="text-[10px] text-ink-muted">
              breathing-room budget used: {c.exploratory_finding.budget_breathing_room_used_minutes}m
            </span>
          </div>
          <div className="text-base font-semibold mb-1">{c.exploratory_finding.unanticipated_ioc_name}</div>
          <p className="text-xs text-ink-secondary mb-3 leading-relaxed">
            {c.exploratory_finding.description}
          </p>
          <div className="grid grid-cols-3 gap-4 mb-3">
            <div className="card p-2">
              <div className="text-[10px] text-ink-muted tracking-widest mb-1">LEVEL</div>
              <span className="text-sm font-semibold text-accent-violet uppercase">{c.exploratory_finding.level}</span>
            </div>
            <div className="card p-2">
              <div className="text-[10px] text-ink-muted tracking-widest mb-1">CONFIDENCE</div>
              <span className="text-sm font-semibold tabular-nums">{(c.exploratory_finding.confidence * 100).toFixed(0)}%</span>
            </div>
            <div className="card p-2">
              <div className="text-[10px] text-ink-muted tracking-widest mb-1">EVIDENCE ARTIFACTS</div>
              <span className="text-sm font-semibold tabular-nums">{c.exploratory_finding.evidence_artifacts.length}</span>
            </div>
          </div>
          <div className="card p-3">
            <div className="text-[10px] tracking-widest text-ink-muted mb-1">WHY STATIC MISSED IT</div>
            <p className="text-xs text-ink-secondary">{c.exploratory_finding.why_static_missed_it}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="label mb-2">static score</div>
          <ScoreChip
            value={c.static_score}
            threshold={c.scorecard?.rubric_potential.threshold_for_dynamic_analysis}
            mode="higher_is_worse"
            label="STATIC"
          />
          <div className="mt-2 text-[10px] text-ink-muted">candidate evidence from rubric matching</div>
        </div>
        <div className="card p-4">
          <div className="label mb-2">dynamic score</div>
          <ScoreChip
            value={c.dynamic_score}
            threshold={c.scorecard?.rubric_potential.threshold_for_dynamic_analysis}
            mode="higher_is_worse"
            label="DYNAMIC"
          />
          <div className="mt-2 text-[10px] text-ink-muted">runtime-validated evidence</div>
        </div>
        <div className="card p-4">
          <div className="label mb-2">final score</div>
          <ScoreChip value={c.final_score} threshold={24} mode="higher_is_worse" label="FINAL" />
          {c.report && (
            <div className="mt-3 pt-3 border-t divider flex items-center justify-between">
              <span className="text-[10px] text-ink-muted">verdict</span>
              <VerdictBadge verdict={c.report.verdict_candidate} />
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left column: identity, metadata, lock */}
        <div className="col-span-1 space-y-6">
          <Panel title="Case Identity" section="01">
            <div className="space-y-1">
              <KV k="App review ID" v={c.case_identity.app_review_id} />
              <KV k="Queue item" v={c.case_identity.queue_item_id} />
              <KV k="Package" v={c.case_identity.package_name} />
              <KV k="Version" v={`${c.case_identity.version_name} (${c.case_identity.version_code})`} />
              <KV k="Category" v={c.case_identity.category_name} />
              <KV k="Case key" v={<span className="text-[10px]">{getCaseKey(c)}</span>} />
            </div>
          </Panel>

          <Panel title="Queue Lock" section="02" subtitle="lease, not permanent lock">
            <div className="space-y-1">
              <KV k="Lock ID" v={<span className="text-[10px]">{c.queue_lock.lock_id}</span>} />
              <KV k="Locked by" v={c.queue_lock.locked_by} />
              <KV k="Locked at" v={new Date(c.queue_lock.locked_at).toLocaleString()} />
              <KV k="Expires at" v={new Date(c.queue_lock.lock_expires_at).toLocaleString()} />
              <KV k="Status" v={c.queue_lock.status} />
            </div>
          </Panel>

          <Panel title="Install Verification" section="03" subtitle="short-circuits the funnel on failure">
            {c.install_verification ? (
              <div className="space-y-1">
                <KV
                  k="Status"
                  v={
                    <span className={c.install_verification.status === 'success' ? 'text-accent-green' : 'text-accent-red'}>
                      {c.install_verification.status.toUpperCase()}
                    </span>
                  }
                />
                <KV k="Method" v={c.install_verification.install_method} />
                <KV k="Package detected" v={c.install_verification.package_detected ? 'yes' : 'no'} />
                <KV k="Version matches" v={c.install_verification.version_code_matches ? 'yes' : 'no'} />
                <KV k="Launchable activity" v={c.install_verification.launchable_activity_found ? 'yes' : 'no'} />
                <KV k="First launch" v={c.install_verification.first_launch_success ? 'success' : 'failed'} />
                <KV k="Notes" v={<span className="text-[10px]">{c.install_verification.notes}</span>} />
              </div>
            ) : (
              <div className="text-xs text-ink-muted">Not yet run.</div>
            )}
          </Panel>

          {c.slice_verification && (
            <Panel title="Slice Verification" section="·" subtitle="confirms the decompile produced usable output">
              <div className="space-y-1">
                <KV
                  k="Status"
                  v={
                    <span className={c.slice_verification.status === 'success' ? 'text-accent-green' : c.slice_verification.status === 'partial' ? 'text-accent-amber' : 'text-accent-red'}>
                      {c.slice_verification.status.toUpperCase()}
                    </span>
                  }
                />
                <KV k="Decompiler" v={c.slice_verification.decompiler} />
                <KV k="Classes decompiled" v={<span className="tabular-nums">{c.slice_verification.classes_decompiled.toLocaleString()}</span>} />
                <KV k="Classes failed" v={<span className="tabular-nums">{c.slice_verification.classes_failed}</span>} />
                <KV k="Manifest parsed" v={c.slice_verification.manifest_parsed ? 'yes' : 'no'} />
                <KV k="Resources parsed" v={c.slice_verification.resources_parsed ? 'yes' : 'no'} />
                <KV k="Obfuscation" v={c.slice_verification.obfuscation_detected ? 'detected' : 'none'} />
              </div>
              {c.slice_verification.obfuscation_notes && (
                <div className="mt-2 text-[10px] text-ink-muted">{c.slice_verification.obfuscation_notes}</div>
              )}
            </Panel>
          )}

          <Panel title="Producer Metadata" section="04" subtitle="non-public intelligence">
            <div className="space-y-1">
              <KV k="Developer country" v={c.metadata.developer_country} />
              <KV k="Reputation" v={c.metadata.developer_reputation} />
              <KV k="Account age" v={`${c.metadata.developer_account_age_days} days`} />
            </div>
            {c.metadata.prior_flags.length > 0 && (
              <div className="mt-3">
                <div className="label mb-2">prior flags</div>
                <ul className="text-[11px] text-ink-secondary space-y-1">
                  {c.metadata.prior_flags.map((f, i) => <li key={i}>· {f}</li>)}
                </ul>
              </div>
            )}
          </Panel>
        </div>

        {/* Right column: scorecard, gate, then static triage (only if dynamic was triggered) */}
        <div className="col-span-2 space-y-6">
          {c.scorecard ? (
            <Panel
              title="Static Funnel Scorecard"
              section="05"
              subtitle="StaticFunnelWorker → maps slice to rubric"
            >
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="card p-3">
                  <div className="label mb-1">candidate score</div>
                  <div className="text-2xl font-semibold tabular-nums">
                    {c.scorecard.rubric_potential.candidate_score}
                    <span className="text-sm text-ink-muted">
                      {' '}/ {c.scorecard.rubric_potential.threshold_for_dynamic_analysis} threshold
                    </span>
                  </div>
                </div>
                <div className="card p-3">
                  <div className="label mb-1">dynamic required?</div>
                  <div
                    className={`text-2xl font-semibold ${
                      c.scorecard.rubric_potential.requires_dynamic_analysis ? 'text-accent-violet' : 'text-ink-secondary'
                    }`}
                  >
                    {c.scorecard.rubric_potential.requires_dynamic_analysis ? 'YES' : 'NO'}
                  </div>
                </div>
                <div className="card p-3">
                  <div className="label mb-1">static slice</div>
                  <div className="text-xs space-y-1 mt-2">
                    <div className={c.scorecard.static_slice.manifest_parsed ? 'text-ink-secondary' : 'text-ink-muted'}>
                      ✓ manifest parsed
                    </div>
                    <div className={c.scorecard.static_slice.webview_usage_detected ? 'text-accent-amber' : 'text-ink-muted'}>
                      {c.scorecard.static_slice.webview_usage_detected ? '⚠ webview detected' : '— no webview'}
                    </div>
                    <div className={c.scorecard.static_slice.native_files_detected ? 'text-accent-amber' : 'text-ink-muted'}>
                      {c.scorecard.static_slice.native_files_detected ? '⚠ native files' : '— no native'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <div className="label mb-2">funnel reason</div>
                <p className="text-xs text-ink-secondary">{c.scorecard.rubric_potential.reason}</p>
              </div>

              <div>
                <div className="label mb-2">candidate IOCs</div>
                <div className="space-y-2">
                  {c.scorecard.candidate_iocs.map(ioc => {
                    const def = c.rubric.iocs.find(i => i.ioc_id === ioc.ioc_id);
                    return (
                      <div key={ioc.ioc_id} className="card p-3">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div>
                            <div className="text-sm font-semibold">{def?.name ?? ioc.ioc_id}</div>
                            <div className="text-[10px] text-ink-muted font-mono">{ioc.ioc_id}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <IocLevelBadge level={ioc.level} />
                            <span className="text-xs text-ink-muted">conf {ioc.confidence.toFixed(2)}</span>
                          </div>
                        </div>
                        <p className="text-xs text-ink-secondary">{ioc.reason}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {c.scorecard.missing_rubric_signals.length > 0 && (
                <div className="mt-4 pt-4 border-t divider">
                  <div className="label mb-2">missing strong signals (saves Consumer time)</div>
                  <ul className="space-y-1 text-[11px] text-ink-secondary">
                    {c.scorecard.missing_rubric_signals.map(m => (
                      <li key={m.ioc_id} className="flex gap-2">
                        <span className="text-ink-muted">−</span>
                        <span>
                          <span className="text-ink-primary">{m.ioc_name}</span> — {m.reason}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {c.scorecard.static_slice.candidate_flows.length > 0 && (
                <div className="mt-4 pt-4 border-t divider">
                  <div className="label mb-2">candidate control-flows</div>
                  <div className="space-y-2">
                    {c.scorecard.static_slice.candidate_flows.map(f => (
                      <div key={f.flow_id} className="card p-2 text-[11px] font-mono">
                        <div className="text-ink-secondary mb-1">{f.summary}</div>
                        <div className="text-[10px]">
                          <span className="text-accent-blue">{f.source}</span>
                          {f.transform && (
                            <>
                              <span className="text-ink-muted"> → </span>
                              <span className="text-accent-amber">{f.transform}</span>
                            </>
                          )}
                          <span className="text-ink-muted"> → </span>
                          <span className="text-accent-red">{f.sink}</span>
                          <span className="text-ink-muted"> · conf {f.confidence.toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Panel>
          ) : (
            <Panel title="Static Funnel Scorecard" section="05">
              <div className="text-xs text-ink-muted">Scorecard not yet generated. Static slice {c.static_slice_summary?.status ?? 'pending'}.</div>
            </Panel>
          )}

          {c.gate_decision && (
            <Panel title="Decision Gate" section="06" subtitle="deterministic routing policy applied">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="card p-3">
                  <div className="label mb-2">decision</div>
                  <GateBadge status={c.gate_decision.status} />
                  <div className="text-[10px] text-ink-muted mt-2">
                    next step: <span className="text-ink-secondary">{c.gate_decision.next_step}</span>
                  </div>
                </div>
                <div className="card p-3">
                  <div className="label mb-2">candidate score vs thresholds</div>
                  <div className="text-xs space-y-1">
                    <div>
                      <span className="text-ink-muted">score: </span>
                      <span className="font-semibold tabular-nums">{c.gate_decision.candidate_score}</span>
                    </div>
                    <div>
                      <span className="text-ink-muted">dynamic at: </span>
                      <span className="tabular-nums">≥ {c.gate_decision.policy_applied.dynamic_analysis_threshold}</span>
                    </div>
                    <div>
                      <span className="text-ink-muted">close below: </span>
                      <span className="tabular-nums">&lt; {c.gate_decision.policy_applied.auto_close_below_score}</span>
                    </div>
                    <div>
                      <span className="text-ink-muted">gray band: </span>
                      <span className="tabular-nums">
                        {c.gate_decision.policy_applied.human_review_band.min}–
                        {c.gate_decision.policy_applied.human_review_band.max}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {c.gate_decision.triggered_force_rules.length > 0 && (
                <div className="mb-4">
                  <div className="label mb-2">triggered force-dynamic rules</div>
                  <div className="flex flex-wrap gap-1">
                    {c.gate_decision.triggered_force_rules.map(r => (
                      <span
                        key={r}
                        className="px-2 py-0.5 text-[10px] tracking-widest border border-accent-violet/40 rounded bg-accent-violet/10 text-accent-violet font-mono"
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="label mb-2">explanation</div>
                <p className="text-xs text-ink-secondary">{c.gate_decision.explanation}</p>
              </div>
            </Panel>
          )}

          <Panel
            title="Pipeline Artifacts"
            section="·"
            subtitle="every typed artifact produced during this case — click any row to see its full structure"
          >
            <div className="space-y-2">
              <ArtifactJsonViewer
                artifactType="QueueLock"
                description="lease created by the queue automation"
                payload={c.queue_lock}
              />
              {c.metadata_scorecard && (
                <ArtifactJsonViewer
                  artifactType="MetadataScorecard"
                  description="The Scout's metadata-only score"
                  payload={c.metadata_scorecard}
                />
              )}
              {c.metadata_gate && (
                <ArtifactJsonViewer
                  artifactType="MetadataGateDecision"
                  description="deterministic metadata-gate routing"
                  payload={c.metadata_gate}
                />
              )}
              {c.metadata_closure_report && (
                <ArtifactJsonViewer
                  artifactType="MetadataClosureReport"
                  description="terminal — closed at metadata gate"
                  payload={c.metadata_closure_report}
                />
              )}
              {c.install_verification && (
                <ArtifactJsonViewer
                  artifactType="InstallVerification"
                  description="The Triager's install check"
                  payload={c.install_verification}
                />
              )}
              {c.static_slice_summary && (
                <ArtifactJsonViewer
                  artifactType="StaticSliceSummary"
                  description="structured fast static-slice output"
                  payload={c.static_slice_summary}
                />
              )}
              {c.scorecard && (
                <ArtifactJsonViewer
                  artifactType="StaticFunnelScorecard"
                  description="rubric scoring with candidate IOCs and missing strong signals"
                  payload={c.scorecard}
                />
              )}
              {c.gate_decision && (
                <ArtifactJsonViewer
                  artifactType="GateDecision"
                  description="static-gate routing"
                  payload={c.gate_decision}
                />
              )}
              {c.closure_report && (
                <ArtifactJsonViewer
                  artifactType="StaticClosureReport"
                  description="terminal — closed at static gate"
                  payload={c.closure_report}
                />
              )}
              {c.mission_package && (
                <ArtifactJsonViewer
                  artifactType="ReviewMissionPackage"
                  description="THE mission package sent to Consumer through PixelBridge"
                  payload={c.mission_package}
                  defaultExpanded
                />
              )}
              {c.evidence_package && (
                <ArtifactJsonViewer
                  artifactType="DynamicEvidencePackage"
                  description="Consumer's runtime evidence return"
                  payload={c.evidence_package}
                />
              )}
              {c.exploratory_finding && (
                <ArtifactJsonViewer
                  artifactType="ExploratoryFinding"
                  description="unanticipated IOC captured under budget breathing room"
                  payload={c.exploratory_finding}
                />
              )}
              {c.report && (
                <ArtifactJsonViewer
                  artifactType="DeepInspectionReport"
                  description="reviewer-ready output"
                  payload={c.report}
                />
              )}
            </div>
          </Panel>

          {/* Hooks/URLs/mission only relevant if gate routed to dynamic */}
          {c.mission_package && c.static_triage.top_ioc_candidates.length > 0 && (
            <>
              <div className="grid grid-cols-2 gap-6">
                <Panel title="Suspicious URLs" section="07">
                  {c.static_triage.suspicious_urls.length ? (
                    <ul className="space-y-2 text-xs">
                      {c.static_triage.suspicious_urls.map(u => (
                        <li key={u.url} className="card p-2">
                          <div className="font-mono text-[11px] text-accent-amber break-all">{u.url}</div>
                          <div className="text-[10px] text-ink-muted mt-1">{u.reason}</div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-xs text-ink-muted">None identified.</div>
                  )}
                </Panel>

                <Panel title="Suggested Hooks" section="08" subtitle="click any hook to see linked evidence + IOCs">
                  {c.static_triage.suggested_hooks.length ? (
                    <ul className="space-y-2 text-xs">
                      {c.static_triage.suggested_hooks.map(h => (
                        <li key={h.target} className="card overflow-hidden">
                          <details>
                            <summary className="p-2 cursor-pointer hover:bg-bg-hover">
                              <div className="font-mono text-[11px] text-accent-green break-all">{h.target}</div>
                              <div className="text-[10px] text-ink-muted mt-1">{h.goal}</div>
                            </summary>
                            <div className="px-2 pb-2 pt-1 border-t border-edge/50">
                              {(h.evidence_refs?.length ?? 0) > 0 ? (
                                <>
                                  <div className="text-[10px] text-ink-muted tracking-widest mb-1">CAPTURED EVIDENCE</div>
                                  <div className="space-y-1">
                                    {h.evidence_refs!.map(refId => {
                                      const ev = c.evidence_package?.evidence_items.find(e => e.evidence_id === refId);
                                      return (
                                        <a
                                          key={refId}
                                          href={`#evidence-${refId}`}
                                          className="block text-[10px] text-accent-green hover:underline"
                                        >
                                          {ev?.title ?? refId} →
                                        </a>
                                      );
                                    })}
                                  </div>
                                </>
                              ) : (
                                <div className="text-[10px] text-ink-muted">No evidence captured for this hook yet.</div>
                              )}
                              {(h.related_ioc_ids?.length ?? 0) > 0 && (
                                <div className="mt-2">
                                  <div className="text-[10px] text-ink-muted tracking-widest mb-1">RELATED IOCs</div>
                                  <div className="flex flex-wrap gap-1">
                                    {h.related_ioc_ids!.map(id => {
                                      const ioc = c.rubric.iocs.find(i => i.ioc_id === id);
                                      return (
                                        <span
                                          key={id}
                                          className="px-1.5 py-0.5 text-[9px] tracking-widest border border-ink-muted/30 rounded bg-bg-base text-ink-secondary"
                                        >
                                          {ioc?.name ?? id}
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          </details>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-xs text-ink-muted">No hook suggestions yet.</div>
                  )}
                </Panel>
              </div>

              {c.static_triage.execution_hypothesis.function_call_trace.length > 0 && (
                <Panel
                  title="Function Call Trace ↔ Evidence"
                  section="09"
                  subtitle="every static step paired with the dynamic evidence that confirmed (or didn't confirm) it"
                >
                  <TraceWithEvidence
                    steps={c.static_triage.execution_hypothesis.function_call_trace}
                    evidenceItems={c.evidence_package?.evidence_items}
                    rubric={c.rubric}
                  />
                </Panel>
              )}

              {c.evidence_package?.evidence_items && c.evidence_package.evidence_items.length > 0 && (
                <Panel
                  title="Evidence Board"
                  section="10"
                  subtitle="every artifact the Investigator produced, grouped by type — anchors linked from the trace"
                >
                  <EvidenceBoard items={c.evidence_package.evidence_items} rubric={c.rubric} />
                </Panel>
              )}

              {getCaseLogs(c.case_identity.app_review_id).length > 0 && (
                <Panel
                  title="Runtime Logs"
                  section="11"
                  subtitle="HTTP Toolkit + logcat + Frida hooks · highlights with INSIGHT badge"
                >
                  <LogViewer rows={getCaseLogs(c.case_identity.app_review_id)} />
                </Panel>
              )}

              {c.extracted_payloads && c.extracted_payloads.length > 0 && (
                <Panel
                  title="Extracted Payloads"
                  section="12"
                  subtitle="dropper / decrypted DEX / other binaries pulled off the device for offline forensics"
                >
                  <div className="space-y-3">
                    {c.extracted_payloads.map(p => (
                      <div key={p.payload_id} className="card p-3 border-accent-red/30">
                        <div className="flex items-baseline justify-between mb-2">
                          <span className="px-2 py-0.5 text-[10px] tracking-widest border border-accent-red/40 rounded bg-accent-red/10 text-accent-red font-mono">
                            {p.artifact_type.toUpperCase()}
                          </span>
                          <span className="text-[10px] text-ink-muted font-mono">{p.payload_id}</span>
                        </div>
                        <p className="text-xs text-ink-secondary mb-3">{p.description}</p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] font-mono">
                          <div className="text-ink-muted">on-device path</div>
                          <div className="text-ink-secondary text-right break-all">{p.source_path_on_device}</div>
                          <div className="text-ink-muted">bridge artifact</div>
                          <div className="text-ink-secondary text-right break-all">{p.bridge_artifact_path}</div>
                          <div className="text-ink-muted">size</div>
                          <div className="text-ink-secondary text-right tabular-nums">{p.size_bytes.toLocaleString()} bytes</div>
                          <div className="text-ink-muted">sha256</div>
                          <div className="text-ink-secondary text-right break-all">{p.sha256}</div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-edge/40 flex items-center justify-between">
                          <div className="flex flex-wrap gap-1">
                            {p.related_ioc_ids.map(id => {
                              const ioc = c.rubric.iocs.find(i => i.ioc_id === id);
                              return (
                                <span
                                  key={id}
                                  className="px-1.5 py-0.5 text-[9px] tracking-widest border border-ink-muted/30 rounded bg-bg-base text-ink-secondary"
                                >
                                  {ioc?.name ?? id}
                                </span>
                              );
                            })}
                          </div>
                          <span
                            title="POC: in the real system this routes to /api/payloads/:id/download with auth + sha256 verification"
                            className="px-2.5 py-1 text-[10px] tracking-widest rounded border border-ink-muted/40 bg-bg-card text-ink-muted"
                          >
                            DEMO · DOWNLOAD WIRED IN PRODUCTION
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Panel>
              )}
            </>
          )}

          {/* Outcome CTA */}
          {c.report && (
            <Link
              href={`/producer/report/${c.case_identity.app_review_id}`}
              className="block panel p-4 hover:border-accent-green/40 transition-colors group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="label mb-1">deep inspection report ready</div>
                  <div className="text-sm font-semibold group-hover:text-accent-green">
                    Open deep inspection report →
                  </div>
                </div>
                <VerdictBadge verdict={c.report.verdict_candidate} />
              </div>
            </Link>
          )}

          {c.closure_report && (
            <Link
              href={`/producer/closure/${c.case_identity.app_review_id}`}
              className="block panel p-4 hover:border-ink-secondary/40 transition-colors group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="label mb-1">static closure report</div>
                  <div className="text-sm font-semibold group-hover:text-ink-primary">
                    Open static closure report →
                  </div>
                  <div className="text-[10px] text-ink-muted mt-1">
                    "{c.closure_report.final_status}"
                  </div>
                </div>
                <span className="px-2 py-1 text-[10px] tracking-widest border border-ink-muted/40 rounded bg-bg-card text-ink-secondary">
                  CLOSED
                </span>
              </div>
            </Link>
          )}

          {c.consumer_status && !c.report && (
            <Link
              href={`/consumer/mission/${c.case_identity.app_review_id}`}
              className="block panel p-4 hover:border-accent-amber/40 transition-colors group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="label mb-1">consumer workspace</div>
                  <div className="text-sm font-semibold group-hover:text-accent-amber">
                    View runtime evidence in progress →
                  </div>
                </div>
                <StatusBadge status={c.consumer_status} side="consumer" />
              </div>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function ScoreCard({
  label,
  value,
  max,
  color,
  verdict,
}: {
  label: string;
  value: number;
  max: number;
  color: 'green' | 'blue' | 'amber';
  verdict?: string;
}) {
  return (
    <div className="card p-4">
      <ScoreBar label={label} value={value} max={max} color={color} />
      {verdict && (
        <div className="mt-3 pt-3 border-t divider flex items-center justify-between">
          <span className="label">verdict</span>
          <VerdictBadge verdict={verdict} />
        </div>
      )}
    </div>
  );
}

function FunnelChain({
  c,
}: {
  c: ReturnType<typeof getCaseByReviewId> & {};
}) {
  if (!c) return null;
  const steps = [
    { label: 'queue lock', done: true, sublabel: c.queue_lock.locked_by },
    {
      label: 'install verify',
      done: !!c.install_verification,
      sublabel: c.install_verification?.status ?? '—',
      err: c.install_verification?.status === 'failed',
    },
    {
      label: 'static slice',
      done: c.static_slice_summary?.status === 'completed',
      sublabel: c.static_slice_summary?.status ?? '—',
    },
    {
      label: 'scorecard',
      done: !!c.scorecard,
      sublabel: c.scorecard ? `${c.scorecard.rubric_potential.candidate_score} / ${c.scorecard.rubric_potential.threshold_for_dynamic_analysis}` : '—',
    },
    {
      label: 'gate decision',
      done: !!c.gate_decision,
      sublabel: c.gate_decision?.status.replace(/_/g, ' ').toLowerCase() ?? '—',
    },
    {
      label: c.gate_decision?.status === 'CLOSE_EARLY_STATIC_INSUFFICIENT' ? 'closure report' : 'dynamic mission',
      done: !!c.mission_package || !!c.closure_report,
      sublabel: c.closure_report ? 'closed' : c.mission_package ? 'sent' : '—',
    },
    {
      label: 'evidence',
      done: !!c.evidence_package,
      sublabel: c.evidence_package?.execution_summary.status ?? (c.gate_decision?.status === 'CLOSE_EARLY_STATIC_INSUFFICIENT' ? 'n/a' : '—'),
      skip: c.gate_decision?.status === 'CLOSE_EARLY_STATIC_INSUFFICIENT',
    },
    {
      label: 'deep report',
      done: !!c.report,
      sublabel: c.report ? c.report.verdict_candidate : (c.gate_decision?.status === 'CLOSE_EARLY_STATIC_INSUFFICIENT' ? 'n/a' : '—'),
      skip: c.gate_decision?.status === 'CLOSE_EARLY_STATIC_INSUFFICIENT',
    },
  ];

  return (
    <Panel title="Funnel Chain" section="00" subtitle="every stage produces a typed artifact">
      <div className="flex items-stretch gap-0">
        {steps.map((s, i) => (
          <div key={i} className="flex-1 flex items-center">
            <div
              className={`flex-1 card p-3 text-center ${
                s.err
                  ? 'border-accent-red/40'
                  : s.done
                  ? 'border-accent-green/30'
                  : s.skip
                  ? 'border-ink-muted/20 opacity-50'
                  : 'border-ink-muted/30'
              }`}
            >
              <div
                className={`text-[10px] tracking-widest mb-1 ${
                  s.err ? 'text-accent-red' : s.done ? 'text-accent-green' : 'text-ink-muted'
                }`}
              >
                {s.done ? '✓' : s.skip ? '—' : '·'} {s.label}
              </div>
              <div className="text-[10px] text-ink-secondary truncate">{s.sublabel}</div>
            </div>
            {i < steps.length - 1 && (
              <div className="px-1 text-ink-muted text-[10px]">›</div>
            )}
          </div>
        ))}
      </div>
    </Panel>
  );
}
