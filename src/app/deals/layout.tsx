import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My Deals — FreshHaul',
};

export default function DealsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
