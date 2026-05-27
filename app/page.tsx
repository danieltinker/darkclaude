import Link from 'next/link';
import { QUEUE_CASES, BRIDGE_EVENTS } from '@/lib/mock-data';
import { RISKWARE_GATE_POLICY } from '@/lib/rubrics';
import { Panel, KV } from '@/components/Panel';
import { StatusBadge, PriorityBadge, VerdictBadge, GateBadge } from '@/components/StatusBadge';

export default function Home() {
  const total = QUEUE_CASES.length;
  const closedEarly = QUEUE_CASES.filter(c => c.producer_status === 'STATIC_INSUFFICIENT_CLOSED').length;
  const dynamicActive = QUEUE_CASES.filter(c => c.consumer_status && c.consumer_status !== 'EVIDENCE_PACKAGE_SENT' && c.consumer_status !== 'DONE').length;
  const reportsReady = QUEUE_CASES.filter(c => c.report).length;

  return (
    <div className="space-y-8">
      <Hero />

      <div className="grid grid-cols-4 gap-4">
        <Stat label="cases in queue" value={total} accent="green" />
        <Stat label="closed early at gate" value={closedEarly} accent="blue" />
        <Stat label="dynamic active" value={dynamicActive} accent="amber" />
        <Stat label="deep reports ready" value={reportsReady} accent="violet" />
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
              <div className="grid grid-cols-12 gap-3 items-center">
                <div className="col-span-3">
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
                  {c.gate_decision ? (
                    <GateBadge status={c.gate_decision.status} />
                  ) : (
                    <span className="text-[10px] text-ink-muted tracking-widest">— gate pending —</span>
                  )}
                </div>
                <div className="col-span-1">
                  <StatusBadge status={c.consumer_status} side="consumer" />
                </div>
                <div className="col-span-1 text-xs text-ink-muted text-right">
                  st <span className="text-ink-primary tabular-nums">{c.static_score}</span>
                </div>
                <div className="col-span-1 text-xs text-ink-muted text-right">
                  dyn <span className="text-ink-primary tabular-nums">{c.dynamic_score}</span>
                </div>
                <div className="col-span-1 text-right">
                  {c.report ? (
                    <VerdictBadge verdict={c.report.verdict_candidate} />
                  ) : c.closure_report ? (
                    <span className="px-2 py-0.5 text-[10px] tracking-widest border border-ink-muted/40 rounded bg-bg-card text-ink-secondary">
                      CLOSED
                    </span>
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
        <Panel title="Gate Policy" section="02" subtitle={`category: ${RISKWARE_GATE_POLICY.category_id}`}>
          <div className="space-y-2">
            <KV k="Dynamic analysis threshold" v={`score ≥ ${RISKWARE_GATE_POLICY.dynamic_analysis_threshold}`} />
            <KV k="Auto-close below" v={`score < ${RISKWARE_GATE_POLICY.auto_close_below_score}`} />
            <KV
              k="Human-review gray band"
              v={`${RISKWARE_GATE_POLICY.human_review_band.min} – ${RISKWARE_GATE_POLICY.human_review_band.max}`}
            />
          </div>
          <div className="mt-3">
            <div className="label mb-2">force-dynamic rules (override low score)</div>
            <div className="flex flex-wrap gap-1">
              {RISKWARE_GATE_POLICY.force_dynamic_if.map(r => (
                <span
                  key={r}
                  className="px-2 py-0.5 text-[10px] tracking-widest border border-accent-violet/30 rounded bg-bg-card text-accent-violet font-mono"
                >
                  {r}
                </span>
              ))}
            </div>
          </div>
        </Panel>
        <Panel title="Scoring Rubric" section="03" subtitle="weak = 2 · medium = 4 · strong = 8 · final = strongest per IOC">
          <div className="space-y-2">
            <KV k="Static score" v="Funnel candidate evidence" mono={false} />
            <KV k="Dynamic score" v="Consumer validation evidence" mono={false} />
            <KV k="Final score" v="max(static, dynamic) per IOC, summed" mono={false} />
            <KV k="Never" v="Double-count the same IOC across artifacts" mono={false} />
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
            <div className="card p-3">
              <div className="text-xs text-ink-secondary tracking-widest mb-1">CLOSURE-CASE</div>
              <div className="text-sm font-semibold mb-1">Closure: Lumen Notepad — funnel insufficient potential</div>
              <div className="text-xs text-ink-secondary">
                Static slice finds only weak WebView usage for bundled help. Gate closes early with explicit "insufficient static rubric potential" reason — not "benign".
              </div>
            </div>
          </div>
        </Panel>

        <Panel title="Architecture Spine" section="05" subtitle="funnel-first; agents are abstract">
          <ol className="space-y-2 text-xs text-ink-secondary">
            <li><span className="text-accent-green">01</span> Queue Lock — lease, dedupe, case identity creation</li>
            <li><span className="text-accent-green">02</span> Install Verification — short-circuits on failure</li>
            <li><span className="text-accent-green">03</span> Static Funnel — slice + scorecard + missing signals</li>
            <li><span className="text-accent-green">04</span> Decision Gate — deterministic routing policy</li>
            <li><span className="text-accent-green">05</span> Static Closure OR Dynamic Mission</li>
            <li><span className="text-accent-green">06</span> Evidence Collector — budgeted experiments</li>
            <li><span className="text-accent-green">07</span> Mission Control — reconcile + deep inspection report</li>
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
          A funnel-first malware-review OS:{' '}
          <span className="text-accent-blue">queue lock</span> →{' '}
          <span className="text-accent-blue">static funnel</span> →{' '}
          <span className="text-accent-amber">gate</span> →{' '}
          <span className="text-accent-violet">dynamic evidence</span> →{' '}
          <span className="text-accent-green">deep inspection report</span>.
        </h1>
        <p className="text-sm text-ink-secondary max-w-3xl">
          The funnel decides whether an app deserves expensive deep analysis at all. A deterministic gate routes
          insufficient cases to early closure (with an explicit reason — not "benign"), and only the cases with
          real rubric potential consume Consumer time. All workers are abstract black boxes behind stable contracts.
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
    <Panel title="Pipeline Flow" section="00" subtitle="funnel-first · gate routes to closure OR dynamic">
      <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] gap-3 items-stretch mb-4">
        <Stage
          step="01"
          title="QUEUE LOCK"
          subtitle="Infrastructure"
          items={['Lease + dedupe', 'CaseIdentity creation', 'Lock_expires_at safety']}
          accent="green"
        />
        <FlowArrow label="locked case" />
        <Stage
          step="02"
          title="STATIC FUNNEL"
          subtitle="First analysis worker"
          items={[
            'Install verification',
            'Static slice (structured)',
            'Rubric potential score',
            'Missing-signals report',
          ]}
          accent="blue"
        />
        <FlowArrow label="StaticFunnelScorecard" />
        <Stage
          step="03"
          title="DECISION GATE"
          subtitle="Deterministic policy"
          items={[
            'Threshold + gray band',
            'Force-dynamic rules',
            'Install-failure routing',
            'Audit-grade explanation',
          ]}
          accent="amber"
        />
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-stretch mb-4">
        <Stage
          step="04a"
          title="CLOSE EARLY"
          subtitle="Insufficient rubric potential"
          items={[
            'StaticClosureReport',
            'Says "insufficient", not "benign"',
            'Lists weak signals + missing strong signals',
          ]}
          accent="muted"
        />
        <div className="flex items-center justify-center text-[10px] text-ink-muted tracking-widest">OR</div>
        <Stage
          step="04b"
          title="DYNAMIC MISSION"
          subtitle="Only when gate routes here"
          items={[
            'Mission package built',
            'Hypothesis + VPN matrix',
            'Hooks + mocks + budget',
            'Sent via PixelBridge',
          ]}
          accent="violet"
        />
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] gap-3 items-stretch">
        <Stage
          step="05"
          title="PIXELBRIDGE"
          subtitle="Append-only transport"
          items={['Atomic .tmp → .json', 'Checksum + schema', 'ACK/NACK', 'Idempotent']}
          accent="blue"
        />
        <FlowArrow label="DynamicEvidencePackage" reverse />
        <Stage
          step="06"
          title="EVIDENCE COLLECTOR"
          subtitle="Consumer runtime lab"
          items={['Budgeted experiments', 'Hooks/network/screenshots', 'Dynamic IOC scoring']}
          accent="amber"
        />
        <FlowArrow label="evidence → reconciliation" />
        <Stage
          step="07"
          title="MISSION CONTROL"
          subtitle="Deep Inspection Report"
          items={[
            'Reconcile static + dynamic',
            'Human-review checklist',
            'Reviewer-ready output',
          ]}
          accent="green"
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
  accent: 'green' | 'blue' | 'violet' | 'amber' | 'muted';
}) {
  const colorMap = {
    green: 'border-accent-green/40 text-accent-green',
    blue: 'border-accent-blue/40 text-accent-blue',
    violet: 'border-accent-violet/40 text-accent-violet',
    amber: 'border-accent-amber/40 text-accent-amber',
    muted: 'border-ink-muted/40 text-ink-secondary',
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
