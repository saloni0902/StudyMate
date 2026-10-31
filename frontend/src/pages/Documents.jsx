import { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import * as documentsApi from '../api/documents.js';
import { errorMessage } from '../api/client.js';
import DocumentList from '../components/DocumentList.jsx';
import ErrorBanner from '../components/ErrorBanner.jsx';
import Loader from '../components/Loader.jsx';
import UploadDropzone from '../components/UploadDropzone.jsx';
import usePageTitle from '../hooks/usePageTitle.js';

const POLL_MS = 2000;

export default function Documents() {
  const { subject } = useOutletContext();
  usePageTitle('Documents', subject.name);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(null); // { name, percent }

  const refresh = useCallback(
    () =>
      documentsApi
        .listDocuments(subject.id)
        .then(setDocuments)
        .catch((err) => setError(errorMessage(err))),
    [subject.id]
  );

  useEffect(() => {
    setLoading(true);
    setError('');
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  // While any document is processing, check again every 2 seconds.
  const processing = documents.some((d) => d.status === 'processing');
  useEffect(() => {
    if (!processing) return undefined;
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [processing, refresh]);

  const uploadFiles = async (files) => {
    setError('');
    for (const file of files) {
      setUploading({ name: file.name, percent: 0 });
      try {
        const doc = await documentsApi.uploadDocument(subject.id, file, (percent) =>
          setUploading({ name: file.name, percent })
        );
        setDocuments((list) => [doc, ...list]);
      } catch (err) {
        setError(`${file.name}: ${errorMessage(err)}`);
      }
    }
    setUploading(null);
  };

  const retry = async (doc) => {
    try {
      const updated = await documentsApi.retryDocument(doc.id);
      setDocuments((list) => list.map((d) => (d.id === doc.id ? updated : d)));
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const remove = async (doc) => {
    if (!window.confirm(`Delete "${doc.originalName}"?`)) return;
    try {
      await documentsApi.deleteDocument(doc.id);
      setDocuments((list) => list.filter((d) => d.id !== doc.id));
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div className="max-w-4xl">
      <p className="text-sm font-medium text-brand">{subject.name}</p>
      <h1 className="text-2xl font-semibold">Documents</h1>
      <p className="mt-1 text-body">Upload your notes. Once a PDF is ready you can chat with it and make quizzes from it.</p>

      <div className="mt-6 space-y-3">
        <UploadDropzone onFiles={uploadFiles} onReject={setError} disabled={Boolean(uploading)} />
        {uploading && (
          <div className="rounded-md border border-line bg-surface p-3 text-sm">
            <div className="flex justify-between">
              <span className="truncate">Uploading {uploading.name}</span>
              <span>{uploading.percent}%</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-brand-tint">
              <div className="h-1.5 rounded-full bg-brand transition-all" style={{ width: `${uploading.percent}%` }} />
            </div>
          </div>
        )}
        <ErrorBanner message={error} />
      </div>

      <h2 className="mt-8 mb-3 font-medium">Your documents</h2>
      {loading ? (
        <Loader />
      ) : (
        <DocumentList documents={documents} subjectId={subject.id} onRetry={retry} onDelete={remove} />
      )}
    </div>
  );
}
