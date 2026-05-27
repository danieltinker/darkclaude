// ScoreNumber — colors a numeric score by where it sits vs a threshold.
// - safe (well below threshold)    → green
// - approaching threshold          → amber
// - at or above threshold          → red
// Used wherever a score has policy meaning attached (rubric, gate).

import { ReactNode } from 'react';

type Tone = 'safe' | 'approaching' | 'over' | 'neutral';

function classify(value: number, threshold: number | undefined, mode: 'higher_is_worse' | 'higher_is_better'): Tone {
  if (threshold === undefined) return 'neutral';
  if (mode === 'higher_is_worse') {
    if (value >= threshold) return 'over';
    if (value >= threshold * 0.75) return 'approaching';
    return 'safe';
  }
  // higher_is_better
  if (value >= threshold) return 'safe';
  if (value >= threshold * 0.75) return 'approaching';
  return 'over';
}

const TONE_COLORS: Record<Tone, string> = {
  safe: 'text-accent-green',
  approaching: 'text-accent-amber',
  over: 'text-accent-red',
  neutral: 'text-ink-primary',
};

const TONE_RING: Record<Tone, string> = {
  safe: 'border-accent-green/40 bg-accent-green/10',
  approaching: 'border-accent-amber/40 bg-accent-amber/10',
  over: 'border-accent-red/40 bg-accent-red/10',
  neutral: 'border-ink-muted/30 bg-bg-card',
};

export function ScoreNumber({
  value,
  threshold,
  mode = 'higher_is_worse',
  size = 'md',
  showThreshold = true,
}: {
  value: number;
  threshold?: number;
  mode?: 'higher_is_worse' | 'higher_is_better';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showThreshold?: boolean;
}) {
  const tone = classify(value, threshold, mode);
  const sizeCls = {
    sm: 'text-base',
    md: 'text-xl',
    lg: 'text-2xl',
    xl: 'text-3xl',
  }[size];
  return (
    <span className={`tabular-nums font-semibold ${TONE_COLORS[tone]} ${sizeCls}`}>
      {value}
      {showThreshold && threshold !== undefined && (
        <span className="text-ink-muted text-sm font-normal"> / {threshold}</span>
      )}
    </span>
  );
}

export function ScoreChip({
  value,
  threshold,
  mode = 'higher_is_worse',
  label,
}: {
  value: number;
  threshold?: number;
  mode?: 'higher_is_worse' | 'higher_is_better';
  label?: ReactNode;
}) {
  const tone = classify(value, threshold, mode);
  return (
    <span
      className={`inline-flex items-center gap-2 px-2.5 py-1 text-xs tracking-widest border rounded ${TONE_RING[tone]}`}
    >
      {label && <span className="text-ink-muted text-[10px]">{label}</span>}
      <span className={`tabular-nums font-semibold ${TONE_COLORS[tone]}`}>
        {value}
        {threshold !== undefined && <span className="text-ink-muted font-normal"> / {threshold}</span>}
      </span>
    </span>
  );
}

export function classifyScore(value: number, threshold: number | undefined, mode: 'higher_is_worse' | 'higher_is_better' = 'higher_is_worse'): Tone {
  return classify(value, threshold, mode);
}
