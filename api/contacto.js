import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const DESTINO = 'hola@casabosquemontoya.com';
// Cambiar a 'Casa Bosque Montoya <contacto@casabosquemontoya.com>' cuando el dominio esté verificado en Resend.
const FROM = process.env.RESEND_FROM || 'Casa Bosque Montoya <onboarding@resend.dev>';

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

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { nombre = '', email = '', motivo = '', mensaje = '', website = '' } = body;

    // Honeypot anti-spam: si viene relleno, fingimos éxito y descartamos.
    if (website) return res.status(200).json({ ok: true });

    if (!nombre.trim() || !email.trim()) {
      return res.status(400).json({ ok: false, error: 'Faltan datos' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ ok: false, error: 'Email inválido' });
    }

    const motivoLabel =
      motivo === 'alquiler' ? 'Alquiler verano'
      : motivo === 'info' ? 'Saber más del proyecto'
      : (motivo || '—');

    const subject = `Nuevo contacto — ${motivoLabel} — ${nombre.trim()}`;
    const html = `
      <div style="font-family:system-ui,-apple-system,Arial,sans-serif;color:#1f4a57;line-height:1.5">
        <h2 style="margin:0 0 16px">Nuevo mensaje desde el sitio</h2>
        <p><strong>Nombre:</strong> ${escapeHtml(nombre.trim())}</p>
        <p><strong>Email:</strong> ${escapeHtml(email.trim())}</p>
        <p><strong>Motivo:</strong> ${escapeHtml(motivoLabel)}</p>
        <p><strong>Mensaje:</strong><br>${escapeHtml(mensaje.trim()).replace(/\n/g, '<br>') || '<em>(sin mensaje)</em>'}</p>
      </div>`;

    const { error } = await resend.emails.send({
      from: FROM,
      to: [DESTINO],
      replyTo: email.trim(),
      subject,
      html,
    });

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
