// JourneyWizard — educational "status journey" stepper for the overview page.
// Renders the full pipeline lifecycle as a horizontal spine of numbered nodes,
// with the two gate closures (and their human-reopen loop) hanging off the
// spine as branch/exit cards. Static + explanatory: not bound to a single case.
//
// Server component — no 'use client', no hooks. `current` optionally highlights
// the active phase; everything before it is treated as "done".

import {
  PHASE_LABEL,
  PHASE_PASSED_NEXT,
  JOURNEY_SPINE,
  JOURNEY_BRANCHES,
  type JourneyPhase,
} from '@/lib/phase';

type NodeState = 'done' | 'active' | 'future';

const NODE_TONE: Record<NodeState, string> = {
  active: 'border-accent-green/60 text-accent-green bg-accent-green/10',
  done: 'border-accent-green/40 text-accent-green',
  future: 'border-ink-muted/30 text-ink-muted',
};

const LABEL_TONE: Record<NodeState, string> = {
  active: 'text-accent-green',
  done: 'text-ink-secondary',
  future: 'text-ink-muted',
};

function pad2(n: number): string {
  return String(n + 1).padStart(2, '0');
}

export function JourneyWizard({ current }: { current?: JourneyPhase }) {
  const activeIndex = current ? JOURNEY_SPINE.indexOf(current) : -1;

  const stateFor = (index: number): NodeState => {
    if (activeIndex < 0) return 'future';
    if (index < activeIndex) return 'done';
    if (index === activeIndex) return 'active';
    return 'future';
  };

  return (
    <div className="space-y-5">
      {/* main spine — horizontal stepper that wraps gracefully */}
      <div className="flex flex-wrap items-start gap-y-4">
        {JOURNEY_SPINE.map((phase, i) => {
          const state = stateFor(i);
          const hint = PHASE_PASSED_NEXT[phase];
          const isLast = i === JOURNEY_SPINE.length - 1;
          // connector segment is "complete" only when the node it leads INTO is done
          const segmentDone = activeIndex >= 0 && i < activeIndex;
          return (
            <div key={phase} className="flex items-start">
              <div className="group flex w-[112px] flex-col items-center text-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-mono ${NODE_TONE[state]}`}
                  aria-current={state === 'active' ? 'step' : undefined}
                >
                  {state === 'done' ? '✓' : pad2(i)}
                </div>
                <div className={`mt-1.5 text-[10px] leading-tight ${LABEL_TONE[state]}`}>
                  {PHASE_LABEL[phase]}
                </div>
                <div className="mt-0.5 text-[9px] text-ink-muted opacity-60 transition-opacity group-hover:opacity-100">
                  → {hint.next}
                </div>
              </div>
              {!isLast && (
                <div
                  className={`mt-4 h-px w-4 flex-shrink-0 ${segmentDone ? 'bg-accent-green/40' : 'bg-edge'}`}
                  aria-hidden="true"
                />
              )}
            </div>
          );
        })}
      </div>

      {/* branch / exit cards — the two gate closures off the spine */}
      <div className="grid gap-3 sm:grid-cols-2">
        {JOURNEY_BRANCHES.map(branch => {
          const isClosure = current === branch.phase;
          return (
            <div
              key={branch.phase}
              className={`card p-3 border-ink-muted/40 bg-bg-card text-ink-secondary ${
                isClosure ? 'ring-1 ring-accent-amber/40' : ''
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="label">exit branch</span>
                <span className="text-[9px] text-ink-muted">
                  branches from: {PHASE_LABEL[branch.from]}
                </span>
              </div>
              <div className="mt-1 text-[11px] text-ink-primary">
                {PHASE_LABEL[branch.phase]}
              </div>
              <div className="mt-1 text-[10px] text-ink-muted">{branch.note}</div>
              <div className="mt-2 inline-flex items-center gap-1 rounded border border-accent-amber/30 bg-accent-amber/5 px-1.5 py-0.5 text-[9px] text-accent-amber">
                ↺ human may reopen
              </div>
            </div>
          );
        })}
      </div>

      {/* legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-edge/40 pt-3 text-[10px] text-ink-muted">
        <span className="label">legend</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-accent-green/60 bg-accent-green/10" />
          <span className="text-ink-secondary">done / active</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-ink-muted/30" />
          <span>upcoming</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="text-accent-amber">↺</span>
          <span>human reopen loop</span>
        </span>
      </div>
    </div>
  );
}
