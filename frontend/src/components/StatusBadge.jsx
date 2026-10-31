const styles = {
  processing: 'bg-amber-50 text-amber-700',
  ready: 'bg-brand-tint text-brand-dark',
  failed: 'bg-rose-50 text-rose-700',
};

const labels = { processing: 'Processing…', ready: 'Ready', failed: 'Failed' };

export default function StatusBadge({ status }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
