import { useState } from 'react';
import TopicPicker from '../TopicPicker.jsx';

// One button in a segmented control (e.g. 5 / 10 / 15).
export const segment = (active, { capitalize = true } = {}) =>
  `flex-1 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ${capitalize ? 'capitalize' : ''} ${
    active ? 'bg-surface text-brand-dark shadow-sm' : 'text-body'
  }`;

// Topic, number of questions and difficulty.
export default function QuizSetup({ topics, initialTopic = '', busy, onSubmit, onFindTopics, findingTopics }) {
  const [topic, setTopic] = useState(initialTopic);
  const [count, setCount] = useState(10);
  const [difficulty, setDifficulty] = useState('medium');

  const submit = (e) => {
    e.preventDefault();
    if (topic !== null && !busy) onSubmit({ topic, count, difficulty });
  };

  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border border-line bg-surface p-4">
      <TopicPicker
        topics={topics}
        initialTopic={initialTopic}
        onChange={setTopic}
        onFindTopics={onFindTopics}
        findingTopics={findingTopics}
      />

      <div className="text-sm">
        <span className="mb-1 block font-medium text-body">Questions</span>
        <div className="flex gap-1 rounded-lg bg-brand-tint p-1">
          {[5, 10, 15].map((n) => (
            <button key={n} type="button" className={segment(count === n)} onClick={() => setCount(n)}>
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="text-sm">
        <span className="mb-1 block font-medium text-body">Difficulty</span>
        <div className="flex gap-1 rounded-lg bg-brand-tint p-1">
          {['easy', 'medium', 'hard'].map((d) => (
            <button key={d} type="button" className={segment(difficulty === d)} onClick={() => setDifficulty(d)}>
              {d}
            </button>
          ))}
        </div>
      </div>

      <button
        disabled={topic === null || busy}
        className="w-full rounded-md bg-cta py-2 text-sm font-medium text-ink hover:bg-cta-hover disabled:opacity-50"
      >
        {busy ? 'Writing your quiz…' : 'Generate quiz'}
      </button>
    </form>
  );
}
