import CitedMarkdown from '../CitedMarkdown.jsx';

export default function MessageBubble({ message }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div
          className={`max-w-[85%] rounded-2xl rounded-tr-sm bg-brand px-4 py-2.5 text-sm whitespace-pre-wrap text-white ${
            message.pending ? 'opacity-70' : ''
          }`}
        >
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[85%]">
      <CitedMarkdown
        content={message.content}
        citations={message.citations}
        className={`rounded-2xl rounded-tl-sm px-4 py-3 ${
          message.grounded ? 'border border-line bg-surface' : 'border border-amber-200 bg-amber-50 text-amber-900'
        }`}
      />
    </div>
  );
}
