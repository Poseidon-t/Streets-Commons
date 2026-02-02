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

interface AdvocacyChatbotProps {
  location: Location;
  metrics: WalkabilityMetrics;
  dataQuality?: DataQuality;
}

const QUICK_PROMPTS = [
  'What do my scores mean?',
  'What should I improve first?',
  'Draft a social media post',
  'Who should I contact?',
];

export default function AdvocacyChatbot({ location, metrics, dataQuality }: AdvocacyChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

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

  const sendMessage = async (text: string) => {
    if (!text.trim() || isStreaming) return;

    const userMessage: Message = { role: 'user', content: text.trim() };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setIsStreaming(true);

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
          },
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
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

  return (
    <>
      {/* Floating button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white transition-transform hover:scale-110 active:scale-95"
          style={{ backgroundColor: COLORS.primary }}
          aria-label="Open advocacy assistant"
        >
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          {/* Notification dot for first-time users */}
          {messages.length === 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white" />
          )}
        </button>
      )}

      {/* Chat panel */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-2rem)] h-[520px] max-h-[calc(100vh-3rem)] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 text-white flex-shrink-0"
            style={{ backgroundColor: COLORS.primary }}
          >
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span className="font-semibold text-sm">Advocacy Assistant</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white/80 hover:text-white text-xl leading-none p-1"
              aria-label="Close chat"
            >
              &times;
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 ? (
              <div className="space-y-4">
                <div className="text-center py-4">
                  <div className="text-3xl mb-2">&#x1f6b6;</div>
                  <p className="text-sm font-semibold text-gray-800">Hi! I'm your advocacy assistant.</p>
                  <p className="text-xs text-gray-500 mt-1">
                    I can help you understand your walkability results for{' '}
                    <strong>{location.displayName.split(',')[0]}</strong> and take action.
                  </p>
                </div>
                {/* Quick prompts */}
                <div className="space-y-2">
                  {QUICK_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => sendMessage(prompt)}
                      className="w-full text-left px-3 py-2 text-sm rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors"
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
          <form onSubmit={handleSubmit} className="px-3 py-3 border-t border-gray-200 flex-shrink-0">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isStreaming ? 'Thinking...' : 'Ask about your results...'}
                disabled={isStreaming}
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-50"
              />
              <button
                type="submit"
                disabled={isStreaming || !input.trim()}
                className="px-3 py-2 rounded-xl text-white font-medium text-sm transition-all disabled:opacity-40"
                style={{ backgroundColor: COLORS.primary }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
