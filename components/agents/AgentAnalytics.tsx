// AgentAnalytics — surfaces per-agent token/duration/cost rollups from
// the WorkerAnalytics records that every worker run emits.

import type { WorkerAnalytics } from '@/lib/types';

type Props = { rows: WorkerAnalytics[] };

function fmt(n: number) {
  return n.toLocaleString();
}

function fmtMs(ms: number) {
  if (ms >= 60_000) return `${(ms / 60_000).toFixed(1)} min`;
  if (ms >= 1_000) return `${(ms / 1_000).toFixed(1)} s`;
  return `${ms} ms`;
}

function fmtCost(usd: number | undefined) {
  if (!usd) return '—';
  if (usd < 0.01) return `<$0.01`;
  return `$${usd.toFixed(3)}`;
}

export function AgentAnalytics({ rows }: Props) {
  if (!rows.length) {
    return <div className="text-xs text-ink-muted">No worker runs recorded yet.</div>;
  }

  // Group by agent_id
  const byAgent = rows.reduce<Record<string, WorkerAnalytics[]>>((acc, r) => {
    (acc[r.agent_id] ??= []).push(r);
    return acc;
  }, {});

  const summaries = Object.entries(byAgent)
    .map(([agent, group]) => {
      const totalDuration = group.reduce((acc, r) => acc + r.duration_ms, 0);
      const totalTokensIn = group.reduce((acc, r) => acc + r.tokens_in, 0);
      const totalTokensOut = group.reduce((acc, r) => acc + r.tokens_out, 0);
      const totalCost = group.reduce((acc, r) => acc + (r.total_cost_usd ?? 0), 0);
      const completed = group.filter(r => r.status === 'completed').length;
      return {
        agent,
        runs: group.length,
        completed,
        totalDuration,
        totalTokensIn,
        totalTokensOut,
        totalCost,
      };
    })
    .sort((a, b) => b.runs - a.runs);

  return (
    <div className="space-y-5">
      <div>
        <div className="text-[10px] text-ink-muted tracking-widest mb-2">PER-AGENT TOTALS</div>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] tracking-widest text-ink-muted border-b border-edge/40">
              <th className="text-left py-2 pr-3">agent</th>
              <th className="text-right px-2">runs</th>
              <th className="text-right px-2">completed</th>
              <th className="text-right px-2">total time</th>
              <th className="text-right px-2">tokens in</th>
              <th className="text-right px-2">tokens out</th>
              <th className="text-right pl-2">est. cost</th>
            </tr>
          </thead>
          <tbody>
            {summaries.map(s => (
              <tr key={s.agent} className="border-b border-edge/40">
                <td className="py-2 pr-3 font-mono text-[11px]">{s.agent}</td>
                <td className="px-2 text-right tabular-nums">{s.runs}</td>
                <td className="px-2 text-right tabular-nums text-accent-green">{s.completed}</td>
                <td className="px-2 text-right tabular-nums">{fmtMs(s.totalDuration)}</td>
                <td className="px-2 text-right tabular-nums">{fmt(s.totalTokensIn)}</td>
                <td className="px-2 text-right tabular-nums">{fmt(s.totalTokensOut)}</td>
                <td className="pl-2 text-right tabular-nums">{fmtCost(s.totalCost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <div className="text-[10px] text-ink-muted tracking-widest mb-2">RECENT TASK RUNS</div>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] tracking-widest text-ink-muted border-b border-edge/40">
              <th className="text-left py-2 pr-3">task_type</th>
              <th className="text-left px-2">agent</th>
              <th className="text-right px-2">duration</th>
              <th className="text-right px-2">tokens</th>
              <th className="text-right px-2">cost</th>
              <th className="text-right pl-2">status</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 20).map(r => (
              <tr key={r.task_id} className="border-b border-edge/40">
                <td className="py-2 pr-3 font-mono text-[10px] text-accent-green">{r.task_type}</td>
                <td className="px-2 text-[10px] text-ink-secondary">{r.agent_id}</td>
                <td className="px-2 text-right tabular-nums text-[10px]">{fmtMs(r.duration_ms)}</td>
                <td className="px-2 text-right tabular-nums text-[10px]">
                  {fmt(r.tokens_in)}<span className="text-ink-muted"> in / </span>{fmt(r.tokens_out)}<span className="text-ink-muted"> out</span>
                </td>
                <td className="px-2 text-right tabular-nums text-[10px]">{fmtCost(r.total_cost_usd)}</td>
                <td className="pl-2 text-right">
                  <span
                    className={`px-1.5 py-0.5 text-[9px] tracking-widest border rounded ${
                      r.status === 'completed'
                        ? 'border-accent-green/30 bg-accent-green/10 text-accent-green'
                        : r.status === 'failed'
                        ? 'border-accent-red/40 bg-accent-red/10 text-accent-red'
                        : 'border-accent-amber/30 bg-accent-amber/10 text-accent-amber'
                    }`}
                  >
                    {r.status.toUpperCase()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
