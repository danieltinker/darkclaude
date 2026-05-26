import './globals.css';
import type { Metadata } from 'next';
import { Nav } from '@/components/Nav';

export const metadata: Metadata = {
  title: 'darkclaude // malware-review pipeline',
  description:
    'Producer ↔ PixelBridge ↔ Consumer pipeline for defensive malware review. POC with mock data.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen scanlines">
        <Nav />
        <main className="relative z-10 max-w-[1400px] mx-auto px-6 py-8">
          {children}
        </main>
        <footer className="relative z-10 max-w-[1400px] mx-auto px-6 py-6 text-xs text-ink-muted">
          <div className="flex justify-between border-t divider pt-4">
            <span>darkclaude · defensive malware-review POC · mock data only</span>
            <span>schemas v1.0.0 · rubric riskware v1.0.0</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
