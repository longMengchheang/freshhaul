import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Post Shipment — FreshHaul',
};

export default function PostShipmentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
