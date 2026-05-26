import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="text-center py-24">
      <div className="text-[10px] text-ink-muted tracking-[0.3em] mb-2">// 404</div>
      <h1 className="text-2xl font-semibold mb-2">Case not found</h1>
      <p className="text-sm text-ink-secondary mb-6">That review_id is not in the local queue.</p>
      <Link
        href="/"
        className="inline-block px-4 py-2 text-xs tracking-widest border divider rounded bg-bg-card hover:bg-bg-hover"
      >
        ← BACK TO OVERVIEW
      </Link>
    </div>
  );
}
