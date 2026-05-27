import { BRIDGE_EVENTS } from '@/lib/mock-data';
import { Panel, KV } from '@/components/chrome/Panel';

const TYPE_COLORS: Record<string, string> = {
  QueueLockClaimed: 'text-ink-secondary border-ink-muted/40',
  InstallVerification: 'text-accent-blue border-accent-blue/30',
  StaticFunnelScorecard: 'text-accent-blue border-accent-blue/40',
  GateDecision: 'text-accent-amber border-accent-amber/40',
  StaticClosureReport: 'text-ink-secondary border-ink-muted/40',
  ReviewMissionPackage: 'text-accent-violet border-accent-violet/30',
  MissionAck: 'text-accent-blue border-accent-blue/30',
  MissionRejected: 'text-accent-red border-accent-red/30',
  ConsumerProgressUpdate: 'text-accent-amber border-accent-amber/30',
  DynamicEvidencePackage: 'text-accent-green border-accent-green/30',
  DeepInspectionReportDraft: 'text-accent-green border-accent-green/40',
};

const NODE_COLORS: Record<string, string> = {
  queue: 'text-ink-secondary',
  mission_control: 'text-accent-green',
  static_funnel: 'text-accent-blue',
  producer: 'text-accent-violet',
  consumer: 'text-accent-green',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'text-ink-muted',
  transferred: 'text-accent-amber',
  processed: 'text-accent-green',
  error: 'text-accent-red',
};

export default function BridgePage() {
  // Group events by case_key
  const byCase = BRIDGE_EVENTS.reduce((acc, ev) => {
    (acc[ev.case_key] ??= []).push(ev);
    return acc;
  }, {} as Record<string, typeof BRIDGE_EVENTS>);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[10px] text-ink-muted tracking-[0.3em] mb-1">// 03 PIXELBRIDGE</div>
        <h1 className="text-2xl font-semibold">Append-only Event Log</h1>
        <p className="text-sm text-ink-secondary mt-1">
          PixelBridge is transport only — every message is a typed package with checksum and case identity. Files are never edited after creation.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Panel title="Static Funnel" section="01">
          <BridgeColumn
            events={BRIDGE_EVENTS.filter(e => e.source === 'static_funnel' || e.source === 'queue')}
            color="blue"
          />
        </Panel>
        <Panel title="Mission Control" section="02">
          <BridgeColumn
            events={BRIDGE_EVENTS.filter(e => e.source === 'mission_control')}
            color="violet"
          />
        </Panel>
        <Panel title="In Transit" section="03">
          <BridgeColumn
            events={BRIDGE_EVENTS.filter(e => e.status === 'transferred')}
            color="amber"
          />
        </Panel>
        <Panel title="Consumer Outbox" section="04">
          <BridgeColumn
            events={BRIDGE_EVENTS.filter(e => e.source === 'consumer')}
            color="green"
          />
        </Panel>
      </div>

      <Panel title="Event Stream" section="05" subtitle="all messages in chronological order">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] tracking-widest text-ink-muted border-b divider">
              <th className="text-left py-2 pr-3">timestamp</th>
              <th className="text-left px-3">event_type</th>
              <th className="text-left px-3">message_id</th>
              <th className="text-left px-3">flow</th>
              <th className="text-right px-3">size</th>
              <th className="text-right px-3">status</th>
              <th className="text-left pl-3">checksum</th>
            </tr>
          </thead>
          <tbody>
            {BRIDGE_EVENTS.map(ev => (
              <tr key={ev.event_id} className="border-b border-edge/40 hover:bg-bg-card">
                <td className="py-2 pr-3 font-mono text-[10px] text-ink-secondary">
                  {new Date(ev.created_at).toLocaleString()}
                </td>
                <td className="px-3">
                  <span className={`px-2 py-0.5 text-[10px] tracking-widest border rounded bg-bg-card ${TYPE_COLORS[ev.event_type]}`}>
                    {ev.event_type}
                  </span>
                </td>
                <td className="px-3 font-mono text-[10px] text-ink-muted">{ev.message_id}</td>
                <td className="px-3 text-[10px]">
                  <span className={NODE_COLORS[ev.source] ?? 'text-ink-secondary'}>{ev.source}</span>
                  <span className="text-ink-muted mx-1">→</span>
                  <span className={NODE_COLORS[ev.target] ?? 'text-ink-secondary'}>{ev.target}</span>
                </td>
                <td className="px-3 text-right tabular-nums text-ink-secondary">
                  {ev.size_bytes.toLocaleString()}b
                </td>
                <td className={`px-3 text-right text-[10px] tracking-widest ${STATUS_COLORS[ev.status]}`}>
                  {ev.status}
                </td>
                <td className="pl-3 font-mono text-[10px] text-ink-muted">
                  {ev.checksum.slice(7, 23)}…
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel title="By Case" section="06" subtitle="all events grouped by case_key">
        <div className="space-y-4">
          {Object.entries(byCase).map(([caseKey, events]) => (
            <div key={caseKey} className="card p-3">
              <div className="text-[10px] font-mono text-ink-muted mb-3">{caseKey}</div>
              <div className="space-y-2">
                {events.map(ev => (
                  <div key={ev.event_id} className="flex items-center gap-3 text-[11px]">
                    <span className="text-ink-muted font-mono w-32">
                      {new Date(ev.created_at).toLocaleTimeString()}
                    </span>
                    <span className={`px-2 py-0.5 text-[10px] tracking-widest border rounded bg-bg-base ${TYPE_COLORS[ev.event_type]}`}>
                      {ev.event_type}
                    </span>
                    <span className="text-ink-muted">
                      {ev.source} → {ev.target}
                    </span>
                    <span className={`text-[10px] tracking-widest ml-auto ${STATUS_COLORS[ev.status]}`}>
                      {ev.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid grid-cols-2 gap-6">
        <Panel title="Protocol Rules" section="07">
          <ul className="space-y-2 text-xs text-ink-secondary">
            <li><span className="text-accent-green">✓</span> Append-only — files never edited after creation</li>
            <li><span className="text-accent-green">✓</span> Atomic writes — .tmp → validate → atomic rename to .json</li>
            <li><span className="text-accent-green">✓</span> Checksum required on every event</li>
            <li><span className="text-accent-green">✓</span> Idempotent — duplicate message_id ignored safely</li>
            <li><span className="text-accent-green">✓</span> Schema-validated — invalid messages → NACK + dead-letter</li>
            <li><span className="text-accent-green">✓</span> Case identity in every payload</li>
          </ul>
        </Panel>
        <Panel title="Event Types" section="08">
          <div className="space-y-1.5 text-[11px]">
            {Object.entries(TYPE_COLORS).map(([type, color]) => (
              <div key={type} className="flex items-center gap-3">
                <span className={`px-2 py-0.5 text-[10px] tracking-widest border rounded bg-bg-card ${color}`}>
                  {type}
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function BridgeColumn({
  events,
  color,
}: {
  events: typeof BRIDGE_EVENTS;
  color: 'violet' | 'amber' | 'green' | 'blue';
}) {
  const colorClass = {
    violet: 'border-accent-violet/20',
    amber: 'border-accent-amber/20',
    green: 'border-accent-green/20',
    blue: 'border-accent-blue/20',
  }[color];
  if (events.length === 0) {
    return <div className="text-xs text-ink-muted text-center py-4">empty</div>;
  }
  return (
    <div className="space-y-2">
      {events.map(ev => (
        <div key={ev.event_id} className={`bg-bg-card p-2 rounded border ${colorClass}`}>
          <div className={`text-[10px] tracking-widest ${TYPE_COLORS[ev.event_type].split(' ')[0]}`}>
            {ev.event_type}
          </div>
          <div className="text-[10px] font-mono text-ink-muted mt-1 truncate">{ev.message_id}</div>
          <div className="flex justify-between items-center mt-2">
            <span className="text-[10px] text-ink-muted tabular-nums">{ev.size_bytes.toLocaleString()}b</span>
            <span className={`text-[10px] tracking-widest ${STATUS_COLORS[ev.status]}`}>{ev.status}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
