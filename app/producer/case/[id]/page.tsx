import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCaseByReviewId, getCaseKey } from '@/lib/mock-data';
import { Panel, KV } from '@/components/Panel';
import { StatusBadge, PriorityBadge, VerdictBadge, IocLevelBadge } from '@/components/StatusBadge';
import { ScoreBar } from '@/components/ScoreBar';

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
          <PriorityBadge priority={c.priority} />
          <StatusBadge status={c.producer_status} side="producer" />
          <StatusBadge status={c.consumer_status} side="consumer" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <ScoreCard label="static score" value={c.static_score} max={32} color="blue" />
        <ScoreCard label="dynamic score" value={c.dynamic_score} max={32} color="amber" />
        <ScoreCard label="final score" value={c.final_score} max={32} color="green" verdict={c.report?.verdict_candidate} />
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left column: case identity + metadata */}
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

          <Panel title="Producer Metadata" section="02" subtitle="non-public intelligence that shapes the dynamic plan">
            <div className="space-y-1">
              <KV k="Developer country" v={c.metadata.developer_country} />
              <KV k="Reputation" v={c.metadata.developer_reputation} />
              <KV k="Account age" v={`${c.metadata.developer_account_age_days} days`} />
            </div>
            <div className="mt-3">
              <div className="label mb-2">target markets</div>
              <div className="flex flex-wrap gap-1">
                {c.metadata.target_markets.length ? (
                  c.metadata.target_markets.map(m => (
                    <span key={m} className="px-2 py-0.5 text-[10px] border divider rounded bg-bg-card">
                      {m}
                    </span>
                  ))
                ) : (
                  <span className="text-[10px] text-ink-muted">none identified</span>
                )}
              </div>
            </div>
            <div className="mt-3">
              <div className="label mb-2">prior flags</div>
              {c.metadata.prior_flags.length ? (
                <ul className="text-[11px] text-ink-secondary space-y-1">
                  {c.metadata.prior_flags.map((f, i) => (
                    <li key={i}>· {f}</li>
                  ))}
                </ul>
              ) : (
                <span className="text-[10px] text-ink-muted">no prior signals</span>
              )}
            </div>
            <div className="mt-3">
              <div className="label mb-2">related packages</div>
              {c.metadata.related_packages.length ? (
                <ul className="text-[11px] text-ink-secondary font-mono space-y-1">
                  {c.metadata.related_packages.map(p => (
                    <li key={p}>· {p}</li>
                  ))}
                </ul>
              ) : (
                <span className="text-[10px] text-ink-muted">none</span>
              )}
            </div>
          </Panel>

          <Panel title="Geo Execution Plan" section="03">
            <div className="space-y-3">
              <div>
                <div className="label mb-1">baseline</div>
                <GeoChip
                  country={c.mission_package.geo_execution_plan.baseline_country.country}
                  role="baseline"
                  reason={c.mission_package.geo_execution_plan.baseline_country.reason}
                />
              </div>
              <div>
                <div className="label mb-1">recommended VPN</div>
                <div className="space-y-2">
                  {c.mission_package.geo_execution_plan.recommended_vpn_countries.map(g => (
                    <GeoChip key={g.country} country={g.country} role={g.role} reason={g.reason} priority={g.priority} />
                  ))}
                </div>
              </div>
            </div>
          </Panel>
        </div>

        {/* Middle column: static triage + IOC candidates */}
        <div className="col-span-2 space-y-6">
          <Panel
            title="Static Triage"
            section="04"
            subtitle="Producer's IOC candidate scoring against the riskware rubric"
          >
            <div className="space-y-3">
              {c.static_triage.top_ioc_candidates.length ? (
                c.static_triage.top_ioc_candidates.map(ioc => {
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
                })
              ) : (
                <div className="text-xs text-ink-muted">No static triage performed yet.</div>
              )}
            </div>

            {c.static_triage.execution_hypothesis.summary && (
              <div className="mt-4 pt-4 border-t divider">
                <div className="label mb-2">execution hypothesis</div>
                <p className="text-xs text-ink-secondary mb-3">{c.static_triage.execution_hypothesis.summary}</p>
                <div className="label mb-2">suspected flow</div>
                <ol className="text-[11px] text-ink-secondary space-y-1">
                  {c.static_triage.execution_hypothesis.suspected_flow.map((s, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-ink-muted font-mono tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {c.static_triage.execution_hypothesis.function_call_trace.length > 0 && (
              <div className="mt-4 pt-4 border-t divider">
                <div className="label mb-2">function call trace</div>
                <div className="space-y-1">
                  {c.static_triage.execution_hypothesis.function_call_trace.map(fc => (
                    <div key={fc.order} className="text-[11px] font-mono flex gap-2">
                      <span className="text-ink-muted tabular-nums">{String(fc.order).padStart(2, '0')}</span>
                      <span className="text-accent-blue">{fc.class}</span>
                      <span className="text-ink-muted">.</span>
                      <span className="text-accent-green">{fc.method}()</span>
                      <span className="text-ink-muted">— {fc.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Panel>

          <div className="grid grid-cols-2 gap-6">
            <Panel title="Suspicious URLs" section="05">
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

            <Panel title="Suggested Hooks" section="06" subtitle="passed to Consumer">
              {c.static_triage.suggested_hooks.length ? (
                <ul className="space-y-2 text-xs">
                  {c.static_triage.suggested_hooks.map(h => (
                    <li key={h.target} className="card p-2">
                      <div className="font-mono text-[11px] text-accent-green break-all">{h.target}</div>
                      <div className="text-[10px] text-ink-muted mt-1">{h.goal}</div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-xs text-ink-muted">No hook suggestions yet.</div>
              )}
            </Panel>
          </div>

          <Panel title="Mission Package" section="07" subtitle="exact JSON written to PixelBridge outbox">
            <div className="bg-bg-base border divider rounded p-3 max-h-[400px] overflow-auto">
              <pre className="text-[10px] text-ink-secondary leading-relaxed">
                {JSON.stringify(
                  {
                    schema_version: c.mission_package.schema_version,
                    event_type: c.mission_package.event_type,
                    message_id: c.mission_package.message_id,
                    case_identity: c.mission_package.case_identity,
                    rubric_reference: c.mission_package.rubric_reference,
                    static_triage: {
                      candidate_score: c.static_triage.candidate_score,
                      top_ioc_candidates: c.static_triage.top_ioc_candidates.length,
                    },
                    hypotheses: c.mission_package.hypotheses.map(h => h.title),
                    consumer_budget: c.mission_package.consumer_budget,
                    checksum: c.mission_package.checksum,
                  },
                  null,
                  2,
                )}
              </pre>
            </div>
          </Panel>

          {c.report && (
            <Link
              href={`/producer/report/${c.case_identity.app_review_id}`}
              className="block panel p-4 hover:border-accent-green/40 transition-colors group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="label mb-1">submission report ready</div>
                  <div className="text-sm font-semibold group-hover:text-accent-green">
                    Open submission report →
                  </div>
                </div>
                <VerdictBadge verdict={c.report.verdict_candidate} />
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

function GeoChip({
  country,
  role,
  reason,
  priority,
}: {
  country: string;
  role: string;
  reason: string;
  priority?: number;
}) {
  const roleColor =
    role === 'baseline'
      ? 'text-accent-blue border-accent-blue/30'
      : role === 'suspected_trigger'
      ? 'text-accent-amber border-accent-amber/30'
      : 'text-accent-violet border-accent-violet/30';
  return (
    <div className="card p-2">
      <div className="flex items-center gap-2 mb-1">
        <span className={`px-1.5 py-0.5 text-[10px] tracking-widest border rounded ${roleColor}`}>
          {country}
        </span>
        <span className="text-[10px] text-ink-muted tracking-widest">{role.replace(/_/g, ' ')}</span>
        {priority && <span className="text-[10px] text-ink-muted">p{priority}</span>}
      </div>
      <div className="text-[10px] text-ink-secondary">{reason}</div>
    </div>
  );
}
