'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import L, { type LatLngLiteral, type LeafletMouseEvent } from 'leaflet';
import { Loader2, MapPin, Navigation, Search } from 'lucide-react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

interface MapPickerInnerProps {
  onLocationSelect: (lat: number, lng: number) => void;
  initialLocation?: { lat: number; lng: number };
  minimal?: boolean;
  size?: 'compact' | 'regular';
}

interface PlaceSuggestion {
  place_id: string | number;
  display_name: string;
  lat: string;
  lon: string;
}

const defaultCenter: LatLngLiteral = { lat: 12.5657, lng: 104.991 };

delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function MapUpdater({ center, zoom }: { center: LatLngLiteral; zoom: number }) {
  const map = useMap();

  useEffect(() => {
    map.flyTo(center, zoom, { duration: 0.6 });
  }, [center, zoom, map]);

  return null;
}

function LocationMarker({
  position,
  onLocationSelect,
  setPosition,
}: {
  position: LatLngLiteral | null;
  onLocationSelect: (lat: number, lng: number) => void;
  setPosition: (value: LatLngLiteral) => void;
}) {
  useMapEvents({
    click(event: LeafletMouseEvent) {
      const nextPosition = event.latlng;
      setPosition(nextPosition);
      onLocationSelect(nextPosition.lat, nextPosition.lng);
    },
  });

  if (!position) {
    return null;
  }

  return (
    <Marker
      position={position}
      draggable
      eventHandlers={{
        dragend(event) {
          const nextPosition = event.target.getLatLng() as LatLngLiteral;
          setPosition(nextPosition);
          onLocationSelect(nextPosition.lat, nextPosition.lng);
        },
      }}
    />
  );
}

export default function MapPickerInner({
  onLocationSelect,
  initialLocation,
  minimal = false,
  size = 'regular',
}: MapPickerInnerProps) {
  const [position, setPosition] = useState<LatLngLiteral | null>(initialLocation || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [helperText, setHelperText] = useState(
    initialLocation
      ? `Pinned at ${initialLocation.lat.toFixed(5)}, ${initialLocation.lng.toFixed(5)}`
      : 'Search, use your current location, or click the map to pin the point.',
  );

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPosition(initialLocation || null);
    if (initialLocation) {
      setHelperText(
        `Pinned at ${initialLocation.lat.toFixed(5)}, ${initialLocation.lng.toFixed(5)}`,
      );
    }
  }, [initialLocation]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const center = useMemo(() => position || initialLocation || defaultCenter, [position, initialLocation]);
  const zoom = position || initialLocation ? 13 : 7;

  async function reverseGeocode(lat: number, lng: number) {
    const nextPosition = { lat, lng };
    setPosition(nextPosition);
    onLocationSelect(lat, lng);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
      );
      if (!response.ok) {
        throw new Error('Reverse geocoding failed');
      }

      const data = (await response.json()) as { display_name?: string };
      if (data.display_name) {
        setSearchQuery(data.display_name);
      }
      setHelperText(`Pinned at ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    } catch {
      setHelperText(`Pinned at ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    }
  }

  async function searchPlaces(query: string) {
    if (!query.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`,
      );
      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = (await response.json()) as PlaceSuggestion[];
      setSuggestions(data);
      setShowSuggestions(data.length > 0);
    } catch {
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setIsSearching(false);
    }
  }

  function handleSearchInput(value: string) {
    setSearchQuery(value);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      void searchPlaces(value);
    }, 350);
  }

  function handleSuggestionSelect(place: PlaceSuggestion) {
    const lat = Number(place.lat);
    const lng = Number(place.lon);

    setSearchQuery(place.display_name);
    setShowSuggestions(false);
    setHelperText(`Pinned at ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    setPosition({ lat, lng });
    onLocationSelect(lat, lng);
  }

  function handleUseCurrentLocation() {
    if (!navigator.geolocation) {
      setHelperText('Geolocation is not supported on this device.');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (result) => {
        setIsLocating(false);
        void reverseGeocode(result.coords.latitude, result.coords.longitude);
      },
      () => {
        setIsLocating(false);
        setHelperText('Could not access your current location.');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      },
    );
  }

  return (
    <div className="space-y-4" ref={containerRef}>
      {!minimal ? (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => handleSearchInput(event.target.value)}
            onFocus={() => {
              if (suggestions.length > 0) {
                setShowSuggestions(true);
              }
            }}
            placeholder="Search for a delivery or pickup point"
            className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-10 text-sm text-slate-900 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
          />
          {isSearching ? (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
          ) : null}

          {showSuggestions && suggestions.length > 0 ? (
            <div className="absolute z-[1000] mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
              {suggestions.map((place) => (
                <button
                  key={place.place_id}
                  type="button"
                  onClick={() => handleSuggestionSelect(place)}
                  className="flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50 last:border-b-0"
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  <span className="text-sm text-slate-700">{place.display_name}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleUseCurrentLocation}
          disabled={isLocating}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLocating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
          {isLocating ? 'Locating...' : 'Use current location'}
        </button>

        {!minimal ? (
          <div className="inline-flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-600">
            Click the map or drag the marker to refine the point.
          </div>
        ) : null}
      </div>

      <div className={`w-full overflow-hidden rounded-3xl border border-slate-200 ${minimal || size === 'compact' ? 'h-[220px]' : 'h-[280px]'}`}>
        <MapContainer center={center} zoom={zoom} scrollWheelZoom className="h-full w-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapUpdater center={center} zoom={zoom} />
          <LocationMarker
            position={position}
            setPosition={setPosition}
            onLocationSelect={(lat, lng) => {
              void reverseGeocode(lat, lng);
            }}
          />
        </MapContainer>
      </div>

      <div className={`rounded-2xl border px-4 py-3 text-sm ${minimal ? 'border-slate-200 bg-slate-50 text-slate-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
        {helperText}
      </div>
    </div>
  );
}
