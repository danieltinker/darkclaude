import { ReactNode } from 'react';

export function Panel({
  title,
  subtitle,
  section,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  section?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="panel">
      <header className="flex items-start justify-between px-4 py-3 border-b divider">
        <div>
          <div className="flex items-baseline gap-3">
            {section && <span className="text-[10px] text-ink-muted tracking-widest">{section}</span>}
            <h2 className="text-sm tracking-widest font-semibold">{title.toUpperCase()}</h2>
          </div>
          {subtitle && <p className="text-xs text-ink-secondary mt-1">{subtitle}</p>}
        </div>
        {action}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function KV({ k, v, mono = true }: { k: string; v: ReactNode; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4 text-xs py-1 border-b border-edge/40 last:border-0">
      <span className="text-ink-muted tracking-wider">{k}</span>
      <span className={`text-ink-primary text-right ${mono ? 'font-mono' : ''}`}>{v}</span>
    </div>
  );
}
