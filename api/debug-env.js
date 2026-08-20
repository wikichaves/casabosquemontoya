export default function handler(req, res) {
  const k = process.env.RESEND_API_KEY;
  const f = process.env.RESEND_FROM;
  res.status(200).json({
    hasKey: !!k,
    keyLen: k ? k.length : 0,
    keyPrefix: k ? k.slice(0, 3) : null,
    hasFrom: !!f,
    fromLen: f ? f.length : 0,
    allResendKeys: Object.keys(process.env).filter(x => x.includes('RESEND')),
  });
}
