import { Resend } from 'resend';

const DESTINO = 'hola@casabosquemontoya.com';
const FROM = process.env.RESEND_FROM || 'Casa Bosque Montoya <hola@casabosquemontoya.com>';

function escapeHtml(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  } catch {
    return res.status(400).json({ ok: false, error: 'JSON inválido' });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ ok: false, error: 'Datos inválidos' });
  }
  const { nombre = '', email = '', motivo = '', mensaje = '', origen = '', website = '', locale = 'es' } = body;

  // Honeypot anti-spam: si viene relleno, fingimos éxito y descartamos.
  if (website) return res.status(200).json({ ok: true });

  if (![nombre, email, motivo, mensaje, origen].every(value => typeof value === 'string') ||
      nombre.length > 120 || email.length > 254 || mensaje.length > 5000 ||
      !['alquiler', 'invernal', 'anual', 'info'].includes(motivo) || origen.length > 40) {
    return res.status(400).json({ ok: false, error: 'Datos inválidos' });
  }

  if (!nombre.trim() || !email.trim()) {
    return res.status(400).json({ ok: false, error: 'Faltan datos' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.status(400).json({ ok: false, error: 'Email inválido' });
  }

  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error('RESEND_API_KEY no está definida en el entorno');
      return res.status(500).json({ ok: false, error: 'Config faltante' });
    }
    const resend = new Resend(apiKey);
    const english = locale === 'en';
    const motivoLabel =
      motivo === 'alquiler' ? 'Alquiler verano'
      : motivo === 'invernal' ? 'Alquiler invernal'
      : motivo === 'anual' ? 'Alquiler anual'
      : motivo === 'info' ? 'Saber más del proyecto'
      : (motivo || '—');

    const origenes = {
      instagram: 'Instagram', google: 'Google', recomendacion: 'Recomendación',
      pasando: 'Pasando por el lugar', inmobiliaria: 'Inmobiliaria', otro: 'Otro',
    };
    const origenLabel = Object.hasOwn(origenes, origen) ? origenes[origen] : 'No indicado';

    const nombreLimpio = nombre.trim();
    const emailLimpio = email.trim();
    const mensajeLimpio = mensaje.trim();
    const subject = `Nuevo contacto — ${motivoLabel} — ${nombreLimpio}`;
    const adminHtml = `
      <div style="font-family:system-ui,-apple-system,Arial,sans-serif;color:#1f4a57;line-height:1.5">
        <h2 style="margin:0 0 16px">Nuevo mensaje desde el sitio</h2>
        <p><strong>Nombre:</strong> ${escapeHtml(nombreLimpio)}</p>
        <p><strong>Email:</strong> ${escapeHtml(emailLimpio)}</p>
        <p><strong>Motivo:</strong> ${escapeHtml(motivoLabel)}</p>
        <p><strong>Cómo nos conoció:</strong> ${escapeHtml(origenLabel)}</p>
        <p><strong>Mensaje:</strong><br>${escapeHtml(mensajeLimpio).replace(/\n/g, '<br>') || '<em>(sin mensaje)</em>'}</p>
      </div>`;

    const confirmacionHtml = `
      <div style="font-family:system-ui,-apple-system,Arial,sans-serif;color:#1f4a57;line-height:1.6;max-width:560px">
        <h2 style="margin:0 0 16px">${english ? 'Thank you' : '¡Gracias'}, ${escapeHtml(nombreLimpio)}!</h2>
        <p>${english ? 'We received your message.' : 'Recibimos tu mensaje.'}</p>
        <p><strong>${english ? 'We’ll be in touch soon.' : 'Te escribimos pronto.'}</strong></p>
        <p style="margin-top:28px">Casa Bosque Montoya</p>
      </div>`;

    const { error } = await resend.batch.send([
      {
        from: FROM,
        to: [DESTINO],
        replyTo: emailLimpio,
        subject,
        html: adminHtml,
      },
      {
        from: FROM,
        to: [emailLimpio],
        replyTo: DESTINO,
        subject: english ? 'Thank you! We’ll be in touch soon' : '¡Gracias! Te escribimos pronto',
        html: confirmacionHtml,
      },
    ]);

    if (error) {
      console.error('Resend error:', error);
      return res.status(502).json({ ok: false, error: 'No se pudo enviar' });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('Handler error:', e);
    return res.status(500).json({ ok: false, error: 'Error interno' });
  }
}
