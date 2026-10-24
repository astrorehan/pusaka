/* Pembungkus HTTP untuk Node (Vercel function dan middleware Vite dev): GET /api/induk → info(), POST → tangani().
   Bentuk (req, res) sama dengan http.IncomingMessage/ServerResponse, jadi tidak butuh framework. */
import { tangani, info } from './inti.js';
import { ke, dari } from './serial.js';

const MAKS_BODY = 200_000;

async function bacaBody(req) {
  // Vercel sudah mengurai body JSON ke req.body; server Node biasa belum.
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') return req.body;
    if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
    return JSON.stringify(req.body);
  }
  let teks = '';
  for await (const potong of req) {
    teks += potong;
    if (teks.length > MAKS_BODY) throw new Error('Permintaan terlalu besar.');
  }
  return teks;
}

export async function layani(req, res) {
  const kirim = (status, isi) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(ke(isi));
  };
  // Situs statis (mis. GitHub Pages) boleh memanggil relayer ini dari domain lain.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
  try {
    if (req.method === 'GET') {
      const h = await info();
      return kirim(h.ok ? 200 : 400, h);
    }
    if (req.method === 'POST') {
      let permintaan;
      try { permintaan = dari(await bacaBody(req)); } catch { return kirim(400, { ok: false, pesan: 'Isi permintaan bukan JSON yang valid.', kode: 'Permintaan' }); }
      const h = await tangani(permintaan);
      return kirim(h.ok ? 200 : 400, h);
    }
    res.setHeader('Allow', 'GET, POST, OPTIONS');
    return kirim(405, { ok: false, pesan: 'Metode tidak didukung.', kode: 'Permintaan' });
  } catch (e) {
    console.error('[relayer]', e);
    return kirim(500, { ok: false, pesan: 'Galat di server relayer.', kode: 'Galat' });
  }
}
