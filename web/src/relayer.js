/* Klien relayer: semua yang dulu dikerjakan dompet induk dan operator di browser sekarang diminta ke /api/induk.
   Kontrak API: docs/relayer-api.md. bigint dikirim lewat serial.js ({"$b":"123"}). */
import { env } from './env.js';
import { ke, dari } from '../../relayer/serial.js';

const URL_RELAYER = (env.VITE_RELAYER_URL || '/api/induk').replace(/\/$/, '');

async function panggil(method, isi) {
  let r;
  try {
    r = await fetch(URL_RELAYER, { method, headers: isi ? { 'content-type': 'application/json' } : undefined, body: isi ? ke(isi) : undefined });
  } catch {
    throw Object.assign(new Error('Relayer tidak terjangkau. Periksa koneksi.'), { kode: 'RelayerMati' });
  }
  const teks = await r.text();
  let h = null;
  try { h = dari(teks); } catch { /* bukan JSON */ }
  if (!h || !h.ok) {
    throw Object.assign(new Error((h && h.pesan) || `Relayer tidak menjawab (${r.status}).`), { kode: (h && h.kode) || 'RelayerMati' });
  }
  return h;
}

const aksi = (nama) => (isi = {}) => panggil('POST', { aksi: nama, ...isi });
export const Relayer = {
  info: () => panggil('GET'),   // { induk, operator, saldoInduk }
  gas: aksi('gas'),             // { pewaris, amplop, tidr, hanyaPewaris } → { tx: [hash] }
  relay: aksi('relay'),         // { pewaris, fungsi, args, gas } → { tx, blok, detik, gas }
  faucet: aksi('faucet'),       // { pewaris } → { tx: [hash] }
  amplop: aksi('amplop'),       // { alamat } → { tx: [hash] }
  mitra: aksi('mitra'),         // {} → { tx: [hash], hasil, catatan }
};
