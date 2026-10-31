import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useOutletContext, useParams } from 'react-router-dom';
import * as decksApi from '../api/decks.js';
import { errorMessage } from '../api/client.js';
import DeckProgress from '../components/DeckProgress.jsx';
import ErrorBanner from '../components/ErrorBanner.jsx';
import Loader from '../components/Loader.jsx';
import usePageTitle from '../hooks/usePageTitle.js';

const countsOf = (cards) => ({
  total: cards.length,
  known: cards.filter((c) => c.status === 'known').length,
  review: cards.filter((c) => c.status === 'review').length,
  new: cards.filter((c) => c.status === 'new').length,
});

// Cards to go through: everything not yet known (or only "review again" ones).
const queueFor = (cards, onlyReview) =>
  cards.filter((c) => (onlyReview ? c.status === 'review' : c.status !== 'known')).map((c) => c.index);

function FlipCard({ card, flipped, onFlip }) {
  const face = 'absolute inset-0 flex flex-col items-center justify-center rounded-2xl p-8 text-center';
  return (
    <button
      type="button"
      onClick={onFlip}
      aria-label={flipped ? `Answer: ${card.back}. Click to see the question` : `Question: ${card.front}. Click to see the answer`}
      className="block h-72 w-full [perspective:1200px]"
    >
      <div
        className="relative h-full w-full transition-transform duration-500 [transform-style:preserve-3d]"
        style={{ transform: flipped ? 'rotateY(180deg)' : 'none' }}
      >
        <div className={`${face} border border-line bg-surface [backface-visibility:hidden]`}>
          <span className="mb-4 rounded-full bg-brand-tint px-2.5 py-0.5 text-xs font-medium text-brand-dark">{card.topic}</span>
          <p className="text-xl leading-snug font-semibold text-ink">{card.front}</p>
          <p className="mt-6 text-xs text-muted">Click or press Space to see the answer</p>
        </div>
        <div
          className={`${face} bg-brand text-white [backface-visibility:hidden]`}
          style={{ transform: 'rotateY(180deg)' }}
        >
          <p className="text-lg leading-relaxed">{card.back}</p>
          {card.source && (
            <p className="mt-5 rounded-full border border-brand-soft/50 px-2.5 py-0.5 text-xs text-brand-soft">
              {card.source.fileName} · p. {card.source.page}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

// Go through a deck: flip each card, then mark "Review again" or "Knew it".
export default function FlashcardReview() {
  const { subject } = useOutletContext();
  usePageTitle('Flashcards', subject.name);
  const { deckId } = useParams();
  const location = useLocation();

  const [deck, setDeck] = useState(location.state?.deck?.id === deckId ? location.state.deck : null);
  const [queue, setQueue] = useState(null);
  const [position, setPosition] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [error, setError] = useState('');

  const start = useCallback((cards, onlyReview = false) => {
    setQueue(queueFor(cards, onlyReview));
    setPosition(0);
    setFlipped(false);
  }, []);

  useEffect(() => {
    if (deck) {
      if (queue === null) start(deck.cards);
      return;
    }
    decksApi
      .getDeck(deckId)
      .then(setDeck)
      .catch((err) => setError(errorMessage(err)));
  }, [deck, deckId, queue, start]);

  const card = deck && queue && position < queue.length ? deck.cards[queue[position]] : null;

  const mark = useCallback(
    (status) => {
      if (!card) return;
      // Update straight away; the save happens in the background.
      setDeck((d) => ({ ...d, cards: d.cards.map((c) => (c.index === card.index ? { ...c, status } : c)) }));
      decksApi.markCard(deck.id, card.index, status).catch((err) => setError(errorMessage(err)));
      setFlipped(false);
      setPosition((p) => p + 1);
    },
    [card, deck]
  );

  // Keyboard: Space flips, 1 = review again, 2 = knew it (once flipped).
  useEffect(() => {
    const onKey = (e) => {
      if (!card || e.target.closest('input, textarea, select')) return;
      if (e.code === 'Space') {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (flipped && e.key === '1') mark('review');
      else if (flipped && e.key === '2') mark('known');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [card, flipped, mark]);

  const resetAll = async () => {
    try {
      const fresh = await decksApi.resetDeck(deck.id);
      setDeck(fresh);
      start(fresh.cards);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  if (!deck || queue === null) return error ? <ErrorBanner message={error} /> : <Loader />;

  const counts = countsOf(deck.cards);

  return (
    <div className="mx-auto max-w-2xl">
      <Link to={`/subjects/${subject.id}/flashcards`} className="text-sm text-brand hover:underline">
        ← All decks
      </Link>
      <div className="mt-2 flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold">{deck.topic || 'All topics'}</h1>
        {card && (
          <p className="text-sm text-muted">
            Card {position + 1} of {queue.length}
          </p>
        )}
      </div>
      <DeckProgress counts={counts} className="mt-3" />

      {card ? (
        <>
          <div className="mt-6">
            <FlipCard card={card} flipped={flipped} onFlip={() => setFlipped((f) => !f)} />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => mark('review')}
              disabled={!flipped}
              className="rounded-lg border border-danger/60 bg-surface py-3 text-sm font-semibold text-[#9b2c2c] hover:bg-danger/10 disabled:opacity-40"
            >
              Review again <span className="font-normal text-muted">(1)</span>
            </button>
            <button
              type="button"
              onClick={() => mark('known')}
              disabled={!flipped}
              className="rounded-lg bg-cta py-3 text-sm font-semibold text-ink hover:bg-cta-hover disabled:opacity-40"
            >
              Knew it <span className="font-normal">(2)</span>
            </button>
          </div>
          {!flipped && <p className="mt-2 text-center text-xs text-muted">Flip the card first, then mark it.</p>}
        </>
      ) : (
        <section className="mt-6 rounded-2xl border border-line bg-surface p-8 text-center">
          <h2 className="text-xl font-semibold">
            {counts.known === counts.total ? 'You know every card in this deck' : 'Round finished'}
          </h2>
          <p className="mt-2 text-body">
            {counts.known} of {counts.total} known
            {counts.review > 0 && `, ${counts.review} to review again`}.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {counts.review > 0 && (
              <button
                onClick={() => start(deck.cards, true)}
                className="rounded-md bg-cta px-4 py-2 text-sm font-semibold text-ink hover:bg-cta-hover"
              >
                Review the {counts.review} again
              </button>
            )}
            <button onClick={resetAll} className="rounded-md border border-line-strong px-4 py-2 text-sm font-medium hover:bg-brand-tint">
              Start over
            </button>
            <Link to={`/subjects/${subject.id}/flashcards`} className="rounded-md px-4 py-2 text-sm text-brand hover:underline">
              Back to decks
            </Link>
          </div>
        </section>
      )}
      <div className="mt-3">
        <ErrorBanner message={error} />
      </div>
    </div>
  );
}
