import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import * as decksApi from '../api/decks.js';
import { listTopics } from '../api/quizzes.js';
import { listDocuments } from '../api/documents.js';
import { errorMessage } from '../api/client.js';
import DeckProgress from '../components/DeckProgress.jsx';
import ErrorBanner from '../components/ErrorBanner.jsx';
import Loader from '../components/Loader.jsx';
import TopicPicker from '../components/TopicPicker.jsx';
import { segment } from '../components/quiz/QuizSetup.jsx';
import usePageTitle from '../hooks/usePageTitle.js';

// Flashcards home: make a deck, and see existing decks with how far you've got.
export default function Flashcards() {
  const { subject } = useOutletContext();
  usePageTitle('Flashcards', subject.name);
  const navigate = useNavigate();
  const location = useLocation();
  const initialTopic = location.state?.topic || '';

  const [topics, setTopics] = useState(null);
  const [decks, setDecks] = useState([]);
  const [hasDocs, setHasDocs] = useState(true);
  const [topic, setTopic] = useState(initialTopic);
  const [count, setCount] = useState(10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    const [topicList, deckList, docs] = await Promise.all([
      listTopics(subject.id),
      decksApi.listDecks(subject.id),
      listDocuments(subject.id),
    ]);
    setTopics(topicList);
    setDecks(deckList);
    setHasDocs(docs.some((d) => d.status === 'ready'));
  }, [subject.id]);

  useEffect(() => {
    refresh().catch((err) => setError(errorMessage(err)));
  }, [refresh]);

  const generate = async (e) => {
    e.preventDefault();
    if (topic === null || busy) return;
    setBusy(true);
    setError('');
    try {
      const deck = await decksApi.createDeck(subject.id, { topic, count });
      navigate(`/subjects/${subject.id}/flashcards/${deck.id}`, { state: { deck } });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  const remove = async (deck) => {
    if (!window.confirm('Delete this flashcard deck?')) return;
    try {
      await decksApi.deleteDeck(deck.id);
      setDecks((list) => list.filter((d) => d.id !== deck.id));
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div className="max-w-5xl">
      <p className="text-sm font-medium text-brand">{subject.name}</p>
      <h1 className="text-2xl font-semibold">Flashcards</h1>
      <p className="mt-1 text-body">Quick question-and-answer cards from your notes. Flip, then mark what you knew.</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-3">
          {topics === null ? (
            <Loader />
          ) : !hasDocs ? (
            <p className="rounded-lg border border-dashed border-line-strong p-4 text-sm text-muted">
              No ready documents yet.{' '}
              <Link to={`/subjects/${subject.id}/documents`} className="text-brand underline">
                Upload a PDF
              </Link>{' '}
              to make flashcards.
            </p>
          ) : (
            <form onSubmit={generate} className="space-y-4 rounded-lg border border-line bg-surface p-4">
              <TopicPicker topics={topics} initialTopic={initialTopic} onChange={setTopic} />
              <div className="text-sm">
                <span className="mb-1 block font-medium text-body">Cards</span>
                <div className="flex gap-1 rounded-lg bg-brand-tint p-1">
                  {[10, 15, 20].map((n) => (
                    <button key={n} type="button" className={segment(count === n)} onClick={() => setCount(n)}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <button
                disabled={topic === null || busy}
                className="w-full rounded-md bg-cta py-2 text-sm font-medium text-ink hover:bg-cta-hover disabled:opacity-50"
              >
                {busy ? 'Writing your cards…' : 'Generate flashcards'}
              </button>
            </form>
          )}
          <ErrorBanner message={error} />
        </div>

        <section>
          <h2 className="mb-3 font-medium">Your decks</h2>
          {busy && (
            <div className="mb-3 rounded-lg border border-line bg-surface">
              <Loader label="Reading your notes and writing cards…" />
            </div>
          )}
          {decks.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line-strong p-6 text-center text-sm text-muted">
              No decks yet. Generate one to start revising.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {decks.map((d) => (
                <div key={d.id} className="flex flex-col rounded-lg border border-line bg-surface p-4">
                  <p className="font-semibold text-ink">{d.topic || 'All topics'}</p>
                  <p className="text-xs text-muted">
                    {d.counts.total} cards · {new Date(d.createdAt).toLocaleDateString()}
                  </p>
                  <DeckProgress counts={d.counts} className="mt-3" />
                  <div className="mt-4 flex items-center gap-3 text-sm">
                    <Link
                      to={`/subjects/${subject.id}/flashcards/${d.id}`}
                      className="rounded-md bg-brand px-3 py-1.5 text-white hover:bg-brand-dark"
                    >
                      {d.counts.new === d.counts.total ? 'Start' : 'Continue'}
                    </Link>
                    <button onClick={() => remove(d)} className="text-muted hover:text-danger">
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
