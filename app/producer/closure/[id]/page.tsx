import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCaseByReviewId } from '@/lib/mock-data';
import { Panel, KV } from '@/components/Panel';
import { IocLevelBadge } from '@/components/StatusBadge';

export default async function ClosurePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = getCaseByReviewId(id);
  if (!c || !c.closure_report) notFound();

  const r = c.closure_report;

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
          // STATIC CLOSURE REPORT
        </div>
        <h1 className="text-2xl font-semibold">{c.case_identity.app_name}</h1>
        <div className="text-xs text-ink-secondary font-mono mt-1">
          {r.report_id} · drafted {new Date(r.created_at).toLocaleString()}
        </div>
      </div>

      <Panel title="Final Status" section="01">
        <div className="flex items-start gap-4">
          <span className="px-3 py-2 text-xs tracking-widest border border-ink-muted/40 rounded bg-bg-card text-ink-secondary">
            CLOSED
          </span>
          <div className="flex-1">
            <p className="text-sm font-semibold">{r.final_status}</p>
            <p className="text-xs text-ink-muted mt-2">
              Note: closure ≠ benign. This means the static funnel did not find enough rubric potential to justify deep dynamic analysis under the current policy.
            </p>
          </div>
        </div>
      </Panel>

      <div className="grid grid-cols-3 gap-6">
        <Panel title="Rubric Potential" section="02">
          <div className="space-y-1">
            <KV k="Candidate score" v={<span className="font-semibold tabular-nums">{r.rubric_potential.candidate_score}</span>} />
            <KV k="Threshold" v={<span className="tabular-nums">{r.rubric_potential.threshold_for_dynamic_analysis}</span>} />
            <KV k="Dynamic required?" v={r.rubric_potential.requires_dynamic_analysis ? 'YES' : 'NO'} />
          </div>
          <div className="mt-3 pt-3 border-t divider">
            <div className="label mb-2">funnel reason</div>
            <p className="text-xs text-ink-secondary">{r.rubric_potential.reason}</p>
          </div>
        </Panel>

        <Panel title="Install Verification" section="03">
          <div className="space-y-1">
            <KV
              k="Status"
              v={
                <span className={r.install_verification.status === 'success' ? 'text-accent-green' : 'text-accent-red'}>
                  {r.install_verification.status.toUpperCase()}
                </span>
              }
            />
            <KV k="Method" v={r.install_verification.install_method} />
            <KV k="First launch" v={r.install_verification.first_launch_success ? 'success' : 'failed'} />
            <KV k="Notes" v={<span className="text-[10px]">{r.install_verification.notes}</span>} />
          </div>
        </Panel>

        <Panel title="Decision Reason" section="04">
          <p className="text-xs text-ink-secondary">{r.decision_reason}</p>
        </Panel>
      </div>

      <Panel title="Checked IOCs" section="05" subtitle="every rubric IOC was evaluated; here is which matched and which did not">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] tracking-widest text-ink-muted border-b divider">
              <th className="text-left py-2 pr-3">ioc</th>
              <th className="text-left px-3">ioc_id</th>
              <th className="text-right pl-3">outcome</th>
            </tr>
          </thead>
          <tbody>
            {r.checked_iocs.map(ci => (
              <tr key={ci.ioc_id} className="border-b divider/40">
                <td className="py-2 pr-3 font-semibold">{ci.ioc_name}</td>
                <td className="px-3 text-[10px] text-ink-muted font-mono">{ci.ioc_id}</td>
                <td className="pl-3 text-right">
                  <span
                    className={`px-2 py-0.5 text-[10px] tracking-widest border rounded ${
                      ci.outcome === 'matched'
                        ? 'text-accent-amber border-accent-amber/30 bg-accent-amber/10'
                        : 'text-ink-muted border-ink-muted/30 bg-bg-card'
                    }`}
                  >
                    {ci.outcome === 'matched' ? 'MATCHED (WEAK)' : 'NOT MATCHED'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <div className="grid grid-cols-2 gap-6">
        <Panel title="Found Weak Signals" section="06" subtitle="not enough alone to justify dynamic">
          {r.found_weak_signals.length ? (
            <div className="space-y-2">
              {r.found_weak_signals.map(s => (
                <div key={s.ioc_id} className="card p-3">
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <div className="text-sm font-semibold">
                      {r.checked_iocs.find(ci => ci.ioc_id === s.ioc_id)?.ioc_name ?? s.ioc_id}
                    </div>
                    <IocLevelBadge level={s.level} />
                  </div>
                  <p className="text-xs text-ink-secondary">{s.reason}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-ink-muted">No matched signals.</div>
          )}
        </Panel>

        <Panel title="Missing Strong Signals" section="07" subtitle="the absences that drove the close-early decision">
          {r.missing_strong_signals.length ? (
            <ul className="space-y-2">
              {r.missing_strong_signals.map(m => (
                <li key={m.ioc_id} className="card p-3">
                  <div className="text-sm font-semibold mb-1">{m.ioc_name}</div>
                  <p className="text-xs text-ink-secondary">{m.reason}</p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-xs text-ink-muted">All strong signals were present.</div>
          )}
        </Panel>
      </div>

      <Panel title="Limitations" section="08" subtitle="what this closure does NOT prove">
        <ul className="text-xs text-ink-secondary space-y-1.5">
          {r.limitations.map((l, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-accent-amber">!</span>
              <span>{l}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
