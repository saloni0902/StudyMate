import { Link } from 'react-router-dom';

export default function ChatList({ chats, activeId, subjectId, onDelete }) {
  return (
    <div className="flex h-full flex-col">
      <Link
        to={`/subjects/${subjectId}/chat`}
        className="mb-3 rounded-md border border-line-strong bg-surface px-3 py-2 text-center text-sm font-medium hover:border-brand"
      >
        + New chat
      </Link>
      <ul className="flex-1 space-y-1 overflow-y-auto">
        {chats.map((chat) => (
          <li key={chat.id} className="group flex items-center">
            <Link
              to={`/subjects/${subjectId}/chat/${chat.id}`}
              className={`min-w-0 flex-1 truncate rounded-md px-3 py-2 text-sm ${
                chat.id === activeId ? 'bg-brand-tint font-medium text-brand-dark' : 'text-body hover:bg-brand-tint'
              }`}
            >
              {chat.title}
            </Link>
            <button
              onClick={() => onDelete(chat)}
              aria-label={`Delete chat ${chat.title}`}
              // Always visible on touch screens (no hover there); on hover from md up.
              className="ml-1 rounded px-1.5 text-muted hover:text-danger md:hidden md:group-hover:block md:group-focus-within:block"
            >
              ×
            </button>
          </li>
        ))}
        {chats.length === 0 && <li className="px-3 text-sm text-muted">No chats yet</li>}
      </ul>
    </div>
  );
}
