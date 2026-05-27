import { ALL_PROMPTS } from '@/lib/prompts';
import { Panel } from '@/components/Panel';

export default function AgentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="text-[10px] text-ink-muted tracking-[0.3em] mb-1">// 04 AGENTS</div>
        <h1 className="text-2xl font-semibold">Black-box Workers</h1>
        <p className="text-sm text-ink-secondary mt-1">
          The infrastructure treats every "agent" as a swappable black box behind a stable contract: task in → typed result out.
          Below are the role prompts and boundaries that any worker (LLM, script, human analyst) must respect.
        </p>
      </div>

      <Panel title="Worker Contract" section="00" subtitle="every worker conforms to this interface — vendor irrelevant">
        <pre className="bg-bg-base border divider rounded p-3 text-[11px] text-ink-secondary overflow-auto">
{`interface BlackBoxWorker {
  can_handle(task_type: string): boolean;
  run(task: WorkerTask): Promise<WorkerResult>;
}

type WorkerTask = {
  task_id: string;
  task_type:
    // Funnel layer
    | "queue.lock_next_app"
    | "producer.verify_install"
    | "producer.static_slice"
    | "producer.generate_static_scorecard"
    | "producer.decide_static_gate"
    | "producer.generate_static_closure_report"
    // Dynamic mission layer
    | "producer.build_dynamic_mission"
    | "consumer.import_dynamic_mission"
    | "consumer.collect_dynamic_evidence"
    | "consumer.score_dynamic_evidence"
    | "consumer.build_evidence_package"
    // Mission Control layer
    | "mission_control.reconcile_scores"
    | "mission_control.generate_deep_inspection_report"
    | "mission_control.prepare_human_review";
  case_identity: CaseIdentity;
  inputs: Record<string, unknown>;
  constraints: { max_iterations: number; max_runtime_seconds: number; output_schema: string };
};

type WorkerResult = {
  task_id: string;
  status: "completed" | "blocked" | "failed";
  output_type: string;        // schema name
  output_path: string;        // artifact path
  confidence: number;
  errors: string[];
  limitations: string[];
};`}
        </pre>
      </Panel>

      {ALL_PROMPTS.map((p, i) => {
        const roleColor = {
          Funnel: 'text-accent-blue border-accent-blue/30',
          Gate: 'text-accent-amber border-accent-amber/30',
          Producer: 'text-accent-violet border-accent-violet/30',
          Consumer: 'text-accent-green border-accent-green/30',
          MissionControl: 'text-accent-green border-accent-green/30',
        }[p.role];
        return (
        <Panel
          key={p.agent_id}
          title={p.agent_name}
          section={String(i + 1).padStart(2, '0')}
          subtitle={p.description}
          action={
            <span
              className={`px-2 py-0.5 text-[10px] tracking-widest border rounded bg-bg-card ${roleColor}`}
            >
              {p.role.toUpperCase()}
            </span>
          }
        >
          <div className="grid grid-cols-3 gap-6">
            <div>
              <div className="label mb-2">capabilities</div>
              <ul className="space-y-1.5 text-xs text-ink-secondary">
                {p.capabilities.map(c => (
                  <li key={c} className="flex gap-2">
                    <span className="text-accent-green">+</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="label mb-2">boundaries</div>
              <ul className="space-y-1.5 text-xs text-ink-secondary">
                {p.boundaries.map(b => (
                  <li key={b} className="flex gap-2">
                    <span className="text-accent-red">−</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="label mb-2">scoring rules</div>
              <ul className="space-y-1.5 text-xs text-ink-secondary">
                {p.scoring_rules.map(s => (
                  <li key={s} className="flex gap-2">
                    <span className="text-accent-amber">≡</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t divider">
            <div className="label mb-3">role prompt (verbatim)</div>
            <div className="bg-bg-base border divider rounded p-4 max-h-[500px] overflow-auto">
              <pre className="text-[11px] text-ink-secondary leading-relaxed whitespace-pre-wrap font-mono">
                {p.body}
              </pre>
            </div>
          </div>
        </Panel>
      );
      })}
    </div>
  );
}
