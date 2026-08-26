import { useEffect, useRef, useState } from 'react';
import { Bot, Loader2, Send, Sparkles } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { useAuth } from '../contexts/AuthContext';
import { apiRequest } from '../utils/api';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const QUICK_PROMPTS = [
  'What needs my attention today?',
  'Which inventory items are below par?',
  'How do I scan an invoice PDF?',
  'Help me understand my recipe costs.',
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
  const { accountId, accountName, activeLocationId, locations } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hi! I’m your zestIQ AI assistant. I can help with this app and answer questions about your authorized company inventory, recipes, invoices, suppliers and purchasing.',
    },
  ]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [isOpen, messages, isSending]);

  const sendMessage = async (messageText: string) => {
    const message = messageText.trim();
    if (!message || !accountId || isSending) return;
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: message };
    const history = messages.filter(entry => entry.id !== 'welcome').map(entry => ({ role: entry.role, content: entry.content }));
    setMessages(current => [...current, userMessage]);
    setInput('');
    setIsSending(true);
    try {
      const activeLocation = locations.find(location => location.id === activeLocationId);
      const liveContext = await getLiveContext(activeLocation?.name);
      const result = await apiRequest<{ answer: string }>(`/api/v1/accounts/${encodeURIComponent(accountId)}/assistant`, {
        method: 'POST',
        body: JSON.stringify({
          message,
          locationId: activeLocationId,
          history,
          liveContext,
        }),
      });
      setMessages(current => [...current, { id: crypto.randomUUID(), role: 'assistant', content: result.answer }]);
    } catch (error) {
      setMessages(current => [...current, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: error instanceof Error ? error.message : 'I’m temporarily unavailable. Please try again.',
      }]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-4 z-30 h-14 rounded-full bg-[#0F172A] px-5 text-white shadow-2xl hover:bg-[#1E293B]"
        aria-label="Open zestIQ AI assistant"
      >
        <Sparkles className="mr-2 h-5 w-5 text-[#F5C10E]" /> Ask zestIQ AI
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="flex h-[min(760px,88vh)] max-w-[calc(100vw-1rem)] flex-col overflow-hidden p-0 sm:max-w-xl">
          <DialogHeader className="border-b border-slate-200 bg-[#0F172A] px-5 py-4 text-left text-white">
            <DialogTitle className="flex items-center gap-2 text-white">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F5C10E] text-[#0F172A]"><Bot className="h-5 w-5" /></span>
              zestIQ AI Assistant
            </DialogTitle>
            <DialogDescription className="text-white/60">
              Company-aware help for {accountName}. Other businesses’ information is never included.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50 p-4">
            {messages.map(message => (
              <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === 'user' ? 'bg-[#0F172A] text-white' : 'border border-slate-200 bg-white text-slate-800 shadow-sm'}`}>
                  {message.content}
                </div>
              </div>
            ))}
            {isSending && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Reviewing your company data…
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
                  onClick={() => void sendMessage(prompt)}
                  className="shrink-0 rounded-full border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:border-[#F5C10E] hover:bg-[#FEFCE8]"
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
                placeholder="Ask about inventory, costs, invoices, recipes or how to use zestIQ…"
                className="min-h-12 flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#F5C10E]"
              />
              <Button type="submit" size="icon" disabled={!input.trim() || isSending} className="h-12 w-12 shrink-0 bg-[#0F172A] text-white hover:bg-[#1E293B]">
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
