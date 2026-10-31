import { useState } from 'react';
import { Link } from 'react-router-dom';
import ErrorBanner from './ErrorBanner.jsx';
import { useSubjects } from '../context/SubjectContext.jsx';
import { errorMessage } from '../api/client.js';

export default function SubjectCard({ subject, stats }) {
  const { updateSubject, deleteSubject } = useSubjects();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: subject.name, description: subject.description });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await updateSubject(subject.id, form);
      setEditing(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete "${subject.name}"? Its documents and quiz history will be removed too.`)) return;
    setBusy(true);
    try {
      await deleteSubject(subject.id);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  if (editing) {
    return (
      <form onSubmit={save} className="space-y-2 rounded-lg border border-brand-soft bg-surface p-4">
        <ErrorBanner message={error} />
        <input
          required
          maxLength={80}
          aria-label="Subject name"
          className="w-full rounded-md border border-line-strong px-2 py-1.5 text-sm"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          maxLength={300}
          aria-label="Description"
          placeholder="Description (optional)"
          className="w-full rounded-md border border-line-strong px-2 py-1.5 text-sm"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <div className="flex gap-2">
          <button disabled={busy} className="rounded-md bg-brand px-3 py-1.5 text-sm text-white disabled:opacity-60">
            Save
          </button>
          <button type="button" onClick={() => setEditing(false)} className="px-3 py-1.5 text-sm text-body">
            Cancel
          </button>
        </div>
      </form>
    );
  }

  // No documents yet: send the student straight to uploading.
  const openTo = stats && stats.readyDocuments === 0 ? 'documents' : stats?.quizzesTaken ? 'progress' : 'chat';

  return (
    <div className="flex flex-col rounded-lg border border-line bg-surface p-4">
      <ErrorBanner message={error} />
      <h3 className="font-semibold">{subject.name}</h3>
      {subject.description && <p className="mt-0.5 text-sm text-muted">{subject.description}</p>}

      {stats && (
        <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-md bg-canvas px-2 py-1.5">
            <dt className="text-[11px] text-muted">Documents</dt>
            <dd className="font-semibold text-ink">{stats.readyDocuments}</dd>
          </div>
          <div className="rounded-md bg-canvas px-2 py-1.5">
            <dt className="text-[11px] text-muted">Avg score</dt>
            <dd className="font-semibold text-ink">{stats.averagePercent === null ? '–' : `${stats.averagePercent}%`}</dd>
          </div>
          <div className="rounded-md bg-canvas px-2 py-1.5">
            <dt className="text-[11px] text-muted">Cards known</dt>
            <dd className="font-semibold text-ink">{stats.flashcards.total ? `${stats.flashcards.known}/${stats.flashcards.total}` : '–'}</dd>
          </div>
        </dl>
      )}

      {stats?.weakTopics.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted">Weak:</span>
          {stats.weakTopics.slice(0, 3).map((t) => (
            <Link
              key={t}
              to={`/subjects/${subject.id}/quiz`}
              state={{ topic: t }}
              className="rounded-full bg-danger/15 px-2 py-0.5 text-xs font-medium text-[#9b2c2c] hover:bg-danger/25"
            >
              {t}
            </Link>
          ))}
          {stats.weakTopics.length > 3 && <span className="text-xs text-muted">+{stats.weakTopics.length - 3} more</span>}
        </div>
      )}

      <div className="mt-auto flex items-center gap-3 pt-4 text-sm">
        <Link
          to={`/subjects/${subject.id}/${openTo}`}
          className="rounded-md bg-brand px-3 py-1.5 text-white hover:bg-brand-dark"
        >
          {stats && stats.readyDocuments === 0 ? 'Upload notes' : 'Open'}
        </Link>
        <button onClick={() => setEditing(true)} className="text-body hover:text-brand">
          Rename
        </button>
        <button onClick={remove} disabled={busy} className="text-body hover:text-danger">
          Delete
        </button>
      </div>
    </div>
  );
}
