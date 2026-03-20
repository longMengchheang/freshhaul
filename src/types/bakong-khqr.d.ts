declare module 'bakong-khqr' {
  export const BakongKHQR: {
    new (): {
      generateIndividual(info: unknown): { data?: { qr: string } };
    };
    IndividualInfo: new (
      bakongAccountId: string,
      merchantName: string,
      merchantCity: string,
      optionalData: Record<string, unknown>,
    ) => unknown;
  };

  export const khqrData: {
    currency: { usd: string };
    language: { km: string };
  };
}
