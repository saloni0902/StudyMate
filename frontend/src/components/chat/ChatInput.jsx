import { useEffect, useRef } from 'react';

// Enter sends, Shift+Enter adds a new line.
export default function ChatInput({ value, onChange, onSend, disabled, placeholder }) {
  const ref = useRef(null);

  // Grow with the text, up to about 6 lines.
  useEffect(() => {
    const el = ref.current;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  const submit = (e) => {
    e.preventDefault();
    if (!disabled && value.trim()) onSend();
  };

  return (
    <form onSubmit={submit} className="flex items-end gap-2 rounded-xl border border-line-strong bg-surface p-2 focus-within:border-brand">
      <textarea
        ref={ref}
        rows={1}
        value={value}
        maxLength={2000}
        aria-label="Your question"
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) submit(e);
        }}
        className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm focus:outline-none"
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className="rounded-lg bg-cta px-4 py-2 text-sm font-medium text-ink hover:bg-cta-hover disabled:opacity-50"
      >
        Send
      </button>
    </form>
  );
}
