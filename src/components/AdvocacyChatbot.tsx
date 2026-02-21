/**
 * Advocacy Chatbot
 * Floating chat widget that helps users understand their walkability data
 * and take action to improve their neighborhood.
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { COLORS } from '../constants';
import { trackEvent } from '../utils/analytics';
import type { Location, WalkabilityMetrics, DataQuality } from '../types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const FREE_MESSAGE_LIMIT = 12;
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

// Base prompts that always appear
const BASE_PROMPTS = [
  'What story do my scores tell?',
  'Help me build a case for my city council',
  'Draft a sharp social media post',
];

// Metric-specific prompts keyed by metric name
const METRIC_PROMPTS: Record<string, string[]> = {
  crossingSafety: [
    'Why is crossing safety critical here?',
    'What would safer crossings look like in this area?',
  ],
  sidewalkCoverage: [
    'What does the sidewalk data actually tell us?',
    'How do I advocate for better pedestrian infrastructure?',
  ],
  speedExposure: [
    'How dangerous are traffic speeds in this area?',
    'What traffic calming could work here?',
  ],
  destinationAccess: [
    'What daily needs are missing within walking distance?',
    'How close is this to a 15-minute neighborhood?',
  ],
  nightSafety: [
    'How does street lighting affect walkability here?',
    'What makes streets feel safe at night?',
  ],
  treeCanopy: [
    'Why does tree canopy matter for walking?',
    'What would more street trees do for this area?',
  ],
  thermalComfort: [
    'How does heat affect walkability here?',
    'What can reduce urban heat in this neighborhood?',
  ],
  slope: [
    'How does terrain affect accessibility here?',
    'What design helps with steep streets?',
  ],
};

function getScoreColor(score: number): string {
  if (score >= 8) return '#22c55e';
  if (score >= 6) return '#84cc16';
  if (score >= 4) return '#eab308';
  if (score >= 2) return '#f97316';
  return '#ef4444';
}

function getScoreLabel(score: number): string {
  if (score >= 8) return 'Strong';
  if (score >= 6) return 'Fair';
  if (score >= 4) return 'Needs work';
  return 'Critical';
}

/** Build dynamic quick prompts: 3 base + 2-3 based on weakest metrics */
function buildQuickPrompts(metrics: WalkabilityMetrics): string[] {
  const metricEntries: [string, number][] = [
    ['crossingSafety', metrics.crossingSafety],
    ['sidewalkCoverage', metrics.sidewalkCoverage],
    ['speedExposure', metrics.speedExposure],
    ['destinationAccess', metrics.destinationAccess],
    ['nightSafety', metrics.nightSafety],
    ['treeCanopy', metrics.treeCanopy],
    ['thermalComfort', metrics.thermalComfort],
    ['slope', metrics.slope],
  ].filter(([, v]) => typeof v === 'number') as [string, number][];

  // Sort by score ascending (weakest first)
  metricEntries.sort((a, b) => a[1] - b[1]);

  // Pick one prompt from each of the 3 weakest metrics
  const dynamicPrompts: string[] = [];
  for (const [key] of metricEntries.slice(0, 3)) {
    const options = METRIC_PROMPTS[key];
    if (options) {
      dynamicPrompts.push(options[Math.floor(Math.random() * options.length)]);
    }
  }

  return [...BASE_PROMPTS, ...dynamicPrompts].slice(0, 6);
}

/** Build peek teasers based on weakest metric */
function buildPeekTeaser(metrics: WalkabilityMetrics): string {
  const entries: [string, number][] = [
    ['crossingSafety', metrics.crossingSafety],
    ['sidewalkCoverage', metrics.sidewalkCoverage],
    ['speedExposure', metrics.speedExposure],
    ['destinationAccess', metrics.destinationAccess],
    ['nightSafety', metrics.nightSafety],
    ['treeCanopy', metrics.treeCanopy],
  ].filter(([, v]) => typeof v === 'number') as [string, number][];

  entries.sort((a, b) => a[1] - b[1]);
  const weakest = entries[0]?.[0];

  const teasers: Record<string, string> = {
    crossingSafety: 'Your crossing safety score needs attention. Ask me why.',
    sidewalkCoverage: 'What does your sidewalk data really mean? Ask me.',
    speedExposure: 'Traffic speeds here could be safer. Want to know how?',
    destinationAccess: 'How close is this to a 15-minute neighborhood?',
    nightSafety: 'What makes streets feel safe after dark?',
    treeCanopy: 'More trees could transform this street. Ask me how.',
  };

  return teasers[weakest || 'crossingSafety'] || 'What would Jane Jacobs say about this street?';
}

export default function AdvocacyChatbot({ location, metrics, dataQuality, isPremium = false, onUnlock }: AdvocacyChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(loadPersistedMessages);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [retryCountdown, setRetryCountdown] = useState(0);
  const [language, setLanguage] = useState('en');
  const [peekVisible, setPeekVisible] = useState(false);
  const [peekDismissed, setPeekDismissed] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [emailSubmitted, setEmailSubmitted] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const persistedCount = useRef(loadPersistedCount());

  // Dynamic prompts based on metrics
  const quickPrompts = useMemo(() => buildQuickPrompts(metrics), [metrics]);
  const peekTeaser = useMemo(() => buildPeekTeaser(metrics), [metrics]);

  // Find weakest metrics for summary card
  const weakestMetrics = useMemo(() => {
    const entries: { name: string; score: number }[] = [
      { name: 'Crossing Safety', score: metrics.crossingSafety },
      { name: 'Sidewalks', score: metrics.sidewalkCoverage },
      { name: 'Speed Safety', score: metrics.speedExposure },
      { name: 'Daily Needs', score: metrics.destinationAccess },
      { name: 'Night Safety', score: metrics.nightSafety },
      { name: 'Tree Canopy', score: metrics.treeCanopy },
      { name: 'Thermal', score: metrics.thermalComfort },
      { name: 'Terrain', score: metrics.slope },
    ].filter(e => typeof e.score === 'number');
    entries.sort((a, b) => a.score - b.score);
    return entries.slice(0, 3);
  }, [metrics]);

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
  const showCounter = !isPremium && userMessageCount >= 6 && !isAtLimit;

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

    // Track chat engagement
    trackEvent('chat_message', { location: location?.displayName, messageNumber: newCount });

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

  const handleCopyChat = async () => {
    const text = messages.map(m =>
      `${m.role === 'user' ? 'You' : 'Meridian'}: ${m.content}`
    ).join('\n\n');
    const header = `SafeStreets Analysis — ${location.displayName}\nOverall Score: ${metrics.overallScore}/10 (${metrics.label})\n\n`;
    try {
      await navigator.clipboard.writeText(header + text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard not available */ }
  };

  const handleEmailCapture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim() || emailLoading) return;
    setEmailLoading(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      await fetch(`${apiUrl}/api/capture-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailInput.trim(),
          source: 'chatbot_paywall',
        }),
      });
      setEmailSubmitted(true);
    } catch {
      // Silently fail — don't block the user
      setEmailSubmitted(true);
    } finally {
      setEmailLoading(false);
    }
  };

  return (
    <>
      {/* Floating button + peek teaser */}
      {!isOpen && (
        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 flex flex-col items-end gap-2">
          {/* Peek teaser bubble — contextual to weakest metric */}
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
                {peekTeaser}
              </p>
              <p className="text-[10px] mt-1" style={{ color: '#8a9a8a' }}>
                Ask Meridian — your AI urbanist advocate
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
                <span className="text-[10px] text-white/60 leading-tight">AI urbanist advocate</span>
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
              {/* Copy conversation */}
              {messages.length > 0 && (
                <button
                  onClick={handleCopyChat}
                  className="text-white/60 hover:text-white text-xs p-1"
                  aria-label="Copy conversation"
                  title={copied ? 'Copied!' : 'Copy conversation'}
                >
                  {copied ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
              )}
              {/* New chat */}
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
                    I'm <strong>Meridian</strong> — your AI urbanist advocate for{' '}
                    <strong>{location.displayName.split(',')[0]}</strong>.
                    Grounded in NACTO standards, urban planning research, and your actual analysis data.
                  </p>
                  {/* Mini score summary */}
                  <div className="mt-3 flex items-center justify-center gap-3">
                    <div className="text-center">
                      <div className="text-lg font-bold" style={{ color: getScoreColor(metrics.overallScore) }}>
                        {metrics.overallScore}/10
                      </div>
                      <div className="text-[10px] text-gray-400">Overall</div>
                    </div>
                    <div className="w-px h-8 bg-gray-200" />
                    <div className="text-left">
                      {weakestMetrics.slice(0, 2).map(m => (
                        <div key={m.name} className="flex items-center gap-1.5 text-[10px]">
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: getScoreColor(m.score) }} />
                          <span className="text-gray-500">{m.name}: {m.score}/10</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                {/* Dynamic quick prompts */}
                <div className="space-y-2">
                  {quickPrompts.map((prompt) => (
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

          {/* Input / Paywall */}
          {isAtLimit ? (
            <div className="px-3 py-3 border-t border-gray-200 flex-shrink-0 overflow-y-auto max-h-[55%]">
              {/* Summary card */}
              <div className="rounded-xl p-3 mb-3" style={{ backgroundColor: '#f8f6f2', border: '1px solid #e8e4dc' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold" style={{ color: '#2a3a2a' }}>Your Analysis Summary</span>
                  <span className="text-sm font-bold" style={{ color: getScoreColor(metrics.overallScore) }}>
                    {metrics.overallScore}/10
                  </span>
                </div>
                <div className="space-y-1.5">
                  {weakestMetrics.map(m => (
                    <div key={m.name} className="flex items-center justify-between">
                      <span className="text-[11px] text-gray-600">{m.name}</span>
                      <div className="flex items-center gap-1.5">
                        <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${m.score * 10}%`, backgroundColor: getScoreColor(m.score) }}
                          />
                        </div>
                        <span className="text-[10px] font-medium w-6 text-right" style={{ color: getScoreColor(m.score) }}>
                          {m.score}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-gray-400 mt-2">
                  {weakestMetrics[0] && `Biggest opportunity: ${weakestMetrics[0].name} (${getScoreLabel(weakestMetrics[0].score)})`}
                </p>
              </div>

              {/* Upgrade CTA */}
              <div className="text-center mb-3">
                <p className="text-sm font-semibold mb-1" style={{ color: '#2a3a2a' }}>
                  Meridian has more to say
                </p>
                <p className="text-xs mb-2.5" style={{ color: '#8a9a8a' }}>
                  Unlock unlimited chat, advocacy letters, and the full toolkit.
                </p>
                {onUnlock && (
                  <button
                    onClick={onUnlock}
                    className="w-full py-2.5 rounded-lg text-white text-sm font-semibold transition-all hover:shadow-md"
                    style={{ backgroundColor: '#e07850' }}
                  >
                    Go Premium — $49
                  </button>
                )}
              </div>

              {/* Email capture alternative */}
              {!emailSubmitted ? (
                <div className="pt-2.5 border-t border-gray-100">
                  <p className="text-[11px] text-gray-500 text-center mb-2">
                    Not ready? Get walkability tips and updates.
                  </p>
                  <form onSubmit={handleEmailCapture} className="flex gap-2">
                    <input
                      type="email"
                      required
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder="you@email.com"
                      className="flex-1 px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                    />
                    <button
                      type="submit"
                      disabled={emailLoading}
                      className="px-3 py-2 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                      style={{ backgroundColor: '#f0ebe0', color: '#2a3a2a' }}
                    >
                      {emailLoading ? '...' : 'Send'}
                    </button>
                  </form>
                </div>
              ) : (
                <p className="text-[11px] text-center pt-2.5 border-t border-gray-100" style={{ color: '#22c55e' }}>
                  Thanks! We'll keep you posted.
                </p>
              )}
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
              <p className={`text-xs text-center mt-1.5 ${userMessageCount >= 10 ? 'text-orange-500' : 'text-gray-400'}`}>
                {FREE_MESSAGE_LIMIT - userMessageCount} messages left
              </p>
            )}
          </div>
          )}
        </div>
      )}
    </>
  );
}
