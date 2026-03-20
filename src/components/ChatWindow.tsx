'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient, getClientEnvError } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Notice } from '@/components/ui/notice';
import { Send, Loader2, MessageSquareText } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import type { ChatMessage } from '@/types/app';

interface ChatWindowProps {
  title: string;
  dealId?: string;
  matchId?: string;
}

function extractActionItems(messages: ChatMessage[]) {
  const actionRegex = /(pickup|deliver|arrive|departure|ready|tomorrow|today|\d{1,2}:\d{2}|\d{1,2}\s?(am|pm))/i;
  const matched = messages
    .filter((message) => actionRegex.test(message.content))
    .slice(-4)
    .map((message) => message.content.trim());

  return Array.from(new Set(matched));
}

export default function ChatWindow({ title, dealId, matchId }: ChatWindowProps) {
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(Boolean(dealId || matchId));
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const configError = !supabase ? getClientEnvError() : null;

  const currentUserId = user?.id;
  const actionItems = extractActionItems(messages);
  const quickMessages = dealId
    ? ['Price confirmed.', 'Quantity confirmed.', 'Deal accepted.']
    : ['Arriving for pickup now.', 'Pickup complete. Starting delivery.', 'Delivered successfully.'];

  useEffect(() => {
    async function loadUser() {
      if (!supabase) {
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    }

    void loadUser();
  }, [supabase]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!currentUserId || (!dealId && !matchId)) {
      return;
    }
    if (!supabase) {
      return;
    }
    const supabaseClient = supabase;

    let active = true;

    async function fetchMessages() {
      setIsLoading(true);

      const baseQuery = supabaseClient.from('messages').select('*').order('created_at', { ascending: true });
      const { data, error } = dealId
        ? await baseQuery.eq('deal_id', dealId)
        : await baseQuery.eq('match_id', matchId);

      if (!active) {
        return;
      }

      if (error) {
        console.error('Error fetching messages:', error);
        setMessages([]);
      } else {
        setMessages((data as ChatMessage[]) || []);
      }

      setIsLoading(false);
    }

    void fetchMessages();

    const channel = supabaseClient
      .channel(`chat_${dealId ?? matchId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: dealId ? `deal_id=eq.${dealId}` : `match_id=eq.${matchId}`,
        },
        (payload) => {
          if (!active) {
            return;
          }
          setMessages((prev) => [...prev, payload.new as ChatMessage]);
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabaseClient.removeChannel(channel);
    };
  }, [currentUserId, dealId, matchId, supabase]);

  const sendMessageContent = async (content: string) => {
    if (!currentUserId || !content.trim()) {
      return;
    }
    if (!supabase) {
      return;
    }

    const { error } = await supabase.from('messages').insert({
      deal_id: dealId ?? null,
      match_id: matchId ?? null,
      sender_id: currentUserId,
      content: content.trim(),
    });

    if (error) {
      console.error('Error sending message:', error);
      setNewMessage(content);
      return;
    }
    setNewMessage('');
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) {
      return;
    }
    await sendMessageContent(newMessage.trim());
  };

  if (isLoading) {
    return (
      <div className="flex h-[420px] flex-col items-center justify-center rounded-[1.75rem] border border-white/80 bg-white/85">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        <p className="mt-3 text-sm text-slate-500">Loading conversation...</p>
      </div>
    );
  }

  if (configError) {
    return (
      <div className="flex h-[420px] flex-col items-center justify-center rounded-[1.75rem] border border-slate-200 bg-white px-6 text-center">
        <Notice tone="warning" className="max-w-md justify-center text-center">
          <div>
            <p className="font-semibold">Chat unavailable</p>
            <p className="mt-1">{configError}</p>
          </div>
        </Notice>
      </div>
    );
  }

  return (
    <div className="flex h-[420px] flex-col overflow-hidden rounded-[1.75rem] border border-white/80 bg-white/90 shadow-sm">
      <div className="border-b border-slate-200/70 bg-slate-50/90 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
            <MessageSquareText className="h-4 w-4" />
          </div>
          <div>
            <p className="font-semibold text-slate-900">{title}</p>
            <p className="text-xs text-slate-500">{dealId ? 'Buyer and farmer thread' : 'Farmer and driver thread'}</p>
          </div>
        </div>
        {actionItems.length > 0 ? (
          <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
            <p className="font-semibold uppercase tracking-[0.08em]">Suggested action notes</p>
            <ul className="mt-1 space-y-1">
              {actionItems.map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          {quickMessages.map((message) => (
            <button
              key={message}
              type="button"
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              onClick={() => {
                void sendMessageContent(message);
              }}
              disabled={!currentUserId}
            >
              {message}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50/60 p-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-slate-400">
            <MessageSquareText className="h-10 w-10" />
            <p className="mt-3 font-medium">No messages yet</p>
            <p className="text-sm">Start the coordination thread here.</p>
          </div>
        ) : (
          messages.map((message) => {
            const isMine = message.sender_id === currentUserId;
            return (
              <div key={message.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[78%] rounded-3xl px-4 py-3 text-sm shadow-sm ${
                    isMine
                      ? 'rounded-br-md bg-emerald-600 text-white'
                      : 'rounded-bl-md border border-slate-200 bg-white text-slate-900'
                  }`}
                >
                  {message.content}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-slate-200/70 bg-white p-3">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="h-11 rounded-full bg-slate-50"
          />
          <Button
            type="submit"
            size="icon"
            className="h-11 w-11 rounded-full"
            disabled={!currentUserId || !newMessage.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}

