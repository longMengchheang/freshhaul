import { Badge } from '@/components/ui/badge';

type StageStatus = 'done' | 'active' | 'pending';

function stageTone(status: StageStatus) {
  if (status === 'done') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  }
  if (status === 'active') {
    return 'border-sky-200 bg-sky-50 text-sky-900';
  }
  return 'border-slate-200 bg-white text-slate-600';
}

export default function DealLifecycleTimeline({
  dealStatus,
  hasDriver,
}: {
  dealStatus: string;
  hasDriver: boolean;
}) {
  const commercial: StageStatus =
    ['accepted', 'transport_pending', 'in_transit', 'completed'].includes(dealStatus) ? 'done' : dealStatus === 'pending' ? 'active' : 'pending';
  const dispatch: StageStatus =
    dealStatus === 'transport_pending' ? 'active' : hasDriver || ['in_transit', 'completed'].includes(dealStatus) ? 'done' : 'pending';
  const delivery: StageStatus =
    dealStatus === 'in_transit' ? 'active' : dealStatus === 'completed' ? 'done' : 'pending';
  const settlement: StageStatus = dealStatus === 'completed' ? 'done' : 'pending';

  const stages = [
    { key: 'commercial', label: 'Commercial approval', status: commercial },
    { key: 'dispatch', label: 'Driver assignment', status: dispatch },
    { key: 'delivery', label: 'Delivery execution', status: delivery },
    { key: 'settlement', label: 'Settlement', status: settlement },
  ];

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {stages.map((stage) => (
        <div key={stage.key} className={`rounded-2xl border px-3 py-2.5 ${stageTone(stage.status)}`}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[0.94rem] leading-5 font-semibold">{stage.label}</span>
            <Badge variant="outline" className="h-5 bg-white/85 px-2 text-[0.62rem] uppercase tracking-[0.08em]">
              {stage.status}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  );
}
