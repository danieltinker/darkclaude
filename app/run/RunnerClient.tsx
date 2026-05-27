'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  PERSONA_META,
  SCENARIOS,
  SimArtifact,
  SimPersonaId,
  SimStage,
  Scenario,
} from '@/lib/simulator';

type StageStatus = 'pending' | 'running' | 'done';

const COLOR_MAP: Record<string, { ring: string; text: string; bg: string; border: string }> = {
  green: { ring: 'border-accent-green/60', text: 'text-accent-green', bg: 'bg-accent-green/10', border: 'border-accent-green/30' },
  blue: { ring: 'border-accent-blue/60', text: 'text-accent-blue', bg: 'bg-accent-blue/10', border: 'border-accent-blue/30' },
  amber: { ring: 'border-accent-amber/60', text: 'text-accent-amber', bg: 'bg-accent-amber/10', border: 'border-accent-amber/30' },
  violet: { ring: 'border-accent-violet/60', text: 'text-accent-violet', bg: 'bg-accent-violet/10', border: 'border-accent-violet/30' },
};

const SPEEDS = [
  { label: '1×', mult: 1 },
  { label: '2×', mult: 0.5 },
  { label: '4×', mult: 0.25 },
];

export function RunnerClient() {
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id);
  const [speedMult, setSpeedMult] = useState(1);
  const [status, setStatus] = useState<Record<string, StageStatus>>({});
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const scenario = SCENARIOS.find(s => s.id === scenarioId)!;

  function clearTimers() {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }

  function reset(initialPending = true) {
    clearTimers();
    setRunning(false);
    setFinished(false);
    if (initialPending) {
      const init: Record<string, StageStatus> = {};
      for (const s of scenario.stages) init[s.id] = 'pending';
      setStatus(init);
    }
  }

  // Reset whenever scenario changes
  useEffect(() => {
    reset(true);
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarioId]);

  function start() {
    clearTimers();
    const init: Record<string, StageStatus> = {};
    for (const s of scenario.stages) init[s.id] = 'pending';
    setStatus(init);
    setFinished(false);
    setRunning(true);

    let cursor = 0;
    function runStage(i: number) {
      if (i >= scenario.stages.length) {
        setRunning(false);
        setFinished(true);
        return;
      }
      const stage = scenario.stages[i];
      setStatus(prev => ({ ...prev, [stage.id]: 'running' }));
      const t = setTimeout(() => {
        setStatus(prev => ({ ...prev, [stage.id]: 'done' }));
        runStage(i + 1);
      }, stage.duration_ms * speedMult);
      timersRef.current.push(t);
    }
    runStage(cursor);
  }

  return (
    <div className="space-y-6">
      <header>
        <div className="text-[10px] text-ink-muted tracking-[0.3em] mb-1">// SIMULATOR · WATCH THE PIPELINE RUN</div>
        <h1 className="text-2xl font-semibold">Run a case</h1>
        <p className="text-sm text-ink-secondary mt-2 max-w-3xl">
          Pick a scenario and press Start. Each step shows the persona doing the work and the typed artifact it produces.
          One scenario is closed early by the gate; the other escalates to full dynamic analysis. Nothing here is live —
          just a deterministic walkthrough of the same artifacts you see elsewhere in the app.
        </p>
      </header>

      <ControlBar
        scenarioId={scenarioId}
        onScenarioChange={setScenarioId}
        running={running}
        finished={finished}
        speedMult={speedMult}
        onSpeedChange={setSpeedMult}
        onStart={start}
        onReset={() => reset(true)}
      />

      <ScenarioBanner scenario={scenario} />

      {/* Timeline */}
      <div className="space-y-3">
        {scenario.stages.map((stage, i) => (
          <StageCard
            key={stage.id}
            stage={stage}
            status={status[stage.id] ?? 'pending'}
            stepNumber={i + 1}
            isLast={i === scenario.stages.length - 1}
          />
        ))}
      </div>

      {/* Final CTA */}
      {finished && (
        <Link
          href={scenario.final_link}
          className="block panel p-5 hover:border-accent-green/40 transition-colors group"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="label mb-1">scenario complete</div>
              <div className="text-base font-semibold group-hover:text-accent-green">
                {scenario.final_link_label} →
              </div>
            </div>
            <OutcomeBadge tone={scenario.outcome_tone} label={scenario.outcome_label} />
          </div>
        </Link>
      )}
    </div>
  );
}

function ControlBar({
  scenarioId,
  onScenarioChange,
  running,
  finished,
  speedMult,
  onSpeedChange,
  onStart,
  onReset,
}: {
  scenarioId: string;
  onScenarioChange: (id: string) => void;
  running: boolean;
  finished: boolean;
  speedMult: number;
  onSpeedChange: (m: number) => void;
  onStart: () => void;
  onReset: () => void;
}) {
  return (
    <div className="panel p-4">
      <div className="grid grid-cols-[1fr_auto_auto] gap-4 items-center">
        <div>
          <div className="label mb-2">scenario</div>
          <div className="flex flex-wrap gap-2">
            {SCENARIOS.map(s => (
              <button
                key={s.id}
                onClick={() => onScenarioChange(s.id)}
                disabled={running}
                className={`px-3 py-2 text-xs tracking-wider rounded border transition-colors text-left ${
                  scenarioId === s.id
                    ? 'border-accent-green/40 bg-accent-green/10 text-accent-green'
                    : 'border-ink-muted/30 bg-bg-card text-ink-secondary hover:text-ink-primary hover:bg-bg-hover'
                } ${running ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                {s.title}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="label mb-2">speed</div>
          <div className="flex gap-1">
            {SPEEDS.map(s => (
              <button
                key={s.label}
                onClick={() => onSpeedChange(s.mult)}
                disabled={running}
                className={`px-3 py-2 text-xs tracking-wider rounded border ${
                  speedMult === s.mult
                    ? 'border-accent-green/40 bg-accent-green/10 text-accent-green'
                    : 'border-ink-muted/30 bg-bg-card text-ink-secondary hover:text-ink-primary'
                } ${running ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="label mb-2">control</div>
          <div className="flex gap-2">
            {!running && !finished && (
              <button
                onClick={onStart}
                className="px-4 py-2 text-xs tracking-widest rounded border border-accent-green/40 bg-accent-green/10 text-accent-green hover:brightness-125"
              >
                ▶ START
              </button>
            )}
            {running && (
              <button
                disabled
                className="px-4 py-2 text-xs tracking-widest rounded border border-accent-amber/40 bg-accent-amber/10 text-accent-amber"
              >
                <span className="inline-block w-2 h-2 rounded-full bg-accent-amber mr-2 dot-pulse" />
                RUNNING
              </button>
            )}
            {finished && (
              <button
                onClick={onStart}
                className="px-4 py-2 text-xs tracking-widest rounded border border-accent-green/40 bg-accent-green/10 text-accent-green hover:brightness-125"
              >
                ↻ RUN AGAIN
              </button>
            )}
            <button
              onClick={onReset}
              disabled={running}
              className={`px-3 py-2 text-xs tracking-widest rounded border border-ink-muted/30 bg-bg-card text-ink-secondary hover:text-ink-primary ${
                running ? 'opacity-60 cursor-not-allowed' : ''
              }`}
            >
              RESET
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScenarioBanner({ scenario }: { scenario: Scenario }) {
  return (
    <div className="panel p-4 flex items-center justify-between">
      <div>
        <div className="text-sm font-semibold">{scenario.title}</div>
        <div className="text-xs text-ink-secondary mt-0.5">{scenario.subtitle}</div>
      </div>
      <div className="text-[10px] text-ink-muted font-mono">{scenario.case_id}</div>
    </div>
  );
}

function StageCard({
  stage,
  status,
  stepNumber,
  isLast,
}: {
  stage: SimStage;
  status: StageStatus;
  stepNumber: number;
  isLast: boolean;
}) {
  const meta = PERSONA_META[stage.persona];
  const colors = COLOR_MAP[meta.color];

  // Dim pending stages so the active stage stands out
  const opacityCls = status === 'pending' ? 'opacity-40' : 'opacity-100';
  const isRunning = status === 'running';
  const isDone = status === 'done';
  const isGate = stage.flavor === 'gate_decision' && isRunning;
  const isVerdict = stage.flavor === 'verdict' && isDone;

  return (
    <div className={`relative transition-opacity duration-300 ${opacityCls}`}>
      <div
        className={`card p-4 border ${
          isRunning
            ? `${colors.ring.replace('/60', '/40')}`
            : isDone
            ? 'border-accent-green/20'
            : 'border-ink-muted/20'
        }`}
      >
        <div className="flex items-start gap-4">
          {/* Persona avatar */}
          <div
            className={`w-12 h-12 rounded-lg flex items-center justify-center text-xs font-semibold border-2 flex-shrink-0 ${
              isDone
                ? `border-accent-green/40 bg-accent-green/10 text-accent-green`
                : isRunning
                ? `${colors.ring} ${colors.bg} ${colors.text}`
                : 'border-ink-muted/30 bg-bg-card text-ink-muted'
            }`}
          >
            {meta.monogram}
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-[10px] text-ink-muted tabular-nums">
                {String(stepNumber).padStart(2, '0')}
              </span>
              <span className={`text-[10px] tracking-widest ${colors.text}`}>{meta.name.toUpperCase()}</span>
              <StatusPill status={status} flavor={stage.flavor} />
            </div>
            <div className="text-sm font-semibold">{stage.label}</div>
            {isDone && (
              <div className="text-xs text-ink-secondary mt-1">{stage.sub}</div>
            )}
            {isRunning && (
              <div className="text-xs text-accent-amber mt-1 flex items-center gap-2">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent-amber dot-pulse" />
                processing…
              </div>
            )}
          </div>
        </div>

        {/* Artifact card — only when done */}
        {isDone && stage.artifact && (
          <ArtifactCard artifact={stage.artifact} highlight={isVerdict || (isDone && stage.flavor === 'gate_decision')} />
        )}

        {/* Special gate "deciding" pulse */}
        {isGate && <GateDeciding />}
      </div>

      {/* Connector line to next stage */}
      {!isLast && (
        <div className="flex justify-center py-1">
          <div
            className={`w-px h-3 ${
              status === 'done' ? 'bg-accent-green/40' : 'bg-ink-muted/30'
            }`}
          />
        </div>
      )}
    </div>
  );
}

function StatusPill({ status, flavor }: { status: StageStatus; flavor?: SimStage['flavor'] }) {
  if (status === 'pending') {
    return (
      <span className="px-1.5 py-0.5 text-[9px] tracking-widest border border-ink-muted/30 rounded bg-bg-card text-ink-muted">
        PENDING
      </span>
    );
  }
  if (status === 'running') {
    return (
      <span className="px-1.5 py-0.5 text-[9px] tracking-widest border border-accent-amber/40 rounded bg-accent-amber/10 text-accent-amber">
        {flavor === 'gate_decision' ? 'DECIDING' : 'RUNNING'}
      </span>
    );
  }
  return (
    <span className="px-1.5 py-0.5 text-[9px] tracking-widest border border-accent-green/40 rounded bg-accent-green/10 text-accent-green">
      DONE
    </span>
  );
}

function GateDeciding() {
  return (
    <div className="mt-3 p-4 border border-accent-amber/30 rounded bg-bg-base">
      <div className="text-[10px] text-accent-amber tracking-widest mb-2">EVALUATING POLICY</div>
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-accent-amber dot-pulse" />
        <span className="w-1.5 h-1.5 rounded-full bg-accent-amber dot-pulse" style={{ animationDelay: '0.3s' }} />
        <span className="w-1.5 h-1.5 rounded-full bg-accent-amber dot-pulse" style={{ animationDelay: '0.6s' }} />
      </div>
    </div>
  );
}

function ArtifactCard({ artifact, highlight }: { artifact: SimArtifact; highlight: boolean }) {
  const [showJson, setShowJson] = useState(false);
  const jsonString = JSON.stringify(artifact.full_payload, null, 2);
  return (
    <div
      className={`mt-3 border rounded p-3 ${
        highlight ? 'border-accent-green/40 bg-accent-green/5' : 'border-ink-muted/20 bg-bg-base'
      }`}
    >
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-[10px] tracking-widest text-accent-green font-mono">{artifact.type}</span>
        <span className="text-[10px] text-ink-muted">artifact produced</span>
      </div>
      <div className="text-sm font-semibold mb-2">{artifact.summary}</div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {artifact.details.map((d, i) => (
          <div key={i} className="flex justify-between gap-3 text-[11px] font-mono">
            <span className="text-ink-muted truncate">{d.k}</span>
            <span className="text-ink-secondary truncate text-right">{d.v}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-2 border-t border-ink-muted/20 flex items-center justify-between">
        <button
          onClick={() => setShowJson(!showJson)}
          className="text-[10px] tracking-widest text-ink-muted hover:text-accent-green"
        >
          {showJson ? '▴ HIDE FULL STRUCTURE' : '▾ VIEW FULL STRUCTURE'}
        </button>
        <span className="text-[10px] text-ink-muted">{jsonString.length.toLocaleString()} chars</span>
      </div>
      {showJson && (
        <pre className="mt-3 bg-bg-base border border-ink-muted/20 rounded p-3 text-[10px] text-ink-secondary leading-relaxed max-h-[400px] overflow-auto font-mono">
{jsonString}
        </pre>
      )}
    </div>
  );
}

function OutcomeBadge({ tone, label }: { tone: 'muted' | 'red' | 'blue' | 'violet'; label: string }) {
  const cls = {
    muted: 'border-ink-muted/40 bg-bg-card text-ink-secondary',
    red: 'border-accent-red/40 bg-accent-red/10 text-accent-red',
    blue: 'border-accent-blue/40 bg-accent-blue/10 text-accent-blue',
    violet: 'border-accent-violet/40 bg-accent-violet/10 text-accent-violet',
  }[tone];
  return (
    <span className={`px-3 py-1.5 text-xs tracking-widest border rounded ${cls}`}>
      {label}
    </span>
  );
}
