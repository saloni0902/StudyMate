import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import * as summariesApi from '../api/summaries.js';
import { listDocuments } from '../api/documents.js';
import { errorMessage } from '../api/client.js';
import CitedMarkdown from '../components/CitedMarkdown.jsx';
import ErrorBanner from '../components/ErrorBanner.jsx';
import Loader from '../components/Loader.jsx';
import SummaryForm from '../components/SummaryForm.jsx';
import usePageTitle from '../hooks/usePageTitle.js';

function SummaryView({ summary, onDelete }) {
  return (
    <article className="rounded-lg border border-line bg-surface p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">
            {summary.kind === 'document' ? 'Document summary' : 'Topic summary'} · {summary.length}
          </p>
          <h2 className="mt-1 text-xl font-semibold break-words">{summary.title}</h2>
          <p className="text-xs text-muted">{new Date(summary.createdAt).toLocaleString()}</p>
        </div>
        <button onClick={() => onDelete(summary)} className="shrink-0 text-sm text-muted hover:text-danger">
          Delete
        </button>
      </div>

      {summary.truncated && (
        <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          This document is very long, so only its first part was summarised.
        </p>
      )}

      <div className="mt-5">
        <CitedMarkdown
          content={summary.content}
          citations={summary.citations}
          className={summary.grounded ? '' : 'rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900'}
        />
      </div>
    </article>
  );
}

export default function Summary() {
  const { subject } = useOutletContext();
  usePageTitle('Summaries', subject.name);
  const { summaryId } = useParams();
  const navigate = useNavigate();

  const [documents, setDocuments] = useState(null);
  const [summaries, setSummaries] = useState([]);
  const [current, setCurrent] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refreshList = useCallback(() => summariesApi.listSummaries(subject.id).then(setSummaries), [subject.id]);

  useEffect(() => {
    listDocuments(subject.id)
      .then((docs) => setDocuments(docs.filter((d) => d.status === 'ready')))
      .catch((err) => setError(errorMessage(err)));
    refreshList().catch((err) => setError(errorMessage(err)));
  }, [subject.id, refreshList]);

  useEffect(() => {
    if (!summaryId) {
      setCurrent(null);
      return;
    }
    if (current?.id === summaryId) return;
    setCurrent(undefined);
    summariesApi
      .getSummary(summaryId)
      .then(setCurrent)
      .catch((err) => {
        setCurrent(null);
        setError(errorMessage(err));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summaryId]);

  const generate = async (body) => {
    setBusy(true);
    setError('');
    try {
      const summary = await summariesApi.createSummary(subject.id, body);
      setCurrent(summary);
      navigate(`/subjects/${subject.id}/summary/${summary.id}`);
      refreshList();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (summary) => {
    if (!window.confirm(`Delete the summary "${summary.title}"?`)) return;
    try {
      await summariesApi.deleteSummary(summary.id);
      setSummaries((list) => list.filter((s) => s.id !== summary.id));
      navigate(`/subjects/${subject.id}/summary`);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div className="max-w-6xl">
      <p className="text-sm font-medium text-brand">{subject.name}</p>
      <h1 className="text-2xl font-semibold">Summaries</h1>
      <p className="mt-1 text-body">Revision notes made only from your PDFs, with page references.</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-6">
          {documents === null ? (
            <Loader />
          ) : (
            <SummaryForm documents={documents} subjectId={subject.id} busy={busy} onSubmit={generate} />
          )}

          <section>
            <h2 className="mb-2 text-sm font-semibold text-body">Saved summaries</h2>
            {summaries.length === 0 ? (
              <p className="text-sm text-muted">None yet</p>
            ) : (
              <ul className="space-y-1">
                {summaries.map((s) => (
                  <li key={s.id}>
                    <Link
                      to={`/subjects/${subject.id}/summary/${s.id}`}
                      className={`block rounded-md px-3 py-2 text-sm ${
                        s.id === summaryId ? 'bg-brand-tint text-brand-dark' : 'text-body hover:bg-brand-tint'
                      }`}
                    >
                      <span className="block truncate font-medium">{s.title}</span>
                      <span className="text-xs text-muted">
                        {s.kind === 'document' ? 'Document' : 'Topic'} · {s.length} ·{' '}
                        {new Date(s.createdAt).toLocaleDateString()}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="min-w-0 space-y-3">
          <ErrorBanner message={error} />
          {busy ? (
            <div className="rounded-lg border border-line bg-surface">
              <Loader label="Reading your notes and writing the summary…" />
            </div>
          ) : current === undefined ? (
            <Loader />
          ) : current ? (
            <SummaryView summary={current} onDelete={remove} />
          ) : (
            <div className="rounded-lg border border-dashed border-line-strong p-10 text-center text-sm text-muted">
              Choose a document or type a topic, then generate a summary.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
