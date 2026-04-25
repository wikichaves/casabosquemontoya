import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * HMAC-SHA256 sobre el body crudo, usando el Secret del webhook de Kapso.
 * Comparación con timingSafeEqual para evitar timing attacks.
 */
function verifySignature(rawBody: string, signature: string, secret: string): boolean {
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  let a: Buffer;
  let b: Buffer;
  try {
    a = Buffer.from(expected, 'hex');
    b = Buffer.from(signature, 'hex');
  } catch {
    return false;
  }
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  // Metadata que manda Kapso en cada webhook
  const meta = {
    event: req.headers.get('x-webhook-event'),
    signature: req.headers.get('x-webhook-signature'),
    idempotencyKey: req.headers.get('x-idempotency-key'),
    batch: req.headers.get('x-webhook-batch'),
    batchSize: req.headers.get('x-batch-size'),
  };

  // Leemos el body como texto crudo: necesario para validar la firma byte a byte
  // (cualquier reformateo del JSON cambiaría el hash).
  const rawBody = await req.text();

  // --- Validación de firma ---
  const secret = process.env.KAPSO_WEBHOOK_SECRET;
  if (secret) {
    if (!meta.signature) {
      console.warn('[kapso webhook] missing X-Webhook-Signature header');
      return NextResponse.json({ error: 'missing signature' }, { status: 401 });
    }
    if (!verifySignature(rawBody, meta.signature, secret)) {
      console.warn('[kapso webhook] invalid signature', {
        idempotencyKey: meta.idempotencyKey,
      });
      return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
    }
  } else {
    // Sin secret configurado seguimos aceptando el request, pero avisamos en logs.
    console.warn(
      '[kapso webhook] KAPSO_WEBHOOK_SECRET not set — skipping signature verification',
    );
  }

  // Parseamos el body para loguear bonito
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    body = rawBody;
  }

  console.log('[kapso webhook]', JSON.stringify({ meta, body }, null, 2));

  return NextResponse.json({ ok: true }, { status: 200 });
}
