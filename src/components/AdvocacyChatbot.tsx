/**
 * Advocacy Chatbot
 * Floating chat widget that helps users understand their walkability data
 * and take action to improve their neighborhood.
 */

import { useState, useRef, useEffect } from 'react';
import { COLORS } from '../constants';
import type { Location, WalkabilityMetrics, DataQuality } from '../types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const FREE_MESSAGE_LIMIT = 6;
const STORAGE_KEY_COUNT = 'safestreets_chat_count';
const STORAGE_KEY_MESSAGES = 'safestreets_chat_messages';

function loadPersistedCount(): number {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_COUNT);
    return stored ? parseInt(stored, 10) || 0 : 0;
  } catch { return 0; }
}

function loadPersistedMessages(): Message[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_MESSAGES);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function persistChat(messages: Message[], count: number) {
  try {
    localStorage.setItem(STORAGE_KEY_COUNT, String(count));
    localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(messages));
  } catch { /* quota exceeded — silently fail */ }
}

interface AdvocacyChatbotProps {
  location: Location;
  metrics: WalkabilityMetrics;
  dataQuality?: DataQuality;
  isPremium?: boolean;
  onUnlock?: () => void;
}

const QUICK_PROMPTS = [
  'What story do my scores tell?',
  'What would Jane Jacobs say about this street?',
  "What's the single biggest win for this neighborhood?",
  'Help me build a case for my city council',
  'How does this compare to global standards?',
  'Draft a sharp social media post',
  'What tactical urbanism could work here?',
  'Who is being failed by this street design?',
];

const PEEK_TEASERS = [
  'What would Jane Jacobs say about this street?',
  'Who is being failed by this street design?',
  'How does this compare to global standards?',
  'What tactical urbanism could work here?',
];

export default function AdvocacyChatbot({ location, metrics, dataQuality, isPremium = false, onUnlock }: AdvocacyChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(loadPersistedMessages);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [retryCountdown, setRetryCountdown] = useState(0);
  const [language, setLanguage] = useState('en');
  const [peekVisible, setPeekVisible] = useState(false);
  const [peekDismissed, setPeekDismissed] = useState(false);
  const peekIndex = useRef(Math.floor(Math.random() * PEEK_TEASERS.length));
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const persistedCount = useRef(loadPersistedCount());

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  // Retry countdown timer
  useEffect(() => {
    if (retryCountdown <= 0) return;
    const timer = setTimeout(() => setRetryCountdown(retryCountdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [retryCountdown]);

  // Show peek teaser after 4 seconds for first-time users
  useEffect(() => {
    if (isOpen || peekDismissed || persistedCount.current > 0) return;
    const timer = setTimeout(() => setPeekVisible(true), 4000);
    return () => clearTimeout(timer);
  }, [isOpen, peekDismissed]);

  // Auto-hide peek after 8 seconds
  useEffect(() => {
    if (!peekVisible) return;
    const timer = setTimeout(() => setPeekVisible(false), 8000);
    return () => clearTimeout(timer);
  }, [peekVisible]);

  // Count user messages (use persisted count as floor)
  const userMessageCount = Math.max(
    persistedCount.current,
    messages.filter(m => m.role === 'user').length,
  );
  const isAtLimit = !isPremium && userMessageCount >= FREE_MESSAGE_LIMIT;
  const showCounter = !isPremium && userMessageCount >= 3 && !isAtLimit;

  const sendMessage = async (text: string) => {
    if (!text.trim() || isStreaming) return;

    // Check free limit
    if (!isPremium && userMessageCount >= FREE_MESSAGE_LIMIT) return;

    const userMessage: Message = { role: 'user', content: text.trim() };
    const updatedMessages = [...messages, userMessage];
    const newCount = userMessageCount + 1;
    setMessages(updatedMessages);
    setInput('');
    setIsStreaming(true);

    // Persist count immediately
    persistedCount.current = newCount;
    persistChat(updatedMessages, newCount);

    // Add empty assistant message that we'll stream into
    const assistantMessage: Message = { role: 'assistant', content: '' };
    setMessages([...updatedMessages, assistantMessage]);

    try {
      abortRef.current = new AbortController();
      const apiUrl = import.meta.env.VITE_API_URL || '';

      const response = await fetch(`${apiUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          messages: updatedMessages,
          context: {
            locationName: location.displayName,
            metrics,
            dataQuality,
            language: language !== 'en' ? language : undefined,
          },
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        if (data.error === 'rate_limited') {
          setRetryCountdown(data.retryAfter || 30);
          setInput(text.trim()); // Restore input so user doesn't lose it
          throw new Error('High demand right now. Try again in a moment.');
        }
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      // Read SSE stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      if (!reader) throw new Error('No response body');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') break;

            try {
              const parsed = JSON.parse(data);
              if (parsed.text) {
                accumulated += parsed.text;
                // Update the last message (assistant) with accumulated text
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: 'assistant', content: accumulated };
                  return updated;
                });
              }
              if (parsed.error) {
                if (parsed.error === 'rate_limited') {
                  setRetryCountdown(parsed.retryAfter || 30);
                  setInput(text.trim());
                }
                throw new Error(parsed.error);
              }
            } catch (e) {
              // Skip malformed JSON lines
              if (e instanceof SyntaxError) continue;
              throw e;
            }
          }
        }
      }

      // Persist final messages with assistant response
      setMessages(prev => {
        persistChat(prev, newCount);
        return prev;
      });
    } catch (err: any) {
      if (err.name === 'AbortError') return;

      setMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === 'assistant' && !last.content) {
          updated[updated.length - 1] = {
            role: 'assistant',
            content: `Sorry, I couldn't respond right now. ${err.message || 'Please try again.'}`,
          };
        }
        persistChat(updated, newCount);
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleResetChat = () => {
    // Reset conversation but keep the count (prevent abuse)
    setMessages([]);
    try {
      localStorage.removeItem(STORAGE_KEY_MESSAGES);
    } catch { /* ignore */ }
  };

  return (
    <>
      {/* Floating button + peek teaser */}
      {!isOpen && (
        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 flex flex-col items-end gap-2">
          {/* Peek teaser bubble */}
          {peekVisible && (
            <div
              className="relative bg-white rounded-xl shadow-lg border px-4 py-3 max-w-[260px] animate-[fadeInUp_0.3s_ease-out]"
              style={{ borderColor: '#e0dbd0' }}
            >
              <button
                onClick={(e) => { e.stopPropagation(); setPeekDismissed(true); setPeekVisible(false); }}
                className="absolute top-1 right-1.5 text-gray-300 hover:text-gray-500 text-sm leading-none"
                aria-label="Dismiss"
              >&times;</button>
              <p className="text-xs font-medium pr-4" style={{ color: '#2a3a2a' }}>
                &ldquo;{PEEK_TEASERS[peekIndex.current]}&rdquo;
              </p>
              <p className="text-[10px] mt-1" style={{ color: '#8a9a8a' }}>
                Ask Meridian — trained on Jacobs, Gehl, Speck & NACTO standards
              </p>
              {/* Triangle pointer */}
              <div className="absolute -bottom-1.5 right-6 w-3 h-3 bg-white border-b border-r rotate-45" style={{ borderColor: '#e0dbd0' }} />
            </div>
          )}

          {/* Button + label */}
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={() => { setIsOpen(true); setPeekVisible(false); setPeekDismissed(true); }}
              className="w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white transition-transform hover:scale-110 active:scale-95"
              style={{ backgroundColor: COLORS.primary }}
              aria-label="Open urbanist advocate"
            >
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              {/* Notification dot for first-time users */}
              {messages.length === 0 && persistedCount.current === 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white" />
              )}
            </button>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full shadow-sm bg-white" style={{ color: '#2a3a2a' }}>
              Meridian
            </span>
          </div>
        </div>
      )}

      {/* Chat panel */}
      {isOpen && (
        <div className="fixed bottom-0 right-0 sm:bottom-6 sm:right-6 z-50 w-full sm:w-[380px] sm:max-w-[calc(100vw-2rem)] h-[100dvh] sm:h-[520px] sm:max-h-[calc(100vh-3rem)] bg-white sm:rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 text-white flex-shrink-0"
            style={{ backgroundColor: COLORS.primary }}
          >
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <div className="flex flex-col">
                <span className="font-semibold text-sm leading-tight">Meridian</span>
                <span className="text-[10px] text-white/60 leading-tight">Trained on NACTO, WHO & urban planning standards</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {/* Language selector */}
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="bg-white/15 text-white text-xs rounded px-1 py-0.5 border-none outline-none cursor-pointer"
                style={{ maxWidth: '58px' }}
                title="Response language"
              >
                <option value="en" className="text-gray-800">EN</option>
                <option value="es" className="text-gray-800">ES</option>
                <option value="fr" className="text-gray-800">FR</option>
                <option value="hi" className="text-gray-800">HI</option>
                <option value="zh" className="text-gray-800">ZH</option>
                <option value="ar" className="text-gray-800">AR</option>
                <option value="pt" className="text-gray-800">PT</option>
                <option value="th" className="text-gray-800">TH</option>
              </select>
              {messages.length > 0 && (
                <button
                  onClick={handleResetChat}
                  className="text-white/60 hover:text-white text-xs p-1"
                  aria-label="New chat"
                  title="New chat"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-white/80 hover:text-white text-xl leading-none p-1"
                aria-label="Close chat"
              >
                &times;
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 ? (
              <div className="space-y-4">
                <div className="text-center py-4">
                  <div className="text-3xl mb-2">&#x1f6b6;</div>
                  <p className="text-sm font-semibold text-gray-800">Streets belong to people.</p>
                  <p className="text-xs text-gray-500 mt-1">
                    I'm <strong>Meridian</strong> — your urbanism advocate for{' '}
                    <strong>{location.displayName.split(',')[0]}</strong>. I think like Jane Jacobs, argue like Jeff Speck, and design like Jan Gehl — grounded in real data and global standards.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-1.5 mt-3">
                    {['NACTO GSDG', 'WHO', 'Jane Jacobs', 'Jan Gehl', 'Jeff Speck'].map((tag) => (
                      <span key={tag} className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ backgroundColor: '#f0ebe0', color: '#5a6a5a' }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                {/* Quick prompts */}
                <div className="space-y-2">
                  {QUICK_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => sendMessage(prompt)}
                      className="w-full text-left px-3 py-2.5 sm:py-2 text-sm rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white rounded-br-md'
                        : 'bg-gray-100 text-gray-800 rounded-bl-md'
                    }`}
                  >
                    {msg.content || (
                      <span className="inline-flex items-center gap-1 text-gray-400">
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          {isAtLimit ? (
            <div className="px-3 py-3 border-t border-gray-200 flex-shrink-0">
              <div className="text-center p-3 rounded-xl" style={{ backgroundColor: 'rgba(224,120,80,0.06)', border: '1px solid rgba(224,120,80,0.2)' }}>
                <p className="text-sm font-semibold mb-1" style={{ color: '#2a3a2a' }}>Free messages used ({FREE_MESSAGE_LIMIT}/{FREE_MESSAGE_LIMIT})</p>
                <p className="text-xs mb-2" style={{ color: '#8a9a8a' }}>Unlock unlimited chat with the Advocacy Toolkit — $49 one-time.</p>
                {onUnlock && (
                  <button
                    onClick={onUnlock}
                    className="px-4 py-2 rounded-lg text-white text-sm font-semibold transition-all hover:shadow-md"
                    style={{ backgroundColor: '#e07850' }}
                  >
                    Unlock Advocacy Toolkit
                  </button>
                )}
              </div>
            </div>
          ) : (
          <div className="px-3 py-3 border-t border-gray-200 flex-shrink-0">
            <form onSubmit={handleSubmit}>
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    retryCountdown > 0
                      ? `Retry in ${retryCountdown}s...`
                      : isStreaming
                      ? 'Thinking...'
                      : 'Ask about streets, standards, advocacy...'
                  }
                  disabled={isStreaming || retryCountdown > 0}
                  className="flex-1 px-3 py-2.5 text-base sm:text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-50"
                />
                <button
                  type="submit"
                  disabled={isStreaming || !input.trim() || retryCountdown > 0}
                  className="px-3.5 py-2.5 rounded-xl text-white font-medium text-sm transition-all disabled:opacity-40"
                  style={{ backgroundColor: COLORS.primary }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </form>
            {/* Remaining messages counter */}
            {showCounter && (
              <p className={`text-xs text-center mt-1.5 ${userMessageCount >= 5 ? 'text-orange-500' : 'text-gray-400'}`}>
                {userMessageCount} of {FREE_MESSAGE_LIMIT} free messages used
              </p>
            )}
          </div>
          )}
        </div>
      )}
    </>
  );
}
