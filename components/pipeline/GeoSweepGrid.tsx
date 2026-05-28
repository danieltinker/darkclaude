// GeoSweepGrid — renders a "geo_screenshot_sweep" basic mission as a country
// matrix. We screenshot the same target activity behind many VPN exit countries
// and surface where behavior diverges from the baseline country. Pure server
// component: no client JS, drilldowns use native <details>/<summary>.

import type {
  DynamicProofMethod,
  GeoScreenshotSweepMission,
  GeoSweepCell,
} from '@/lib/types';

// Per-status chip styling. Each status maps to an accent family + label.
const STATUS_STYLE: Record<
  GeoSweepCell['status'],
  { label: string; cls: string; pulse?: boolean }
> = {
  captured: {
    label: 'CAPTURED',
    cls: 'text-accent-green bg-accent-green/10 border-accent-green/30',
  },
  running: {
    label: 'RUNNING',
    cls: 'text-accent-amber bg-accent-amber/10 border-accent-amber/30',
    pulse: true,
  },
  pending: {
    label: 'PENDING',
    cls: 'text-ink-muted bg-bg-base border-edge',
  },
  failed: {
    label: 'FAILED',
    cls: 'text-accent-red bg-accent-red/10 border-accent-red/30',
  },
  needs_human: {
    label: 'NEEDS HUMAN',
    cls: 'text-accent-amber bg-accent-amber/10 border-accent-amber/30',
  },
};

const METHOD_LABEL: Record<DynamicProofMethod, string> = {
  frida: 'frida',
  http_toolkit: 'http_toolkit',
  logcat: 'logcat',
  screenshot: 'screenshot',
};

function StatusChip({ status }: { status: GeoSweepCell['status'] }) {
  const s = STATUS_STYLE[status];
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] tracking-widest border rounded ${s.cls}`}
    >
      {s.pulse && (
        <span className="w-1.5 h-1.5 rounded-full bg-current dot-pulse" />
      )}
      {s.label}
    </span>
  );
}

function CaptureChip({ method }: { method: DynamicProofMethod }) {
  return (
    <span className="px-1.5 py-0.5 text-[10px] tracking-widest border border-edge rounded bg-bg-base text-ink-secondary font-mono">
      {METHOD_LABEL[method]}
    </span>
  );
}

function GeoCard({
  cell,
  mission,
  isBaseline,
}: {
  cell: GeoSweepCell;
  mission: GeoScreenshotSweepMission;
  isBaseline: boolean;
}) {
  const differs = cell.differs_from_baseline === true;

  return (
    <div
      className={`card p-2 flex flex-col gap-2 ${
        differs ? 'border-accent-amber/50' : ''
      }`}
    >
      {/* Header row: country code + tags */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold text-ink-primary uppercase tracking-wide">
          {cell.country}
        </span>
        <div className="flex items-center gap-1">
          {isBaseline && (
            <span className="px-1.5 py-0.5 text-[10px] tracking-widest border border-accent-blue/30 rounded bg-accent-blue/10 text-accent-blue">
              BASELINE
            </span>
          )}
          {differs && (
            <span className="px-1.5 py-0.5 text-[10px] tracking-widest border border-accent-amber/50 rounded bg-accent-amber/10 text-accent-amber">
              DIFFERS
            </span>
          )}
        </div>
      </div>

      {/* Thumbnail / capture preview */}
      {cell.screenshot_ref ? (
        <div className="aspect-video bg-bg-base border border-edge/40 rounded overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cell.screenshot_ref}
            alt={`${cell.country} capture of ${mission.target}`}
            className="object-cover w-full h-full"
          />
        </div>
      ) : (
        <div className="aspect-video bg-bg-base border border-edge/40 rounded overflow-hidden flex items-center justify-center">
          <span className="label">no capture</span>
        </div>
      )}

      {/* Status row */}
      <div className="flex items-center justify-between gap-2">
        <StatusChip status={cell.status} />
      </div>

      {/* Drilldown — note + capture methods, no client JS */}
      <details className="group">
        <summary className="cursor-pointer list-none text-[11px] text-ink-muted hover:text-ink-secondary select-none">
          <span className="group-open:hidden">details</span>
          <span className="hidden group-open:inline">hide</span>
        </summary>
        <div className="mt-2 pt-2 border-t border-edge/40 flex flex-col gap-2">
          <p className="text-[11px] leading-relaxed text-ink-secondary">
            {cell.note ?? (
              <span className="text-ink-muted">No note recorded.</span>
            )}
          </p>
          <div className="flex flex-col gap-1">
            <span className="label">capture</span>
            <div className="flex flex-wrap gap-1">
              {mission.capture.map(m => (
                <CaptureChip key={m} method={m} />
              ))}
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}

export function GeoSweepGrid({
  mission,
  cells,
}: {
  mission: GeoScreenshotSweepMission;
  cells: GeoSweepCell[];
}) {
  // Render the baseline country first, then the rest in their given order.
  const baseline = mission.baseline_country.toUpperCase();
  const ordered = [...cells].sort((a, b) => {
    const aBase = a.country.toUpperCase() === baseline ? 0 : 1;
    const bBase = b.country.toUpperCase() === baseline ? 0 : 1;
    return aBase - bBase;
  });

  const countryCount = mission.countries.length;
  const divergent = cells.filter(c => c.differs_from_baseline === true).length;

  return (
    <div className="flex flex-col gap-4">
      {/* Header strip */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="label">geo screenshot sweep</span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-ink-primary">
              {mission.target}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {mission.capture.map(m => (
              <CaptureChip key={m} method={m} />
            ))}
          </div>
        </div>
        <div className="flex flex-col items-start sm:items-end gap-1.5">
          <span className="text-xs text-ink-secondary tabular-nums">
            {countryCount} countries
            <span className="text-ink-muted"> · </span>
            <span className="tabular-nums">
              {mission.per_country_budget_seconds}s
            </span>{' '}
            budget each
          </span>
          {divergent > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] tracking-widest border border-accent-amber/50 rounded bg-accent-amber/10 text-accent-amber tabular-nums">
              {divergent} DIVERGENT
            </span>
          )}
        </div>
      </div>

      {/* Country matrix */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
        {ordered.map(cell => (
          <GeoCard
            key={cell.country}
            cell={cell}
            mission={mission}
            isBaseline={cell.country.toUpperCase() === baseline}
          />
        ))}
      </div>
    </div>
  );
}
