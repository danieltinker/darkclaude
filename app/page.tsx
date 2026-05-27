import Link from 'next/link';
import { QUEUE_CASES } from '@/lib/mock-data';
import { RISKWARE_GATE_POLICY } from '@/lib/rubrics';
import { Panel } from '@/components/chrome/Panel';
import { GateBadge, PriorityBadge, StatusBadge, VerdictBadge } from '@/components/status/StatusBadge';

export default function Home() {
  const closedEarly = QUEUE_CASES.filter(c => c.producer_status === 'STATIC_INSUFFICIENT_CLOSED').length;
  const dynamicActive = QUEUE_CASES.filter(
    c => c.consumer_status && c.consumer_status !== 'EVIDENCE_RETURNED' && c.consumer_status !== 'DONE',
  ).length;
  const reportsReady = QUEUE_CASES.filter(c => c.report).length;

  return (
    <div className="space-y-10">
      <Hero />

      {/* Stats — visible at a glance */}
      <div className="grid grid-cols-4 gap-4">
        <Stat label="cases in queue" value={QUEUE_CASES.length} accent="green" />
        <Stat
          label="closed at the gate"
          value={closedEarly}
          accent="blue"
          hint="didn't need dynamic"
        />
        <Stat label="being investigated" value={dynamicActive} accent="amber" hint="consumer running" />
        <Stat label="ready for human" value={reportsReady} accent="violet" hint="deep report drafted" />
      </div>

      {/* HOW IT WORKS — the new plain-English story */}
      <HowItWorks />

      {/* Active cases */}
      <Panel title="Active Cases" section="·" subtitle="click any row to open the case file">
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
                <div className="col-span-3">
                  {c.gate_decision ? (
                    <GateBadge status={c.gate_decision.status} />
                  ) : (
                    <span className="text-[10px] text-ink-muted tracking-widest">— gate pending —</span>
                  )}
                </div>
                <div className="col-span-1 text-xs text-ink-muted text-right">
                  score <span className="text-ink-primary tabular-nums">{c.final_score || c.static_score}</span>
                </div>
                <div className="col-span-2 text-right">
                  {renderOutcomeBadge(c)}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </Panel>

      {/* SCORING — explained with concrete examples */}
      <ScoringGuide />

      {/* Gate policy + golden cases — keep but tighter */}
      <div className="grid grid-cols-2 gap-6">
        <Panel title="Gate Policy" section="·" subtitle="how the gate routes a case based on its score">
          <div className="space-y-3 text-xs">
            <PolicyRow
              label="Investigate deeper"
              cond={`score ≥ ${RISKWARE_GATE_POLICY.dynamic_analysis_threshold}`}
              color="violet"
            />
            <PolicyRow
              label="Send to human reviewer"
              cond={`score ${RISKWARE_GATE_POLICY.human_review_band.min}–${RISKWARE_GATE_POLICY.human_review_band.max} (gray band)`}
              color="amber"
            />
            <PolicyRow
              label="Close early"
              cond={`score < ${RISKWARE_GATE_POLICY.auto_close_below_score} and no override rule`}
              color="muted"
            />
          </div>
          <div className="mt-4 pt-4 border-t divider">
            <div className="text-[10px] text-ink-muted tracking-widest mb-2">override rules (escalate even at low score)</div>
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

        <Panel title="Golden Cases" section="·" subtitle="the scenarios the pipeline must handle">
          <div className="space-y-3">
            <div className="card p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-accent-green tracking-widest">GRC-001</span>
                <VerdictBadge verdict="riskware" />
              </div>
              <div className="text-sm font-semibold mb-1">Server tells the app where to load</div>
              <div className="text-xs text-ink-secondary">
                A C2 endpoint returns a URL and the app loads it inside a hidden WebView. Proven dynamically with a network capture, hook log, and screenshot.
              </div>
            </div>
            <div className="card p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-accent-amber tracking-widest">GRC-002</span>
                <span className="text-[10px] text-ink-muted">in progress</span>
              </div>
              <div className="text-sm font-semibold mb-1">Server flag enables hidden behavior</div>
              <div className="text-xs text-ink-secondary">
                The app changes behavior based on a remote feature flag. Proven by comparing behavior across geographies.
              </div>
            </div>
            <div className="card p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-ink-secondary tracking-widest">CLOSURE</span>
                <span className="text-[10px] text-ink-muted">closed at gate</span>
              </div>
              <div className="text-sm font-semibold mb-1">Not enough rubric to investigate</div>
              <div className="text-xs text-ink-secondary">
                A notepad app with only weak WebView usage for bundled help. Gate closes with{' '}
                <em>"insufficient static rubric potential"</em> — never "benign".
              </div>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function renderOutcomeBadge(c: typeof QUEUE_CASES[number]) {
  if (c.report) return <VerdictBadge verdict={c.report.verdict_candidate} />;
  if (c.producer_status === 'METADATA_INSUFFICIENT_CLOSED') {
    return <span className="px-2 py-0.5 text-[10px] tracking-widest border border-ink-muted/40 rounded bg-bg-card text-ink-secondary">METADATA CLOSED</span>;
  }
  if (c.producer_status === 'STATIC_INSUFFICIENT_CLOSED') {
    return <span className="px-2 py-0.5 text-[10px] tracking-widest border border-ink-muted/40 rounded bg-bg-card text-ink-secondary">STATIC CLOSED</span>;
  }
  if (c.producer_status === 'FALSE_POSITIVE_CLOSED') {
    return <span className="px-2 py-0.5 text-[10px] tracking-widest border border-accent-blue/40 rounded bg-accent-blue/10 text-accent-blue">FALSE POSITIVE</span>;
  }
  if (c.producer_status === 'EXPLORATORY_FINDING_READY') {
    return <span className="px-2 py-0.5 text-[10px] tracking-widest border border-accent-violet/40 rounded bg-accent-violet/10 text-accent-violet">EXPLORATORY</span>;
  }
  return <span className="text-[10px] text-ink-muted">pending</span>;
}

function Hero() {
  return (
    <div className="panel p-8 relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none">
        <div className="absolute top-0 right-0 w-72 h-72 bg-accent-green rounded-full blur-[140px]" />
        <div className="absolute bottom-0 left-32 w-56 h-56 bg-accent-violet rounded-full blur-[140px]" />
      </div>
      <div className="relative max-w-3xl">
        <div className="text-[10px] text-ink-muted tracking-[0.3em] mb-3">// WHAT IS DARKCLAUDE?</div>
        <h1 className="text-3xl font-semibold mb-4 leading-tight">
          A malware-review assembly line that decides which apps deserve deep investigation
          — and writes the report when they do.
        </h1>
        <p className="text-sm text-ink-secondary leading-relaxed mb-6">
          Most apps in the queue don't have enough suspicious signals to justify expensive runtime analysis.
          A <span className="text-accent-blue">static funnel</span> reads each app fast, gives it a score,
          and a deterministic <span className="text-accent-amber">gate</span> decides:
          close the case now with a clear reason, or send it to a{' '}
          <span className="text-accent-violet">dynamic lab</span> for runtime evidence. The final{' '}
          <span className="text-accent-green">deep inspection report</span> goes to a human reviewer.
        </p>
        <Link
          href="/run"
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm tracking-widest rounded border border-accent-green/40 bg-accent-green/10 text-accent-green hover:brightness-125 transition-all"
        >
          ▶ RUN A CASE — WATCH THE PIPELINE
        </Link>
      </div>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: '1',
      title: 'Lock & score metadata',
      sub: 'queue lock · the scout',
      desc: 'Grabs one app off the queue and immediately scores it from metadata alone (publisher, account age, prior flags). No install yet — this is the cheapest filter.',
      color: 'green',
    },
    {
      n: '2',
      title: 'Look & score code',
      sub: 'the triager',
      desc: 'If metadata score is above threshold, install the app, run a fast static slice, and score it against the rubric — including what was NOT found.',
      color: 'blue',
    },
    {
      n: '3',
      title: 'Decide',
      sub: 'the gatekeeper',
      desc: 'Two gates in sequence (metadata, then static). Each is deterministic: high score or force-rule → investigate; low score → close with a clear reason; in between → human.',
      color: 'amber',
    },
    {
      n: '4',
      title: 'Investigate or close',
      sub: 'the investigator + the reporter',
      desc: 'Dynamic returns one of three honest outcomes: malicious, false positive, or exploratory finding (when runtime surprises us with an unanticipated IOC).',
      color: 'violet',
    },
  ];

  return (
    <section>
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-lg font-semibold">How it works</h2>
        <span className="text-[10px] text-ink-muted tracking-widest">4 STEPS · LEFT TO RIGHT</span>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {steps.map((s, i) => (
          <div key={s.n} className="relative">
            <div className={`card p-4 h-full border ${COLOR_BORDER[s.color]}`}>
              <div className="flex items-center gap-3 mb-3">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 ${COLOR_RING[s.color]}`}
                >
                  {s.n}
                </div>
                <div>
                  <div className="text-sm font-semibold">{s.title}</div>
                  <div className={`text-[10px] tracking-widest ${COLOR_TEXT[s.color]}`}>
                    {s.sub.toUpperCase()}
                  </div>
                </div>
              </div>
              <p className="text-xs text-ink-secondary leading-relaxed">{s.desc}</p>
            </div>
            {i < steps.length - 1 && (
              <div className="hidden lg:flex absolute -right-2 top-1/2 -translate-y-1/2 z-10 items-center justify-center w-4 h-4 rounded-full bg-bg-base text-ink-muted text-xs">
                →
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="text-xs text-ink-muted mt-4 leading-relaxed max-w-3xl">
        Each step produces a <span className="text-ink-secondary">typed artifact</span>{' '}
        (scorecard → gate decision → mission → evidence → report) that flows over an append-only file
        protocol called <Link href="/bridge" className="text-accent-green hover:underline">PixelBridge</Link>.
        Workers can be swapped (LLM, script, human) without changing the pipeline.
      </p>
    </section>
  );
}

function ScoringGuide() {
  return (
    <section>
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-lg font-semibold">How scoring works</h2>
        <span className="text-[10px] text-ink-muted tracking-widest">RUBRIC · RISKWARE V1</span>
      </div>
      <Panel title="" section="" subtitle="">
        <div className="grid grid-cols-3 gap-4 mb-6">
          <ScoreLevel
            level="weak"
            points={2}
            color="muted"
            example="Found a suspicious URL string in code, but no obvious flow to a WebView."
          />
          <ScoreLevel
            level="medium"
            points={4}
            color="amber"
            example="Code path shows a server response is passed to WebView.loadUrl — but we haven't run it."
          />
          <ScoreLevel
            level="strong"
            points={8}
            color="red"
            example="Runtime captured the server response AND WebView loaded it AND we have a screenshot."
          />
        </div>
        <div className="pt-4 border-t divider grid grid-cols-3 gap-6">
          <Rule
            title="Static = suspicion"
            body="The triager scores rubric items it can see in code. This is candidate evidence — not proof."
          />
          <Rule
            title="Dynamic = proof"
            body="The investigator scores only what it captured at runtime, and every score must point to an artifact."
          />
          <Rule
            title="Final = strongest, not summed"
            body="Each rubric item is scored once. We take the strongest level (static or dynamic) and add those up. Multiple evidence items for the same IOC don't stack."
          />
        </div>
        <div className="mt-6 pt-4 border-t divider">
          <div className="text-[10px] text-ink-muted tracking-widest mb-3">VERDICT THRESHOLDS</div>
          <div className="grid grid-cols-4 gap-2 text-xs">
            <VerdictRange label="benign" range="< 4" color="green" />
            <VerdictRange label="inconclusive" range="4–11" color="blue" />
            <VerdictRange label="riskware" range="12–23" color="amber" />
            <VerdictRange label="malicious" range="≥ 24" color="red" />
          </div>
        </div>
      </Panel>
    </section>
  );
}

// ─── small UI helpers ─────────────────────────────────────────────────

const COLOR_BORDER: Record<string, string> = {
  green: 'border-accent-green/40',
  blue: 'border-accent-blue/40',
  amber: 'border-accent-amber/40',
  violet: 'border-accent-violet/40',
};
const COLOR_RING: Record<string, string> = {
  green: 'border-accent-green/60 text-accent-green',
  blue: 'border-accent-blue/60 text-accent-blue',
  amber: 'border-accent-amber/60 text-accent-amber',
  violet: 'border-accent-violet/60 text-accent-violet',
};
const COLOR_TEXT: Record<string, string> = {
  green: 'text-accent-green',
  blue: 'text-accent-blue',
  amber: 'text-accent-amber',
  violet: 'text-accent-violet',
};

function Stat({
  label,
  value,
  accent,
  hint,
}: {
  label: string;
  value: number;
  accent: 'green' | 'amber' | 'blue' | 'violet';
  hint?: string;
}) {
  const colorMap = {
    green: 'text-accent-green',
    amber: 'text-accent-amber',
    blue: 'text-accent-blue',
    violet: 'text-accent-violet',
  };
  return (
    <div className="card px-4 py-4">
      <div className="label">{label}</div>
      <div className={`text-3xl font-semibold tabular-nums mt-2 ${colorMap[accent]}`}>{value}</div>
      {hint && <div className="text-[10px] text-ink-muted mt-1">{hint}</div>}
    </div>
  );
}

function PolicyRow({ label, cond, color }: { label: string; cond: string; color: 'violet' | 'amber' | 'muted' }) {
  const dotColor = {
    violet: 'bg-accent-violet',
    amber: 'bg-accent-amber',
    muted: 'bg-ink-muted',
  }[color];
  return (
    <div className="flex items-start gap-3">
      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 ${dotColor}`} />
      <div className="flex-1">
        <div className="text-sm font-semibold">{label}</div>
        <div className="text-[10px] text-ink-muted font-mono mt-0.5">{cond}</div>
      </div>
    </div>
  );
}

function ScoreLevel({
  level,
  points,
  example,
  color,
}: {
  level: 'weak' | 'medium' | 'strong';
  points: number;
  example: string;
  color: 'muted' | 'amber' | 'red';
}) {
  const colorMap = {
    muted: 'text-ink-secondary border-ink-muted/40',
    amber: 'text-accent-amber border-accent-amber/40',
    red: 'text-accent-red border-accent-red/40',
  };
  return (
    <div className={`card p-4 border ${colorMap[color].split(' ')[1]}`}>
      <div className="flex items-baseline justify-between mb-2">
        <span className={`text-xs tracking-widest font-semibold ${colorMap[color].split(' ')[0]}`}>
          {level.toUpperCase()}
        </span>
        <span className="text-2xl font-semibold tabular-nums">+{points}</span>
      </div>
      <p className="text-xs text-ink-secondary leading-relaxed">{example}</p>
    </div>
  );
}

function Rule({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <div className="text-sm font-semibold mb-1.5">{title}</div>
      <p className="text-xs text-ink-secondary leading-relaxed">{body}</p>
    </div>
  );
}

function VerdictRange({ label, range, color }: { label: string; range: string; color: 'green' | 'blue' | 'amber' | 'red' }) {
  const dotColor = {
    green: 'bg-accent-green',
    blue: 'bg-accent-blue',
    amber: 'bg-accent-amber',
    red: 'bg-accent-red',
  }[color];
  return (
    <div className="card p-3 flex items-center gap-3">
      <div className={`w-2 h-2 rounded-full ${dotColor}`} />
      <div className="flex-1">
        <div className="text-xs font-semibold">{label}</div>
      </div>
      <div className="text-xs text-ink-muted font-mono">{range}</div>
    </div>
  );
}
