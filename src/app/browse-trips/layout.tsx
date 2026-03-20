import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Browse Trips — FreshHaul',
};

export default function BrowseTripsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
