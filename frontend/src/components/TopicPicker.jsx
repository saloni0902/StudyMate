import { useState } from 'react';

const OTHER = '__other__';

// "All topics", one of the subject's detected topics, or a typed one.
// Calls onChange with the topic text ('' = all topics, null = typed but too short).
export default function TopicPicker({ topics, initialTopic = '', onChange, onFindTopics, findingTopics }) {
  const startsAsOther = initialTopic && !topics.includes(initialTopic);
  const [choice, setChoice] = useState(startsAsOther ? OTHER : initialTopic);
  const [custom, setCustom] = useState(startsAsOther ? initialTopic : '');

  const report = (nextChoice, nextCustom) => {
    if (nextChoice !== OTHER) return onChange(nextChoice);
    const typed = nextCustom.trim();
    onChange(typed.length >= 2 ? typed : null);
  };

  return (
    <div className="space-y-2 text-sm">
      <label className="block">
        <span className="mb-1 block font-medium text-body">Topic</span>
        <select
          value={choice}
          onChange={(e) => {
            setChoice(e.target.value);
            report(e.target.value, custom);
          }}
          className="w-full rounded-md border border-line-strong bg-surface px-2 py-2"
        >
          <option value="">All topics in this subject</option>
          {topics.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
          <option value={OTHER}>Type a topic…</option>
        </select>
      </label>

      {choice === OTHER && (
        <input
          autoFocus
          value={custom}
          maxLength={200}
          onChange={(e) => {
            setCustom(e.target.value);
            report(OTHER, e.target.value);
          }}
          placeholder="e.g. Banker's algorithm"
          aria-label="Topic"
          className="w-full rounded-md border border-line-strong px-3 py-2"
        />
      )}

      {topics.length === 0 && onFindTopics && (
        <p className="text-xs text-muted">
          No topics found yet.{' '}
          <button type="button" onClick={onFindTopics} disabled={findingTopics} className="text-brand underline">
            {findingTopics ? 'Finding topics…' : 'Find topics in my documents'}
          </button>
        </p>
      )}
    </div>
  );
}
