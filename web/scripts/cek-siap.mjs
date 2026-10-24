// Cek kesiapan sebelum demo, hanya membaca (tidak mengirim transaksi):
// jaringan, alamat kontrak, saldo dompet induk, pemilik MitraCair, multicall3, dan perkiraan biaya.
//
//   node scripts/cek-siap.mjs                     # memakai .env.local
//   ENV_FILE=.env.uji.local node scripts/cek-siap.mjs
//   MON_IDR=392 node scripts/cek-siap.mjs         # harga MON untuk perkiraan rupiah
import { readFileSync, existsSync } from 'node:fs';
import { createPublicClient, http, getAddress, formatEther, formatGwei, isAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { anvil, monadTestnet } from 'viem/chains';

const berkas = new URL(`../${process.env.ENV_FILE || '.env.local'}`, import.meta.url);
if (!existsSync(berkas)) { console.error(`Tidak ada ${berkas.pathname}`); process.exit(1); }
const env = Object.fromEntries(readFileSync(berkas, 'utf8').split(/\r?\n/)
  .filter((l) => /^\s*[A-Z_]+=/.test(l)).map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));

const LOKAL = (env.VITE_CHAIN || 'anvil') !== 'monad';
const chain = LOKAL ? anvil : monadTestnet;
const RPC = env.VITE_RPC || (LOKAL ? (env.ANVIL_URL || 'http://127.0.0.1:8545') : monadTestnet.rpcUrls.default.http[0]);
const pub = createPublicClient({ chain, transport: http(RPC, { retryCount: 1 }) });
const MON_IDR = Number(process.env.MON_IDR || 392);

let gagal = 0, peringatan = 0;
const ok = (teks) => console.log(`  ✓ ${teks}`);
const salah = (teks) => { console.log(`  ✗ ${teks}`); gagal++; };
const awas = (teks) => { console.log(`  ! ${teks}`); peringatan++; };

const ABI = {
  mitra: [
    { type: 'function', name: 'pemilik', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
    { type: 'function', name: 'token', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
    { type: 'function', name: 'rekeningImpl', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
    { type: 'function', name: 'isOperator', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'bool' }] },
  ],
  token: [
    { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
    { type: 'function', name: 'name', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  ],
};

console.log(`Jaringan: ${LOKAL ? 'anvil (lokal)' : 'Monad testnet'} · RPC ${RPC}`);
try {
  const id = await pub.getChainId();
  if (id === chain.id) ok(`chain id ${id}`); else salah(`chain id ${id}, seharusnya ${chain.id}`);
  const t0 = performance.now();
  const b = await pub.getBlock();
  ok(`blok ${b.number} (${Math.round(performance.now() - t0)} ms), base fee ${formatGwei(b.baseFeePerGas || 0n)} gwei`);
} catch (e) {
  salah(`RPC tidak bisa dihubungi: ${e.shortMessage || e.message}`);
  process.exit(1);
}

console.log('Kontrak');
const alamat = {};
for (const k of ['VITE_TOKEN', 'VITE_FACTORY', 'VITE_WALLET', 'VITE_MITRA']) {
  const v = env[k];
  if (k === 'VITE_FACTORY' && (!v || /^0x0{40}$/i.test(v))) { ok('VITE_FACTORY kosong (brankas cadangan tidak di-deploy; layar demo tidak memakainya)'); continue; }
  if (!v || !isAddress(v)) { salah(`${k} belum diisi`); continue; }
  alamat[k] = getAddress(v);
  const kode = await pub.getCode({ address: alamat[k] });
  if (kode && kode !== '0x') ok(`${k} ${alamat[k]} (${(kode.length - 2) / 2} byte)`); else salah(`${k} ${alamat[k]} tidak berisi kode (deploy ulang?)`);
}
if (alamat.VITE_TOKEN) {
  try { ok(`token: ${await pub.readContract({ address: alamat.VITE_TOKEN, abi: ABI.token, functionName: 'name' })} (${await pub.readContract({ address: alamat.VITE_TOKEN, abi: ABI.token, functionName: 'symbol' })})`); } catch { salah('token tidak terbaca sebagai ERC-20'); }
}
let pemilik = null;
if (alamat.VITE_MITRA) {
  try {
    const [tok, impl, p] = await Promise.all(['token', 'rekeningImpl', 'pemilik'].map((f) => pub.readContract({ address: alamat.VITE_MITRA, abi: ABI.mitra, functionName: f })));
    pemilik = p;
    if (alamat.VITE_TOKEN && tok.toLowerCase() === alamat.VITE_TOKEN.toLowerCase()) ok('MitraCair memakai token yang sama'); else salah(`MitraCair memakai token lain (${tok})`);
    const kodeImpl = await pub.getCode({ address: impl });
    if (kodeImpl && kodeImpl !== '0x') ok(`cetakan rekening virtual ${impl}`); else salah('cetakan rekening virtual tidak ada');
  } catch (e) { salah(`MitraCair tidak terbaca: ${e.shortMessage || e.message}`); }
}

console.log('Dompet induk (relayer, pembagi gas, pemilik MitraCair)');
const KUNCI_ANVIL_0 = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const kunci = env.INDUK_KEY || env.VITE_INDUK_KEY || (LOKAL ? KUNCI_ANVIL_0 : null);
if (!kunci) salah('INDUK_KEY (atau VITE_INDUK_KEY lama) belum diisi');
else {
  const induk = privateKeyToAccount(kunci);
  const saldo = Number(formatEther(await pub.getBalance({ address: induk.address })));
  const butuh = 3;
  if (saldo >= butuh) ok(`${induk.address}: ${saldo.toFixed(3)} MON`);
  else if (saldo > .5) awas(`${induk.address}: ${saldo.toFixed(3)} MON (cukup untuk ±${Math.floor(saldo / .8)} kali demo; sebaiknya ≥ ${butuh} MON)`);
  else salah(`${induk.address}: ${saldo.toFixed(3)} MON, ambil dari faucet dulu`);
  if (pemilik) {
    if (pemilik.toLowerCase() === induk.address.toLowerCase()) ok('dompet induk adalah pemilik MitraCair (operator bisa didaftarkan otomatis)');
    else awas(`pemilik MitraCair ${pemilik} bukan dompet induk: operator harus didaftarkan manual (aturOperator)`);
  }
}

console.log('Fitur jaringan');
const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11';
const kodeMc = await pub.getCode({ address: MULTICALL3 });
if (kodeMc && kodeMc !== '0x') ok('Multicall3 ada (baca kontrak bisa digabung)'); else (LOKAL ? ok('Multicall3 tidak ada di anvil (tidak dipakai di lokal)') : awas('Multicall3 tidak ada'));
{
  // P256VERIFY (EIP-7951) di 0x…0100: tanda tangan P-256 yang sah harus mengembalikan 1. Dipakai untuk passkey nanti,
  // bukan untuk demo, jadi hasilnya hanya informasi.
  const { generateKeyPairSync, createSign, createHash } = await import('node:crypto');
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const pesan = Buffer.from('pusaka');
  const ttd = createSign('SHA256').update(pesan).sign({ key: privateKey, dsaEncoding: 'ieee-p1363' });
  const jwk = publicKey.export({ format: 'jwk' });
  const b = (x) => Buffer.from(x, 'base64url').toString('hex').padStart(64, '0');
  const data = '0x' + createHash('sha256').update(pesan).digest('hex') + ttd.toString('hex') + b(jwk.x) + b(jwk.y);
  try {
    const r = await pub.call({ to: '0x0000000000000000000000000000000000000100', data });
    if (r.data && BigInt(r.data) === 1n) ok('precompile P-256 aktif (passkey bisa diverifikasi murah)');
    else console.log('  - precompile P-256 tidak aktif di jaringan ini (tidak dipakai demo)');
  } catch { console.log('  - precompile P-256 tidak bisa dipanggil (tidak dipakai demo)'); }
}

console.log('Perkiraan biaya (gas dihitung dari batas gas)');
const harga = await pub.getGasPrice();
const rp = (gas) => Number(formatEther(harga * BigInt(gas))) * MON_IDR;
const BATAS = { 'Pasang + 4 rekening': 1_640_000, 'Kabar hidup (relayer)': 80_000, 'Kabar sidik jari (relayer)': 200_000, 'Saksi (relayer)': 150_000, 'Bayar (aktivitas)': 180_000, Bagikan: 600_000, 'Cairkan amplop': 560_000 };
console.log(`  harga gas ${formatGwei(harga)} gwei, MON ≈ Rp${MON_IDR}`);
for (const [n, g] of Object.entries(BATAS)) console.log(`  ${n.padEnd(24)} ${String(g).padStart(9)} gas ≈ Rp${rp(g).toLocaleString('id-ID', { maximumFractionDigits: 2 })}`);

console.log(gagal ? `\nBELUM SIAP: ${gagal} masalah${peringatan ? `, ${peringatan} peringatan` : ''}` : `\nSIAP${peringatan ? ` (${peringatan} peringatan)` : ''}`);
process.exit(gagal ? 1 : 0);
