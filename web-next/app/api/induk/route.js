/* Dompet induk dan operator mitra hanya ada di server (lihat docs/relayer-api.md).
   Pembungkus tipis di atas relayer/inti.js; perilakunya sama dengan relayer/http.js (Vercel function web Vite). */
import { tangani, info } from '../../../../relayer/inti.js';
import { ke, dari } from '../../../../relayer/serial.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAKS_BODY = 200_000;
const KEPALA = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  // Situs statis (mis. GitHub Pages) boleh memanggil relayer ini dari domain lain.
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
};
const balas = (status, isi) => new Response(ke(isi), { status, headers: KEPALA });

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: KEPALA });
}

export async function GET() {
  try {
    const h = await info();
    return balas(h.ok ? 200 : 400, h);
  } catch (e) {
    console.error('[relayer]', e);
    return balas(500, { ok: false, pesan: 'Galat di server relayer.', kode: 'Galat' });
  }
}

export async function POST(req) {
  try {
    let permintaan;
    try {
      const teks = await req.text();
      if (teks.length > MAKS_BODY) throw new Error('terlalu besar');
      permintaan = dari(teks);
    } catch {
      return balas(400, { ok: false, pesan: 'Isi permintaan bukan JSON yang valid.', kode: 'Permintaan' });
    }
    const h = await tangani(permintaan);
    return balas(h.ok ? 200 : 400, h);
  } catch (e) {
    console.error('[relayer]', e);
    return balas(500, { ok: false, pesan: 'Galat di server relayer.', kode: 'Galat' });
  }
}
