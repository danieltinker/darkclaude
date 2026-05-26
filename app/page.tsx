import Link from 'next/link';
import { QUEUE_CASES, BRIDGE_EVENTS } from '@/lib/mock-data';
import { Panel, KV } from '@/components/Panel';
import { StatusBadge, PriorityBadge, VerdictBadge } from '@/components/StatusBadge';
import { ScoreBar } from '@/components/ScoreBar';

export default function Home() {
  const total = QUEUE_CASES.length;
  const reportsDrafted = QUEUE_CASES.filter(c => c.report).length;
  const consumerActive = QUEUE_CASES.filter(
    c => c.consumer_status && !['DONE', 'PACKAGE_SENT'].includes(c.consumer_status as string),
  ).length;
  const bridgeEvents = BRIDGE_EVENTS.length;

  return (
    <div className="space-y-8">
      <Hero />

      <div className="grid grid-cols-4 gap-4">
        <Stat label="cases in queue" value={total} accent="green" />
        <Stat label="bridge events" value={bridgeEvents} accent="blue" />
        <Stat label="consumer running" value={consumerActive} accent="amber" />
        <Stat label="reports drafted" value={reportsDrafted} accent="violet" />
      </div>

      <PipelineFlow />

      <Panel title="Active Cases" section="01" subtitle="every case carries a stable identity: review_id · package · version · category">
        <div className="space-y-2">
          {QUEUE_CASES.map(c => (
            <Link
              key={c.case_identity.app_review_id}
              href={`/producer/case/${c.case_identity.app_review_id}`}
              className="card block px-4 py-3 hover:border-accent-green/40 transition-colors"
            >
              <div className="grid grid-cols-12 gap-4 items-center">
                <div className="col-span-4">
                  <div className="text-sm font-semibold">{c.case_identity.app_name}</div>
                  <div className="text-[11px] text-ink-muted font-mono">
                    {c.case_identity.package_name} v{c.case_identity.version_code}
                  </div>
                </div>
                <div className="col-span-1">
                  <PriorityBadge priority={c.priority} />
                </div>
                <div className="col-span-2">
                  <StatusBadge status={c.producer_status} side="producer" />
                </div>
                <div className="col-span-2">
                  <StatusBadge status={c.consumer_status} side="consumer" />
                </div>
                <div className="col-span-1 text-xs text-ink-muted text-right">
                  static <span className="text-ink-primary tabular-nums">{c.static_score}</span>
                </div>
                <div className="col-span-1 text-xs text-ink-muted text-right">
                  dyn <span className="text-ink-primary tabular-nums">{c.dynamic_score}</span>
                </div>
                <div className="col-span-1 text-right">
                  {c.report ? (
                    <VerdictBadge verdict={c.report.verdict_candidate} />
                  ) : (
                    <span className="text-[10px] text-ink-muted">pending</span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </Panel>

      <div className="grid grid-cols-2 gap-6">
        <Panel title="Scoring Rubric" section="02" subtitle="weak = 2 · medium = 4 · strong = 8 · final = strongest level per unique IOC">
          <div className="space-y-3">
            <KV k="Static score" v="Producer candidate evidence" mono={false} />
            <KV k="Dynamic score" v="Consumer validation evidence" mono={false} />
            <KV k="Final score" v="max(static, dynamic) per IOC, summed" mono={false} />
            <KV k="Never" v="Double-count the same IOC across artifacts" mono={false} />
          </div>
        </Panel>
        <Panel title="Verdict Thresholds" section="03">
          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-3">
              <VerdictBadge verdict="benign" />
              <span className="text-ink-secondary">final &lt; 4</span>
            </div>
            <div className="flex items-center gap-3">
              <VerdictBadge verdict="inconclusive" />
              <span className="text-ink-secondary">4 ≤ final &lt; 12</span>
            </div>
            <div className="flex items-center gap-3">
              <VerdictBadge verdict="riskware" />
              <span className="text-ink-secondary">12 ≤ final &lt; 24</span>
            </div>
            <div className="flex items-center gap-3">
              <VerdictBadge verdict="malicious" />
              <span className="text-ink-secondary">final ≥ 24</span>
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Panel title="Golden Cases" section="04" subtitle="canonical scenarios the pipeline must handle">
          <div className="space-y-3">
            <div className="card p-3">
              <div className="text-xs text-accent-green tracking-widest mb-1">GRC-001</div>
              <div className="text-sm font-semibold mb-1">Riskware: C2 URL → WebView.loadUrl</div>
              <div className="text-xs text-ink-secondary">
                C2 endpoint returns a URL; app loads it in a hidden WebView. Strong evidence = network capture + hook log + screenshot.
              </div>
            </div>
            <div className="card p-3">
              <div className="text-xs text-accent-amber tracking-widest mb-1">GRC-002</div>
              <div className="text-sm font-semibold mb-1">Riskware: Remote config flag enables hidden behavior</div>
              <div className="text-xs text-ink-secondary">
                Server returns feature flag; app changes behavior. Strong evidence = config capture + behavior delta across geos.
              </div>
            </div>
          </div>
        </Panel>

        <Panel title="Architecture Spine" section="05" subtitle="infrastructure first; agents are abstract">
          <ol className="space-y-2 text-xs text-ink-secondary">
            <li><span className="text-accent-green">01</span> Identity — every case keyed by review_id + package + version + category</li>
            <li><span className="text-accent-green">02</span> Schemas — Pydantic-style typed contracts, JSON-schema exportable</li>
            <li><span className="text-accent-green">03</span> PixelBridge — append-only event files, atomic .tmp → .json</li>
            <li><span className="text-accent-green">04</span> State machines — Producer + Consumer transitions are deterministic</li>
            <li><span className="text-accent-green">05</span> Worker runtime — black-box adapter, no vendor coupling</li>
            <li><span className="text-accent-green">06</span> Scoring — strongest level per IOC, never double-count</li>
            <li><span className="text-accent-green">07</span> Report — Producer reconciles and submits</li>
          </ol>
        </Panel>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <div className="panel p-6 relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none">
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent-green rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-32 w-48 h-48 bg-accent-violet rounded-full blur-[120px]" />
      </div>
      <div className="relative">
        <div className="text-[10px] text-ink-muted tracking-[0.3em] mb-2">// SYSTEM OVERVIEW</div>
        <h1 className="text-2xl font-semibold mb-3">
          A two-sided malware-review OS where{' '}
          <span className="text-accent-green">static suspicion</span> becomes{' '}
          <span className="text-accent-amber">dynamic evidence</span>{' '}
          becomes a <span className="text-accent-violet">submission report</span>.
        </h1>
        <p className="text-sm text-ink-secondary max-w-3xl">
          Producer owns the queue, static triage, mission packaging, and reporting. Consumer owns runtime validation with budgeted experiments.
          PixelBridge is append-only transport — no chat, only typed packages. Workers are abstract black boxes behind stable contracts.
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent: 'green' | 'amber' | 'blue' | 'violet' }) {
  const colorMap = {
    green: 'text-accent-green',
    amber: 'text-accent-amber',
    blue: 'text-accent-blue',
    violet: 'text-accent-violet',
  };
  return (
    <div className="card px-4 py-4">
      <div className="label mb-2">{label}</div>
      <div className={`text-3xl font-semibold tabular-nums ${colorMap[accent]}`}>{value}</div>
    </div>
  );
}

function PipelineFlow() {
  return (
    <Panel title="Pipeline Flow" section="00" subtitle="data shapes that move between sides">
      <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] gap-4 items-stretch">
        <Stage
          step="01"
          title="PRODUCER"
          subtitle="Static intelligence"
          items={[
            'Queue intake + identity',
            'Metadata intelligence',
            'Static triage + IOC candidates',
            'Mission package builder',
          ]}
          accent="green"
        />
        <FlowArrow label="ReviewMissionPackage" />
        <Stage
          step="02"
          title="PIXELBRIDGE"
          subtitle="Append-only transport"
          items={[
            'Atomic .tmp → .json',
            'Checksum + schema validation',
            'ACK/NACK + dead-letter',
            'Idempotent by message_id',
          ]}
          accent="blue"
        />
        <FlowArrow label="DynamicEvidencePackage" reverse />
        <Stage
          step="03"
          title="CONSUMER"
          subtitle="Runtime evidence lab"
          items={[
            'Mission import + rubric check',
            'Budgeted experiments',
            'Hooks / network / screenshots',
            'Evidence package builder',
          ]}
          accent="violet"
        />
      </div>
    </Panel>
  );
}

function Stage({
  step,
  title,
  subtitle,
  items,
  accent,
}: {
  step: string;
  title: string;
  subtitle: string;
  items: string[];
  accent: 'green' | 'blue' | 'violet';
}) {
  const colorMap = {
    green: 'border-accent-green/40 text-accent-green',
    blue: 'border-accent-blue/40 text-accent-blue',
    violet: 'border-accent-violet/40 text-accent-violet',
  };
  return (
    <div className={`card p-4 border ${colorMap[accent].split(' ')[0]}`}>
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-[10px] text-ink-muted tracking-widest">{step}</span>
        <span className={`text-xs tracking-widest font-semibold ${colorMap[accent].split(' ')[1]}`}>{title}</span>
      </div>
      <div className="text-[11px] text-ink-secondary mb-3">{subtitle}</div>
      <ul className="space-y-1.5 text-[11px] text-ink-secondary">
        {items.map(i => (
          <li key={i} className="flex gap-2">
            <span className="text-ink-muted">▸</span>
            <span>{i}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FlowArrow({ label, reverse }: { label: string; reverse?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-2">
      <div className="text-[9px] text-ink-muted tracking-widest text-center max-w-[100px] leading-tight">
        {label}
      </div>
      <div className="relative w-full h-px">
        <div className="absolute inset-0 flow-line" />
      </div>
      <div className={`text-accent-green text-xs ${reverse ? 'rotate-180' : ''}`}>►</div>
    </div>
  );
}
