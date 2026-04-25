import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    // fallback en caso de que kapso no mande JSON
    body = await req.text();
  }

  console.log('[kapso webhook]', JSON.stringify(body, null, 2));

  return NextResponse.json({ ok: true }, { status: 200 });
}
