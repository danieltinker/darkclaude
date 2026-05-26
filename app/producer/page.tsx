import Link from 'next/link';
import { QUEUE_CASES } from '@/lib/mock-data';
import { Panel } from '@/components/Panel';
import { StatusBadge, PriorityBadge, VerdictBadge } from '@/components/StatusBadge';

export default function ProducerQueue() {
  return (
    <div className="space-y-6">
      <div>
        <div className="text-[10px] text-ink-muted tracking-[0.3em] mb-1">// 01 PRODUCER</div>
        <h1 className="text-2xl font-semibold">Mission Command</h1>
        <p className="text-sm text-ink-secondary mt-1">
          Review queue, static triage, and mission package builder. Producer owns the case until evidence returns.
        </p>
      </div>

      <Panel title="Queue" section="01.01" subtitle={`${QUEUE_CASES.length} cases · click any row for the case file`}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] tracking-widest text-ink-muted border-b divider">
                <th className="text-left py-2 pr-3">case identity</th>
                <th className="text-left px-3">category</th>
                <th className="text-left px-3">prio</th>
                <th className="text-left px-3">producer state</th>
                <th className="text-left px-3">consumer state</th>
                <th className="text-right px-3">static</th>
                <th className="text-right px-3">dyn</th>
                <th className="text-right px-3">final</th>
                <th className="text-right pl-3">verdict</th>
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
                        {c.case_identity.app_review_id} · {c.case_identity.package_name} v{c.case_identity.version_code}
                      </div>
                    </Link>
                  </td>
                  <td className="px-3 text-ink-secondary">{c.case_identity.category_name}</td>
                  <td className="px-3">
                    <PriorityBadge priority={c.priority} />
                  </td>
                  <td className="px-3">
                    <StatusBadge status={c.producer_status} side="producer" />
                  </td>
                  <td className="px-3">
                    <StatusBadge status={c.consumer_status} side="consumer" />
                  </td>
                  <td className="px-3 text-right tabular-nums">{c.static_score}</td>
                  <td className="px-3 text-right tabular-nums">{c.dynamic_score}</td>
                  <td className="px-3 text-right tabular-nums font-semibold">{c.final_score}</td>
                  <td className="pl-3 text-right">
                    {c.report ? <VerdictBadge verdict={c.report.verdict_candidate} /> : <span className="text-[10px] text-ink-muted">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
