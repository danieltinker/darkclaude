import Link from 'next/link';
import { QUEUE_CASES } from '@/lib/mock-data';
import { Panel } from '@/components/chrome/Panel';
import { StatusBadge, PriorityBadge } from '@/components/status/StatusBadge';

export default function ConsumerInbox() {
  const visibleCases = QUEUE_CASES.filter(c => c.consumer_status !== null && c.mission_package);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[10px] text-ink-muted tracking-[0.3em] mb-1">// 03 CONSUMER</div>
        <h1 className="text-2xl font-semibold">Evidence Lab</h1>
        <p className="text-sm text-ink-secondary mt-1">
          Mission inbox, experiments, and runtime evidence. Consumer only sees what PixelBridge delivers.
        </p>
      </div>

      <Panel
        title="Incoming Missions"
        section="03.01"
        subtitle={`${visibleCases.length} active · imported from PixelBridge inbox`}
      >
        <div className="space-y-2">
          {visibleCases.map(c => (
            <Link
              key={c.case_identity.app_review_id}
              href={`/consumer/mission/${c.case_identity.app_review_id}`}
              className="card block px-4 py-3 hover:border-accent-amber/40 transition-colors"
            >
              <div className="grid grid-cols-12 gap-4 items-center">
                <div className="col-span-4">
                  <div className="text-sm font-semibold">{c.case_identity.app_name}</div>
                  <div className="text-[11px] text-ink-muted font-mono">
                    {c.case_identity.app_review_id} · {c.case_identity.category_name}
                  </div>
                </div>
                <div className="col-span-1">
                  <PriorityBadge priority={c.priority} />
                </div>
                <div className="col-span-3">
                  <StatusBadge status={c.consumer_status} side="consumer" />
                </div>
                <div className="col-span-2 text-xs text-ink-muted">
                  budget <span className="text-ink-primary">{c.mission_package!.consumer_budget.max_total_minutes}m</span>
                </div>
                <div className="col-span-2 text-xs text-ink-muted text-right">
                  {c.mission_package!.geo_execution_plan.recommended_vpn_countries.length} VPN countries
                </div>
              </div>
            </Link>
          ))}
        </div>
      </Panel>

      {visibleCases.length === 0 && (
        <div className="text-xs text-ink-muted text-center py-12">No missions in Consumer inbox.</div>
      )}
    </div>
  );
}
