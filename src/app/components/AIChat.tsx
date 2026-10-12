import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Bot, Loader2, Send, Sparkles } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { useAuth } from '../contexts/AuthContext';
import { apiRequest } from '../utils/api';
import { assistantScopeKey, assistantTextParts } from '../utils/assistantChat.js';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const QUICK_PROMPTS = [
  'Help me get started with ZestIQ.',
  'How do I scan and check an invoice?',
  'What needs my attention today?',
  'How do I fix a recipe food cost that looks wrong?',
];

const weatherDescription = (code: number) => {
  if ([0, 1].includes(code)) return 'Clear';
  if ([2, 3].includes(code)) return 'Cloudy';
  if ([45, 48].includes(code)) return 'Foggy';
  if ([51, 53, 55, 56, 57].includes(code)) return 'Drizzle';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'Rain';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Snow';
  if ([95, 96, 99].includes(code)) return 'Thunderstorms';
  return 'Current conditions unavailable';
};

async function getLiveContext(locationName?: string) {
  const now = new Date();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Toronto';
  const context: Record<string, unknown> = {
    locationName: locationName || 'Selected restaurant location',
    timeZone,
    localDate: new Intl.DateTimeFormat('en-CA', { dateStyle: 'full', timeZone }).format(now),
    localTime: new Intl.DateTimeFormat('en-CA', { timeStyle: 'short', timeZone }).format(now),
    capturedAt: now.toISOString(),
  };

  if (!navigator.geolocation) return context;
  const coordinates = await new Promise<GeolocationCoordinates | null>(resolve => {
    const timeout = window.setTimeout(() => resolve(null), 3200);
    navigator.geolocation.getCurrentPosition(
      position => { window.clearTimeout(timeout); resolve(position.coords); },
      () => { window.clearTimeout(timeout); resolve(null); },
      { enableHighAccuracy: false, maximumAge: 30 * 60 * 1000, timeout: 3000 },
    );
  });
  if (!coordinates) return { ...context, weatherStatus: 'Location permission was not granted, so live weather is unavailable.' };

  try {
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', String(coordinates.latitude));
    url.searchParams.set('longitude', String(coordinates.longitude));
    url.searchParams.set('current', 'temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m');
    url.searchParams.set('timezone', 'auto');
    const response = await fetch(url);
    if (!response.ok) throw new Error('Weather lookup unavailable');
    const current = (await response.json()).current || {};
    context.weather = {
      conditions: weatherDescription(Number(current.weather_code)),
      temperatureC: Number(current.temperature_2m),
      feelsLikeC: Number(current.apparent_temperature),
      precipitationMm: Number(current.precipitation),
      windKmh: Number(current.wind_speed_10m),
      observedAt: current.time,
    };
  } catch {
    context.weatherStatus = 'Live weather lookup is temporarily unavailable.';
  }
  return context;
}

export function AIChat() {
  const { accountId, user, activeLocationId } = useAuth();
  if (!accountId || !user) return null;
  return <ScopedAIChat key={assistantScopeKey(accountId, `${user.id || user.email}:${user.role}`, activeLocationId)} />;
}

function ScopedAIChat() {
  const { accountId, accountName, activeLocationId, locations, user } = useAuth();
  const activeLocation = locations.find(location => location.id === activeLocationId);
  const welcome: ChatMessage = { id: 'welcome', role: 'assistant', content: `Hi ${user?.name?.split(' ')[0] || 'there'}! I can help you use ZestIQ, troubleshoot problems and understand your authorized account data. Tell me what you’re trying to do, or share how you prefer to work.` };
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([welcome]);
  const [notes, setNotes] = useState<string[]>([]);
  const [showMemory, setShowMemory] = useState(false);
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [isLoadingMemory, setIsLoadingMemory] = useState(true);
  const [isClearing, setIsClearing] = useState(false);
  const [memoryStatus, setMemoryStatus] = useState('');
  const requestRef = useRef<AbortController | null>(null);
  const mutationRef = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);
  const memoryUrl = `/api/v1/accounts/${encodeURIComponent(accountId || '')}/assistant?locationId=${encodeURIComponent(activeLocationId || '')}`;
  const busy = isSending || isLoadingMemory || isClearing;

  useEffect(() => () => requestRef.current?.abort(), []);

  useEffect(() => {
    if (!isOpen || !accountId || !activeLocationId || isSending || isClearing) return;
    const controller = new AbortController();
    setIsLoadingMemory(true);
    void apiRequest<{ history: Array<{ role: 'user' | 'assistant'; content: string }>; notes: string[]; memoryEnabled?: boolean }>(memoryUrl, { signal: controller.signal })
      .then(result => {
        if (controller.signal.aborted) return;
        setMemoryEnabled(result.memoryEnabled !== false);
        if (result.memoryEnabled !== false) setMessages([welcome, ...result.history.map((entry, index) => ({ ...entry, id: `saved-${index}` }))]);
        setNotes(result.notes);
        setMemoryStatus('');
      })
      .catch(() => {
        if (!controller.signal.aborted) setMemoryStatus('Saved conversations are unavailable right now. You can still ask for help.');
      })
      .finally(() => { if (!controller.signal.aborted) setIsLoadingMemory(false); });
    return () => controller.abort();
  }, [isOpen, accountId, activeLocationId]);

  const clearMemory = async () => {
    if (busy || mutationRef.current) return;
    mutationRef.current = true;
    setIsClearing(true);
    const controller = new AbortController();
    requestRef.current = controller;
    try {
      await apiRequest(memoryUrl, { method: 'DELETE', signal: controller.signal });
      if (controller.signal.aborted) return;
      setMessages([welcome]); setNotes([]); setInput('');
      setMemoryStatus('Your chat and saved preferences for this location have been cleared.');
    } catch {
      if (!controller.signal.aborted) setMemoryStatus('Could not clear memory. Please try again.');
    } finally { mutationRef.current = false; if (!controller.signal.aborted) setIsClearing(false); }
  };

  useEffect(() => {
    if (isOpen) endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [isOpen, messages, isSending]);

  const sendMessage = async (messageText: string) => {
    const message = messageText.trim();
    if (!message || !accountId || busy || mutationRef.current) return;
    mutationRef.current = true;
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: message };
    setMessages(current => [...current, userMessage]);
    setInput('');
    setIsSending(true);
    const controller = new AbortController();
    requestRef.current = controller;
    try {
      const liveContext = await getLiveContext(activeLocation?.name);
      if (controller.signal.aborted) return;
      const result = await apiRequest<{ answer: string; memorySaved: boolean; memoryEnabled?: boolean; notes: string[] }>(`/api/v1/accounts/${encodeURIComponent(accountId)}/assistant`, {
        method: 'POST',
        signal: controller.signal,
        body: JSON.stringify({
          message,
          locationId: activeLocationId,
          ...(!memoryEnabled ? { history: messages.filter(entry => entry.id !== 'welcome').map(entry => ({ role: entry.role, content: entry.content })) } : {}),
          liveContext,
        }),
      });
      if (controller.signal.aborted) return;
      setMessages(current => [...current, { id: crypto.randomUUID(), role: 'assistant', content: result.answer }]);
      setNotes(result.notes || []);
      setMemoryEnabled(result.memoryEnabled !== false);
      setMemoryStatus(result.memorySaved || result.memoryEnabled === false ? '' : 'This answer is available, but the conversation could not be saved.');
    } catch (error) {
      if (controller.signal.aborted) return;
      setMessages(current => [...current, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: error instanceof Error ? error.message : 'I’m temporarily unavailable. Please try again.',
      }]);
    } finally {
      mutationRef.current = false;
      if (!controller.signal.aborted) setIsSending(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-4 z-30 h-12 w-12 rounded-full bg-[#303A43] px-0 text-white shadow-lg hover:bg-[#1E293B] sm:h-14 sm:w-auto sm:px-5"
        aria-label="Open zestIQ AI assistant"
      >
        <Sparkles className="h-5 w-5 text-[#F58220] sm:mr-2" /> <span className="hidden sm:inline">Ask zestIQ AI</span>
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="flex h-[min(760px,88vh)] max-w-[calc(100vw-1rem)] flex-col overflow-hidden p-0 sm:max-w-xl">
          <DialogHeader className="border-b border-slate-200 bg-[#303A43] px-5 py-4 text-left text-white">
            <DialogTitle className="flex items-center gap-2 text-white">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F58220] text-[#303A43]"><Bot className="h-5 w-5" /></span>
              zestIQ AI Assistant
            </DialogTitle>
            <DialogDescription className="break-words text-white/60">
              Help for {accountName} · {activeLocation?.name}. {memoryEnabled ? 'Your chats and preferences are remembered here.' : 'Shared demo chat stays temporary.'}
            </DialogDescription>
          </DialogHeader>

          <div className="border-b border-slate-200 bg-white px-4 py-2 text-xs text-slate-600">
            {memoryEnabled ? <div className="flex items-center justify-between gap-2">
              <button type="button" className="min-h-9 font-semibold text-[#303A43] underline" onClick={() => setShowMemory(current => !current)}>Saved preferences ({notes.length})</button>
              <button type="button" disabled={busy} onClick={() => void clearMemory()} className="min-h-9 rounded px-2 py-1 hover:bg-slate-100 disabled:opacity-50">{isClearing ? 'Clearing…' : 'Clear memory'}</button>
            </div> : <p>Shared demo chats stay in this browser tab and are not saved.</p>}
            {memoryEnabled && showMemory && <div className="mt-2 max-h-28 overflow-y-auto break-words rounded-lg bg-slate-50 p-2"><p className="mb-1">Your memory is separate for each user, company and location. Tell me “I prefer…” or “Remember…” to share a preference.</p>{notes.length ? <ul className="list-disc space-y-1 pl-4">{notes.map((note, index) => <li key={index}>{note}</li>)}</ul> : <p>No saved preferences yet.</p>}</div>}
            {memoryStatus && <p role="status" className="mt-1 leading-5">{memoryStatus}</p>}
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50 p-4">
            {messages.map(message => (
              <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[88%] whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === 'user' ? 'bg-[#303A43] text-white' : 'border border-slate-200 bg-white text-slate-800 shadow-sm'}`}>
                  {assistantTextParts(message.content).map((part, index) => part.route ? <Link key={index} to={part.route} onClick={() => setIsOpen(false)} className="font-semibold underline">{part.text}</Link> : <span key={index}>{part.text}</span>)}
                </div>
              </div>
            ))}
            {(isSending || isLoadingMemory) && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> {isLoadingMemory ? 'Loading your conversation…' : 'Finding the next step…'}
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {messages.length === 1 && (
            <div className="flex gap-2 overflow-x-auto border-t border-slate-100 bg-white px-4 py-3">
              {QUICK_PROMPTS.map(prompt => (
                <button
                  key={prompt}
                  type="button"
                  disabled={busy}
                  onClick={() => void sendMessage(prompt)}
                  className="shrink-0 rounded-full border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:border-[#F58220] hover:bg-[#FEFCE8]"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          <form
            className="border-t border-slate-200 bg-white p-4"
            onSubmit={event => {
              event.preventDefault();
              void sendMessage(input);
            }}
          >
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={event => setInput(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage(input);
                  }
                }}
                rows={2}
                maxLength={4000}
                disabled={busy}
                placeholder="Ask me anything about ZestIQ…"
                className="min-h-12 flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#F58220]"
              />
              <Button type="submit" size="icon" disabled={!input.trim() || busy} className="h-12 w-12 shrink-0 bg-[#303A43] text-white hover:bg-[#1E293B]">
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-2 text-[11px] text-slate-400">AI can make mistakes. Review operational and costing decisions before acting.</p>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
