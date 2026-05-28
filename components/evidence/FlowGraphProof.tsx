'use client';

// FlowGraphProof — renders a generic RubricFlowGraph + a per-case
// IocProofInstance as a node-link chain. Each node pairs its path-pinned
// static signature with the dynamic evidence that proves it, carries a
// status, and contributes to the TP score only when proven. The human
// reviewer can reject any node ("not convinced") and flip the verdict.

import { useMemo, useState } from 'react';
import type {
  DynamicVerdict,
  FlowEdge,
  FlowNode,
  IocProofInstance,
  NodeProofStatus,
  RubricFlowGraph,
} from '@/lib/types';
import { DYNAMIC_VERDICT_LABEL } from '@/lib/types';
import { dynamicVerdict, isTruePositive } from '@/lib/scoring';

const KIND_TONE: Record<FlowNode['kind'], string> = {
  trigger: 'text-accent-blue border-accent-blue/40 bg-accent-blue/10',
  transform: 'text-accent-violet border-accent-violet/40 bg-accent-violet/10',
  network: 'text-accent-amber border-accent-amber/40 bg-accent-amber/10',
  sink: 'text-accent-red border-accent-red/40 bg-accent-red/10',
  guard: 'text-ink-secondary border-ink-muted/40 bg-bg-card',
};

const STATUS_TONE: Record<NodeProofStatus, string> = {
  proven: 'text-accent-green border-accent-green/40 bg-accent-green/10',
  failed_to_prove: 'text-accent-red border-accent-red/40 bg-accent-red/10',
  pending: 'text-ink-muted border-ink-muted/30 bg-bg-card',
  needs_human: 'text-accent-amber border-accent-amber/40 bg-accent-amber/10',
};

const METHOD_LABEL: Record<string, string> = {
  frida: 'Frida', http_toolkit: 'HTTP Toolkit', logcat: 'logcat', screenshot: 'Screenshot',
};

const VERDICT_TONE: Record<DynamicVerdict, string> = {
  strong_tp: 'text-accent-red border-accent-red/50 bg-accent-red/10',
  tp: 'text-accent-amber border-accent-amber/50 bg-accent-amber/10',
  inconclusive: 'text-accent-blue border-accent-blue/50 bg-accent-blue/10',
  strong_fp: 'text-accent-green border-accent-green/50 bg-accent-green/10',
};

export function FlowGraphProof({
  flow,
  proof,
  dynamicScore,
}: {
  flow: RubricFlowGraph;
  proof: IocProofInstance;
  dynamicScore: number;
}) {
  const [rejected, setRejected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<Set<string>>(new Set(flow.nodes.map(n => n.node_id))); // expanded by default
  const [flipped, setFlipped] = useState<DynamicVerdict | null>(null);
  const [flipReason, setFlipReason] = useState('');

  function toggleOpen(id: string) {
    setOpen(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleReject(id: string) {
    setRejected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    setFlipped(null); // re-evaluate on any change
  }

  const outgoing = useMemo(() => {
    const m: Record<string, FlowEdge[]> = {};
    for (const e of flow.edges) (m[e.from] ??= []).push(e);
    return m;
  }, [flow.edges]);

  // TP holds only when every tp_requires node is proven AND not human-rejected.
  const requiredProven = flow.scoring.tp_requires.every(id => {
    const np = proof.node_proofs[id];
    return np && np.status === 'proven' && !rejected.has(id);
  });

  const computedVerdict = dynamicVerdict(dynamicScore);
  // If a required node is rejected, the chain breaks → effective verdict cannot be TP.
  const chainBroken = !requiredProven;
  const effectiveVerdict: DynamicVerdict = flipped ?? (chainBroken && isTruePositive(computedVerdict) ? 'inconclusive' : computedVerdict);
  const nodeById = (id: string) => flow.nodes.find(n => n.node_id === id);

  return (
    <div className="space-y-3">
      {/* Flow header */}
      <div className="card p-3">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">{flow.ioc_name}</div>
            <div className="text-[11px] text-ink-muted font-mono mt-0.5">{flow.flow_id}</div>
          </div>
          <span className="text-[10px] text-ink-muted">{flow.nodes.length} nodes · {flow.scoring.tp_requires.length} required for TP</span>
        </div>
        <p className="text-xs text-ink-secondary mt-2 leading-relaxed">{flow.summary}</p>
      </div>

      {/* Node chain */}
      <ol className="space-y-0">
        {flow.nodes.map((node, i) => {
          const np = proof.node_proofs[node.node_id];
          const status: NodeProofStatus = rejected.has(node.node_id) ? 'failed_to_prove' : (np?.status ?? 'pending');
          const isOpen = open.has(node.node_id);
          const sig = node.signature;
          const edges = outgoing[node.node_id] ?? [];
          return (
            <li key={node.node_id}>
              <div className={`card p-3 border ${rejected.has(node.node_id) ? 'border-accent-red/40' : status === 'proven' ? 'border-accent-green/25' : 'border-edge'}`}>
                {/* Node header */}
                <button onClick={() => toggleOpen(node.node_id)} className="w-full text-left flex items-start justify-between gap-3">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-[11px] text-ink-muted tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                    <span className={`px-1.5 py-0.5 text-[9px] tracking-widest border rounded ${KIND_TONE[node.kind]}`}>{node.kind.toUpperCase()}</span>
                    <span className="text-sm font-semibold">{node.label}</span>
                    {node.required_for_tp && <span className="text-[9px] text-accent-green tracking-widest" title="required for TP">★ TP</span>}
                  </div>
                  <span className={`px-2 py-0.5 text-[10px] tracking-widest border rounded whitespace-nowrap ${STATUS_TONE[status]}`}>
                    {status === 'needs_human' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-current dot-pulse mr-1.5 align-middle" />}
                    {status.replace(/_/g, ' ').toUpperCase()}
                  </span>
                </button>
                <p className="text-[11px] text-ink-secondary mt-1">{node.what_it_does}</p>

                {isOpen && (
                  <div className="mt-3 grid grid-cols-2 gap-4">
                    {/* LEFT: static signature */}
                    <div>
                      <div className="label mb-1">static signature</div>
                      <div className="text-[10px] font-mono text-ink-secondary mb-1 break-all">
                        <span className="text-accent-blue">{sig.class_name}</span>
                        <span className="text-ink-muted">.</span>
                        <span className="text-accent-green">{sig.method}</span>
                      </div>
                      <div className="text-[10px] font-mono text-ink-muted mb-2">{sig.file_path}:{sig.line}</div>
                      <pre className="bg-bg-base border border-edge/40 rounded p-2 text-[10px] leading-relaxed overflow-auto">
{sig.context_before.map((l, k) => <div key={`b${k}`} className="text-ink-muted">{l}</div>)}
<div className="text-accent-green bg-accent-green/10 -mx-2 px-2">{sig.focal_line}</div>
{sig.context_after.map((l, k) => <div key={`a${k}`} className="text-ink-muted">{l}</div>)}
                      </pre>
                      {np?.resolved_snippet && (
                        <div className="mt-2 text-[10px] font-mono text-ink-secondary">
                          <span className="text-ink-muted">resolved · </span>{np.resolved_snippet}
                        </div>
                      )}
                    </div>

                    {/* RIGHT: verification + dynamic evidence */}
                    <div className="border-l border-edge/40 pl-4">
                      <div className="label mb-1">verification</div>
                      <div className="text-[10px] font-mono text-accent-green break-all mb-1">{node.verification.hook_target}</div>
                      <div className="flex flex-wrap gap-1 mb-1">
                        {node.verification.methods.map(m => (
                          <span key={m} className="px-1.5 py-0.5 text-[9px] tracking-widest border border-edge/40 rounded text-ink-secondary">{METHOD_LABEL[m] ?? m}</span>
                        ))}
                      </div>
                      <div className="text-[10px] text-ink-muted mb-2">{node.verification.expectation}</div>

                      <div className="label mb-1">dynamic evidence</div>
                      {np && np.evidence.length > 0 ? (
                        <ul className="space-y-1.5">
                          {np.evidence.map((ev, k) => (
                            <li key={k} className="text-[10px]">
                              <div className="flex items-center gap-1.5">
                                <span className={ev.captured ? 'text-accent-green' : 'text-accent-red'}>{ev.captured ? '✓' : '✗'}</span>
                                <span className="px-1.5 py-0.5 text-[9px] tracking-widest border border-edge/40 rounded text-ink-secondary">{METHOD_LABEL[ev.method] ?? ev.method}</span>
                                {ev.artifact_ref && <a href={`#evidence-${ev.artifact_ref}`} className="text-accent-green hover:underline">{ev.artifact_ref}</a>}
                              </div>
                              <div className="text-ink-secondary mt-0.5">{ev.observation}</div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="text-[10px] text-ink-muted">No dynamic evidence captured yet.</div>
                      )}

                      {/* Human-in-the-loop for needs_human / failed */}
                      {(status === 'needs_human' || status === 'failed_to_prove') && np?.human_note && (
                        <div className="mt-2 p-2 border border-accent-amber/30 bg-accent-amber/5 rounded text-[10px] text-ink-secondary">
                          <span className="text-accent-amber tracking-widest">HUMAN-IN-THE-LOOP · </span>{np.human_note}
                          <div className="mt-1 text-ink-muted">Budget-limited — a reviewer may attach evidence, confirm, or mark "failed to prove" and move on.</div>
                        </div>
                      )}

                      {/* Reviewer reject control */}
                      <div className="mt-2">
                        <button
                          onClick={() => toggleReject(node.node_id)}
                          className={`px-2 py-1 text-[9px] tracking-widest rounded border ${rejected.has(node.node_id) ? 'border-accent-red/50 bg-accent-red/10 text-accent-red' : 'border-edge/40 bg-bg-card text-ink-muted hover:text-ink-primary'}`}
                        >
                          {rejected.has(node.node_id) ? '✗ REJECTED — RESTORE' : 'NOT CONVINCED · reject node'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Outgoing edges */}
                {edges.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-edge/40 flex flex-wrap gap-x-4 gap-y-1">
                    {edges.map((e, k) => (
                      <span key={k} className="text-[9px] text-ink-muted font-mono">
                        <span className="text-ink-secondary">{e.relation.replace(/_/g, ' ')}</span> → {nodeById(e.to)?.label ?? e.to}{e.label ? ` · ${e.label}` : ''}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {i < flow.nodes.length - 1 && (
                <div className="flex justify-center py-1">
                  <div className={`w-px h-3 ${status === 'proven' && !rejected.has(node.node_id) ? 'bg-accent-green/40' : 'bg-edge'}`} />
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {/* Scoring footer */}
      <div className={`card p-3 border ${requiredProven ? 'border-accent-green/40' : 'border-accent-amber/40'}`}>
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <div className="label mb-1">scoring gate</div>
            <div className="text-xs text-ink-secondary">{flow.scoring.note}</div>
          </div>
          <div className="text-right">
            <div className="label mb-1">required nodes proven</div>
            <div className={`text-sm font-semibold ${requiredProven ? 'text-accent-green' : 'text-accent-amber'}`}>
              {flow.scoring.tp_requires.filter(id => proof.node_proofs[id]?.status === 'proven' && !rejected.has(id)).length}
              <span className="text-ink-muted"> / {flow.scoring.tp_requires.length}</span>
            </div>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-edge/40 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="label">verdict</span>
            <span className={`px-2.5 py-1 text-xs tracking-widest border rounded ${VERDICT_TONE[effectiveVerdict]}`}>
              {DYNAMIC_VERDICT_LABEL[effectiveVerdict]}
            </span>
            {flipped && <span className="text-[10px] text-accent-amber tracking-widest">OVERRIDDEN BY HUMAN · was {DYNAMIC_VERDICT_LABEL[computedVerdict]}</span>}
            {!flipped && chainBroken && isTruePositive(computedVerdict) && (
              <span className="text-[10px] text-accent-amber">chain broken by rejection — TP no longer holds</span>
            )}
          </div>
          <div className="text-[10px] text-ink-muted">dynamic score <span className="text-ink-primary tabular-nums">{dynamicScore}</span></div>
        </div>

        {/* Verdict flip control — appears when the human breaks the chain */}
        {chainBroken && (
          <div className="mt-3 pt-3 border-t border-edge/40">
            <div className="label mb-1">flip verdict (proof unconvincing)</div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={flipReason}
                onChange={e => setFlipReason(e.target.value)}
                placeholder="reason the proof didn't convince you…"
                className="flex-1 min-w-[200px] bg-bg-base border border-edge/40 rounded px-2 py-1 text-[11px] text-ink-primary focus:outline-none focus:border-accent-amber/50"
              />
              {(['inconclusive', 'strong_fp'] as DynamicVerdict[]).map(v => (
                <button
                  key={v}
                  disabled={!flipReason}
                  onClick={() => setFlipped(v)}
                  className={`px-2.5 py-1 text-[10px] tracking-widest rounded border ${flipReason ? `${VERDICT_TONE[v]} hover:brightness-125` : 'border-edge/40 bg-bg-card text-ink-muted cursor-not-allowed'}`}
                >
                  → {DYNAMIC_VERDICT_LABEL[v]}
                </button>
              ))}
              {flipped && (
                <button onClick={() => setFlipped(null)} className="px-2.5 py-1 text-[10px] tracking-widest rounded border border-edge/40 bg-bg-card text-ink-secondary hover:text-ink-primary">
                  UNDO
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
