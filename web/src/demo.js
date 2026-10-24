/* Pusaka · status demo dari kontrak asli.
   Pengganti assets/demo.js. Bentuk `window.Demo` sengaja dibuat sama (s, on, aksi, sisaSanggah, …)
   supaya semua layar bisa dipakai apa adanya, tetapi isinya dibaca dari getSummary() dan setiap aksi
   mengirim transaksi sungguhan.

   Ahli waris tidak perlu dompet (rekening bank lewat MitraCair, atau amplop digital), dan pewaris tidak perlu
   menekan tombol (aktivitas dompet dan kabar hidup bertanda tangan = bukti hidup; saksi juga cukup tanda tangan).

   Status: 0 belum dipasang · 1 aktif · 2 dipicu (masa sanggah) · 3 dibagikan.
   Sebab perubahan (dipakai layar untuk memilih animasi):
   pasang · cabut · saksi · dipicu · batal · hidup · aktivitas · kabar · lewati · dibagikan · pencairan · qr · gas ·
   ulang · sinkron */
import {
  parseEther, formatEther, BaseError, ContractFunctionRevertedError, encodeFunctionData, parseSignature,
  getAddress, isAddress, hashTypedData,
} from 'viem';
import { pusakaWalletAbi, mockIDRAbi, mitraCairAbi } from './abi.js';
import * as Passkey from './passkey.js';
import { env } from './env.js';
import { Relayer } from './relayer.js';
import {
  pub, dompet, chain, ALAMAT, LOKAL, EXPLORER, GAS_MON, GAS_AMPLOP, BLOK_MS, akun, pewarisBaru,
  alamatPenerima, benihSendiri, kunciAmplop, sidikRekening, garamRekening, idRekening, alamatVA, aturImplRekening,
} from './chain.js';

const RP300 = parseEther('300000000'); // Rp300 jt tIDR (18 desimal)
/* Dompet induk dan operator mitra ada di server (relayer/); kuncinya tidak pernah sampai ke browser. Di sini hanya
   alamatnya, dari GET /api/induk: { address }, atau null bila relayer tidak terjangkau (layar lalu memakai jalur tanpa
   relayer: saksi dan pewaris membayar gasnya sendiri). */
let induk = null, operator = null;
async function muatInfo() {
  try {
    const h = await Relayer.info();
    induk = { address: h.induk };
    operator = h.operator ? { address: h.operator } : null;
  } catch (e) {
    induk = null; operator = null;
    console.warn('Relayer belum tersambung', e.message);
  }
}
const AKTA_CONTOH = '0x9f2c41d07be3a95c2e1f8806d4b7a3c150e9f2ab64d18c37e5b2a0f91c6d4ab1';
/* Batas gas eksplisit. Di Monad biaya dihitung dari batas gas, bukan gas terpakai, jadi batasnya dibuat dekat dengan
   pemakaian terukur di anvil mode Monad (`anvil --network monad`, GAS_LOG=1 node scripts/e2e.mjs) ditambah ±40%.
   Kabar sidik jari: ±77 rb gas dengan precompile P-256 (Monad); tanpa precompile (anvil biasa) ±365 rb. */
const GAS = {
  pasang: 1_000_000n, perRekening: 160_000n, cabut: 300_000n, saksi: 150_000n, saksiLangsung: 140_000n, hidup: 90_000n,
  kabar: 80_000n, bayar: 180_000n, picu: 120_000n, bagikan: 600_000n, sapuPer: 220_000n, selesaikanPer: 70_000n,
  cairkan: 560_000n, operator: 80_000n, faucet: 120_000n, sidikDaftar: 150_000n, sidikKabar: LOKAL ? 450_000n : 200_000n,
};

const q = new URLSearchParams(location.search);
const diam = q.has('diam') || matchMedia('(prefers-reduced-motion: reduce)').matches;
if (q.has('diam')) document.documentElement.classList.add('diam');

/* Alamat yang dipantau: ?p=0x… (HP penonton, perangkat lain) atau pewaris dari kunci di browser ini. */
const pDariUrl = /^0x[0-9a-fA-F]{40}$/.test(q.get('p') || '') ? getAddress(q.get('p')) : null;
let P = pDariUrl || akun.pewaris.address;
const milikSendiri = () => P.toLowerCase() === akun.pewaris.address.toLowerCase();

/* Benih amplop: milik sendiri (laptop presenter), dari #s= di tautan QR, atau yang pernah disimpan untuk pewaris ini. */
const kunciBenih = () => `pusaka-benih:${P.toLowerCase()}`;
function bacaBenih() {
  if (milikSendiri()) return benihSendiri();
  const frag = new URLSearchParams(location.hash.slice(1));
  const dariUrl = frag.get('s');
  if (/^0x[0-9a-fA-F]{64}$/.test(dariUrl || '')) { try { localStorage.setItem(kunciBenih(), dariUrl); } catch {} return dariUrl; }
  try { return localStorage.getItem(kunciBenih()); } catch { return null; }
}
let benih = bacaBenih();

const pendek = (h) => (h ? h.slice(0, 6) + '…' + h.slice(-4) : '');
const hash = (str) => {
  let h1 = 0x811c9dc5, out = '0x';
  for (let r = 0; r < 4; r++) {
    for (let i = 0; i < str.length; i++) { h1 ^= str.charCodeAt(i) + r; h1 = Math.imul(h1, 16777619) >>> 0; }
    out += h1.toString(16).padStart(8, '0');
  }
  return out;
};
const juta = (wei) => Number(BigInt(wei) / 10n ** 12n) / 1e12; // tIDR 18 desimal → juta rupiah

/* ---------- jam kontrak ----------
   Waktu di kontrak (detik) diubah ke jam perangkat (ms). Selisihnya diambil dari waktu blok terbaru;
   waktu blok selalu sedikit di belakang jam asli, jadi dipakai nilai terbesar dari beberapa sampel terakhir. */
const sampel = [];
let selisih = 0;
function catatSelisih(ts) {
  sampel.push(Number(ts) * 1000 - Date.now());
  if (sampel.length > 12) sampel.shift();
  selisih = Math.max(...sampel) + 500;
}
const keJamPerangkat = (t) => (t ? Number(t) * 1000 - selisih : null);
const sekarangKontrak = () => Math.floor((Date.now() + selisih) / 1000);

/* Nomor blok untuk denyut jaringan, diperkirakan di antara dua bacaan. */
let jangkar = { n: 0, t: Date.now() };
let blokDibagikan = null;

/* ---------- penerima ----------
   Tujuh penerima keluarga contoh. `key` dipakai untuk menurunkan kunci amplop dan urutan di setup(). */
const KEY_PENERIMA = { istri: 'pasangan-0', masjid: 'wasiat-0', putra1: 'putra-0', putra2: 'putra-1', putri: 'putri-0', ayah: 'ayah-0', ibu: 'ibu-0' };
const ID_PENERIMA = Object.keys(KEY_PENERIMA);
/* Cara terima: 'bank' (rekening bank/e-wallet lewat mitra pencairan, ahli waris tidak melakukan apa pun),
   'amplop' (tautan WhatsApp, dibuka setelah warisan dibagikan), 'kripto' (dompet kripto milik ahli waris). */
const TERIMA_AWAL = () => ({
  'pasangan-0': { cara: 'bank', bank: 'BSI', nomor: '7140022291', nama: 'Siti Aminah' },
  'wasiat-0': { cara: 'bank', bank: 'BSI', nomor: '7150000412', nama: 'Masjid Al-Ikhlas' },
  'putra-0': { cara: 'amplop', wa: '0812-3456-8812', nama: 'Andi Santoso' },
  'putra-1': { cara: 'kripto', alamat: '', nama: 'Bima Santoso' },
  'putri-0': { cara: 'amplop', wa: '0813-2211-0456', nama: 'Citra Santoso' },
  'ayah-0': { cara: 'bank', bank: 'BRI', nomor: '012301007781', nama: 'Harjo Santoso' },
  'ibu-0': { cara: 'bank', bank: 'BPD DIY', nomor: '001221003310', nama: 'Sri Lestari' },
});
/* Bank dan e-wallet untuk pencairan amplop. Di dunia nyata daftar ini dari mitra (BI-FAST + e-wallet). */
const BANK = ['BCA', 'BRI', 'BNI', 'Mandiri', 'BSI', 'BPD DIY', 'CIMB Niaga', 'Muamalat', 'GoPay', 'OVO', 'DANA', 'ShopeePay'];
const EWALLET = new Set(['GoPay', 'OVO', 'DANA', 'ShopeePay']);
const akhiranDari = (nomor) => String(nomor || '').replace(/\D/g, '').slice(-4);

/* ---------- status ---------- */
const awal = () => ({
  v: 4, status: 0, alasan: null, attest: [null, null, null], bukti: [null, null, null],
  triggeredAt: null, sanggah: 20, batas: 31536000, ambang: 2,
  setupAt: null, lastBeat: Date.now(), lastVia: 0, round: 0, distributedAt: null, qr: false, rev: 1,
  gas: { pewaris: 0, saksi: [0, 0, 0], induk: 0, operator: 0 }, tidr: 0, log: [],
  penerima: Object.fromEntries(ID_PENERIMA.map((id) => [id, { id, key: KEY_PENERIMA[id], cara: TERIMA_AWAL()[KEY_PENERIMA[id]].cara, alamat: null, bank: '', akhiran: '', saldo: 0, cair: null }])),
});
let s = awal();
let mentah = null;           // ringkasan terakhir dari kontrak, untuk mendeteksi perubahan
const subs = new Set();
const emit = (prev, sebab) => subs.forEach((f) => { try { f(s, prev, sebab); } catch (e) { console.error(e); } });

/* Waktu konfirmasi saksi tidak disimpan kontrak, jadi dicatat saat pertama terlihat (atau saat receipt). */
const WAKTU_KEY = 'pusaka-waktu-v2';
let waktu = {};
try { waktu = JSON.parse(localStorage.getItem(WAKTU_KEY)) || {}; } catch {}
const simpanWaktu = () => { try { localStorage.setItem(WAKTU_KEY, JSON.stringify(waktu)); } catch {} };
const tandai = (k, t = Date.now()) => { if (!waktu[k]) { waktu[k] = t; simpanWaktu(); } return waktu[k]; };

/* Hash transaksi terakhir per jenis aksi, dibagikan antartab supaya lini waktu Panggung bisa menampilkannya. */
const txTerakhir = {};
const finalTerakhir = {}; // { tx, blok, detik } per jenis aksi, untuk "Final di blok … dalam … detik"
const bc = 'BroadcastChannel' in window ? new BroadcastChannel('pusaka-web') : null;
bc && (bc.onmessage = (e) => {
  const m = e.data || {};
  if (m.jenis === 'tx') txTerakhir[m.sebab] = m.tx;
  if (m.jenis === 'final') finalTerakhir[m.sebab] = m.hasil;
  if (m.jenis === 'qr') { const prev = s; s = { ...s, qr: m.on, rev: s.rev + 1 }; emit(prev, 'qr'); }
  if (m.jenis === 'ulang') { if (!pDariUrl) gantiPewaris(m.alamat, false); }
  if (m.jenis === 'segarkan') tarik();
  if (m.jenis === 'aturan') { alamatTerpasang = null; perbaruiAlamat(); }
});
const umumkanTx = (sebab, tx) => { txTerakhir[sebab] = tx; bc && bc.postMessage({ jenis: 'tx', sebab, tx }); };

function catatLog(teks, tx = '') {
  s.log = [...s.log, ...[].concat(teks).map((t, i) => ({ t: Date.now() + i, teks: t, tx }))].slice(-30);
}

/* ---------- aturan (isi formulir Pewaris) ---------- */
const ATURAN_KEY = 'pusaka-aturan-v2';
const AWAL_ATURAN = () => ({
  laki: true, istri: 1, suami: false, putra: 2, putri: 1, ayah: true, ibu: true, saudara: 0, kerabatLain: false,
  bersama: 'seluruh', ambang: 2, batas: 31536000, sanggah: 20,
  wasiat: [{ label: 'Wakaf masjid', bagian: '1/5' }],
  saksi: [{ nama: 'Rina Santoso', peran: 'Adik' }, { nama: 'Yusuf Pratama', peran: 'Sahabat' }, { nama: 'Ustaz Hamid', peran: 'Guru ngaji' }],
  terima: TERIMA_AWAL(),
});
function bacaAturan() {
  let f;
  try { f = JSON.parse(localStorage.getItem(ATURAN_KEY)); } catch { f = null; }
  f = f || AWAL_ATURAN();
  if (!f.terima) f.terima = TERIMA_AWAL();
  return f;
}
function simpanAturan(f) {
  try { localStorage.setItem(ATURAN_KEY, JSON.stringify(f)); } catch {}
  alamatTerpasang = null;
  perbaruiAlamat();
  bc && bc.postMessage({ jenis: 'aturan' });
}
/* Cara terima satu penerima dari aturan, dengan bawaan amplop untuk penerima di luar keluarga contoh. */
const terimaDari = (f, key) => ({ ...(TERIMA_AWAL()[key] || { cara: 'amplop' }), ...((f.terima || {})[key] || {}) });

/* Alamat tujuan satu penerima menurut cara terimanya. Rekening bank → rekening virtual mitra (id terikat pada dompet
   pewaris yang mendaftarkannya). Amplop → alamat kunci amplop. Kripto → alamat yang diisi, atau kunci amplop. */
function alamatTujuan(pewaris, key, t) {
  if (t.cara === 'bank') return alamatVA(idRekening(pewaris, sidikRekening(t, garamRekening(pewaris))));
  if (t.cara === 'kripto' && isAddress(t.alamat || '')) return getAddress(t.alamat);
  return benih ? kunciAmplop(benih, key).address : alamatPenerima(pewaris, key);
}

/* Isi formulir Pewaris → argumen setup() + rekening yang perlu didaftarkan.
   Urutan ahli waris: pasangan, anak laki-laki, anak perempuan, ayah, ibu. */
function argsSetup(f, pewaris) {
  const heirs = [], rekening = [];
  const catatRek = (key, t) => {
    if (t.cara !== 'bank') return;
    rekening.push({ sidik: sidikRekening(t, garamRekening(pewaris)), bank: t.bank, akhiran: akhiranDari(t.nomor), cadangan: kunciAmplop(benih, key).address });
  };
  const tambah = (key, relation) => { const t = terimaDari(f, key); heirs.push({ wallet: alamatTujuan(pewaris, key, t), relation }); catatRek(key, t); };
  if (f.laki) for (let i = 0; i < f.istri; i++) tambah(`pasangan-${i}`, 1);
  else if (f.suami) tambah('pasangan-0', 0);
  for (let i = 0; i < f.putra; i++) tambah(`putra-${i}`, 2);
  for (let i = 0; i < f.putri; i++) tambah(`putri-${i}`, 3);
  if (f.ayah) tambah('ayah-0', 4);
  if (f.ibu) tambah('ibu-0', 5);
  const nPas = f.laki ? f.istri : f.suami ? 1 : 0;
  const bersama = nPas === 1 ? { seluruh: [1n, 1n], separuh: [1n, 2n] }[f.bersama] || [0n, 1n] : [0n, 1n];
  const bequests = f.wasiat.map((w, i) => {
    const [num, den] = w.bagian.split('/').map(BigInt);
    const key = `wasiat-${i}`, t = terimaDari(f, key);
    catatRek(key, t);
    return { to: alamatTujuan(pewaris, key, t), share: { num, den } };
  });
  const cfg = {
    deceasedMale: !!f.laki, siblings: f.saudara || 0, otherRelatives: !!f.kerabatLain, raddToSpouse: false,
    inactivityPeriod: f.batas, challengePeriod: f.sanggah, witnessThreshold: f.ambang,
    jointProperty: { num: bersama[0], den: bersama[1] },
  };
  return { setup: [[ALAMAT.token], heirs, akun.saksi.map((a) => a.address), bequests, cfg], rekening };
}

/* ---------- membaca kontrak ---------- */
const baca = (functionName, args) => pub.readContract({ address: P, abi: pusakaWalletAbi, functionName, args });
const bacaMitra = (functionName, args) => pub.readContract({ address: ALAMAT.mitra, abi: mitraCairAbi, functionName, args });
const saldoToken = (a) => pub.readContract({ address: ALAMAT.token, abi: mockIDRAbi, functionName: 'balanceOf', args: [a] });
const mon = (wei) => Number(formatEther(wei));

/* Alamat penerima yang terpasang di kontrak (urutan setup), dibaca sekali per pewaris. */
let alamatTerpasang = null;
async function bacaAlamatTerpasang() {
  const [heirs, bequests] = await Promise.all([baca('getHeirs'), baca('getBequests')]);
  const rel = heirs.map((h) => Number(h.relation)).join();
  if (rel !== '1,2,2,3,4,5' || bequests.length !== 1) return null; // bukan keluarga contoh
  return { istri: heirs[0].wallet, putra1: heirs[1].wallet, putra2: heirs[2].wallet, putri: heirs[3].wallet, ayah: heirs[4].wallet, ibu: heirs[5].wallet, masjid: bequests[0].to };
}

let kodeAda = false, putaran = 0, sedangTarik = false, gagalBerturut = 0, labelBankDibaca = false;
let labelPernah = false; // data mitra pernah terbaca untuk pewaris ini (caraTerima memakai data kontrak)
async function tarik() {
  if (sedangTarik) return;
  sedangTarik = true;
  try {
    // Di perangkat lain, jam blok cukup dibaca tiap 4 putaran (hemat RPC); di antaranya diperkirakan dari jam perangkat.
    const perluBlok = milikSendiri() || !mentah || putaran % 4 === 0;
    const [blk, kode] = await Promise.all([perluBlok ? pub.getBlock() : Promise.resolve(null), kodeAda ? Promise.resolve('0x1') : pub.getCode({ address: P })]);
    if (blk) { catatSelisih(blk.timestamp); jangkar = { n: Number(blk.number), t: Date.now() }; }
    kodeAda = !!kode && kode !== '0x';

    let sum = null, wit = null;
    if (kodeAda) {
      sum = await baca('getSummary');
      // Daftar saksi hanya dibaca saat jumlah konfirmasi, putaran, atau status berubah (hemat panggilan RPC).
      const berubah = !mentah || Number(sum.attestations) !== mentah.att || Number(sum.round) !== s.round
        || Number(sum.status) !== mentah.status || putaran % 8 === 0;
      if (sum.status > 0 && berubah) wit = await baca('getWitnesses');
      // null = belum dibaca · false = bukan keluarga contoh (tidak dibaca ulang)
      if (sum.status > 0 && alamatTerpasang === null) alamatTerpasang = (await bacaAlamatTerpasang()) || false;
    }
    if (!induk && putaran % 10 === 5) muatInfo(); // relayer sempat tidak terjangkau: coba lagi
    const ambilGas = milikSendiri() && (putaran % 3 === 0 || !mentah);
    putaran++;
    const st = sum ? Number(sum.status) : 0;
    // Status pencairan: label bank sekali; saldo dan pencairan setelah dibagikan (dan selama ada yang diproses).
    const alamatP = ID_PENERIMA.map((id) => s.penerima[id].alamat).filter(Boolean);
    const perluMitra = alamatP.length === ID_PENERIMA.length && (st === 3 || !labelBankDibaca);
    const [tidr, statusMitra, ...gas] = await Promise.all([
      sum ? Promise.resolve(sum.balance) : saldoToken(P),
      perluMitra ? bacaMitra('statusBanyak', [alamatP]) : Promise.resolve(null),
      ...(ambilGas ? [akun.pewaris.address, ...akun.saksi.map((a) => a.address), induk?.address, operator?.address]
        .map((address) => (address ? pub.getBalance({ address }) : Promise.resolve(0n))) : []),
    ]);
    if (statusMitra) { labelBankDibaca = true; labelPernah = true; }
    terapkan(sum, wit, tidr, ambilGas ? gas : null, statusMitra);
    gagalBerturut = 0;
    peringatan(null);
  } catch (e) {
    if (++gagalBerturut === 3) peringatan('Tidak tersambung ke blockchain. Mencoba lagi…');
    if (gagalBerturut === 1) console.warn('Gagal membaca kontrak', e);
  } finally {
    sedangTarik = false;
  }
}

const TAHAP = ['tidak', 'diproses', 'selesai', 'dikembalikan'];
function terapkanMitra(n, statusMitra) {
  if (!statusMitra) return;
  ID_PENERIMA.forEach((id, i) => {
    const x = statusMitra[i], p = { ...n.penerima[id] };
    if (x.rekening !== '0x' + '0'.repeat(64)) { p.cara = 'bank'; p.bank = x.bank; p.akhiran = x.akhiran; p.rekening = x.rekening; }
    else { p.bank = ''; p.akhiran = ''; p.rekening = null; }
    p.saldo = juta(x.saldo);
    p.cair = x.adaPencairan ? {
      no: Number(x.no), tahap: TAHAP[Number(x.pencairan.tahap)], jumlah: juta(x.pencairan.jumlah),
      bank: x.bankTujuan, akhiran: x.akhiranTujuan, bukti: x.pencairan.bukti,
      diminta: keJamPerangkat(x.pencairan.diminta), selesai: x.pencairan.selesai ? keJamPerangkat(x.pencairan.selesai) : null,
    } : null;
    n.penerima[id] = p;
  });
}
const sidikPenerima = (pen) => ID_PENERIMA.map((id) => { const p = pen[id]; return `${p.alamat}:${p.saldo}:${p.cair ? p.cair.tahap + p.cair.no : '-'}`; }).join('|');

function terapkan(sum, wit, tidr, gas, statusMitra) {
  const prev = s;
  const n = { ...s, attest: s.attest.slice(), bukti: s.bukti.slice(), gas: { ...s.gas, saksi: s.gas.saksi.slice() }, penerima: { ...s.penerima } };
  n.tidr = juta(tidr);
  if (gas) {
    n.gas = { pewaris: mon(gas[0]), saksi: [mon(gas[1]), mon(gas[2]), mon(gas[3])], induk: mon(gas[4] || 0n), operator: mon(gas[5] || 0n) };
  }
  if (alamatTerpasang) ID_PENERIMA.forEach((id) => { n.penerima[id] = { ...n.penerima[id], alamat: alamatTerpasang[id] }; });
  terapkanMitra(n, statusMitra);
  const st = sum ? Number(sum.status) : 0;
  const baru = {
    status: st,
    att: sum ? Number(sum.attestations) : 0,
    hb: sum ? Number(sum.lastHeartbeat) : 0,
    via: sum ? Number(sum.lastProofVia) : 0,
    trig: sum ? Number(sum.triggeredAt) : 0,
    selisih,
    pen: sidikPenerima(n.penerima),
  };
  if (st === 0) {
    Object.assign(n, { status: 0, alasan: null, attest: [null, null, null], bukti: [null, null, null], triggeredAt: null, distributedAt: null, setupAt: null, lastVia: 0 });
  } else {
    n.status = st;
    n.alasan = Number(sum.triggerReason) === 1 ? 'saksi' : Number(sum.triggerReason) === 2 ? 'tidak aktif' : null;
    n.sanggah = Number(sum.config.challengePeriod);
    n.batas = Number(sum.config.inactivityPeriod);
    n.ambang = Number(sum.config.witnessThreshold);
    n.lastBeat = keJamPerangkat(sum.lastHeartbeat);
    n.lastVia = baru.via;
    n.round = Number(sum.round);
    n.triggeredAt = st >= 2 ? keJamPerangkat(sum.triggeredAt) : null;
    n.distributedAt = st === 3 ? keJamPerangkat(sum.distributedAt) : null;
    n.setupAt = waktu[`${P}:setup`] || null;
    if (wit) {
      const [alamat, sudah] = wit;
      const urutan = alamat.map((a, i) => {
        const j = akun.saksi.findIndex((x) => x.address.toLowerCase() === a.toLowerCase());
        return j >= 0 ? j : i;
      });
      n.attest = [null, null, null];
      n.bukti = [null, null, null];
      urutan.forEach((j, i) => {
        if (j > 2 || !sudah[i]) return;
        n.attest[j] = tandai(`${P}:${n.round}:${alamat[i]}`);
        n.bukti[j] = waktu[`${P}:${n.round}:${alamat[i]}:bukti`] || AKTA_CONTOH;
      });
    }
  }
  if (st === 3 && !blokDibagikan) cariBlokDibagikan();

  const sebab = sebabDari(mentah, baru, prev, n);
  mentah = baru;
  if (!sebab) { s.tidr = n.tidr; s.lastBeat = n.lastBeat; s.triggeredAt = n.triggeredAt; s.distributedAt = n.distributedAt; s.penerima = n.penerima; return; }
  s = { ...n, rev: s.rev + 1 };
  logUntuk(sebab, prev);
  emit(prev, sebab);
  if (sebab === 'sinkron' || sebab === 'pasang' || sebab === 'cabut') cekSidik().catch(() => {});
}

function sebabDari(a, b, prev, n) {
  if (!a) return 'sinkron';
  if (a.status === 0 && b.status === 1) return 'pasang';
  if (a.status === 1 && b.status === 0) return 'cabut';
  if (b.status === 3 && a.status !== 3) return 'dibagikan';
  if (a.status === 1 && b.status === 2) return 'dipicu';
  if (a.status === 2 && b.status === 1) return 'batal';
  if (a.status !== b.status) return 'sinkron';
  if (b.status === 1 && b.att > a.att) return 'saksi';
  if (b.status === 1 && (b.hb !== a.hb || b.via !== a.via || n.round !== prev.round)) return b.via === 3 ? 'aktivitas' : b.via === 2 || b.via === 4 ? 'kabar' : 'hidup';
  if (b.pen !== a.pen) return 'pencairan';
  if (b.selisih - a.selisih > 2500) return 'lewati';
  const g = (x) => [x.pewaris, ...x.saksi, x.induk, x.operator].map((v) => (v || 0).toFixed(4)).join();
  if (g(prev.gas) !== g(n.gas) || prev.tidr !== n.tidr) return 'gas';
  return null;
}

const NAMA_PERAN = { istri: 'Istri', masjid: 'Masjid', putra1: 'Putra pertama', putra2: 'Putra kedua', putri: 'Putri', ayah: 'Ayah', ibu: 'Ibu' };
const VIA_TEKS = { 0: 'pemasangan aturan', 1: 'tombol "Saya masih hidup"', 2: 'kabar hidup bertanda tangan', 3: 'transaksi dari dompetnya', 4: 'sidik jari (passkey)' };
function logUntuk(sebab, prev) {
  const nama = (i) => Pusaka.saksi[i]?.nama || `Saksi ${i + 1}`;
  const pw = Pusaka.pewaris.nama;
  const tx = txTerakhir[sebab] || '';
  if (sebab === 'pasang') catatLog(`Aturan warisan dipasang di dompet ${pw}`, tx);
  if (sebab === 'cabut') catatLog(`Aturan warisan dicabut dari dompet ${pw}`, tx);
  if (sebab === 'saksi' || sebab === 'dipicu') {
    const baru = s.attest.map((t, i) => (t && !prev.attest[i] ? i : -1)).filter((i) => i >= 0);
    baru.forEach((i) => catatLog(`${nama(i)} menandatangani konfirmasi wafat`, txTerakhir['saksi' + i] || tx));
  }
  if (sebab === 'dipicu') catatLog(s.alasan === 'tidak aktif' ? 'Pewaris tidak aktif melewati batas. Masa sanggah dimulai' : 'Dua dari tiga saksi. Masa sanggah dimulai', tx);
  if (sebab === 'batal') catatLog(`${pw} masih hidup (${VIA_TEKS[s.lastVia] || 'bukti hidup'}). Pemicu dibatalkan`, txTerakhir.batal || tx);
  if (sebab === 'hidup') catatLog(`${pw} menekan "Saya masih hidup"`, tx);
  if (sebab === 'aktivitas') catatLog(`${pw} bertransaksi dari dompetnya. Tercatat sebagai bukti hidup`, txTerakhir.aktivitas || tx);
  if (sebab === 'kabar') catatLog(s.lastVia === 4 ? `${pw} menyentuh sidik jari: kabar hidup tercatat. Biaya untuknya Rp0` : `${pw} menandatangani kabar hidup. Biaya untuknya Rp0`, txTerakhir.kabar || tx);
  if (sebab === 'dibagikan') catatLog('Warisan dibagikan dalam satu transaksi', tx);
  if (sebab === 'pencairan') {
    ID_PENERIMA.forEach((id) => {
      const a = prev.penerima[id]?.cair, b = s.penerima[id]?.cair;
      if (b && b.tahap === 'selesai' && (!a || a.tahap !== 'selesai' || a.no !== b.no)) {
        catatLog(`${NAMA_PERAN[id]}: Rp${b.jumlah.toLocaleString('id-ID')} jt masuk ${b.bank} ••••${b.akhiran}`, txTerakhir.mitra || '');
      }
    });
  }
}

/* Blok tempat warisan dibagikan, dari event Distributed. Dipakai "Final di blok …". */
async function cariBlokDibagikan() {
  try {
    const sampai = await pub.getBlockNumber();
    const ev = await pub.getContractEvents({
      address: P, abi: pusakaWalletAbi, eventName: 'Distributed',
      fromBlock: sampai > 90n ? sampai - 90n : 0n, toBlock: sampai,
    });
    if (ev.length) blokDibagikan = Number(ev[ev.length - 1].blockNumber);
  } catch {}
}

function blok(t = Date.now()) {
  if (blokDibagikan && s.distributedAt && Math.abs(t - s.distributedAt) < 1500) return blokDibagikan;
  return Math.max(0, jangkar.n + Math.floor((t - jangkar.t) / BLOK_MS));
}

const jumlahSaksi = () => s.attest.filter(Boolean).length;
const sisaSanggah = (t = Date.now()) => (s.status === 2 ? Math.max(0, (s.triggeredAt + s.sanggah * 1000 - t) / 1000) : null);
const sisaBatas = (t = Date.now()) => (s.status === 1 ? Math.max(0, (s.lastBeat + s.batas * 1000 - t) / 1000) : null);

/* ---------- menulis ke kontrak ---------- */
const antrean = new Map(); // satu akun di browser ini hanya mengirim satu transaksi dalam satu waktu
function antre(a, kerja) {
  const sebelum = antrean.get(a.address) || Promise.resolve();
  const p = sebelum.catch(() => {}).then(kerja);
  antrean.set(a.address, p);
  return p;
}

/* Nama error dari revert, mis. WrongStatus, TooEarly. */
function namaError(e) {
  const r = e instanceof BaseError && e.walk((x) => x instanceof ContractFunctionRevertedError);
  if (r instanceof ContractFunctionRevertedError) return r.data?.errorName || r.reason || 'revert';
  return null;
}
const PESAN_ERROR = {
  WrongStatus: 'Status warisan sudah berubah. Layar akan menyesuaikan.',
  TooEarly: 'Belum waktunya.',
  ChallengeOver: 'Masa sanggah sudah habis.',
  AlreadyAttested: 'Saksi ini sudah mengonfirmasi.',
  NotWitness: 'Dompet ini bukan saksi.',
  NotOwner: 'Hanya pewaris yang boleh melakukan ini.',
  BadSignature: 'Tanda tangan tidak cocok.',
  StaleCheckIn: 'Kabar hidup ini sudah tercatat.',
  CheckInFromFuture: 'Jam perangkat terlalu jauh di depan.',
  BukanOperator: 'Kunci ini bukan operator mitra pencairan.',
  SudahTuntas: 'Pencairan ini sudah diproses.',
  JumlahNol: 'Tidak ada saldo untuk dicairkan.',
};
function pesanDari(e) {
  const nama = namaError(e);
  if (nama) return PESAN_ERROR[nama] || `Ditolak kontrak: ${nama}`;
  if (e && e.kode && PESAN_ERROR[e.kode]) return PESAN_ERROR[e.kode]; // galat dari relayer membawa nama revert di `kode`
  const m = (e && (e.shortMessage || e.message)) || String(e);
  // e.message viem memuat baris "Details:" dari node, mis. "Signer had insufficient balance" di Monad.
  if (/insufficient funds|insufficient balance|exceeds the balance/i.test(`${m} ${e?.message || ''}`)) return 'Gas di dompet demo tidak cukup. Bagikan gas dulu.';
  return m.split('\n')[0];
}
/* Kirim satu panggilan kontrak dari kunci di browser ini (pewaris atau amplop): simulasi dulu (agar penolakan terbaca
   jelas dan tidak membuang gas), lalu kirim dengan batas gas eksplisit. Di Monad biaya dihitung dari batas gas, bukan
   gas terpakai. Jika nonce bentrok dengan tab lain yang memakai akun yang sama, dicoba ulang dengan nonce baru. */
const nonceBentrok = (e) => /nonce|already known|replacement transaction|underpriced/i.test((e && (e.shortMessage || e.message)) || '');
async function kirim(a, req, sebab) {
  return antre(a, async () => {
    const t0 = performance.now();
    if (!req.authorizationList) await pub.simulateContract({ account: a, ...req });
    let tx;
    for (let coba = 0; ; coba++) {
      try { tx = await dompet(a).writeContract(req); break; } catch (e) {
        if (coba >= 2 || !nonceBentrok(e)) throw e;
        await new Promise((r) => setTimeout(r, 350 + coba * 300));
      }
    }
    umumkanTx(sebab, tx);
    const r = await pub.waitForTransactionReceipt({ hash: tx });
    if (r.status !== 'success') throw new Error('Transaksi gagal dijalankan di blockchain.');
    return selesai(sebab, { tx, blok: Number(r.blockNumber), detik: (performance.now() - t0) / 1000, gas: Number(r.gasUsed) });
  });
}
/* Transaksi yang dikirim relayer (server) atas nama pewaris, saksi, atau siapa pun: kabar hidup, konfirmasi saksi,
   pemicu tidak aktif, pembagian. Browser tidak memegang kunci pengirimnya, jadi cukup meminta /api/induk. */
async function relay(sebab, fungsi, args, gas) {
  const h = await Relayer.relay({ pewaris: P, fungsi, args, gas });
  umumkanTx(sebab, h.tx);
  return selesai(sebab, { tx: h.tx, blok: h.blok, detik: h.detik, gas: h.gas });
}
/* Struk dan "Final di blok …" untuk transaksi yang baru selesai. */
function selesai(sebab, hasil) {
  finalTerakhir[sebab] = hasil;
  bc && bc.postMessage({ jenis: 'final', sebab, hasil });
  try { struk(sebab, hasil); } catch (e) { console.warn('struk', e); }
  return hasil;
}
async function jalankan(nama, kerja) {
  try {
    const hasil = await kerja();
    await tarik();
    bc && bc.postMessage({ jenis: 'segarkan' });
    return hasil;
  } catch (e) {
    console.error(nama, e);
    pesanTerakhir = pesanDari(e);
    toast(pesanTerakhir);
    await tarik();
    return null;
  }
}
let pesanTerakhir = '';
const hanyaBaca = () => { toast('Layar ini hanya memantau. Aksi pewaris ada di browser yang memegang kunci pewaris.'); return null; };

/* Domain EIP-712 kontrak Pusaka di dompet pewaris, untuk kabar hidup dan konfirmasi saksi. */
const domainPusaka = () => ({ name: 'Pusaka', version: '1', chainId: chain.id, verifyingContract: P });
const TIPE_KABAR = { KabarHidup: [{ name: 'pesan', type: 'string' }, { name: 'waktu', type: 'uint64' }] };
const TIPE_KONFIRMASI = { KonfirmasiWafat: [{ name: 'saksi', type: 'address' }, { name: 'bukti', type: 'bytes32' }, { name: 'putaran', type: 'uint256' }] };
const TIPE_IZIN = { Permit: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }, { name: 'value', type: 'uint256' }, { name: 'nonce', type: 'uint256' }, { name: 'deadline', type: 'uint256' }] };

/* "Bagikan gas": relayer (server) mengirim MON ke kunci yang perlu mengirim transaksi sendiri (pewaris, amplop, operator
   mitra), mendaftarkan operator mitra, dan mengisi tIDR pewaris. Saksi tidak perlu gas: tanda tangannya dikirim relayer.
   Jumlah MON dan pemeriksaan saldo ada di server (aksi gas); di sini hanya memilih siapa yang perlu diisi. */
async function isiDompetDemo({ tidr: isiTidr = true, hanyaPewaris = false } = {}) {
  if (!induk) throw new Error('Relayer belum tersambung (/api/induk). Dompet induk ada di server.');
  const f = bacaAturan();
  // Server membatasi 6 amplop; sisanya diisi saat dicairkan (aksi amplop).
  const amplop = benih && !hanyaPewaris
    ? ID_PENERIMA.filter((id) => terimaDari(f, KEY_PENERIMA[id]).cara !== 'bank').map((id) => kunciAmplop(benih, KEY_PENERIMA[id]).address).slice(0, 6)
    : [];
  await Relayer.gas({ pewaris: akun.pewaris.address, amplop, tidr: isiTidr && milikSendiri() && s.status <= 1, hanyaPewaris });
}

/* Ada relayer yang mengirim transaksi atas nama orang lain (kabar hidup, konfirmasi saksi)? Di produk: relayer Pusaka. */
const relayer = () => induk;
const WARUNG = '0x000000000000000000000000000000000000b0b1'; // penerima pembayaran contoh

const aksi = {
  /* Pemasangan lewat EIP-7702: satu transaksi dari dompet pewaris ke alamatnya sendiri, membawa otorisasi.
     Isinya execute([daftarkan rekening bank ahli waris di mitra, setup aturan]) sehingga keduanya terjadi bersamaan.
     onStatus menerima 'gas' | 'otorisasi' | 'kirim' untuk lembar tanda tangan. */
  async pasang({ aturan, onStatus = () => {} } = {}) {
    if (!milikSendiri()) return hanyaBaca();
    if (s.status !== 0) return null;
    const f = aturan || bacaAturan();
    return jalankan('pasang', async () => {
      const a = akun.pewaris;
      const [gas, tidr] = await Promise.all([pub.getBalance({ address: a.address }), saldoToken(a.address)]);
      // Pewaris diisi dulu; amplop dan operator diisi di belakang (kiriman MON berjeda, diatur relayer).
      if (gas < parseEther(String(GAS_MON)) / 2n || tidr < RP300) { onStatus('gas'); await isiDompetDemo({ hanyaPewaris: true }); }
      isiDompetDemo().catch((e) => console.warn('gas amplop/operator', e));
      const { setup, rekening } = argsSetup(f, a.address);
      const calls = [];
      if (rekening.length) {
        calls.push({
          to: ALAMAT.mitra, value: 0n,
          data: encodeFunctionData({
            abi: mitraCairAbi, functionName: 'daftarBanyak',
            args: [rekening.map((r) => r.sidik), rekening.map((r) => r.bank), rekening.map((r) => r.akhiran), rekening.map((r) => r.cadangan)],
          }),
        });
      }
      calls.push({ to: a.address, value: 0n, data: encodeFunctionData({ abi: pusakaWalletAbi, functionName: 'setup', args: setup }) });
      onStatus('otorisasi');
      const otorisasi = await dompet(a).signAuthorization({ contractAddress: ALAMAT.wallet, executor: 'self' });
      onStatus('kirim');
      const hasil = await kirim(a, {
        address: a.address, abi: pusakaWalletAbi, functionName: 'execute', args: [calls],
        authorizationList: [otorisasi], gas: GAS.pasang + GAS.perRekening * BigInt(rekening.length),
      }, 'pasang');
      tandai(`${a.address}:setup`);
      kodeAda = false; alamatTerpasang = null; labelBankDibaca = false;
      return hasil;
    });
  },
  /* cancelSetup(): aturan dicabut, dompet kembali biasa dan bisa dipasang ulang */
  async cabut() {
    if (!milikSendiri()) return hanyaBaca();
    if (s.status !== 1) return null;
    return jalankan('cabut', () => kirim(akun.pewaris, { address: P, abi: pusakaWalletAbi, functionName: 'cancelSetup', gas: GAS.cabut }, 'cabut'));
  },
  /* Saksi menandatangani konfirmasi (EIP-712), relayer mengirimnya. Saksi tidak butuh gas. */
  async saksi(i, bukti = AKTA_CONTOH) {
    if (s.status !== 1 || s.attest[i]) return null;
    const w = akun.saksi[i];
    return jalankan('saksi', async () => {
      const r = relayer();
      let hasil;
      if (r) {
        const sum = await baca('getSummary');
        const ttd = await dompet(w).signTypedData({ domain: domainPusaka(), types: TIPE_KONFIRMASI, primaryType: 'KonfirmasiWafat', message: { saksi: w.address, bukti, putaran: sum.round } });
        hasil = await relay('saksi' + i, 'attestDeathFor', [w.address, bukti, ttd], GAS.saksi);
        hasil.relayer = true;
      } else {
        hasil = await kirim(w, { address: P, abi: pusakaWalletAbi, functionName: 'attestDeath', args: [bukti], gas: GAS.saksiLangsung }, 'saksi' + i);
      }
      const k = `${P}:${s.round}:${w.address}`;
      tandai(k); waktu[k + ':bukti'] = bukti; simpanWaktu();
      txTerakhir.saksi = hasil.tx;
      return hasil;
    });
  },
  /* triggerByInactivity(): siapa pun, setelah batas tidak aktif terlewati. Dikirim relayer. */
  async picu() {
    if (s.status !== 1) return null;
    return jalankan('picu', () => relay('dipicu', 'triggerByInactivity', [], GAS.picu));
  },
  /* Kabar hidup: pewaris hanya menandatangani (tanpa gas), relayer mengirim checkIn(). Saat masa sanggah, ini
     membatalkan pemicu. Waktunya dibuat lebih baru dari bukti hidup terakhir (jam blok beresolusi 1 detik). */
  async kabar() {
    if (!milikSendiri()) return hanyaBaca();
    if (!(s.status === 1 || (s.status === 2 && sisaSanggah() > 0))) return null;
    const sebab = s.status === 2 ? 'batal' : 'kabar';
    return jalankan('kabar', async () => {
      const r = relayer();
      if (!r) return kirim(akun.pewaris, { address: P, abi: pusakaWalletAbi, functionName: 'heartbeat', gas: GAS.hidup }, sebab);
      const sum = await baca('getSummary');
      const t = Math.max(sekarangKontrak(), Number(sum.lastHeartbeat) + 1, Number(sum.triggeredAt));
      const pesan = { domain: domainPusaka(), types: TIPE_KABAR, primaryType: 'KabarHidup', message: { pesan: 'Saya masih hidup', waktu: BigInt(t) } };
      // Sidik jari aktif di perangkat ini: passkey menandatangani digest EIP-712 yang sama, relayer mengirimnya.
      const pk = sidik.aktif ? passkeyLokal() : null;
      if (pk) {
        sidik.sibuk = true;
        let auth;
        try { auth = await Passkey.tandatangani(pk.id, hashTypedData(pesan)); } finally { sidik.sibuk = false; }
        const hasil = await relay(sebab, 'checkInPasskey', [BigInt(t), auth], GAS.sidikKabar);
        hasil.relayer = true; hasil.sidikJari = true;
        return hasil;
      }
      const ttd = await dompet(akun.pewaris).signTypedData(pesan);
      const hasil = await relay(sebab, 'checkIn', [BigInt(t), ttd], GAS.kabar);
      hasil.relayer = true;
      return hasil;
    });
  },
  /* Aktifkan sidik jari: browser membuat passkey (kunci P-256 yang tidak pernah keluar dari perangkat), lalu kunci
     publiknya dicatat di kontrak lewat aturPasskey() dari dompet pewaris. Setelah itu kabar hidup cukup sentuhan. */
  async daftarSidikJari() {
    if (!milikSendiri()) return hanyaBaca();
    if (s.status !== 1) { toast('Pasang aturan warisan dulu.'); return null; }
    if (!(await Passkey.didukung())) { toast('Perangkat ini belum bisa memakai sidik jari atau wajah di browser (butuh HTTPS atau localhost).'); return null; }
    return jalankan('sidik', async () => {
      sidik.sibuk = true;
      let k;
      try { k = await Passkey.buat({ nama: `${window.Pusaka?.pewaris?.nama || 'Pewaris'} · Pusaka`, pengenal: P }); } finally { sidik.sibuk = false; }
      const hasil = await kirim(akun.pewaris, { address: P, abi: pusakaWalletAbi, functionName: 'aturPasskey', args: [k.x, k.y], gas: GAS.sidikDaftar }, 'sidik');
      try { localStorage.setItem(kunciPasskey(), JSON.stringify(k)); } catch {}
      sidik.aktif = true;
      const prev = s; s = { ...s, rev: s.rev + 1 }; emit(prev, 'gas');
      return hasil;
    });
  },
  /* Matikan sidik jari: kunci publik di kontrak dihapus. */
  async hapusSidikJari() {
    if (!milikSendiri()) return hanyaBaca();
    if (s.status !== 1) return null;
    const z = '0x' + '0'.repeat(64);
    return jalankan('sidik', async () => {
      const hasil = await kirim(akun.pewaris, { address: P, abi: pusakaWalletAbi, functionName: 'aturPasskey', args: [z, z], gas: GAS.sidikDaftar }, 'sidik');
      try { localStorage.removeItem(kunciPasskey()); } catch {}
      sidik.aktif = false;
      const prev = s; s = { ...s, rev: s.rev + 1 }; emit(prev, 'gas');
      return hasil;
    });
  },
  /* Cadangan: heartbeat() lewat transaksi biasa dari dompet pewaris. */
  async hidup() {
    if (!milikSendiri()) return hanyaBaca();
    if (!(s.status === 1 || (s.status === 2 && sisaSanggah() > 0))) return null;
    const sebab = s.status === 2 ? 'batal' : 'hidup';
    return jalankan('hidup', () => kirim(akun.pewaris, { address: P, abi: pusakaWalletAbi, functionName: 'heartbeat', gas: GAS.hidup }, sebab));
  },
  /* Aktivitas biasa: pewaris membayar dari dompetnya lewat execute(). Kontrak mencatatnya sebagai bukti hidup, dan
     saat masa sanggah pemicu batal sendiri. Demo: saldo lalu diisi ulang ke Rp300 jt agar angka contoh tetap sama. */
  async bayar({ jumlah = 250_000, ke = WARUNG } = {}) {
    if (!milikSendiri()) return hanyaBaca();
    if (!(s.status === 1 || s.status === 2)) return null;
    const sebab = s.status === 2 && sisaSanggah() > 0 ? 'batal' : 'aktivitas';
    return jalankan('bayar', async () => {
      const data = encodeFunctionData({ abi: mockIDRAbi, functionName: 'transfer', args: [ke, parseEther(String(jumlah))] });
      const hasil = await kirim(akun.pewaris, { address: P, abi: pusakaWalletAbi, functionName: 'execute', args: [[{ to: ALAMAT.token, value: 0n, data }]], gas: GAS.bayar }, sebab);
      if (induk) {
        // Saldo diisi ulang oleh relayer; kalau gagal, pembayarannya sendiri tetap berhasil.
        try { await Relayer.faucet({ pewaris: P }); } catch (e) { console.warn('isi ulang tIDR', e.message); }
      }
      return hasil;
    });
  },
  /* Tidak ada di kontrak. Di anvil, jam blockchain dimajukan; di testnet cukup pakai masa sanggah pendek. */
  /* Anvil saja: majukan jam blockchain sebanyak `detik` (mis. "sebelas bulan tanpa transaksi" untuk pengingat). */
  async majukan(detik) {
    if (!LOKAL) { toast('Di testnet waktu tidak bisa dipercepat.'); return null; }
    const maju = Math.max(1, Math.floor(Number(detik) || 0));
    return jalankan('lewati', async () => {
      await pub.request({ method: 'evm_increaseTime', params: [maju] });
      await pub.request({ method: 'evm_mine', params: [] });
      return true;
    });
  },
  async lewati() {
    if (!LOKAL) { toast('Di testnet waktu tidak bisa dipercepat. Tunggu masa sanggah selesai.'); return null; }
    // dihitung dalam jam kontrak (detik)
    let sampai = null;
    if (s.status === 2 && mentah) sampai = mentah.trig + s.sanggah;
    else if (s.status === 1 && mentah) sampai = mentah.hb + s.batas;
    if (!sampai) return null;
    const maju = Math.max(1, sampai - sekarangKontrak() + 1);
    return jalankan('lewati', async () => {
      await pub.request({ method: 'evm_increaseTime', params: [maju] });
      await pub.request({ method: 'evm_mine', params: [] });
      return true;
    });
  },
  async bagikan() {
    if (s.status !== 2 || sisaSanggah() > 0) return null;
    const hasil = await jalankan('bagikan', async () => {
      const h = await relay('dibagikan', 'finalize', [], GAS.bagikan);
      blokDibagikan = h.blok;
      labelBankDibaca = false;
      return h;
    });
    if (hasil) detakOperator(true); // mitra langsung menyapu rekening virtual
    return hasil;
  },
  /* Ahli waris membuka amplop di HP-nya dan mencairkan ke rekening bank atau e-wallet. Satu transaksi dari kunci
     amplop: daftarkan rekening + izin EIP-2612 + tarik token ke mitra. Gasnya disponsori (amplop diisi MON saat
     pemasangan), jadi ahli waris tidak pernah membeli MON. rek: { bank, nomor, nama } */
  async cairkan(id, rek) {
    const a = amplopUntuk(id);
    if (!a) { toast('Kunci amplop tidak ada di HP ini. Pindai ulang QR dari layar Panggung.'); return null; }
    if (!rek || !rek.bank || akhiranDari(rek.nomor).length < 4) { toast('Isi nama bank dan nomor rekening atau HP.'); return null; }
    return jalankan('cair', async () => {
      const [jumlah, gas, nonce] = await Promise.all([
        saldoToken(a.address), pub.getBalance({ address: a.address }),
        pub.readContract({ address: ALAMAT.token, abi: mockIDRAbi, functionName: 'nonces', args: [a.address] }),
      ]);
      if (jumlah === 0n) throw new Error('Amplop ini sudah kosong.');
      // Di Monad biaya dihitung dari batas gas, jadi amplop diisi sampai GAS_AMPLOP penuh sebelum mencairkan (oleh relayer).
      const targetAmplop = parseEther(String(GAS_AMPLOP));
      if (gas < (targetAmplop * 9n) / 10n) {
        if (!induk) throw new Error('Gas amplop belum disponsori.');
        await Relayer.amplop({ alamat: a.address });
      }
      const deadline = BigInt(sekarangKontrak() + 3600);
      const ttd = await dompet(a).signTypedData({
        domain: { name: 'Testnet Rupiah', version: '1', chainId: chain.id, verifyingContract: ALAMAT.token },
        types: TIPE_IZIN, primaryType: 'Permit',
        message: { owner: a.address, spender: ALAMAT.mitra, value: jumlah, nonce, deadline },
      });
      const { v, r, s: ss } = parseSignature(ttd);
      const sidik = sidikRekening(rek, garamRekening(a.address));
      const hasil = await kirim(a, {
        address: ALAMAT.mitra, abi: mitraCairAbi, functionName: 'cairkan',
        args: [sidik, rek.bank, akhiranDari(rek.nomor), jumlah, deadline, Number(v), r, ss], gas: GAS.cairkan,
      }, 'cair-' + id);
      labelBankDibaca = false;
      return hasil;
    });
  },
  qr(on) {
    const prev = s;
    s = { ...s, qr: on, rev: s.rev + 1 };
    bc && bc.postMessage({ jenis: 'qr', on });
    emit(prev, 'qr');
  },
  async bagikanGas() {
    return jalankan('gas', async () => { await isiDompetDemo(); return true; });
  },
  /* Pewaris baru dengan kunci baru. Status DIBAGIKAN final, jadi demo berikutnya butuh dompet lain. */
  ulang() {
    if (pDariUrl) return hanyaBaca();
    const a = pewarisBaru();
    bc && bc.postMessage({ jenis: 'ulang', alamat: a.address });
    gantiPewaris(a.address, true);
  },
  preset() {},
  /* Operator mitra: sapu dan selesaikan sekarang (biasanya berjalan sendiri). */
  async prosesMitra() { await detakOperator(true); },
};

function gantiPewaris(alamat, lokal) {
  if (!lokal) {
    // tab lain membuat pewaris baru: muat ulang kunci dari localStorage
    location.reload();
    return;
  }
  P = alamat;
  benih = bacaBenih();
  blokDibagikan = null;
  mentah = null;
  kodeAda = false; alamatTerpasang = null; labelBankDibaca = false; labelPernah = false;
  sidik.aktif = false;
  const prev = s;
  s = { ...awal(), rev: s.rev + 1 };
  perbaruiAlamat();
  emit(prev, 'ulang');
  tarik();
}

/* ---------- sidik jari (passkey) ----------
   Passkey disimpan oleh perangkat (Windows Hello, Touch ID, sidik jari Android). Browser ini hanya mengingat id dan
   kunci publiknya; aktif jika kunci publik yang sama tercatat di kontrak pewaris ini. */
const sidik = { didukung: null, aktif: false, sibuk: false };
const kunciPasskey = () => `pusaka-passkey:${P.toLowerCase()}`;
function passkeyLokal() { try { return JSON.parse(localStorage.getItem(kunciPasskey())); } catch { return null; } }
async function cekSidik() {
  if (sidik.didukung === null) sidik.didukung = await Passkey.didukung();
  const lok = passkeyLokal();
  let aktif = false;
  if (lok && milikSendiri()) {
    try {
      const [x, y] = await baca('passkey');
      aktif = x.toLowerCase() === lok.x.toLowerCase() && y.toLowerCase() === lok.y.toLowerCase();
    } catch { aktif = false; }
  }
  if (aktif !== sidik.aktif) { sidik.aktif = aktif; const prev = s; s = { ...s, rev: s.rev + 1 }; emit(prev, 'gas'); }
}

/* ---------- amplop ---------- */
const cacheAmplop = new Map();
function amplopUntuk(id) {
  const key = KEY_PENERIMA[id] || id;
  if (!benih) return null;
  const k = `${benih}:${key}`;
  if (!cacheAmplop.has(k)) cacheAmplop.set(k, kunciAmplop(benih, key));
  return cacheAmplop.get(k);
}
/* Tautan untuk QR Panggung atau pesan WhatsApp. Benih di bagian # tidak pernah dikirim ke server. */
function urlAmplop(id) {
  const base = (env.VITE_PUBLIC_URL || location.origin).replace(/\/$/, '');
  return `${base}/waris.html?p=${P}${id ? `&id=${id}` : ''}${benih ? `#s=${benih}` : ''}`;
}
/* Cara terima satu penerima, untuk layar mana pun. Di laptop pewaris: dari aturan. Di perangkat lain: rekening
   virtual terbaca dari mitra; selain itu amplop atau kripto menurut keluarga contoh. */
function caraTerima(id) {
  const p = s.penerima[id];
  if (!p) return null;
  const t = milikSendiri() ? terimaDari(bacaAturan(), KEY_PENERIMA[id]) : TERIMA_AWAL()[KEY_PENERIMA[id]];
  let cara = t.cara;
  if (p.bank) cara = 'bank';
  else if (p.alamat && labelPernah) {
    // Sudah terpasang dan data mitra sudah terbaca, tetapi tidak ada rekening virtual: amplop atau dompet kripto.
    const a = amplopUntuk(id);
    cara = a && p.alamat.toLowerCase() === a.address.toLowerCase() ? (t.cara === 'kripto' ? 'kripto' : 'amplop') : 'kripto';
  }
  return {
    id, cara, nama: t.nama || '', wa: t.wa || '',
    bank: p.bank || (cara === 'bank' ? t.bank : ''), akhiran: p.akhiran || (cara === 'bank' ? akhiranDari(t.nomor) : ''),
    alamat: p.alamat, saldo: p.saldo, cair: p.cair, ewallet: EWALLET.has(p.bank || t.bank),
  };
}

/* ---------- operator mitra pencairan (simulasi bank) ----------
   Kuncinya di server: layar presenter (Panggung, Pewaris, Saksi, Mitra, Simulasi HP) hanya memanggil aksi `mitra`
   secara berkala, satu tab sebagai pemimpin. Server mengerjakan:
   1. Rekening virtual yang berisi disapu ke mitra (sapuBanyak).
   2. Pencairan yang diproses "ditransfer lewat BI-FAST" ±1,4 detik, lalu dicatat selesai dengan nomor referensi. */
const HALAMAN_OPERATOR = /(panggung|pewaris|saksi|mitra|hp|index)\.html$|\/$/;
const bolehOperator = () => !!operator && window.self === window.top && HALAMAN_OPERATOR.test(location.pathname);
const ID_TAB = Math.random().toString(36).slice(2);
const KUNCI_PEMIMPIN = 'pusaka-mitra-pemimpin';
function pemimpin() {
  try {
    const x = JSON.parse(localStorage.getItem(KUNCI_PEMIMPIN) || 'null');
    if (!x || x.id === ID_TAB || Date.now() - x.t > 3500) { localStorage.setItem(KUNCI_PEMIMPIN, JSON.stringify({ id: ID_TAB, t: Date.now() })); return true; }
    return false;
  } catch { return true; }
}
let operatorSibuk = false, detakKe = 0, bankMenunggu = 0;
const mitraLog = [];
const catatMitra = (teks, tx = '') => { mitraLog.push({ t: Date.now(), teks, tx }); if (mitraLog.length > 40) mitraLog.shift(); };
/* Untuk pewaris yang sedang dipantau, isi rekening virtual dan antrean pencairan sudah terbaca oleh tarik()
   (statusBanyak), jadi server dipanggil hanya jika ada yang perlu dikerjakan. Pemindaian penuh hanya tiap ±10 detik. */
async function detakOperator(paksa = false) {
  if (!bolehOperator() || operatorSibuk) return;
  if (!paksa && !pemimpin()) return;
  const penuh = paksa || detakKe++ % 10 === 0;
  const pen = Object.values(s.penerima);
  const adaVa = pen.some((p) => p.rekening && p.saldo > 0);
  const adaAntre = pen.some((p) => p.cair && p.cair.tahap === 'diproses');
  if (!penuh && !adaVa && !adaAntre && !bankMenunggu) return;
  operatorSibuk = true;
  try {
    const h = await Relayer.mitra();
    bankMenunggu = h.menunggu || 0;
    (h.catatan || []).forEach((c) => catatMitra(c.teks, c.tx));
    if (h.tx && h.tx.length) {
      const akhir = h.hasil[h.hasil.length - 1];
      umumkanTx('mitra', akhir.tx);
      selesai('mitra', akhir);
    }
    if ((h.catatan || []).some((c) => c.jenis === 'selesai')) {
      bc && bc.postMessage({ jenis: 'segarkan' });
      labelBankDibaca = false;
      tarik();
    }
  } catch (e) {
    console.warn('operator mitra', pesanDari(e));
  } finally {
    operatorSibuk = false;
  }
}
/* Nomor referensi transfer yang mudah dibaca dari bukti bytes32: "BIFAST 2026-1024 4471 0932". */
function refBank(bukti, t = Date.now()) {
  if (!bukti || /^0x0+$/.test(bukti)) return '';
  const d = new Date(t), x = (BigInt(bukti) % 10n ** 8n).toString().padStart(8, '0');
  return `BIFAST ${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')} ${x.slice(0, 4)} ${x.slice(4)}`;
}

/* ---------- data tampilan dari kontrak ----------
   Layar memakai data contoh di assets/data.js (nama, peran, susunan keluarga demo). Alamat diganti dengan alamat
   asli, dan jika aturan sudah terpasang dengan keluarga demo, nominal diambil dari preview() kontrak. */
function perbaruiAlamat() {
  const D = window.Pusaka;
  D.pewaris.alamat = pendek(P);
  D.pewaris.alamatPenuh = P;
  const f = bacaAturan();
  D.saksi.forEach((sk, i) => {
    sk.alamat = pendek(akun.saksi[i].address);
    if (milikSendiri() && f.saksi && f.saksi[i]) { sk.nama = f.saksi[i].nama || sk.nama; sk.peran = f.saksi[i].peran || sk.peran; }
  });
  const prev = s;
  const pen = { ...s.penerima };
  D.penerima.forEach((p) => {
    const key = KEY_PENERIMA[p.id];
    let a = alamatTerpasang ? alamatTerpasang[p.id] : null;
    if (!a && milikSendiri()) { try { a = alamatTujuan(P, key, terimaDari(f, key)); } catch { a = null; } }
    p.alamatPenuh = a || alamatPenerima(P, key);
    p.alamat = pendek(p.alamatPenuh);
    const t = milikSendiri() ? terimaDari(f, key) : TERIMA_AWAL()[key];
    pen[p.id] = { ...pen[p.id], alamat: a, cara: pen[p.id].bank ? 'bank' : t.cara };
  });
  // Tanpa emit: layar membaca s.penerima saat menggambar ulang, dan tarik() memberi tahu jika ada yang berubah.
  s = { ...prev, penerima: pen };
}
async function nominalDariKontrak() {
  const D = window.Pusaka;
  try {
    const kode = await pub.getCode({ address: P });
    if (!kode || kode === '0x') return;
    const st = Number(await baca('status'));
    if (st === 0) return;
    const [pv, saksiChain] = await Promise.all([baca('preview'), baca('getWitnesses')]);
    // saksi dari kontrak (penting untuk perangkat lain yang tidak memegang kunci saksi)
    saksiChain[0].forEach((a, i) => { if (D.saksi[i]) D.saksi[i].alamat = pendek(a); });
    const rel = pv.heirs.map((h) => Number(h.relation)).join();
    if (rel !== '1,2,2,3,4,5' || pv.bequests.length !== 1) return; // bukan keluarga demo: biarkan data contoh
    const urut = { istri: pv.heirs[0], putra1: pv.heirs[1], putra2: pv.heirs[2], putri: pv.heirs[3], ayah: pv.heirs[4], ibu: pv.heirs[5] };
    D.penerima.forEach((p) => {
      if (p.id === 'masjid') {
        const b = pv.bequests[0];
        p.wasiat = juta(b.amount); p.total = p.wasiat; p.alamatPenuh = b.to;
      } else {
        const h = urut[p.id];
        p.faraid = juta(h.faraidAmount); p.bersama = juta(h.jointAmount); p.total = p.faraid + p.bersama; p.alamatPenuh = h.wallet;
      }
      p.alamat = pendek(p.alamatPenuh);
    });
    D.bidang.forEach((b) => {
      const p = D.P[b.id];
      b.amount = b.bagian === 'bersama' ? p.bersama : b.bagian === 'wasiat' ? p.wasiat : p.faraid;
    });
  } catch (e) {
    console.warn('preview() gagal dibaca, memakai data contoh', e);
  }
}

/* ---------- pesan kecil di layar ---------- */
/* Kabar singkat dan struk transaksi menumpuk di pojok kanan bawah (gaya di base.css: .toast, .struk). */
let tumpukEl;
function tumpuk() {
  if (!tumpukEl || !tumpukEl.isConnected) {
    tumpukEl = document.createElement('div');
    tumpukEl.className = 'toast-tumpuk';
    tumpukEl.setAttribute('role', 'status');
    tumpukEl.setAttribute('aria-live', 'polite');
    document.body.appendChild(tumpukEl);
  }
  return tumpukEl;
}
function tampilkan(el, lama) {
  const host = tumpuk();
  host.appendChild(el);
  while (host.children.length > 3) host.firstElementChild.remove();
  setTimeout(() => { el.classList.add('pergi'); setTimeout(() => el.remove(), 400); }, lama);
}
function toast(teks, { galat = true } = {}) {
  const el = document.createElement('div');
  el.className = 'toast' + (galat ? ' galat' : '');
  el.textContent = teks;
  tampilkan(el, 5200);
}
/* Struk: tiap transaksi yang dikirim dari browser ini, dengan blok, lama konfirmasi, dan tautan explorer */
const JUDUL_STRUK = {
  pasang: 'Aturan warisan terpasang', cabut: 'Aturan dicabut dari dompet', dipicu: 'Masa sanggah dimulai',
  kabar: 'Kabar hidup tercatat', hidup: 'Bukti hidup tercatat', aktivitas: 'Pembayaran tercatat sebagai bukti hidup',
  batal: 'Masa sanggah dibatalkan', sidik: 'Sidik jari diperbarui', dibagikan: 'Warisan dibagikan sesuai faraid',
};
const judulStruk = (sebab) => JUDUL_STRUK[sebab] || (/^saksi/.test(sebab) ? 'Konfirmasi saksi tercatat' : /^cair-/.test(sebab) ? 'Amplop dicairkan' : '');
function struk(sebab, h) {
  const judul = judulStruk(sebab);
  if (!judul || q.has('diam')) return;
  const el = document.createElement('div');
  el.className = 'toast struk';
  const detik = Math.max(0.1, h.detik).toLocaleString('id-ID', { maximumFractionDigits: 1 });
  el.innerHTML = `<span class="tanda" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
    <b></b><small>Final di blok ${h.blok.toLocaleString('id-ID')} dalam ${detik} detik</small>
    ${EXPLORER ? `<a href="${EXPLORER}/tx/${h.tx}" target="_blank" rel="noopener">Lihat transaksi di MonadVision <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M4 2h6v6M10 2 3 9" fill="none" stroke="currentColor" stroke-width="1.4"/></svg></a>` : ''}`;
  el.querySelector('b').textContent = judul;
  tampilkan(el, 7000);
}
let pesanEl;
function peringatan(teks) {
  if (!teks) { if (pesanEl) pesanEl.hidden = true; return; }
  if (!pesanEl) {
    pesanEl = document.createElement('div');
    pesanEl.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9998;padding:6px 12px;background:#7c4e2d;color:#f5efe3;font:13px var(--font-sans,system-ui);text-align:center';
    document.body.appendChild(pesanEl);
  }
  pesanEl.textContent = teks;
  pesanEl.hidden = false;
}

/* ---------- panel demo ---------- */
const HALAMAN = [['index.html', 'Beranda'], ['pewaris.html', 'Pewaris'], ['saksi.html', 'Saksi'], ['waris.html', 'Ahli waris'],
  ['hp.html', 'Simulasi HP'], ['kabar.html', 'HP pewaris'], ['panggung.html', 'Panggung'], ['mitra.html', 'Mitra bank'], ['kalkulator.html', 'Kalkulator']];
function panel({ judul = 'Panel demo', aksiStatus = true } = {}) {
  const d = document.createElement('details');
  if (window.self !== window.top) return d; // di dalam iframe (simulasi HP), panel ada di halaman induk
  d.className = 'panel-demo';
  d.innerHTML = `<summary title="${judul} (tombol \`)"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><path d="M1.5 4.5h13M1.5 11.5h13"/><circle cx="5.5" cy="4.5" r="1.9" fill="#0e1527"/><circle cx="10.5" cy="11.5" r="1.9" fill="#0e1527"/></svg><span class="teks">${judul}</span></summary><div class="isi">
    ${aksiStatus ? `<div class="baris"><span class="judul">Transaksi ${LOKAL ? 'anvil' : 'Monad testnet'}</span>
      <button data-a="bagikanGas">Bagikan gas</button><button data-a="pasang">Pasang aturan</button>
      <button data-a="qr">QR</button>
      <button data-a="s0">Saksi 1</button><button data-a="s1">Saksi 2</button><button data-a="s2">Saksi 3</button>
      <button data-a="kabar">Kabar hidup (Rp0)</button><button data-a="bayar">Bayar Rp250rb</button>
      <button data-a="hidup">Tombol hidup</button><button data-a="daftarSidikJari">Aktifkan sidik jari</button><button data-a="picu">Picu tidak aktif</button>
      ${LOKAL ? '<button data-a="lewati">Majukan waktu</button>' : ''}
      <button data-a="bagikan">Bagikan</button><button data-a="prosesMitra">Proses mitra</button><button data-a="ulang">Pewaris baru</button></div>` : ''}
    <div class="baris"><span class="judul">Layar</span>
      ${HALAMAN.map(([h, l]) => `<a href="${h}" style="padding:6px 4px">${l}</a>`).join('')}</div>
    <div class="baris"><span class="judul">Pewaris</span><span style="font-size:12px;opacity:.75;word-break:break-all">${P}</span></div>
  </div>`;
  d.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const a = b.dataset.a;
    if (a === 'qr') aksi.qr(!s.qr);
    else if (a && a[0] === 's' && a.length === 2) aksi.saksi(+a[1]);
    else if (a) aksi[a]();
  });
  addEventListener('keydown', (e) => { if (e.key === '`' || (e.key === 'd' && e.altKey)) d.open = !d.open; });
  document.body.appendChild(d);
  return d;
}

/* ---------- mulai ---------- */
/* HP penonton (perangkat lain) membaca lebih jarang: di acara puluhan HP berbagi satu IP Wi-Fi, sedangkan RPC publik
   Monad membatasi ±25 panggilan per detik per IP. */
const INTERVAL = /panggung/.test(location.pathname) ? 500 : /waris|hp|kabar/.test(location.pathname) ? (milikSendiri() ? 1500 : 2000) : 1000;
export async function siapkan() {
  await muatInfo();
  try { aturImplRekening(await bacaMitra('rekeningImpl')); } catch (e) { console.warn('MitraCair tidak terbaca', e); }
  perbaruiAlamat();
  await nominalDariKontrak();
  await tarik();
  cekSidik().catch(() => {});
  setInterval(tarik, INTERVAL);
  if (bolehOperator()) setInterval(detakOperator, 1000);
}

window.Demo = {
  get s() { return s; },
  on(f) { subs.add(f); return () => subs.delete(f); },
  diam,
  ...aksi, jumlahSaksi, sisaSanggah, sisaBatas, blok, hash, pendek, panel, toast, AKTA_CONTOH,
  get pewaris() { return P; },
  get pesanTerakhir() { return pesanTerakhir; },
  tx: (sebab) => txTerakhir[sebab] || '',
  /* "Final di blok N dalam X detik" jika transaksinya dikirim dari browser ini, jika tidak "Final di blok N" */
  teksFinal(sebab, n) {
    const f = finalTerakhir[sebab];
    const blokN = (f ? f.blok : n || blok()).toLocaleString('id-ID');
    return f ? `Final di blok ${blokN} dalam ${Math.max(0.1, f.detik).toLocaleString('id-ID', { maximumFractionDigits: 1 })} detik` : `Final di blok ${blokN}`;
  },
  hasilTerakhir: (sebab) => finalTerakhir[sebab] || null,
  PUBLIC_URL: (env.VITE_PUBLIC_URL || location.origin).replace(/\/$/, ''),
  NAMA_JARINGAN: LOKAL ? 'blockchain lokal (anvil)' : 'Monad testnet',
  get milikSendiri() { return milikSendiri(); },
  alamatPenerima: (key) => alamatPenerima(P, key),
  alamat: ALAMAT, LOKAL, EXPLORER, akun,
  /* alamat dompet induk dan operator mitra dari relayer ({ address }), atau null; kuncinya hanya ada di server */
  get induk() { return induk; },
  get operator() { return operator; },
  sekarangKontrak,
  /* cara terima, bukti hidup, sidik jari */
  KEY_PENERIMA, ID_PENERIMA, BANK, EWALLET, TERIMA_AWAL, AWAL_ATURAN, bacaAturan, simpanAturan, terimaDari,
  alamatTujuan: (key, t) => alamatTujuan(P, key, t),
  akhiranDari, caraTerima, amplopUntuk, urlAmplop, refBank,
  get benih() { return benih; },
  get mitraLog() { return mitraLog.slice(); },
  get operatorAktif() { return bolehOperator(); },
  /* { didukung, aktif, sibuk }: perangkat bisa memakai sidik jari/wajah, passkey tercatat di kontrak, sedang meminta */
  get sidikJari() { return { ...sidik }; },
  VIA_TEKS, GAS, TAHAP,
  /* Baca langsung dari kontrak (untuk layar Mitra dan rincian). Hasil mentah dari viem (bigint, struct). */
  bacaWallet: (fn, args) => baca(fn, args),
  bacaMitra: (fn, args) => bacaMitra(fn, args),
  saldoToken: (a) => saldoToken(a),
  bacaToken: (fn, args) => pub.readContract({ address: ALAMAT.token, abi: mockIDRAbi, functionName: fn, args }),
  juta,
};
