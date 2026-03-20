import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';

export async function GET() {
  try {
    await db.select({ id: users.id }).from(users).limit(1);

    return NextResponse.json(
      {
        status: 'ok',
        database: 'ok',
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Health check failed';
    return NextResponse.json(
      {
        status: 'error',
        database: 'unreachable',
        message,
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}

