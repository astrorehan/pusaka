// Uji ujung ke ujung di anvil dengan viem, memakai panggilan yang sama persis dengan web:
//   deploy → pasang aturan + daftarkan rekening bank ahli waris (satu transaksi EIP-7702) → bukti hidup dari
//   aktivitas dompet dan kabar bertanda tangan → saksi menandatangani, relayer mengirim → bagikan → mitra menyapu
//   rekening virtual dan mentransfer ke bank → ahli waris membuka amplop dan mencairkan ke e-wallet.
//
// Terminal 1: anvil --network monad --block-time 1 --mixed-mining --code-size-limit 131072
// Terminal 2 (dari folder web): node scripts/e2e.mjs
import { readFileSync } from 'node:fs';
import {
  createPublicClient, createWalletClient, http, parseEther, formatEther, encodeFunctionData, encodeAbiParameters,
  keccak256, toHex, parseSignature, getAddress,
} from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { anvil } from 'viem/chains';

const RPC = process.env.RPC || 'http://127.0.0.1:8545';
const transport = http(RPC);
const pub = createPublicClient({ chain: anvil, transport });
const dompet = (akun) => createWalletClient({ account: akun, chain: anvil, transport });

const art = (file, nama = file) => JSON.parse(readFileSync(new URL(`../../contracts/out/${file}.sol/${nama}.json`, import.meta.url)));
const A = Object.fromEntries(['MockIDR', 'PusakaVault', 'PusakaFactory', 'PusakaWallet', 'MitraCair'].map((n) => [n, art(n)]));
const abi = (n) => A[n].abi;

// Akun anvil nomor 0: dompet induk demo (pemilik dan operator mitra). Kuncinya publik, khusus blockchain lokal.
const induk = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
const rp = (n) => parseEther(String(n));
let gagal = 0;
const cek = (ok, teks) => { console.log(`   ${ok ? '✓' : '✗'} ${teks}`); if (!ok) gagal++; };

async function tunggu(hash, label) {
  const r = await pub.waitForTransactionReceipt({ hash });
  if (r.status !== 'success') throw new Error(`${label}: transaksi gagal`);
  return r;
}
async function deploy(nama, args = []) {
  const hash = await dompet(induk).deployContract({ abi: abi(nama), bytecode: A[nama].bytecode.object, args });
  return getAddress((await tunggu(hash, `deploy ${nama}`)).contractAddress);
}
const baca = (address, n, functionName, args = []) => pub.readContract({ address, abi: abi(n), functionName, args });
async function tulis(akun, address, n, functionName, args = [], extra = {}) {
  await pub.simulateContract({ account: akun, address, abi: abi(n), functionName, args, ...extra }).catch((e) => {
    if (extra.authorizationList) return;
    const rinci = e.walk ? e.walk((x) => x?.data?.errorName) : null;
    throw new Error(`${functionName} ditolak: ${rinci?.data?.errorName || e.shortMessage || e.message}`);
  });
  const hash = await dompet(akun).writeContract({ address, abi: abi(n), functionName, args, ...extra });
  const r = await tunggu(hash, functionName);
  const k = `${functionName}${extra.authorizationList ? ' (EIP-7702)' : ''}`;
  gasPer[k] = [...(gasPer[k] || []), Number(r.gasUsed)];
  return r;
}
// GAS_LOG=1: ringkasan gas per fungsi di akhir (untuk menyetel batas gas di src/demo.js)
const gasPer = {};
const majukan = async (detik) => { await pub.request({ method: 'evm_increaseTime', params: [detik] }); await pub.request({ method: 'evm_mine', params: [] }); };
const jamBlok = async () => Number((await pub.getBlock()).timestamp);

console.log('1. Deploy kontrak');
const token = await deploy('MockIDR');
const cetakan = await deploy('PusakaVault');
const factory = await deploy('PusakaFactory', [token, cetakan]);
const wallet = await deploy('PusakaWallet');
const mitra = await deploy('MitraCair', [token, induk.address]);
console.log(`   tIDR ${token} · PusakaWallet ${wallet} · MitraCair ${mitra}`);

console.log('2. Kunci demo: pewaris, 3 saksi, dan amplop tiap penerima');
const pewaris = privateKeyToAccount(generatePrivateKey());
const P = pewaris.address;
const saksi = [0, 1, 2].map(() => privateKeyToAccount(generatePrivateKey()));
const PENERIMA = ['istri', 'masjid', 'putra1', 'putra2', 'putri', 'ayah', 'ibu'];
const amplop = Object.fromEntries(PENERIMA.map((id) => [id, privateKeyToAccount(generatePrivateKey())]));
await tunggu(await dompet(induk).sendTransaction({ to: P, value: parseEther('1') }), 'gas pewaris');
await tulis(induk, token, 'MockIDR', 'faucet', [P, rp(300_000_000)]);

// Rekening bank: hanya sidik (hash rincian) yang dikirim; nama bank + 4 digit terakhir untuk tampilan.
const BANK = {
  istri: { bank: 'BSI', nomor: '7140022291', nama: 'Siti Aminah' },
  masjid: { bank: 'BSI', nomor: '7150000412', nama: 'Masjid Al-Ikhlas' },
  ayah: { bank: 'BRI', nomor: '012301007781', nama: 'Harjo Santoso' },
  ibu: { bank: 'BPD DIY', nomor: '001221003310', nama: 'Sri Lestari' },
};
const sidikDari = (b, garam) => keccak256(encodeAbiParameters(
  [{ type: 'string' }, { type: 'string' }, { type: 'string' }, { type: 'string' }, { type: 'bytes32' }],
  ['pusaka-rekening-v1', b.bank, b.nomor, b.nama, garam],
));
const garam = keccak256(toHex(`garam:${P}`));
const idBank = Object.keys(BANK);
const sidik = idBank.map((k) => sidikDari(BANK[k], garam));
const va = await baca(mitra, 'MitraCair', 'alamatVAUntuk', [P, sidik]);
const alamat = Object.fromEntries(PENERIMA.map((id) => [id, amplop[id].address]));
idBank.forEach((k, i) => { alamat[k] = va[i]; });
console.log(`   rekening virtual istri ${va[0]} (BSI ••••2291)`);

console.log('3. Satu transaksi EIP-7702: daftarkan 4 rekening bank + pasang aturan di dompet pewaris');
const heirs = [
  { wallet: alamat.istri, relation: 1 }, { wallet: alamat.putra1, relation: 2 }, { wallet: alamat.putra2, relation: 2 },
  { wallet: alamat.putri, relation: 3 }, { wallet: alamat.ayah, relation: 4 }, { wallet: alamat.ibu, relation: 5 },
];
const bequests = [{ to: alamat.masjid, share: { num: 1n, den: 5n } }];
const cfg = {
  deceasedMale: true, siblings: 0, otherRelatives: false, raddToSpouse: false,
  inactivityPeriod: 365 * 86400, challengePeriod: 20, witnessThreshold: 2, jointProperty: { num: 1n, den: 1n },
};
const calls = [
  {
    to: mitra, value: 0n,
    data: encodeFunctionData({
      abi: abi('MitraCair'), functionName: 'daftarBanyak',
      args: [sidik, idBank.map((k) => BANK[k].bank), idBank.map((k) => BANK[k].nomor.slice(-4)), idBank.map((k) => amplop[k].address)],
    }),
  },
  {
    to: P, value: 0n,
    data: encodeFunctionData({ abi: abi('PusakaWallet'), functionName: 'setup', args: [[token], heirs, saksi.map((s) => s.address), bequests, cfg] }),
  },
];
const otorisasi = await dompet(pewaris).signAuthorization({ contractAddress: wallet, executor: 'self' });
let r = await tulis(pewaris, P, 'PusakaWallet', 'execute', [calls], { authorizationList: [otorisasi], gas: 2_500_000n });
console.log(`   gas terpakai: ${r.gasUsed}`);
const kode = await pub.getCode({ address: P });
cek(kode?.toLowerCase() === ('0xef0100' + wallet.slice(2)).toLowerCase(), `delegasi terpasang (${kode})`);
let s = await baca(P, 'PusakaWallet', 'getSummary');
cek(Number(s.status) === 1, 'status AKTIF');
const rekIstri = await baca(mitra, 'MitraCair', 'statusPenerima', [alamat.istri]);
cek(rekIstri.bank === 'BSI' && rekIstri.akhiran === '2291', `alamat istri adalah rekening virtual ${rekIstri.bank} ••••${rekIstri.akhiran}`);

console.log('4. Bukti hidup tanpa tombol');
await majukan(30 * 86400);
const rina = privateKeyToAccount(generatePrivateKey()).address;
const transfer = encodeFunctionData({ abi: abi('MockIDR'), functionName: 'transfer', args: [rina, rp(1_000_000)] });
r = await tulis(pewaris, P, 'PusakaWallet', 'execute', [[{ to: token, value: 0n, data: transfer }]]);
s = await baca(P, 'PusakaWallet', 'getSummary');
cek(Number(s.lastProofVia) === 3 && Number(s.lastHeartbeat) === Number((await pub.getBlock({ blockNumber: r.blockNumber })).timestamp), `transfer Rp1 jt ke adik = bukti hidup otomatis (gas ${r.gasUsed})`);
await tulis(induk, token, 'MockIDR', 'faucet', [P, rp(1_000_000)]); // harta kembali Rp300 jt agar angkanya sama dengan demo
await majukan(60 * 86400);
const domainPusaka = { name: 'Pusaka', version: '1', chainId: anvil.id, verifyingContract: P };
const kabar = async (waktu) => dompet(pewaris).signTypedData({
  domain: domainPusaka, primaryType: 'KabarHidup',
  types: { KabarHidup: [{ name: 'pesan', type: 'string' }, { name: 'waktu', type: 'uint64' }] },
  message: { pesan: 'Saya masih hidup', waktu: BigInt(waktu) },
});
const waktuKabar = async () => Math.max(await jamBlok(), Number((await baca(P, 'PusakaWallet', 'getSummary')).lastHeartbeat) + 1);
let t = await waktuKabar();
const ttd = await kabar(t);
const gasPewarisSebelum = await pub.getBalance({ address: P });
r = await tulis(induk, P, 'PusakaWallet', 'checkIn', [BigInt(t), ttd]);
s = await baca(P, 'PusakaWallet', 'getSummary');
cek(Number(s.lastProofVia) === 2 && Number(s.lastHeartbeat) === t, `kabar hidup ditandatangani, dikirim relayer (gas ${r.gasUsed})`);
cek((await pub.getBalance({ address: P })) === gasPewarisSebelum, 'pewaris membayar Rp0 untuk kabar hidup');
const ulang = await pub.simulateContract({ account: induk, address: P, abi: abi('PusakaWallet'), functionName: 'checkIn', args: [BigInt(t), ttd] }).then(() => null, (e) => e);
cek(ulang && /StaleCheckIn/.test(ulang.message), 'tanda tangan yang sama tidak bisa dipakai ulang');

console.log('5. Saksi menandatangani konfirmasi wafat, relayer mengirim');
const AKTA = keccak256(toHex('akta-kematian.pdf'));
const konfirmasi = async (i) => {
  const putaran = (await baca(P, 'PusakaWallet', 'getSummary')).round;
  const sig = await dompet(saksi[i]).signTypedData({
    domain: domainPusaka, primaryType: 'KonfirmasiWafat',
    types: { KonfirmasiWafat: [{ name: 'saksi', type: 'address' }, { name: 'bukti', type: 'bytes32' }, { name: 'putaran', type: 'uint256' }] },
    message: { saksi: saksi[i].address, bukti: AKTA, putaran },
  });
  return tulis(induk, P, 'PusakaWallet', 'attestDeathFor', [saksi[i].address, AKTA, sig]);
};
r = await konfirmasi(0);
console.log(`   saksi 1 (gas ${r.gasUsed})`);
await konfirmasi(1);
s = await baca(P, 'PusakaWallet', 'getSummary');
cek(Number(s.status) === 2, 'dua saksi → masa sanggah');
const saldoSaksi = await Promise.all(saksi.map((x) => pub.getBalance({ address: x.address })));
cek(saldoSaksi.every((b) => b === 0n), 'saksi tidak punya gas dan tidak butuh gas');

console.log('6. Pewaris ternyata masih hidup: satu tanda tangan membatalkan');
t = await waktuKabar();
await tulis(induk, P, 'PusakaWallet', 'checkIn', [BigInt(t), await kabar(t)]);
s = await baca(P, 'PusakaWallet', 'getSummary');
cek(Number(s.status) === 1 && Number(s.attestations) === 0, 'kembali AKTIF, konfirmasi saksi hangus');
await konfirmasi(0);
await konfirmasi(2);
cek(Number((await baca(P, 'PusakaWallet', 'getSummary')).status) === 2, 'dikonfirmasi ulang oleh saksi 1 dan 3');

console.log('7. Masa sanggah habis, siapa pun membagikan');
await majukan(21);
r = await tulis(induk, P, 'PusakaWallet', 'finalize');
console.log(`   gas finalize: ${r.gasUsed}`);
const harap = { istri: 165, masjid: 30, putra1: 26, putra2: 26, putri: 13, ayah: 20, ibu: 20 };
for (const id of PENERIMA) {
  const b = await baca(token, 'MockIDR', 'balanceOf', [alamat[id]]);
  cek(b === rp(harap[id] * 1e6), `${id.padEnd(7)} menerima Rp${harap[id]} jt di ${idBank.includes(id) ? 'rekening virtual' : 'amplop'}`);
}

console.log('8. Mitra menyapu rekening virtual lalu mentransfer ke bank (operator = dompet induk)');
const n = await baca(mitra, 'MitraCair', 'jumlahRekening');
const berisi = await baca(mitra, 'MitraCair', 'vaBerisi', [0n, n]);
cek(berisi.length === 4, `${berisi.length} rekening virtual berisi`);
r = await tulis(induk, mitra, 'MitraCair', 'sapuBanyak', [berisi]);
console.log(`   gas sapuBanyak(4): ${r.gasUsed}`);
let antre = await baca(mitra, 'MitraCair', 'antrean');
const bukti = antre.map((no) => keccak256(toHex(`BIFAST-${no}`)));
const supplySebelum = await baca(token, 'MockIDR', 'totalSupply');
r = await tulis(induk, mitra, 'MitraCair', 'selesaikan', [antre, bukti]);
console.log(`   gas selesaikan(4): ${r.gasUsed}`);
const st = await baca(mitra, 'MitraCair', 'statusBanyak', [idBank.map((k) => alamat[k])]);
st.forEach((x, i) => cek(Number(x.pencairan.tahap) === 2 && x.pencairan.jumlah === rp(harap[idBank[i]] * 1e6),
  `${idBank[i].padEnd(7)} Rp${harap[idBank[i]]} jt masuk ${x.bankTujuan} ••••${x.akhiranTujuan}`));
cek(supplySebelum - (await baca(token, 'MockIDR', 'totalSupply')) === rp(235_000_000), 'Rp235 jt tIDR dibakar saat ditukar ke rupiah');

console.log('9. Putra pertama membuka amplop dan mencairkan ke GoPay (gas disponsori)');
const a = amplop.putra1;
await tunggu(await dompet(induk).sendTransaction({ to: a.address, value: parseEther('0.05') }), 'sponsor gas amplop');
const jumlah = await baca(token, 'MockIDR', 'balanceOf', [a.address]);
const deadline = BigInt((await jamBlok()) + 3600);
const nonce = await baca(token, 'MockIDR', 'nonces', [a.address]);
const izin = parseSignature(await dompet(a).signTypedData({
  domain: { name: 'Testnet Rupiah', version: '1', chainId: anvil.id, verifyingContract: token },
  primaryType: 'Permit',
  types: { Permit: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }, { name: 'value', type: 'uint256' }, { name: 'nonce', type: 'uint256' }, { name: 'deadline', type: 'uint256' }] },
  message: { owner: a.address, spender: mitra, value: jumlah, nonce, deadline },
}));
const sidikGopay = sidikDari({ bank: 'GoPay', nomor: '081234568812', nama: 'Andi' }, keccak256(toHex(`garam:${a.address}`)));
r = await tulis(a, mitra, 'MitraCair', 'cairkan', [sidikGopay, 'GoPay', '8812', jumlah, deadline, Number(izin.v), izin.r, izin.s]);
console.log(`   gas cairkan: ${r.gasUsed}`);
antre = await baca(mitra, 'MitraCair', 'antrean');
await tulis(induk, mitra, 'MitraCair', 'selesaikan', [antre, antre.map((no) => keccak256(toHex(`BIFAST-${no}`)))]);
const sA = await baca(mitra, 'MitraCair', 'statusPenerima', [a.address]);
cek(Number(sA.pencairan.tahap) === 2 && sA.bankTujuan === 'GoPay' && sA.saldo === 0n, `Rp${formatEther(sA.pencairan.jumlah) / 1e6} jt masuk ${sA.bankTujuan} ••••${sA.akhiranTujuan}`);

if (process.env.GAS_LOG) {
  console.log('Gas per fungsi (semua panggilan):');
  for (const [k, v] of Object.entries(gasPer)) console.log(`   ${k.padEnd(28)} ${v.join(', ')}`);
}
console.log(gagal ? `GAGAL (${gagal})` : 'LULUS');
process.exit(gagal ? 1 : 0);
