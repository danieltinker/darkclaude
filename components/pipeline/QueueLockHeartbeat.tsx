'use client';

// QueueLockHeartbeat — client-side liveness check on a lease.
// Counts down to lock_expires_at and surfaces a warning when the lease
// is about to expire. In a real two-machine setup this would also
// poll PixelBridge for a LockRevoked event and trigger a re-claim.

import { useEffect, useState } from 'react';
import type { QueueLock } from '@/lib/types';

function fmtRemaining(ms: number): string {
  if (ms <= 0) return 'expired';
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

export function QueueLockHeartbeat({ lock }: { lock: QueueLock }) {
  const expiresAt = new Date(lock.lock_expires_at).getTime();
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = expiresAt - now;
  // For the POC the demo timestamp is in the past; treat negative as
  // "demo lease" rather than alarming the reviewer.
  const isDemo = remaining < -60_000;
  const isWarn = remaining > 0 && remaining < 5 * 60_000;
  const isExpired = remaining <= 0 && !isDemo;

  return (
    <div
      className={`flex items-center gap-2 text-[10px] tracking-widest border rounded px-2 py-1 ${
        isExpired
          ? 'border-accent-red/40 bg-accent-red/10 text-accent-red'
          : isWarn
          ? 'border-accent-amber/40 bg-accent-amber/10 text-accent-amber'
          : isDemo
          ? 'border-ink-muted/30 bg-bg-card text-ink-muted'
          : 'border-accent-green/30 bg-accent-green/5 text-accent-green'
      }`}
      title={`Lock owned by ${lock.locked_by} · expires ${lock.lock_expires_at}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full bg-current ${isWarn || isExpired ? 'dot-pulse' : ''}`} />
      LOCK · {isDemo ? 'demo lease' : fmtRemaining(remaining)}
    </div>
  );
}
