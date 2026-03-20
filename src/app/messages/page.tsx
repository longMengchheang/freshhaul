import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ChatWindow from '@/components/ChatWindow';
import { getCurrentUserContext } from '@/lib/server/current-user';
import { hasActiveRole } from '@/lib/user-roles';
import { listDriverConversations } from '@/lib/server/driver-messaging';

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ matchId?: string }>;
}) {
  const context = await getCurrentUserContext();

  if (!context) {
    redirect('/auth/login');
  }

  if (!hasActiveRole(context.profile.roles, 'driver')) {
    redirect('/dashboard?mode=driver');
  }

  const conversations = await listDriverConversations(context.authUser.id);
  const resolvedParams = await searchParams;

  const selected =
    conversations.find((item) => item.matchId === resolvedParams.matchId) ??
    conversations[0] ??
    null;

  return (
    <div className="page-shell space-y-6">
      <section className="space-y-2">
        <Badge variant="outline" className="border-slate-200 text-slate-600 bg-slate-50">
          Driver messaging system
        </Badge>
        <h1 className="text-3xl font-bold tracking-tight text-slate-950">Conversation workspace</h1>
        <p className="text-sm text-slate-600">
          Coordinate with farmers in one place for pickup, timing, and completion updates.
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card className="border-0 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.08)]">
          <CardHeader>
            <CardTitle className="text-lg">Active conversations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {conversations.length === 0 ? (
              <p className="text-sm text-slate-500">
                No active delivery conversations yet. Claim a transport match to start messaging.
              </p>
            ) : (
              conversations.map((conversation) => {
                const active = selected?.matchId === conversation.matchId;
                return (
                  <Link
                    key={conversation.matchId}
                    href={`/messages?matchId=${conversation.matchId}`}
                    className={`block rounded-xl border px-3 py-3 transition-colors ${
                      active
                        ? 'border-emerald-300 bg-emerald-50/70'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-slate-900">{conversation.farmerName}</p>
                      <span className="text-xs uppercase tracking-wide text-slate-500">
                        {conversation.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {conversation.pickupProvince} to {conversation.deliveryProvince}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {conversation.produceType} ({Number(conversation.quantityKg).toFixed(0)} kg)
                    </p>
                    <p className="mt-2 line-clamp-2 text-xs text-slate-600">
                      {conversation.lastMessagePreview ?? 'No messages yet - start coordination now.'}
                    </p>
                  </Link>
                );
              })
            )}
          </CardContent>
        </Card>

        <div>
          {selected ? (
            <ChatWindow
              title={`${selected.farmerName} - ${selected.pickupProvince} to ${selected.deliveryProvince}`}
              matchId={selected.matchId}
            />
          ) : (
            <Card className="border-dashed border-slate-300/80 bg-slate-50/50">
              <CardContent className="py-16 text-center text-sm text-slate-600">
                Select a conversation to open real-time chat.
              </CardContent>
            </Card>
          )}
        </div>
      </section>
    </div>
  );
}

