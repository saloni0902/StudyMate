import { useState } from 'react';
import { Link } from 'react-router-dom';

const segment = (active) =>
  `flex-1 rounded-md px-3 py-1.5 text-sm font-medium ${active ? 'bg-surface text-brand-dark shadow-sm' : 'text-body'}`;

// Choose "whole document" or "a topic", and short or detailed.
export default function SummaryForm({ documents, subjectId, busy, onSubmit }) {
  const [kind, setKind] = useState('document');
  const [documentId, setDocumentId] = useState('');
  const [topic, setTopic] = useState('');
  const [length, setLength] = useState('short');

  if (documents.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line-strong p-4 text-sm text-muted">
        No ready documents yet.{' '}
        <Link to={`/subjects/${subjectId}/documents`} className="text-brand underline">
          Upload a PDF
        </Link>{' '}
        to make summaries.
      </p>
    );
  }

  const selectedDoc = documentId || documents[0].id;
  const canSubmit = kind === 'document' || topic.trim().length >= 2;

  const submit = (e) => {
    e.preventDefault();
    if (!canSubmit || busy) return;
    onSubmit(kind === 'document' ? { documentId: selectedDoc, length } : { topic: topic.trim(), length });
  };

  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border border-line bg-surface p-4">
      <div className="flex gap-1 rounded-lg bg-brand-tint p-1" role="tablist">
        <button type="button" role="tab" aria-selected={kind === 'document'} className={segment(kind === 'document')} onClick={() => setKind('document')}>
          Whole document
        </button>
        <button type="button" role="tab" aria-selected={kind === 'topic'} className={segment(kind === 'topic')} onClick={() => setKind('topic')}>
          A topic
        </button>
      </div>

      {kind === 'document' ? (
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-body">Document</span>
          <select
            value={selectedDoc}
            onChange={(e) => setDocumentId(e.target.value)}
            className="w-full rounded-md border border-line-strong bg-surface px-2 py-2"
          >
            {documents.map((d) => (
              <option key={d.id} value={d.id}>
                {d.originalName} ({d.pages} pages)
              </option>
            ))}
          </select>
        </label>
      ) : (
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-body">Topic</span>
          <input
            value={topic}
            maxLength={200}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. CPU scheduling algorithms"
            className="w-full rounded-md border border-line-strong px-3 py-2"
          />
          <span className="mt-1 block text-xs text-muted">Searches all documents in this subject.</span>
        </label>
      )}

      <div className="text-sm">
        <span className="mb-1 block font-medium text-body">Length</span>
        <div className="flex gap-1 rounded-lg bg-brand-tint p-1">
          <button type="button" className={segment(length === 'short')} onClick={() => setLength('short')}>
            Short
          </button>
          <button type="button" className={segment(length === 'detailed')} onClick={() => setLength('detailed')}>
            Detailed
          </button>
        </div>
      </div>

      <button
        disabled={!canSubmit || busy}
        className="w-full rounded-md bg-cta py-2 text-sm font-medium text-ink hover:bg-cta-hover disabled:opacity-50"
      >
        {busy ? 'Summarising…' : 'Generate summary'}
      </button>
    </form>
  );
}
