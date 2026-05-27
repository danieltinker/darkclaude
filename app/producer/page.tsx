import Link from 'next/link';
import { QUEUE_CASES } from '@/lib/mock-data';
import { Panel } from '@/components/Panel';
import { GateBadge, IocLevelBadge, PriorityBadge, StatusBadge, VerdictBadge } from '@/components/StatusBadge';

export default function ProducerQueue() {
  return (
    <div className="space-y-6">
      <div>
        <div className="text-[10px] text-ink-muted tracking-[0.3em] mb-1">// 01 MISSION CONTROL</div>
        <h1 className="text-2xl font-semibold">Mission Command</h1>
        <p className="text-sm text-ink-secondary mt-1">
          Queue, static funnel scorecards, gate decisions, deep inspection reports. Mission Control owns the case from lock to submission.
        </p>
      </div>

      <Panel title="Queue" section="01.01" subtitle={`${QUEUE_CASES.length} cases · click any row for the case file`}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] tracking-widest text-ink-muted border-b divider">
                <th className="text-left py-2 pr-3">case identity</th>
                <th className="text-left px-2">prio</th>
                <th className="text-left px-2">producer state</th>
                <th className="text-left px-2">install</th>
                <th className="text-right px-2">scorecard</th>
                <th className="text-left px-2">gate decision</th>
                <th className="text-left px-2">consumer</th>
                <th className="text-right px-2">final</th>
                <th className="text-right pl-2">outcome</th>
              </tr>
            </thead>
            <tbody>
              {QUEUE_CASES.map(c => (
                <tr
                  key={c.case_identity.app_review_id}
                  className="border-b divider/40 hover:bg-bg-card transition-colors"
                >
                  <td className="py-3 pr-3">
                    <Link href={`/producer/case/${c.case_identity.app_review_id}`}>
                      <div className="font-semibold">{c.case_identity.app_name}</div>
                      <div className="text-[10px] text-ink-muted font-mono">
                        {c.case_identity.app_review_id} · v{c.case_identity.version_code}
                      </div>
                    </Link>
                  </td>
                  <td className="px-2">
                    <PriorityBadge priority={c.priority} />
                  </td>
                  <td className="px-2">
                    <StatusBadge status={c.producer_status} side="producer" />
                  </td>
                  <td className="px-2">
                    {c.install_verification ? (
                      <span
                        className={`px-1.5 py-0.5 text-[10px] tracking-widest border rounded ${
                          c.install_verification.status === 'success'
                            ? 'text-accent-green border-accent-green/30 bg-accent-green/10'
                            : 'text-accent-red border-accent-red/30 bg-accent-red/10'
                        }`}
                      >
                        {c.install_verification.status === 'success' ? 'OK' : 'FAILED'}
                      </span>
                    ) : (
                      <span className="text-[10px] text-ink-muted">—</span>
                    )}
                  </td>
                  <td className="px-2 text-right">
                    {c.scorecard ? (
                      <span className="text-xs tabular-nums">
                        <span className="text-ink-primary font-semibold">{c.scorecard.rubric_potential.candidate_score}</span>
                        <span className="text-ink-muted"> /{c.scorecard.rubric_potential.threshold_for_dynamic_analysis}</span>
                      </span>
                    ) : (
                      <span className="text-[10px] text-ink-muted">—</span>
                    )}
                  </td>
                  <td className="px-2">
                    {c.gate_decision ? (
                      <GateBadge status={c.gate_decision.status} />
                    ) : (
                      <span className="text-[10px] text-ink-muted">— pending —</span>
                    )}
                  </td>
                  <td className="px-2">
                    <StatusBadge status={c.consumer_status} side="consumer" />
                  </td>
                  <td className="px-2 text-right tabular-nums font-semibold">{c.final_score || '—'}</td>
                  <td className="pl-2 text-right">
                    {c.report ? (
                      <VerdictBadge verdict={c.report.verdict_candidate} />
                    ) : c.closure_report ? (
                      <Link
                        href={`/producer/closure/${c.case_identity.app_review_id}`}
                        className="px-2 py-0.5 text-[10px] tracking-widest border border-ink-muted/40 rounded bg-bg-card text-ink-secondary hover:text-ink-primary"
                      >
                        CLOSED
                      </Link>
                    ) : (
                      <span className="text-[10px] text-ink-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid grid-cols-3 gap-4">
        <Panel title="Funnel Outcomes" section="01.02">
          <div className="space-y-2 text-xs">
            <Stat
              label="dynamic required"
              value={QUEUE_CASES.filter(c => c.gate_decision?.status === 'DYNAMIC_ANALYSIS_REQUIRED').length}
            />
            <Stat
              label="closed early"
              value={QUEUE_CASES.filter(c => c.gate_decision?.status === 'CLOSE_EARLY_STATIC_INSUFFICIENT').length}
            />
            <Stat
              label="gate pending"
              value={QUEUE_CASES.filter(c => !c.gate_decision).length}
            />
          </div>
        </Panel>
        <Panel title="Strongest Static Candidates" section="01.03">
          <div className="space-y-2">
            {QUEUE_CASES.filter(c => c.scorecard)
              .flatMap(c =>
                c.scorecard!.candidate_iocs.map(i => ({
                  app: c.case_identity.app_name,
                  ioc: c.rubric.iocs.find(r => r.ioc_id === i.ioc_id)?.name ?? i.ioc_id,
                  level: i.level,
                  conf: i.confidence,
                })),
              )
              .sort((a, b) => (b.conf - a.conf))
              .slice(0, 6)
              .map((row, i) => (
                <div key={i} className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="truncate text-ink-secondary">{row.app}</span>
                  <span className="truncate text-ink-muted">· {row.ioc}</span>
                  <IocLevelBadge level={row.level} />
                </div>
              ))}
          </div>
        </Panel>
        <Panel title="Awaiting Deep Report" section="01.04">
          {QUEUE_CASES.filter(c => c.consumer_status === 'DYNAMIC_RUNNING').length ? (
            <div className="space-y-2">
              {QUEUE_CASES.filter(c => c.consumer_status === 'DYNAMIC_RUNNING').map(c => (
                <Link
                  key={c.case_identity.app_review_id}
                  href={`/consumer/mission/${c.case_identity.app_review_id}`}
                  className="block card p-2 hover:border-accent-amber/40"
                >
                  <div className="text-xs font-semibold">{c.case_identity.app_name}</div>
                  <div className="text-[10px] text-ink-muted">consumer running…</div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-xs text-ink-muted">none</div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-secondary">{label}</span>
      <span className="text-base font-semibold tabular-nums">{value}</span>
    </div>
  );
}
