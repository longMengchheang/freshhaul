import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Marketplace — FreshHaul',
};

export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  return children;
}
