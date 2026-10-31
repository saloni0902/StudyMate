import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import * as chatsApi from '../api/chats.js';
import { listDocuments } from '../api/documents.js';
import { errorMessage } from '../api/client.js';
import ChatInput from '../components/chat/ChatInput.jsx';
import ChatList from '../components/chat/ChatList.jsx';
import MessageBubble from '../components/chat/MessageBubble.jsx';
import ErrorBanner from '../components/ErrorBanner.jsx';
import Loader from '../components/Loader.jsx';
import usePageTitle from '../hooks/usePageTitle.js';

const EXAMPLES = ['Summarise the main ideas of my notes', 'Explain the key terms with an example', 'What are the differences between …?'];

function Thinking() {
  return (
    <div className="flex items-center gap-2 text-sm text-muted">
      <span className="flex gap-1">
        {[0, 150, 300].map((delay) => (
          <span key={delay} className="h-2 w-2 animate-bounce rounded-full bg-brand-soft" style={{ animationDelay: `${delay}ms` }} />
        ))}
      </span>
      Searching your notes…
    </div>
  );
}

export default function Chat() {
  const { subject } = useOutletContext();
  usePageTitle('Chat', subject.name);
  const { chatId } = useParams();
  const navigate = useNavigate();

  const [chats, setChats] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loadedChatId, setLoadedChatId] = useState(null);
  const [readyDocs, setReadyDocs] = useState(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [showList, setShowList] = useState(false); // phones only
  const bottomRef = useRef(null);

  const refreshChats = useCallback(() => chatsApi.listChats(subject.id).then(setChats), [subject.id]);

  useEffect(() => {
    refreshChats().catch((err) => setError(errorMessage(err)));
    listDocuments(subject.id)
      .then((docs) => setReadyDocs(docs.filter((d) => d.status === 'ready').length))
      .catch(() => setReadyDocs(0));
  }, [subject.id, refreshChats]);

  // Load the chat named in the URL (none = a new, empty chat).
  useEffect(() => {
    setError('');
    setShowList(false);
    if (!chatId) {
      setMessages([]);
      setLoadedChatId(null);
      return;
    }
    if (chatId === loadedChatId) return; // already showing it (we just created it)
    let cancelled = false;
    setLoadedChatId(undefined);
    chatsApi
      .getChat(chatId)
      .then((chat) => {
        if (cancelled) return;
        setMessages(chat.messages);
        setLoadedChatId(chat.id);
      })
      .catch((err) => !cancelled && setError(errorMessage(err)));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const send = async () => {
    const question = draft.trim();
    setError('');
    setSending(true);
    setDraft('');
    setMessages((list) => [...list, { id: 'pending', role: 'user', content: question, pending: true }]);

    let targetId = chatId;
    let createdNow = false;
    try {
      if (!targetId) {
        targetId = (await chatsApi.createChat(subject.id)).id;
        createdNow = true;
      }
      const { userMessage, assistantMessage } = await chatsApi.sendMessage(targetId, question);
      setMessages((list) => [...list.filter((m) => m.id !== 'pending'), userMessage, assistantMessage]);
      setLoadedChatId(targetId);
      if (createdNow) navigate(`/subjects/${subject.id}/chat/${targetId}`, { replace: true });
      refreshChats();
    } catch (err) {
      // Nothing was saved: put the question back so it can be sent again.
      setMessages((list) => list.filter((m) => m.id !== 'pending'));
      setDraft(question);
      setError(errorMessage(err));
      if (createdNow) chatsApi.deleteChat(targetId).catch(() => {});
    } finally {
      setSending(false);
    }
  };

  const removeChat = async (chat) => {
    if (!window.confirm(`Delete the chat "${chat.title}"?`)) return;
    try {
      await chatsApi.deleteChat(chat.id);
      setChats((list) => list.filter((c) => c.id !== chat.id));
      if (chat.id === chatId) navigate(`/subjects/${subject.id}/chat`);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const noDocs = readyDocs === 0;
  const loadingChat = chatId && loadedChatId === undefined && !error;

  return (
    // Fills the screen below the phone top bar (3.5rem), or the whole screen on desktop.
    <div className="relative -m-4 flex h-[calc(100dvh-3.5rem)] md:-m-8 md:h-screen">
      {/* Chat list: a column on desktop, a panel opened with "Chats" on phones */}
      <aside
        className={`${
          showList ? 'absolute inset-y-0 left-0 z-20 block shadow-lg' : 'hidden'
        } w-64 shrink-0 border-r border-line bg-canvas p-4 md:static md:block md:shadow-none`}
      >
        <ChatList chats={chats} activeId={chatId} subjectId={subject.id} onDelete={removeChat} />
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-line bg-surface px-4 py-3 md:px-6 md:py-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-brand">{subject.name}</p>
            <h1 className="text-lg font-semibold">Chat with your notes</h1>
          </div>
          <button
            type="button"
            onClick={() => setShowList((v) => !v)}
            aria-expanded={showList}
            className="rounded-md border border-line-strong px-3 py-1.5 text-sm font-medium md:hidden"
          >
            Chats ({chats.length})
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-6 md:px-6">
          <div className="mx-auto max-w-3xl space-y-5">
            {loadingChat && <Loader />}

            {!loadingChat && messages.length === 0 && (
              <div className="py-10 text-center">
                <h2 className="text-xl font-semibold">Ask anything about your {subject.name} notes</h2>
                <p className="mt-2 text-sm text-muted">
                  Answers come only from your uploaded PDFs and cite the page they came from.
                </p>
                {noDocs ? (
                  <p className="mt-6 text-sm">
                    No ready documents yet.{' '}
                    <Link to={`/subjects/${subject.id}/documents`} className="text-brand underline">
                      Upload a PDF
                    </Link>{' '}
                    first.
                  </p>
                ) : (
                  <div className="mt-6 flex flex-wrap justify-center gap-2">
                    {EXAMPLES.map((example) => (
                      <button
                        key={example}
                        onClick={() => setDraft(example.replace(' …?', ' '))}
                        className="rounded-full border border-line-strong bg-surface px-3 py-1.5 text-sm text-body hover:border-brand"
                      >
                        {example}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {sending && <Thinking />}
            <div ref={bottomRef} />
          </div>
        </div>

        <div className="border-t border-line bg-surface px-4 py-3 md:px-6 md:py-4">
          <div className="mx-auto max-w-3xl space-y-2">
            <ErrorBanner message={error} />
            <ChatInput
              value={draft}
              onChange={setDraft}
              onSend={send}
              disabled={sending || noDocs}
              placeholder={noDocs ? 'Upload a PDF to start asking questions' : 'Ask a question about your notes…'}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
