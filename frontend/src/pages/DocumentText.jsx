import { useEffect, useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { getDocumentText } from '../api/documents.js';
import { errorMessage } from '../api/client.js';
import ErrorBanner from '../components/ErrorBanner.jsx';
import Loader from '../components/Loader.jsx';
import usePageTitle from '../hooks/usePageTitle.js';

// Shows the text extracted from one PDF, page by page.
export default function DocumentText() {
  const { subject } = useOutletContext();
  usePageTitle('Extracted text', subject.name);
  const { documentId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getDocumentText(documentId)
      .then(setData)
      .catch((err) => setError(errorMessage(err)));
  }, [documentId]);

  return (
    <div className="max-w-3xl">
      <Link to={`/subjects/${subject.id}/documents`} className="text-sm text-brand hover:underline">
        ← Back to documents
      </Link>
      <h1 className="mt-2 text-2xl font-semibold break-words">{data?.document.originalName || 'Extracted text'}</h1>
      {data && (
        <p className="mt-1 text-sm text-muted">
          {data.document.pages} pages · {data.document.charCount.toLocaleString()} characters extracted
        </p>
      )}

      <div className="mt-6">
        <ErrorBanner message={error} />
        {!data && !error && <Loader />}
        {data?.pages.map((page) => (
          <section key={page.page} className="mb-4 rounded-lg border border-line bg-surface p-4">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Page {page.page}</h2>
            {page.text ? (
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-body">{page.text}</p>
            ) : (
              <p className="text-sm text-muted italic">No text on this page</p>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
