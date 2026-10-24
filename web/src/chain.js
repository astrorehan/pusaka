/* Koneksi ke blockchain: klien viem, alamat kontrak, dan kunci demo di browser (pewaris, saksi, amplop).
   Dompet induk dan operator mitra tidak ada di sini: kuncinya di server (relayer/), browser memanggil /api/induk. */
import {
  createPublicClient, createWalletClient, http, fallback, getAddress, keccak256, encodePacked, encodeAbiParameters, concat, toHex,
  getContractAddress,
} from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { anvil, monadTestnet } from 'viem/chains';
import { env } from './env.js';
import { RPC_MONAD } from './rpc.js';

export const LOKAL = (env.VITE_CHAIN || 'anvil') !== 'monad';
export const chain = LOKAL ? anvil : monadTestnet;
export const RPC = env.VITE_RPC || (LOKAL ? `${location.origin}/rpc` : monadTestnet.rpcUrls.default.http[0]);
export const EXPLORER = LOKAL ? null : 'https://testnet.monadvision.com';
// Di testnet: RPC utama + RPC publik lain sebagai cadangan, supaya batas permintaan satu RPC tidak menggagalkan demo.
const transport = LOKAL ? http(RPC, { batch: true, retryCount: 2 })
  : fallback([...new Set([RPC, ...RPC_MONAD])].map((u) => http(u, { retryCount: 1, retryDelay: 250 })));

export const pub = createPublicClient({ chain, transport, pollingInterval: LOKAL ? 250 : 200, batch: { multicall: !LOKAL } });
/* Harga gas di Monad. Bawaan viem memakai harga maksimum ±2× base fee. Monad menolak transaksi jika saldo pengirim di
   bawah batas gas × harga maksimum, jadi dompet kecil (operator, amplop) ditolak walau biaya sebenarnya jauh lebih
   kecil. Base fee Monad hampir tetap, jadi cukup base fee + 15% + tip 2 gwei. Yang dibayar tetap base fee + tip. */
const TIP = 2_000_000_000n;
let biaya = null, biayaT = 0;
async function biayaGas() {
  if (!biaya || Date.now() - biayaT > 5000) {
    const { baseFeePerGas } = await pub.getBlock({ blockTag: 'latest' });
    biaya = { maxFeePerGas: (baseFeePerGas * 115n) / 100n + TIP, maxPriorityFeePerGas: TIP };
    biayaT = Date.now();
  }
  return biaya;
}
export const dompet = (akun) => {
  const w = createWalletClient({ account: akun, chain, transport });
  if (LOKAL) return w;
  return {
    ...w,
    writeContract: async (req) => w.writeContract({ ...(await biayaGas()), ...req }),
    sendTransaction: async (req) => w.sendTransaction({ ...(await biayaGas()), ...req }),
  };
};

const wajib = (nama) => {
  const v = env[nama];
  if (!v) throw new Error(`${nama} belum diisi di web/.env (lihat .env.example)`);
  return getAddress(v);
};
// Factory (model brankas cadangan) tidak dipakai layar demo, jadi boleh kosong atau nol (deploy dengan BRANKAS=false).
const opsional = (nama) => (env[nama] && !/^0x0{40}$/i.test(env[nama]) ? getAddress(env[nama]) : null);
export const ALAMAT = { token: wajib('VITE_TOKEN'), wallet: wajib('VITE_WALLET'), factory: opsional('VITE_FACTORY'), mitra: wajib('VITE_MITRA') };

/* Ambang isi gas di browser; jumlah sebenarnya diatur server (GAS_MON). */
export const GAS_MON = Number(env.VITE_GAS_MON || 0.2);
/* Gas yang disponsori untuk tiap amplop digital, supaya ahli waris bisa mencairkan tanpa pernah membeli MON. */
export const GAS_AMPLOP = Number(env.VITE_GAS_AMPLOP || 0.08);
export const BLOK_MS = LOKAL ? 1000 : 400;

/* Kunci demo pewaris + 3 saksi, dibuat sekali dan disimpan di browser ini. Khusus testnet. */
const KEY = 'pusaka-kunci-v2';
function muatKunci() {
  let k;
  try { k = JSON.parse(localStorage.getItem(KEY)); } catch { k = null; }
  if (!k || !k.pewaris || !Array.isArray(k.saksi) || k.saksi.length !== 3) {
    k = { pewaris: generatePrivateKey(), saksi: [generatePrivateKey(), generatePrivateKey(), generatePrivateKey()] };
    simpanKunci(k);
  }
  return k;
}
function simpanKunci(k) { try { localStorage.setItem(KEY, JSON.stringify(k)); } catch {} }

const kunci = muatKunci();
export const akun = {
  pewaris: privateKeyToAccount(kunci.pewaris),
  saksi: kunci.saksi.map((x) => privateKeyToAccount(x)),
};
/* "Ulang": pewaris baru. Status DIBAGIKAN final, jadi demo berikutnya butuh dompet pewaris lain. */
export function pewarisBaru() {
  kunci.pewaris = generatePrivateKey();
  simpanKunci(kunci);
  akun.pewaris = privateKeyToAccount(kunci.pewaris);
  return akun.pewaris;
}

/* ---------- amplop digital ----------
   Tiap penerima punya kunci amplop sendiri. Di produk, kunci itu dikirim ke ahli waris lewat tautan WhatsApp dan
   baru berguna setelah warisan dibagikan. Di demo semua kunci amplop diturunkan dari satu "benih" milik pewaris, dan
   benih itu ikut di QR Panggung (di bagian # tautan, jadi tidak pernah dikirim ke server), supaya HP penonton bisa
   memerankan siapa pun. */
export const benihDari = (kunciPewaris) => keccak256(concat([kunciPewaris, toHex('pusaka-amplop-v1')]));
export const benihSendiri = () => benihDari(kunci.pewaris);
export const kunciAmplop = (benih, key) => privateKeyToAccount(keccak256(concat([benih, toHex(key)])));

/* ---------- rekening bank ----------
   Hanya sidik (hash rincian rekening + garam) yang dikirim ke kontrak. Nama bank dan 4 digit terakhir ikut tercatat
   untuk tampilan. id rekening = keccak256(pendaftar, sidik); alamat setorannya (rekening virtual) adalah klon
   EIP-1167 yang dibuat MitraCair dengan CREATE2, jadi bisa dihitung di sini tanpa memanggil kontrak. */
export function sidikRekening({ bank, nomor, nama }, garam) {
  return keccak256(encodeAbiParameters(
    [{ type: 'string' }, { type: 'string' }, { type: 'string' }, { type: 'string' }, { type: 'bytes32' }],
    ['pusaka-rekening-v1', bank, String(nomor).replace(/\D/g, ''), nama || '', garam],
  ));
}
export const garamRekening = (pendaftar) => keccak256(toHex(`pusaka-garam:${pendaftar.toLowerCase()}`));
export const idRekening = (pendaftar, sidik) => keccak256(encodeAbiParameters([{ type: 'address' }, { type: 'bytes32' }], [pendaftar, sidik]));
let implRekening = null;
export function aturImplRekening(a) { implRekening = getAddress(a); }
export function alamatVA(id) {
  if (!implRekening) throw new Error('Alamat cetakan rekening virtual belum dibaca dari MitraCair');
  const kode = concat(['0x3d602d80600a3d3981f3363d3d373d3d3d363d73', implRekening, '0x5af43d82803e903d91602b57fd5bf3']);
  return getContractAddress({ opcode: 'CREATE2', from: ALAMAT.mitra, salt: id, bytecode: kode });
}

/* Alamat turunan untuk penerima yang hanya menerima: diturunkan dari alamat pewaris, tanpa kunci. */
export const alamatPenerima = (pewaris, key) =>
  getAddress('0x' + keccak256(encodePacked(['address', 'string'], [pewaris, key])).slice(-40));
