/* Relayer Pusaka: semua yang dulu dikerjakan "dompet induk" dan "operator mitra" di browser, sekarang di server.
   Tanpa framework (Node 20+, hanya viem). Pembungkus HTTP (Vercel, Vite dev, Next.js) cukup memanggil
   tangani(permintaan) dan info(). Kontrak API: docs/relayer-api.md.

   Kunci induk dan operator tidak pernah keluar dari berkas ini. Konfigurasi dibaca dari variabel lingkungan server
   (INDUK_KEY, RPC_URL, TOKEN, WALLET, MITRA, GAS_MON, GAS_AMPLOP, CHAIN_ID). */
import {
  createPublicClient, createWalletClient, http, parseEther, getAddress, isAddress, keccak256, concat, toHex,
  BaseError, ContractFunctionRevertedError,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { anvil, monadTestnet } from 'viem/chains';
import { pusakaWalletAbi, mockIDRAbi, mitraCairAbi } from '../web/src/abi.js';

const RP300 = parseEther('300000000'); // Rp300 jt tIDR (18 desimal)
const KUNCI_ANVIL_0 = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const MAKS_AMPLOP = 6;
const JEDA_BLOK_MON = 4n;
const DELAY_BANK = 1400;

/* Galat yang pesannya aman ditampilkan ke pengguna. `kode` dipakai browser untuk memilih pesan (mis. WrongStatus). */
class Galat extends Error {
  constructor(pesan, kode = 'Permintaan') { super(pesan); this.kode = kode; }
}

/* ---------- konfigurasi ---------- */
let sumber = null; // null = process.env
let kfg = null;
/* Dipanggil pembungkus yang punya sumber env sendiri (mis. Vite dev server). Tanpa ini dipakai process.env. */
export function atur(env) { sumber = env || null; kfg = null; }

function muat() {
  if (kfg) return kfg;
  const e = sumber || process.env;
  const chainId = Number(e.CHAIN_ID || 10143);
  const LOKAL = chainId === 31337;
  const chain = LOKAL ? anvil : monadTestnet;
  const RPC = e.RPC_URL || (LOKAL ? 'http://127.0.0.1:8545' : monadTestnet.rpcUrls.default.http[0]);
  const wajib = (nama) => {
    if (!e[nama]) throw new Galat(`${nama} belum diisi di server relayer.`, 'Konfigurasi');
    if (!isAddress(e[nama], { strict: false })) throw new Galat(`${nama} di server relayer bukan alamat.`, 'Konfigurasi');
    return getAddress(e[nama]);
  };
  let kunci = (e.INDUK_KEY || '').trim();
  if (kunci && !kunci.startsWith('0x')) kunci = '0x' + kunci;
  if (!kunci && LOKAL) kunci = KUNCI_ANVIL_0;
  if (!/^0x[0-9a-fA-F]{64}$/.test(kunci)) throw new Galat('INDUK_KEY belum diisi (atau bukan kunci) di server relayer.', 'Konfigurasi');
  const induk = privateKeyToAccount(kunci);
  /* Operator mitra pencairan (simulasi bank): kunci turunan dompet induk, supaya transaksinya tidak berebut nonce
     dengan dompet induk. Didaftarkan sebagai operator oleh pemilik MitraCair saat aksi gas. */
  const operator = privateKeyToAccount(keccak256(concat([kunci, toHex('pusaka-mitra-operator-v1')])));
  // Jumlah MON dibatasi supaya salah ketik di env tidak menguras dompet induk.
  const jumlah = (nama, awal, maks) => { const n = Number(e[nama] || awal); return n > 0 && n <= maks ? n : awal; };
  const transport = http(RPC, { retryCount: 2 });
  const pub = createPublicClient({ chain, transport, pollingInterval: LOKAL ? 250 : 200 });
  kfg = {
    LOKAL, chain, RPC, transport, pub, induk, operator,
    ALAMAT: { token: wajib('TOKEN'), wallet: wajib('WALLET'), mitra: wajib('MITRA') },
    GAS_MON: jumlah('GAS_MON', 0.2, 5),
    GAS_AMPLOP: jumlah('GAS_AMPLOP', 0.08, 1),
    BATAS_JAM: Number(e.BATAS_JAM || 300),
    BLOK_MS: LOKAL ? 1000 : 400,
  };
  return kfg;
}

/* Batas gas eksplisit. Di Monad biaya dihitung dari batas gas, bukan gas terpakai (angka dari pengukuran di anvil
   mode Monad ditambah ±40%). Batas dari browser dipakai hanya jika tidak melebihi 2× angka ini. */
export const GAS = {
  saksi: 150_000n, kabar: 80_000n, picu: 120_000n, bagikan: 600_000n, sapuPer: 220_000n, selesaikanPer: 70_000n,
  operator: 80_000n, faucet: 120_000n, sidikKabar: 450_000n, sidikKabarMonad: 200_000n,
};
const FUNGSI_RELAY = {
  attestDeathFor: () => GAS.saksi,
  checkIn: () => GAS.kabar,
  checkInPasskey: () => (muat().LOKAL ? GAS.sidikKabar : GAS.sidikKabarMonad),
  triggerByInactivity: () => GAS.picu,
  finalize: () => GAS.bagikan,
};

/* Harga gas di Monad: base fee + 15% + tip 2 gwei (alasan lengkap di web/src/chain.js). */
const TIP = 2_000_000_000n;
let biaya = null, biayaT = 0;
async function biayaGas() {
  const { pub } = muat();
  if (!biaya || Date.now() - biayaT > 5000) {
    const { baseFeePerGas } = await pub.getBlock({ blockTag: 'latest' });
    biaya = { maxFeePerGas: (baseFeePerGas * 115n) / 100n + TIP, maxPriorityFeePerGas: TIP };
    biayaT = Date.now();
  }
  return biaya;
}
function dompet(akun) {
  const { chain, transport, LOKAL } = muat();
  const w = createWalletClient({ account: akun, chain, transport });
  if (LOKAL) return w;
  return {
    ...w,
    writeContract: async (req) => w.writeContract({ ...(await biayaGas()), ...req }),
    sendTransaction: async (req) => w.sendTransaction({ ...(await biayaGas()), ...req }),
  };
}

const tidur = (ms) => new Promise((r) => setTimeout(r, ms));
const sama = (a, b) => a.toLowerCase() === b.toLowerCase();

/* ---------- antrean ---------- */
const antrean = new Map(); // satu akun hanya mengirim satu transaksi dalam satu waktu (dalam proses ini)
function antre(a, kerja) {
  const sebelum = antrean.get(a.address) || Promise.resolve();
  const p = sebelum.catch(() => {}).then(kerja);
  antrean.set(a.address, p);
  return p;
}

/* Batas isi gas per jam (satu proses): mencegah alamat acak menguras dompet induk. */
const jejak = [];
function batasi(n) {
  const { BATAS_JAM } = muat();
  const sekarang = Date.now();
  while (jejak.length && sekarang - jejak[0] > 3_600_000) jejak.shift();
  if (jejak.length + n > BATAS_JAM) throw new Galat('Terlalu banyak permintaan isi gas dalam satu jam. Coba lagi nanti.', 'Dibatasi');
  for (let i = 0; i < n; i++) jejak.push(sekarang);
}

/* ---------- transaksi ---------- */
const nonceBentrok = (e) => /nonce|already known|replacement transaction|underpriced/i.test((e && (e.shortMessage || e.message)) || '');

let blokIndukTerakhir = 0n;
const catatBlokInduk = (a, r) => { if (sama(a.address, muat().induk.address) && r.blockNumber > blokIndukTerakhir) blokIndukTerakhir = r.blockNumber; };

/* Aturan "reserve balance" Monad: dompet bersaldo di bawah 10 MON hanya boleh mengurangi saldonya dengan mengirim MON
   jika dalam 3 blok terakhir (±1,2 detik) ia tidak mengirim transaksi lain. Jika tidak, kirimannya dibatalkan di
   blockchain (gas tetap terpakai). Karena itu kiriman MON dari induk satu per satu dengan jeda, dan dicoba ulang
   bila tetap dibatalkan. Anvil tidak punya aturan ini. Dipanggil di dalam antre(induk). */
async function kirimMON(to, value) {
  const { pub, induk, LOKAL, BLOK_MS } = muat();
  for (let coba = 0; ; coba++) {
    if (!LOKAL) {
      // Instance baru belum tahu blok transaksi induk terakhir: anggap baru saja mengirim.
      if (!blokIndukTerakhir) blokIndukTerakhir = await pub.getBlockNumber({ cacheTime: 0 });
      while ((await pub.getBlockNumber({ cacheTime: 0 })) < blokIndukTerakhir + JEDA_BLOK_MON) await tidur(BLOK_MS);
    }
    // Dompet pewaris yang sudah memakai EIP-7702 punya kode, jadi menerima MON butuh sedikit di atas 21.000 gas.
    const perkiraan = await pub.estimateGas({ account: induk, to, value }).catch(() => 60_000n);
    let tx;
    for (let u = 0; ; u++) {
      try { tx = await dompet(induk).sendTransaction({ to, value, gas: perkiraan === 21_000n ? perkiraan : perkiraan + perkiraan / 5n }); break; } catch (e) {
        if (u >= 2 || !nonceBentrok(e)) throw e;
        await tidur(350 + u * 300);
      }
    }
    const r = await pub.waitForTransactionReceipt({ hash: tx, timeout: 40_000 });
    catatBlokInduk(induk, r);
    if (r.status === 'success') {
      // Monad memeriksa saldo pengirim memakai keadaan ±3 blok lalu, jadi penerima baru bisa memakai MON ini setelahnya.
      if (!LOKAL) while ((await pub.getBlockNumber({ cacheTime: 0 })) < r.blockNumber + JEDA_BLOK_MON) await tidur(BLOK_MS);
      return tx;
    }
    if (LOKAL || coba >= 2) throw new Galat('Kiriman MON dari dompet induk dibatalkan di blockchain.', 'KirimanDibatalkan');
  }
}

/* Satu panggilan kontrak: simulasi dulu (agar penolakan terbaca jelas dan tidak membuang gas), lalu kirim dengan batas
   gas eksplisit. Jika nonce bentrok dengan instance lain yang memakai akun yang sama, dicoba ulang dengan nonce baru. */
function kirim(a, req) {
  return antre(a, async () => {
    const { pub } = muat();
    const t0 = Date.now();
    await pub.simulateContract({ account: a, ...req });
    let tx;
    for (let coba = 0; ; coba++) {
      try { tx = await dompet(a).writeContract(req); break; } catch (e) {
        if (coba >= 3 || !nonceBentrok(e)) throw e;
        await tidur(350 + coba * 300);
      }
    }
    const r = await pub.waitForTransactionReceipt({ hash: tx, timeout: 40_000 });
    catatBlokInduk(a, r);
    if (r.status !== 'success') throw new Galat('Transaksi gagal dijalankan di blockchain.', 'GagalDiChain');
    return { tx, blok: Number(r.blockNumber), detik: (Date.now() - t0) / 1000, gas: Number(r.gasUsed) };
  });
}

/* ---------- membaca kontrak ---------- */
const bacaMitra = (functionName, args) => muat().pub.readContract({ address: muat().ALAMAT.mitra, abi: mitraCairAbi, functionName, args });
const saldoToken = (a) => muat().pub.readContract({ address: muat().ALAMAT.token, abi: mockIDRAbi, functionName: 'balanceOf', args: [a] });

/* ---------- validasi ---------- */
function alamat(v, nama) {
  if (typeof v !== 'string' || !isAddress(v, { strict: false })) throw new Galat(`${nama} bukan alamat yang valid.`);
  return getAddress(v);
}

/* Pewaris harus sudah memasang Pusaka: kodenya adalah delegasi EIP-7702 (0xef0100 + alamat PusakaWallet). */
const pewarisSah = new Map(); // alamat → waktu terakhir terbukti sah
async function cekPewaris(p) {
  const { pub, ALAMAT } = muat();
  if (Date.now() - (pewarisSah.get(p) || 0) < 60_000) return;
  const kode = await pub.getCode({ address: p });
  if (!kode || kode.toLowerCase() !== `0xef0100${ALAMAT.wallet.slice(2)}`.toLowerCase()) {
    throw new Galat('Dompet ini belum memasang Pusaka (tanpa delegasi EIP-7702).', 'BukanPewaris');
  }
  if (pewarisSah.size > 500) pewarisSah.clear();
  pewarisSah.set(p, Date.now());
}

/* ---------- aksi ---------- */

/* "Bagikan gas": induk mengirim MON ke kunci yang perlu mengirim transaksi sendiri (pewaris, amplop, operator mitra),
   mendaftarkan operator mitra, dan mengisi tIDR pewaris. Saksi tidak perlu gas: tanda tangannya dikirim relayer. */
async function aksiGas({ pewaris, amplop = [], tidr: isiTidr = true, hanyaPewaris = false } = {}) {
  const { pub, induk, operator, ALAMAT, GAS_MON, GAS_AMPLOP } = muat();
  const p = alamat(pewaris, 'pewaris');
  if (!Array.isArray(amplop)) throw new Galat('amplop harus berupa daftar alamat.');
  if (amplop.length > MAKS_AMPLOP) throw new Galat(`Maksimal ${MAKS_AMPLOP} amplop.`);
  const daftarAmplop = hanyaPewaris ? [] : [...new Set(amplop.map((a) => alamat(a, 'amplop')))].filter((a) => !sama(a, p));
  const target = parseEther(String(GAS_MON));
  // Operator menyapu dan menyelesaikan banyak transfer per putaran (±0,15 MON di Monad), jadi jatahnya 1,5×.
  const daftar = [[p, target], ...(hanyaPewaris ? [] : [[operator.address, (target * 3n) / 2n]]), ...daftarAmplop.map((a) => [a, parseEther(String(GAS_AMPLOP))])];
  const saldo = await Promise.all(daftar.map(([a]) => pub.getBalance({ address: a })));
  const kurang = daftar.map(([a, t], i) => [a, t, saldo[i]]).filter(([, t, b]) => b < t / 2n);

  // tIDR hanya diisi bila pewaris belum memasang aturan (atau aturannya masih aktif), seperti layar lama.
  const tidr = await saldoToken(p);
  let perluTidr = isiTidr && tidr < RP300;
  if (perluTidr) {
    const kode = await pub.getCode({ address: p });
    if (kode && kode !== '0x') {
      try { const st = Number(await pub.readContract({ address: p, abi: pusakaWalletAbi, functionName: 'status' })); perluTidr = st <= 1; } catch { perluTidr = false; }
    }
  }
  let perluOperator = false;
  if (!hanyaPewaris) {
    const [aktif, pemilik] = await Promise.all([bacaMitra('isOperator', [operator.address]), bacaMitra('pemilik')]);
    perluOperator = !aktif && sama(pemilik, induk.address);
  }
  if (!kurang.length && !perluTidr && !perluOperator) return { ok: true, tx: [] };
  batasi(Math.max(1, kurang.length));

  return antre(induk, async () => {
    const tx = [];
    // Kiriman MON satu per satu (lihat kirimMON), lalu panggilan kontrak tanpa MON boleh beruntun.
    let gagalPewaris = null;
    for (const [a, t, b] of kurang) {
      try { tx.push(await kirimMON(a, t - b)); } catch (e) {
        if (sama(a, p)) gagalPewaris = e;
        console.warn(`[relayer] gas: MON tidak terkirim ke ${a}:`, pesanAman(e)); // penerima lain tetap diisi
      }
    }
    if (gagalPewaris) throw gagalPewaris;
    const w = dompet(induk);
    let nonce = await pub.getTransactionCount({ address: induk.address, blockTag: 'pending' });
    const kontrak = [];
    if (perluTidr) {
      kontrak.push(await w.writeContract({ address: ALAMAT.token, abi: mockIDRAbi, functionName: 'faucet', args: [p, RP300 - tidr], gas: GAS.faucet, nonce: nonce++ }));
    }
    if (perluOperator) {
      kontrak.push(await w.writeContract({ address: ALAMAT.mitra, abi: mitraCairAbi, functionName: 'aturOperator', args: [operator.address, true], gas: GAS.operator, nonce: nonce++ }));
    }
    const rs = await Promise.all(kontrak.map((hash) => pub.waitForTransactionReceipt({ hash, timeout: 40_000 })));
    rs.forEach((r) => catatBlokInduk(induk, r));
    return { ok: true, tx: [...tx, ...kontrak] };
  });
}

/* Kirim transaksi yang sudah ditandatangani pewaris atau saksi (atau yang boleh dipicu siapa pun) dan bayar gasnya. */
async function aksiRelay({ pewaris, fungsi, args = [], gas } = {}) {
  const { induk } = muat();
  const p = alamat(pewaris, 'pewaris');
  if (typeof fungsi !== 'string' || !Object.hasOwn(FUNGSI_RELAY, fungsi)) throw new Galat('Fungsi ini tidak boleh dikirim lewat relayer.', 'FungsiDitolak');
  if (!Array.isArray(args)) throw new Galat('args harus berupa daftar.');
  await cekPewaris(p);
  const baku = FUNGSI_RELAY[fungsi]();
  const batas = typeof gas === 'bigint' && gas > 0n && gas <= baku * 2n ? gas : baku;
  const hasil = await kirim(induk, { address: p, abi: pusakaWalletAbi, functionName: fungsi, args, gas: batas });
  return { ok: true, ...hasil };
}

/* Isi tIDR dompet pewaris sampai Rp300 jt (setelah demo "bayar", supaya angka contoh tetap sama). */
async function aksiFaucet({ pewaris } = {}) {
  const { pub, induk, ALAMAT } = muat();
  const p = alamat(pewaris, 'pewaris');
  await cekPewaris(p);
  const sisa = await saldoToken(p);
  if (sisa >= RP300) return { ok: true, tx: [] };
  batasi(1);
  return antre(induk, async () => {
    const tx = await dompet(induk).writeContract({ address: ALAMAT.token, abi: mockIDRAbi, functionName: 'faucet', args: [p, RP300 - sisa], gas: GAS.faucet });
    const r = await pub.waitForTransactionReceipt({ hash: tx, timeout: 40_000 });
    catatBlokInduk(induk, r);
    if (r.status !== 'success') throw new Galat('Isi tIDR gagal dijalankan di blockchain.', 'GagalDiChain');
    return { ok: true, tx: [tx] };
  });
}

/* Isi gas satu amplop sampai GAS_AMPLOP penuh, sebelum ahli waris mencairkan. Hanya amplop yang berisi tIDR. */
async function aksiAmplop({ alamat: alamatAmplop } = {}) {
  const { pub, induk, GAS_AMPLOP } = muat();
  const a = alamat(alamatAmplop, 'alamat');
  const [jumlah, gas] = await Promise.all([saldoToken(a), pub.getBalance({ address: a })]);
  if (jumlah === 0n) throw new Galat('Amplop ini sudah kosong.', 'AmplopKosong');
  // Di Monad biaya dihitung dari batas gas, jadi amplop diisi sampai penuh sebelum mencairkan.
  const target = parseEther(String(GAS_AMPLOP));
  if (gas >= (target * 9n) / 10n) return { ok: true, tx: [] };
  batasi(1);
  return antre(induk, async () => ({ ok: true, tx: [await kirimMON(a, target - gas)] }));
}

/* ---------- operator mitra pencairan (simulasi bank) ----------
   1. Rekening virtual yang berisi disapu ke mitra (sapuBanyak).
   2. Pencairan yang diproses "ditransfer lewat BI-FAST" ±1,4 detik, lalu dicatat selesai dengan nomor referensi. */
let operatorSibuk = false, operatorSiap = null;
const sudahDiproses = new Map(); // no → waktu mulai "transfer bank"
async function aksiMitra() {
  const { operator, ALAMAT, chain } = muat();
  if (operatorSibuk) return { ok: true, tx: [], sibuk: true };
  operatorSibuk = true;
  try {
    if (operatorSiap === null) operatorSiap = await bacaMitra('isOperator', [operator.address]);
    if (!operatorSiap) { operatorSiap = null; return { ok: true, tx: [], siap: false }; }
    const n = await bacaMitra('jumlahRekening');
    const [berisi, antreAwal] = await Promise.all([n > 0n ? bacaMitra('vaBerisi', [0n, n]) : Promise.resolve([]), bacaMitra('antrean')]);
    let antreNo = antreAwal;
    const tx = [], hasil = [], catatan = [];
    if (berisi.length) {
      const ids = berisi.slice(0, 20);
      const h = await kirim(operator, { address: ALAMAT.mitra, abi: mitraCairAbi, functionName: 'sapuBanyak', args: [ids], gas: GAS.sapuPer * BigInt(ids.length) + 80_000n });
      tx.push(h.tx); hasil.push(h); catatan.push({ jenis: 'sapu', teks: `${ids.length} rekening virtual disapu ke mitra`, tx: h.tx });
      antreNo = await bacaMitra('antrean'); // penyapuan membuat pencairan baru: langsung dicatat mulai "diproses bank"
    }
    const sekarang = Date.now();
    antreNo.forEach((no) => { const k = Number(no); if (!sudahDiproses.has(k)) sudahDiproses.set(k, sekarang); });
    const siap = antreNo.filter((no) => sekarang - sudahDiproses.get(Number(no)) >= DELAY_BANK);
    // yang sudah tidak ada di antrean (selesai di tempat lain) dilupakan
    const masih = new Set(antreNo.map(Number));
    [...sudahDiproses.keys()].forEach((k) => { if (!masih.has(k)) sudahDiproses.delete(k); });
    if (siap.length) {
      siap.forEach((no) => sudahDiproses.delete(Number(no)));
      const bukti = siap.map((no) => keccak256(toHex(`BIFAST|${chain.id}|${no}|${sekarang}`)));
      const h = await kirim(operator, {
        address: ALAMAT.mitra, abi: mitraCairAbi, functionName: 'selesaikan', args: [siap, bukti],
        gas: GAS.selesaikanPer * BigInt(siap.length) + 90_000n,
      });
      tx.push(h.tx); hasil.push(h); catatan.push({ jenis: 'selesai', teks: `${siap.length} transfer bank selesai (simulasi BI-FAST)`, tx: h.tx });
    }
    // menunggu: transfer bank yang sudah terlihat tetapi belum waktunya diselesaikan (browser memanggil lagi sebentar lagi)
    return { ok: true, tx, hasil, catatan, menunggu: sudahDiproses.size };
  } catch (e) {
    operatorSiap = null;
    throw e;
  } finally {
    operatorSibuk = false;
  }
}

const AKSI = { gas: aksiGas, relay: aksiRelay, faucet: aksiFaucet, amplop: aksiAmplop, mitra: aksiMitra };

/* ---------- pintu masuk ---------- */
/* Nama error dari revert, mis. WrongStatus, TooEarly. */
function namaError(e) {
  const r = e instanceof BaseError && e.walk((x) => x instanceof ContractFunctionRevertedError);
  if (r instanceof ContractFunctionRevertedError) return r.data?.errorName || r.reason || 'revert';
  return null;
}
/* Pesan galat tanpa alamat RPC (bisa memuat kunci API) dan tanpa rincian panjang dari viem. */
function pesanAman(e) {
  const m = ((e && (e.shortMessage || e.message)) || String(e)).split('\n')[0];
  return m.replace(/https?:\/\/\S+/g, '[url]');
}
function galatDari(e) {
  if (e instanceof Galat) return { ok: false, pesan: e.message, kode: e.kode };
  const nama = namaError(e);
  if (nama) return { ok: false, pesan: `Ditolak kontrak: ${nama}`, kode: nama };
  const lengkap = `${e?.shortMessage || ''} ${e?.message || ''}`;
  if (/insufficient funds|insufficient balance|exceeds the balance/i.test(lengkap)) {
    return { ok: false, pesan: 'Saldo MON dompet induk di server tidak cukup untuk gas.', kode: 'SaldoRelayer' };
  }
  console.error('[relayer]', e);
  return { ok: false, pesan: pesanAman(e), kode: 'Galat' };
}

/* permintaan: { aksi, ...isi } → { ok: true, ... } atau { ok: false, pesan, kode }. Tidak pernah melempar. */
export async function tangani(permintaan) {
  try {
    if (!permintaan || typeof permintaan !== 'object' || typeof permintaan.aksi !== 'string' || !Object.hasOwn(AKSI, permintaan.aksi)) {
      throw new Galat('aksi tidak dikenal.');
    }
    muat();
    return await AKSI[permintaan.aksi](permintaan);
  } catch (e) {
    return galatDari(e);
  }
}

/* Alamat dompet induk dan operator (bukan kuncinya) beserta saldo MON induk. */
export async function info() {
  try {
    const { pub, induk, operator } = muat();
    const saldoInduk = await pub.getBalance({ address: induk.address });
    return { ok: true, induk: induk.address, operator: operator.address, saldoInduk };
  } catch (e) {
    return galatDari(e);
  }
}
