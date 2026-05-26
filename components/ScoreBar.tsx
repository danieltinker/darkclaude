export function ScoreBar({
  label,
  value,
  max = 32,
  color = 'green',
}: {
  label: string;
  value: number;
  max?: number;
  color?: 'green' | 'amber' | 'red' | 'blue';
}) {
  const pct = Math.min(100, (value / max) * 100);
  const colorClass = {
    green: 'bg-accent-green',
    amber: 'bg-accent-amber',
    red: 'bg-accent-red',
    blue: 'bg-accent-blue',
  }[color];
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="label">{label}</span>
        <span className="text-sm font-semibold tabular-nums">
          {value}
          <span className="text-ink-muted text-xs"> / {max}</span>
        </span>
      </div>
      <div className="h-1.5 bg-bg-card rounded-full overflow-hidden border divider">
        <div
          className={`h-full ${colorClass} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
