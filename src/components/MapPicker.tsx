'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Loader2, MapPinned } from 'lucide-react';

const MapPickerInner = dynamic(() => import('./MapPickerInner'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[280px] w-full items-center justify-center rounded-3xl border border-slate-200 bg-slate-50 text-sm text-slate-400 animate-pulse">
      Loading Map...
    </div>
  ),
});

interface MapPickerProps {
  onLocationSelect: (lat: number, lng: number) => void;
  initialLocation?: { lat: number; lng: number };
  minimal?: boolean;
  defer?: boolean;
  size?: 'compact' | 'regular';
}

export default function MapPicker({ defer = true, ...props }: MapPickerProps) {
  const mapHeightClass = props.minimal || props.size === 'compact' ? 'h-[220px]' : 'h-[280px]';
  const [isReady, setIsReady] = useState(!defer);

  useEffect(() => {
    if (!defer) {
      return;
    }

    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let idleId: number | null = null;

    if (typeof idleWindow.requestIdleCallback === 'function') {
      idleId = idleWindow.requestIdleCallback(() => setIsReady(true), { timeout: 1200 });
    } else {
      timeoutId = setTimeout(() => setIsReady(true), 350);
    }

    return () => {
      if (idleId !== null && typeof idleWindow.cancelIdleCallback === 'function') {
        idleWindow.cancelIdleCallback(idleId);
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [defer]);

  if (!isReady) {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setIsReady(true)}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <MapPinned className="h-4 w-4" />
          Open map picker
        </button>
        <div className={`flex ${mapHeightClass} w-full items-center justify-center rounded-3xl border border-slate-200 bg-slate-50 text-sm text-slate-500`}>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Preparing map...
        </div>
      </div>
    );
  }

  return <MapPickerInner {...props} />;
}
