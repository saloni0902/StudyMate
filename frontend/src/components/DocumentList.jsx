import { Link } from 'react-router-dom';
import StatusBadge from './StatusBadge.jsx';

function formatSize(bytes) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function DocumentList({ documents, subjectId, onRetry, onDelete }) {
  if (documents.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line-strong p-6 text-center text-sm text-muted">
        No documents yet. Upload your first PDF above.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
      {documents.map((doc) => (
        <li key={doc.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{doc.originalName}</p>
            <p className="text-xs text-muted">
              {formatSize(doc.size)}
              {doc.status === 'ready' && ` · ${doc.pages} page${doc.pages === 1 ? '' : 's'}`}
              {doc.emptyPages.length > 0 && ` · ${doc.emptyPages.length} without text`}
              {` · uploaded ${new Date(doc.createdAt).toLocaleDateString()}`}
            </p>
            {doc.status === 'failed' && <p className="mt-1 text-sm text-rose-600">{doc.error}</p>}
          </div>
          <StatusBadge status={doc.status} />
          <div className="flex gap-3 text-sm">
            {doc.status === 'ready' && (
              <Link to={`/subjects/${subjectId}/documents/${doc.id}`} className="text-brand hover:underline">
                View text
              </Link>
            )}
            {doc.status === 'failed' && (
              <button onClick={() => onRetry(doc)} className="text-brand hover:underline">
                Retry
              </button>
            )}
            <button onClick={() => onDelete(doc)} className="text-muted hover:text-danger">
              Delete
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
