// TraceWithEvidence — renders the static function-call trace as an
// ordered step list where each step is the LEFT half of a (step, evidence)
// tuple. The RIGHT half shows the linked evidence items, the affected
// rubric IOCs, and a click target that scrolls to the evidence's anchor
// on the same page.

import type { EvidenceItem, FunctionCallTraceStep, IocRubric } from '@/lib/types';

type Props = {
  steps: FunctionCallTraceStep[];
  evidenceItems?: EvidenceItem[];
  rubric: IocRubric;
};

export function TraceWithEvidence({ steps, evidenceItems, rubric }: Props) {
  if (!steps.length) {
    return <div className="text-xs text-ink-muted">No trace recorded.</div>;
  }
  return (
    <ol className="space-y-3">
      {steps.map(step => {
        const linked = (step.evidence_refs ?? []).map(id =>
          evidenceItems?.find(ev => ev.evidence_id === id),
        ).filter(Boolean) as EvidenceItem[];
        const iocNames = (step.related_ioc_ids ?? []).map(id =>
          rubric.iocs.find(i => i.ioc_id === id)?.name ?? id,
        );
        const hasEvidence = linked.length > 0;
        return (
          <li key={step.order} className="card p-3">
            <div className="grid grid-cols-2 gap-4">
              {/* Left: the step */}
              <div>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-[10px] text-ink-muted tabular-nums">
                    {String(step.order).padStart(2, '0')}
                  </span>
                  <span className="text-[10px] tracking-widest text-ink-muted">STEP</span>
                </div>
                <div className="text-[11px] font-mono">
                  <span className="text-accent-blue">{step.class}</span>
                  <span className="text-ink-muted">.</span>
                  <span className="text-accent-green">{step.method}()</span>
                </div>
                <div className="text-[11px] text-ink-secondary mt-1">{step.reason}</div>
                {iocNames.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {iocNames.map((name, i) => (
                      <span
                        key={i}
                        className="px-1.5 py-0.5 text-[9px] tracking-widest border border-ink-muted/30 rounded bg-bg-base text-ink-secondary"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Right: the evidence */}
              <div
                className={`border-l ${hasEvidence ? 'border-accent-green/40' : 'border-ink-muted/20'} pl-4`}
              >
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-[10px] tracking-widest text-ink-muted">
                    {hasEvidence ? 'EVIDENCE' : 'NO RUNTIME EVIDENCE'}
                  </span>
                </div>
                {hasEvidence ? (
                  <div className="space-y-2">
                    {linked.map(ev => (
                      <a
                        key={ev.evidence_id}
                        href={`#evidence-${ev.evidence_id}`}
                        className="block group"
                      >
                        <div className="flex items-baseline justify-between">
                          <span className="text-[10px] tracking-widest text-accent-green font-mono">
                            {ev.type.replace(/_/g, ' ').toUpperCase()}
                          </span>
                          <span className="text-[10px] text-ink-muted group-hover:text-accent-green">
                            view ↓
                          </span>
                        </div>
                        <div className="text-xs font-semibold mt-0.5 group-hover:text-accent-green">
                          {ev.title}
                        </div>
                        <div className="text-[10px] text-ink-muted mt-0.5">
                          confidence {(ev.confidence * 100).toFixed(0)}% · sha256:
                          {ev.artifact.sha256.slice(7, 23)}…
                        </div>
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className="text-[11px] text-ink-muted leading-relaxed">
                    Static suspected this step. No runtime artifact captured for it.
                  </div>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
