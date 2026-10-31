// A thin bar split into known (teal), review again (coral) and not yet seen.
export default function DeckProgress({ counts, className = '' }) {
  const part = (n) => `${(n / Math.max(counts.total, 1)) * 100}%`;
  return (
    <div className={className}>
      <div className="flex h-2 overflow-hidden rounded-full bg-brand-tint" aria-hidden="true">
        <div className="bg-brand" style={{ width: part(counts.known) }} />
        <div className="bg-danger" style={{ width: part(counts.review) }} />
      </div>
      <p className="mt-1 text-xs text-muted">
        {counts.known} known · {counts.review} to review · {counts.new} new
      </p>
    </div>
  );
}
