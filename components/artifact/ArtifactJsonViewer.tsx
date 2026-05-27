'use client';
import { useState } from 'react';

type Props = {
  artifactType: string;        // e.g. "ReviewMissionPackage"
  description?: string;        // one-line context
  payload: unknown;            // the actual contract instance
  defaultExpanded?: boolean;
  maxHeight?: string;
};

export function ArtifactJsonViewer({
  artifactType,
  description,
  payload,
  defaultExpanded = false,
  maxHeight = '500px',
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const json = JSON.stringify(payload, null, 2);
  return (
    <div className="card p-3">
      <div className="flex items-baseline justify-between mb-2">
        <div className="flex items-baseline gap-3">
          <span className="text-[10px] tracking-widest text-accent-green font-mono">{artifactType}</span>
          {description && <span className="text-[10px] text-ink-secondary">{description}</span>}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-ink-muted">{json.length.toLocaleString()} chars</span>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[10px] tracking-widest text-ink-muted hover:text-accent-green"
          >
            {expanded ? '▴ HIDE STRUCTURE' : '▾ VIEW STRUCTURE'}
          </button>
        </div>
      </div>
      {expanded && (
        <pre
          className="bg-bg-base border border-ink-muted/20 rounded p-3 text-[10px] text-ink-secondary leading-relaxed overflow-auto font-mono"
          style={{ maxHeight }}
        >
{json}
        </pre>
      )}
    </div>
  );
}
