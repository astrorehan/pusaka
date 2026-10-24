/* Menyiapkan dompet induk terpisah bersaldo kecil untuk situs publik. Kuncinya hanya dipakai server relayer
   (isi INDUK_KEY di Vercel dengan nilai ini); browser tidak pernah memegangnya.
   - Membuat kunci baru di .env.publik.local (salinan .env.monad.local dengan VITE_INDUK_KEY baru), jika belum ada.
   - Dompet induk utama (VITE_INDUK_KEY di .env.monad.local, pemilik MitraCair) mengirim MON ke induk publik
     dan mendaftarkan operator mitra milik induk publik.
   Pakai: node scripts/siapkan-publik.mjs [MON=1.5] [URL=https://…] */
import fs from 'node:fs';
import { createPublicClient, createWalletClient, http, parseEther, formatEther, keccak256, concat, toHex, parseGwei } from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { mitraCairAbi } from '../src/abi.js';

const baca = (f) => Object.fromEntries(fs.readFileSync(f, 'utf8').split(/\r?\n/).filter((l) => /^\w+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const SUMBER = '.env.monad.local';
const TUJUAN = '.env.publik.local';
const MON = process.env.MON || '1.5';
const URL = process.env.URL || 'https://astrorehan.github.io/pusaka';

const utama = baca(SUMBER);
if (!utama.VITE_INDUK_KEY) throw new Error(`VITE_INDUK_KEY kosong di ${SUMBER}`);
const induk = privateKeyToAccount(utama.VITE_INDUK_KEY);

if (!fs.existsSync(TUJUAN)) {
  const isi = fs.readFileSync(SUMBER, 'utf8')
    .replace(/^VITE_INDUK_KEY=.*$/m, `VITE_INDUK_KEY=${generatePrivateKey()}`)
    .replace(/^VITE_PUBLIC_URL=.*$/m, `VITE_PUBLIC_URL=${URL}`)
    .replace(/^# Isi sendiri: private key dompet induk.*$/m, '# Dompet induk PUBLIK (saldo kecil). Kunci ini untuk server relayer (INDUK_KEY di Vercel), bukan untuk browser.');
  fs.writeFileSync(TUJUAN, isi);
  console.log(`dibuat ${TUJUAN}`);
}
const publik = baca(TUJUAN);
const indukPublik = privateKeyToAccount(publik.VITE_INDUK_KEY);
const operator = privateKeyToAccount(keccak256(concat([publik.VITE_INDUK_KEY, toHex('pusaka-mitra-operator-v1')])));

const chain = { id: 10143, name: 'Monad Testnet', nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 }, rpcUrls: { default: { http: [utama.VITE_RPC || 'https://testnet-rpc.monad.xyz'] } } };
const pub = createPublicClient({ chain, transport: http() });
const w = createWalletClient({ account: induk, chain, transport: http() });
const biaya = { maxFeePerGas: parseGwei('120'), maxPriorityFeePerGas: parseGwei('2') };

console.log('induk utama  ', induk.address, formatEther(await pub.getBalance({ address: induk.address })), 'MON');
console.log('induk publik ', indukPublik.address);
console.log('operator     ', operator.address);

const saldo = await pub.getBalance({ address: indukPublik.address });
const target = parseEther(MON);
if (saldo < target) {
  const h = await w.sendTransaction({ to: indukPublik.address, value: target - saldo, gas: 21000n, ...biaya });
  await pub.waitForTransactionReceipt({ hash: h });
  console.log('MON terkirim', formatEther(target - saldo), h);
}
if (!(await pub.readContract({ address: utama.VITE_MITRA, abi: mitraCairAbi, functionName: 'isOperator', args: [operator.address] }))) {
  const h = await w.writeContract({ address: utama.VITE_MITRA, abi: mitraCairAbi, functionName: 'aturOperator', args: [operator.address, true], gas: 80000n, ...biaya });
  await pub.waitForTransactionReceipt({ hash: h });
  console.log('operator terdaftar', h);
}
console.log('saldo induk publik', formatEther(await pub.getBalance({ address: indukPublik.address })), 'MON');
