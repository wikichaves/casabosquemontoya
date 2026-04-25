import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  // Metadata que manda Kapso en cada webhook
  const meta = {
    event: req.headers.get('x-webhook-event'),
    signature: req.headers.get('x-webhook-signature'),
    idempotencyKey: req.headers.get('x-idempotency-key'),
    batch: req.headers.get('x-webhook-batch'),
    batchSize: req.headers.get('x-batch-size'),
  };

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    // fallback en caso de que no venga JSON
    body = await req.text();
  }

  console.log('[kapso webhook]', JSON.stringify({ meta, body }, null, 2));

  return NextResponse.json({ ok: true }, { status: 200 });
}
