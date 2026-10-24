// Uji relayer di anvil: semua yang dikerjakan dompet induk dan operator (isi gas, kabar hidup, saksi, bagikan, mitra,
// amplop, faucet) lewat relayer/inti.js, sedangkan pewaris dan saksi hanya menandatangani.
//
//   node scripts/deploy-lokal.mjs            # sekali setiap anvil dinyalakan (menulis alamat ke .env.local)
//   node scripts/e2e-relayer.mjs             # memanggil relayer/inti.js langsung (dalam proses)
//   RELAYER=http://localhost:5180/api/induk node scripts/e2e-relayer.mjs   # lewat dev server (npm run dev) atau URL lain
//
// Variabel: RPC (anvil, bawaan http://127.0.0.1:8545), ENV_FILE (berkas alamat kontrak, bawaan .env.local).
import { readFileSync } from 'node:fs';
import {
  createPublicClient, createWalletClient, http, parseEther, encodeFunctionData, encodeAbiParameters, keccak256, toHex, getAddress,
} from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { anvil } from 'viem/chains';
import { ke, dari } from '../../relayer/serial.js';
import { pusakaWalletAbi, mockIDRAbi, mitraCairAbi } from '../src/abi.js';

const RPC = process.env.RPC || 'http://127.0.0.1:8545';
const transport = http(RPC);
const pub = createPublicClient({ chain: anvil, transport });
const dompet = (akun) => createWalletClient({ account: akun, chain: anvil, transport });

const env = Object.fromEntries(readFileSync(new URL(`../${process.env.ENV_FILE || '.env.local'}`, import.meta.url), 'utf8')
  .split(/\r?\n/).filter((l) => /^\w+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const token = getAddress(env.VITE_TOKEN), wallet = getAddress(env.VITE_WALLET), mitra = getAddress(env.VITE_MITRA);

// Relayer: lewat HTTP bila RELAYER diisi, selain itu langsung memanggil inti.js dengan konfigurasi yang sama.
let tangani, info;
if (process.env.RELAYER) {
  const url = process.env.RELAYER;
  const jawab = async (r) => dari(await r.text());
  info = async () => jawab(await fetch(url));
  tangani = async (isi) => jawab(await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: ke(isi) }));
} else {
  const m = await import('../../relayer/inti.js');
  m.atur({ CHAIN_ID: '31337', RPC_URL: RPC, TOKEN: token, WALLET: wallet, MITRA: mitra });
  ({ tangani, info } = m);
}

const rp = (n) => parseEther(String(n));
let gagal = 0;
const cek = (ok, teks) => { console.log(`   ${ok ? '✓' : '✗'} ${teks}`); if (!ok) gagal++; };
const baca = (address, abi, functionName, args = []) => pub.readContract({ address, abi, functionName, args });
const majukan = async (detik) => { await pub.request({ method: 'evm_increaseTime', params: [detik] }); await pub.request({ method: 'evm_mine', params: [] }); };
const jamBlok = async () => Number((await pub.getBlock()).timestamp);
const tidur = (ms) => new Promise((r) => setTimeout(r, ms));
async function tunggu(hash) { const r = await pub.waitForTransactionReceipt({ hash }); if (r.status !== 'success') throw new Error('transaksi gagal'); return r; }
const ok = (h, teks) => { cek(h.ok === true, `${teks}${h.ok ? '' : ` (${h.kode}: ${h.pesan})`}`); return h; };
const ditolak = (h, kode, teks) => cek(h.ok === false && h.kode === kode, `${teks} → ${h.ok ? 'DITERIMA' : h.kode}`);

console.log('1. Info relayer: alamat saja, tanpa kunci');
const inf = await info();
cek(inf.ok && /^0x[0-9a-fA-F]{40}$/.test(inf.induk) && /^0x[0-9a-fA-F]{40}$/.test(inf.operator) && typeof inf.saldoInduk === 'bigint', `induk ${inf.induk}, operator ${inf.operator}`);
cek(!JSON.stringify(ke(inf)).match(/0x[0-9a-fA-F]{64}/), 'tidak ada nilai 32 byte (kunci) di jawaban info');
cek((await baca(mitra, mitraCairAbi, 'pemilik')).toLowerCase() === inf.induk.toLowerCase(), 'dompet induk adalah pemilik MitraCair');

console.log('2. Validasi');
const pewaris = privateKeyToAccount(generatePrivateKey());
const P = pewaris.address;
const saksi = [0, 1, 2].map(() => privateKeyToAccount(generatePrivateKey()));
ditolak(await tangani({ aksi: 'relay', pewaris: P, fungsi: 'execute', args: [[]] }), 'FungsiDitolak', 'fungsi di luar daftar (execute)');
ditolak(await tangani({ aksi: 'relay', pewaris: P, fungsi: 'finalize', args: [] }), 'BukanPewaris', 'pewaris tanpa delegasi EIP-7702');
ditolak(await tangani({ aksi: 'gas', pewaris: P, amplop: Array.from({ length: 7 }, () => privateKeyToAccount(generatePrivateKey()).address) }), 'Permintaan', '7 amplop (maksimal 6)');
ditolak(await tangani({ aksi: 'gas', pewaris: 'bukan-alamat' }), 'Permintaan', 'alamat tidak valid');
ditolak(await tangani({ aksi: 'curi' }), 'Permintaan', 'aksi tidak dikenal');

console.log('3. Bagikan gas lewat relayer');
const amplopKey = ['putra1', 'putra2', 'putri'].map(() => privateKeyToAccount(generatePrivateKey()));
ok(await tangani({ aksi: 'gas', pewaris: P, amplop: [], tidr: true, hanyaPewaris: true }), 'gas pewaris (hanyaPewaris)');
cek((await pub.getBalance({ address: P })) >= rp(0.1), 'pewaris mendapat MON');
cek((await baca(token, mockIDRAbi, 'balanceOf', [P])) === rp(300_000_000), 'pewaris mendapat tIDR Rp300 jt');
ok(await tangani({ aksi: 'gas', pewaris: P, amplop: amplopKey.map((a) => a.address), tidr: false }), 'gas penuh (operator + amplop)');
cek((await pub.getBalance({ address: inf.operator })) >= rp(0.2), 'operator mendapat MON');
cek(await baca(mitra, mitraCairAbi, 'isOperator', [inf.operator]), 'operator didaftarkan di MitraCair');
cek((await Promise.all(amplopKey.map((a) => pub.getBalance({ address: a.address })))).every((b) => b >= rp(0.04)), 'tiap amplop mendapat MON');
const ulang = await tangani({ aksi: 'gas', pewaris: P, amplop: amplopKey.map((a) => a.address), tidr: false });
cek(ulang.ok && ulang.tx.length === 0, 'diulang: tidak ada yang dikirim lagi');

console.log('4. Pewaris memasang aturan (EIP-7702, bertanda tangan sendiri)');
const PENERIMA = ['istri', 'masjid', 'putra1', 'putra2', 'putri', 'ayah', 'ibu'];
const amplop = Object.fromEntries(PENERIMA.map((id, i) => [id, amplopKey[i - 2] || privateKeyToAccount(generatePrivateKey())]));
const BANK = {
  istri: { bank: 'BSI', nomor: '7140022291', nama: 'Siti Aminah' }, masjid: { bank: 'BSI', nomor: '7150000412', nama: 'Masjid Al-Ikhlas' },
  ayah: { bank: 'BRI', nomor: '012301007781', nama: 'Harjo Santoso' }, ibu: { bank: 'BPD DIY', nomor: '001221003310', nama: 'Sri Lestari' },
};
const sidikDari = (b, garam) => keccak256(encodeAbiParameters(
  [{ type: 'string' }, { type: 'string' }, { type: 'string' }, { type: 'string' }, { type: 'bytes32' }],
  ['pusaka-rekening-v1', b.bank, b.nomor, b.nama, garam]));
const garam = keccak256(toHex(`garam:${P}`));
const idBank = Object.keys(BANK);
const sidik = idBank.map((k) => sidikDari(BANK[k], garam));
const va = await baca(mitra, mitraCairAbi, 'alamatVAUntuk', [P, sidik]);
const alamat = Object.fromEntries(PENERIMA.map((id) => [id, amplop[id].address]));
idBank.forEach((k, i) => { alamat[k] = va[i]; });
const heirs = [
  { wallet: alamat.istri, relation: 1 }, { wallet: alamat.putra1, relation: 2 }, { wallet: alamat.putra2, relation: 2 },
  { wallet: alamat.putri, relation: 3 }, { wallet: alamat.ayah, relation: 4 }, { wallet: alamat.ibu, relation: 5 },
];
const cfg = { deceasedMale: true, siblings: 0, otherRelatives: false, raddToSpouse: false, inactivityPeriod: 365 * 86400, challengePeriod: 20, witnessThreshold: 2, jointProperty: { num: 1n, den: 1n } };
const calls = [
  { to: mitra, value: 0n, data: encodeFunctionData({ abi: mitraCairAbi, functionName: 'daftarBanyak', args: [sidik, idBank.map((k) => BANK[k].bank), idBank.map((k) => BANK[k].nomor.slice(-4)), idBank.map((k) => amplop[k].address)] }) },
  { to: P, value: 0n, data: encodeFunctionData({ abi: pusakaWalletAbi, functionName: 'setup', args: [[token], heirs, saksi.map((s) => s.address), [{ to: alamat.masjid, share: { num: 1n, den: 5n } }], cfg] }) },
];
const otorisasi = await dompet(pewaris).signAuthorization({ contractAddress: wallet, executor: 'self' });
await tunggu(await dompet(pewaris).writeContract({ address: P, abi: pusakaWalletAbi, functionName: 'execute', args: [calls], authorizationList: [otorisasi], gas: 2_500_000n }));
cek(Number((await baca(P, pusakaWalletAbi, 'getSummary')).status) === 1, 'status AKTIF');

console.log('5. Kabar hidup dan saksi: hanya tanda tangan, relayer mengirim');
const domainPusaka = { name: 'Pusaka', version: '1', chainId: anvil.id, verifyingContract: P };
const kabar = (waktu) => dompet(pewaris).signTypedData({
  domain: domainPusaka, primaryType: 'KabarHidup',
  types: { KabarHidup: [{ name: 'pesan', type: 'string' }, { name: 'waktu', type: 'uint64' }] },
  message: { pesan: 'Saya masih hidup', waktu: BigInt(waktu) },
});
const waktuKabar = async () => Math.max(await jamBlok(), Number((await baca(P, pusakaWalletAbi, 'getSummary')).lastHeartbeat) + 1);
let t = await waktuKabar();
const gasSebelum = await pub.getBalance({ address: P });
const kb = ok(await tangani({ aksi: 'relay', pewaris: P, fungsi: 'checkIn', args: [BigInt(t), await kabar(t)], gas: 80_000n }), 'checkIn lewat relayer');
cek(kb.ok && /^0x[0-9a-f]{64}$/.test(kb.tx) && kb.blok > 0 && kb.detik > 0 && kb.gas > 0, `hasil membawa tx, blok ${kb.blok}, detik ${kb.detik?.toFixed(2)}, gas ${kb.gas}`);
cek((await pub.getBalance({ address: P })) === gasSebelum, 'pewaris membayar Rp0');
ditolak(await tangani({ aksi: 'relay', pewaris: P, fungsi: 'checkIn', args: [BigInt(t), await kabar(t)] }), 'StaleCheckIn', 'tanda tangan kabar yang sama dipakai ulang');
const AKTA = keccak256(toHex('akta-kematian.pdf'));
const konfirmasi = async (i) => {
  const putaran = (await baca(P, pusakaWalletAbi, 'getSummary')).round;
  const sig = await dompet(saksi[i]).signTypedData({
    domain: domainPusaka, primaryType: 'KonfirmasiWafat',
    types: { KonfirmasiWafat: [{ name: 'saksi', type: 'address' }, { name: 'bukti', type: 'bytes32' }, { name: 'putaran', type: 'uint256' }] },
    message: { saksi: saksi[i].address, bukti: AKTA, putaran },
  });
  return tangani({ aksi: 'relay', pewaris: P, fungsi: 'attestDeathFor', args: [saksi[i].address, AKTA, sig], gas: 150_000n });
};
ok(await konfirmasi(0), 'saksi 1 lewat relayer');
ok(await konfirmasi(1), 'saksi 2 lewat relayer');
cek(Number((await baca(P, pusakaWalletAbi, 'getSummary')).status) === 2, 'dua saksi → masa sanggah');
ditolak(await tangani({ aksi: 'relay', pewaris: P, fungsi: 'finalize', args: [] }), 'TooEarly', 'finalize sebelum masa sanggah habis');

console.log('6. Bagikan dan mitra bekerja lewat relayer');
await majukan(21);
ok(await tangani({ aksi: 'relay', pewaris: P, fungsi: 'finalize', args: [], gas: 600_000n }), 'finalize lewat relayer');
const harap = { istri: 165, masjid: 30, putra1: 26, putra2: 26, putri: 13, ayah: 20, ibu: 20 };
for (const id of PENERIMA) cek((await baca(token, mockIDRAbi, 'balanceOf', [alamat[id]])) === rp(harap[id] * 1e6), `${id.padEnd(7)} menerima Rp${harap[id]} jt`);
let m = ok(await tangani({ aksi: 'mitra' }), 'mitra putaran 1 (sapu)');
cek(m.catatan?.some((c) => c.jenis === 'sapu'), 'rekening virtual disapu');
let putaran = 0;
cek(m.menunggu === 4, 'empat transfer bank menunggu (simulasi BI-FAST ±1,4 detik)');
while (m.menunggu > 0 && putaran++ < 10) { await tidur(500); m = ok(await tangani({ aksi: 'mitra' }), `mitra putaran ${putaran + 1}${m.menunggu ? ` (masih menunggu ${m.menunggu})` : ' (transfer selesai)'}`); }
const st = await baca(mitra, mitraCairAbi, 'statusBanyak', [idBank.map((k) => alamat[k])]);
st.forEach((x, i) => cek(Number(x.pencairan.tahap) === 2, `${idBank[i].padEnd(7)} Rp${harap[idBank[i]]} jt masuk ${x.bankTujuan} ••••${x.akhiranTujuan}`));

console.log('7. Amplop dan faucet');
const a = amplop.putra1;
// amplop dikuras dulu (MON dikirim ke pewaris), lalu relayer mengisinya lagi
const gasAwal = await pub.getBalance({ address: a.address });
await tunggu(await dompet(a).sendTransaction({ to: P, value: gasAwal - parseEther('0.01'), gas: 60_000n }));
const sisaGas = await pub.getBalance({ address: a.address });
const am = ok(await tangani({ aksi: 'amplop', alamat: a.address }), 'amplop diisi gas');
cek((await pub.getBalance({ address: a.address })) >= rp(0.072), `amplop punya MON lagi (${Number(sisaGas) / 1e18} → ${Number(await pub.getBalance({ address: a.address })) / 1e18})`);
ditolak(await tangani({ aksi: 'amplop', alamat: privateKeyToAccount(generatePrivateKey()).address }), 'AmplopKosong', 'amplop kosong tidak diisi');
const fa = ok(await tangani({ aksi: 'faucet', pewaris: P }), 'faucet tIDR pewaris');
cek((await baca(token, mockIDRAbi, 'balanceOf', [P])) === rp(300_000_000), 'tIDR pewaris kembali Rp300 jt');
ditolak(await tangani({ aksi: 'faucet', pewaris: privateKeyToAccount(generatePrivateKey()).address }), 'BukanPewaris', 'faucet untuk alamat bukan pewaris');

console.log(gagal ? `GAGAL (${gagal})` : 'LULUS');
process.exit(gagal ? 1 : 0);
