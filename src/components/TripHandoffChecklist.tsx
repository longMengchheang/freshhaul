'use client';

import { useEffect, useMemo, useState } from 'react';

interface TripHandoffChecklistProps {
  dealId: string;
}

const checklistItems = [
  { id: 'confirm_pickup_time', label: 'Confirm pickup time with farmer' },
  { id: 'check_produce_quantity', label: 'Check produce quantity before loading' },
  { id: 'confirm_cooling_condition', label: 'Confirm cooling condition is ready' },
  { id: 'share_departure_update', label: 'Send departure update in transport chat' },
  { id: 'capture_delivery_proof', label: 'Capture delivery proof before completion' },
];

export default function TripHandoffChecklist({ dealId }: TripHandoffChecklistProps) {
  const storageKey = useMemo(() => `freshhaul:handoff-checklist:${dealId}`, [dealId]);
  const [checkedItems, setCheckedItems] = useState<string[]>(() => {
    if (typeof window === 'undefined') {
      return [];
    }
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return [];
      return JSON.parse(raw) as string[];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(checkedItems));
  }, [checkedItems, storageKey]);

  const completedCount = checkedItems.length;
  const totalCount = checklistItems.length;

  function toggleItem(itemId: string) {
    setCheckedItems((previous) =>
      previous.includes(itemId)
        ? previous.filter((id) => id !== itemId)
        : [...previous, itemId],
    );
  }

  return (
    <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Handoff checklist</p>
      <h2 className="mt-2 text-lg font-semibold text-slate-950">
        {completedCount}/{totalCount} steps complete
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Keep this checklist simple and update it as the trip progresses.
      </p>

      <div className="mt-4 space-y-2">
        {checklistItems.map((item) => {
          const checked = checkedItems.includes(item.id);
          return (
            <label
              key={item.id}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm ${
                checked ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-slate-50 text-slate-700'
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleItem(item.id)}
                className="h-4 w-4 rounded border-slate-300 text-emerald-600"
              />
              {item.label}
            </label>
          );
        })}
      </div>
    </div>
  );
}
