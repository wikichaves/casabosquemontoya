import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

// Exercise the real handler while replacing only the external email transport.
const source = readFileSync(new URL('../api/contacto.js', import.meta.url), 'utf8')
  .replace("import { Resend } from 'resend';", '')
  .replace('export default async function handler', 'async function handler');
const valid = { nombre: 'Visitante', email: 'visitor@example.com', motivo: 'alquiler', origen: 'inmobiliaria', mensaje: 'Consulta' };
async function invoke(body, { method = 'POST', configured = true, deliveryError = false } = {}) {
  const sent = [];
  const context = vm.createContext({
    process: { env: configured ? { RESEND_API_KEY: 'test-only' } : {} },
    console: { error() {} },
    Resend: class { batch = { send: async messages => { sent.push(...messages); return { error: deliveryError ? { message: 'test failure' } : null }; } }; },
  });
  new vm.Script(source).runInContext(context);
  const result = { headers: {}, sent };
  const res = { setHeader(k,v) { result.headers[k]=v; }, status(code) { result.status=code; return this; }, json(value) { result.body=value; return this; } };
  await context.handler({ method, body }, res);
  return result;
}
test('rejects methods other than POST', async () => { const r=await invoke(null,{method:'GET'}); assert.equal(r.status,405); assert.equal(r.headers.Allow,'POST'); assert.equal(r.sent.length,0); });
test('invalid JSON and non-object input return 400 without sending', async () => { for(const body of ['{', 'null', [], 42]) { const r=await invoke(body); assert.equal(r.status,400); assert.equal(r.sent.length,0); } });
test('invalid types, email, required data and oversized messages return 400', async () => {
  for(const body of [{...valid,nombre:{}},{...valid,mensaje:[]},{...valid,nombre:' '},{...valid,email:'broken'},{...valid,mensaje:'x'.repeat(5001)},{...valid,motivo:'unknown'}]) { const r=await invoke(body); assert.equal(r.status,400); assert.equal(r.sent.length,0); }
});
test('honeypot discards submissions without requiring email configuration', async () => { const r=await invoke({...valid,website:'spam'},{configured:false}); assert.equal(r.status,200); assert.equal(r.sent.length,0); });
test('all rental reasons reach the admin and confirmation emails', async () => { for(const motivo of ['alquiler','invernal','anual','info']) { const r=await invoke({...valid,motivo}); assert.equal(r.status,200); assert.equal(r.sent.length,2); assert.match(r.sent[0].html,/Inmobiliaria/); assert.equal(r.sent[0].replyTo,valid.email); assert.match(r.sent[1].subject,/Gracias/); } });
test('English visitors receive an English confirmation', async () => { const r=await invoke({...valid,locale:'en'}); assert.match(r.sent[1].subject,/Thank you/); assert.match(r.sent[1].html,/We received your message/); });
test('HTML is escaped and message newlines preserved', async () => { const r=await invoke({...valid,nombre:'<script>bad</script>',mensaje:'<b>text</b>\nNext'}); assert.equal(r.status,200); assert(!r.sent[0].html.includes('<script>')); assert.match(r.sent[0].html,/&lt;b&gt;text&lt;\/b&gt;<br>Next/); });
test('missing configuration and transport failures are reported', async () => { assert.equal((await invoke(valid,{configured:false})).status,500); assert.equal((await invoke(valid,{deliveryError:true})).status,502); });
