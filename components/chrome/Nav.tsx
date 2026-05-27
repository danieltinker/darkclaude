'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'overview', section: '00' },
  { href: '/run', label: 'run a case', section: '01' },
  { href: '/producer', label: 'producer', section: '02' },
  { href: '/bridge', label: 'pixelbridge', section: '03' },
  { href: '/consumer', label: 'consumer', section: '04' },
  { href: '/agents', label: 'agents', section: '05' },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <header className="relative z-10 border-b divider bg-bg-panel/80 backdrop-blur">
      <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-2 h-2 rounded-full bg-accent-green dot-pulse" />
          <span className="text-sm tracking-widest font-semibold group-hover:text-accent-green transition-colors">
            DARKCLAUDE
          </span>
          <span className="text-[10px] text-ink-muted tracking-widest">// MALWARE REVIEW PIPELINE</span>
        </Link>
        <nav className="flex items-center gap-1">
          {LINKS.map(link => {
            const active =
              link.href === '/'
                ? pathname === '/'
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 text-xs tracking-wider rounded transition-colors flex items-center gap-2 ${
                  active
                    ? 'bg-bg-card text-accent-green'
                    : 'text-ink-secondary hover:text-ink-primary hover:bg-bg-card'
                }`}
              >
                <span className="text-ink-muted text-[10px]">{link.section}</span>
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
