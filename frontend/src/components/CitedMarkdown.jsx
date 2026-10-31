import { useState } from 'react';
import ReactMarkdown from 'react-markdown';

// Turn "[1]" markers into links the markdown renderer hands to CiteMarker.
const withCiteLinks = (text) => text.replace(/\[(\d+)\](?!\()/g, '[$1](#cite-$1)');

function CiteMarker({ n, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`Show source ${n}`}
      className={`mx-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded px-1 align-super text-[10px] font-semibold ${
        active ? 'bg-brand text-white' : 'bg-brand-soft text-brand-dark hover:bg-brand-soft'
      }`}
    >
      {n}
    </button>
  );
}

// Markdown text with clickable [n] citation markers, a row of source chips
// ("os.pdf · p. 3") and the cited passage shown when one is clicked.
export default function CitedMarkdown({ content, citations = [], className = '' }) {
  const [open, setOpen] = useState(null);
  const toggle = (n) => setOpen((current) => (current === n ? null : n));
  const openCitation = citations.find((c) => c.n === open);

  const components = {
    a: ({ href, children }) => {
      const match = href?.match(/^#cite-(\d+)$/);
      if (!match) {
        return (
          <a href={href} target="_blank" rel="noreferrer" className="text-brand underline">
            {children}
          </a>
        );
      }
      const n = Number(match[1]);
      // Numbers the AI service didn't confirm as sources are left out.
      return citations.some((c) => c.n === n) ? <CiteMarker n={n} active={open === n} onClick={() => toggle(n)} /> : null;
    },
  };

  return (
    <div>
      <div className={`markdown text-sm leading-relaxed ${className}`}>
        <ReactMarkdown components={components}>{withCiteLinks(content)}</ReactMarkdown>
      </div>

      {citations.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {citations.map((c) => (
            <button
              key={c.n}
              type="button"
              onClick={() => toggle(c.n)}
              className={`rounded-full border px-2.5 py-0.5 text-xs ${
                open === c.n
                  ? 'border-brand bg-brand text-white'
                  : 'border-line-strong bg-surface text-body hover:border-brand'
              }`}
            >
              [{c.n}] {c.fileName} · p. {c.page}
            </button>
          ))}
        </div>
      )}

      {openCitation && (
        <blockquote className="mt-2 rounded-md border-l-4 border-brand bg-brand-tint px-3 py-2 text-xs text-body">
          <p className="mb-1 font-semibold text-muted">
            {openCitation.fileName}, page {openCitation.page}
          </p>
          {openCitation.snippet}
          {openCitation.snippet.length >= 300 && '…'}
        </blockquote>
      )}
    </div>
  );
}
