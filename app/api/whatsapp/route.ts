import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';

const REPLY_TEXT = 'Hola, como andás? Que te gustaría saber?';

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

/**
 * Envía un mensaje de texto por WhatsApp via la API de Kapso.
 * No hace throw: cualquier error se loguea y se descarta para no romper el webhook.
 */
async function sendKapsoText(
  phoneNumberId: string,
  to: string,
  text: string,
): Promise<void> {
  const apiKey = process.env.KAPSO_API_KEY;
  if (!apiKey) {
    console.warn('[kapso reply] KAPSO_API_KEY not set — skipping send');
    return;
  }

  const url = `https://api.kapso.ai/meta/whatsapp/v24.0/${phoneNumberId}/messages`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text },
      }),
    });
    const responseText = await res.text();
    if (!res.ok) {
      console.error('[kapso reply] failed', { status: res.status, body: responseText });
      return;
    }
    console.log('[kapso reply] sent', { to, status: res.status });
  } catch (err) {
    console.error('[kapso reply] error', err);
  }
}

type KapsoMessageEvent = {
  message?: {
    from?: string;
    type?: string;
    kapso?: { direction?: string };
  };
  phone_number_id?: string;
};

type KapsoWebhookBody = {
  type?: string;
  data?: KapsoMessageEvent[];
};

export async function POST(req: NextRequest) {
  // Metadata que manda Kapso en cada webhook
  const meta = {
    event: req.headers.get('x-webhook-event'),
    signature: req.headers.get('x-webhook-signature'),
    idempotencyKey: req.headers.get('x-idempotency-key'),
    batch: req.headers.get('x-webhook-batch'),
    batchSize: req.headers.get('x-batch-size'),
  };

  // Body crudo: necesario para validar firma byte a byte.
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
    console.warn(
      '[kapso webhook] KAPSO_WEBHOOK_SECRET not set — skipping signature verification',
    );
  }

  // Parseamos body para loguear y rutear
  let body: KapsoWebhookBody | string;
  try {
    body = JSON.parse(rawBody) as KapsoWebhookBody;
  } catch {
    body = rawBody;
  }

  console.log('[kapso webhook]', JSON.stringify({ meta, body }, null, 2));

  // --- Auto-respuesta ---
  // Solo respondemos a textos inbound. Filtros redundantes (event header + direction)
  // para evitar auto-loops con nuestros propios mensajes salientes.
  if (
    meta.event === 'whatsapp.message.received' &&
    typeof body === 'object' &&
    Array.isArray(body.data)
  ) {
    const replies = body.data
      .filter(
        (evt) =>
          !!evt?.message?.from &&
          !!evt?.phone_number_id &&
          evt?.message?.type === 'text' &&
          evt?.message?.kapso?.direction === 'inbound',
      )
      .map((evt) =>
        sendKapsoText(evt.phone_number_id!, evt.message!.from!, REPLY_TEXT),
      );

    // allSettled: que un fallo no bloquee al resto del batch.
    await Promise.allSettled(replies);
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
