// Deploy semua kontrak ke anvil dari hasil `forge build`, lalu tulis alamatnya ke web/.env.local.
// Untuk Monad testnet tetap pakai `forge script script/Deploy.s.sol` (lihat contracts/README.md).
//
//   node scripts/deploy-lokal.mjs                 # anvil di http://127.0.0.1:8545
//   RPC=http://127.0.0.1:8546 node scripts/deploy-lokal.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createPublicClient, createWalletClient, http, getAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { anvil } from 'viem/chains';

const RPC = process.env.RPC || 'http://127.0.0.1:8545';
const transport = http(RPC);
const pub = createPublicClient({ chain: anvil, transport });
// Akun anvil nomor 0 (kuncinya publik, khusus blockchain lokal). Ia juga dompet induk di web.
const akun = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
const w = createWalletClient({ account: akun, chain: anvil, transport });
const art = (n) => JSON.parse(readFileSync(new URL(`../../contracts/out/${n}.sol/${n}.json`, import.meta.url)));

async function deploy(n, args = []) {
  const a = art(n);
  const hash = await w.deployContract({ abi: a.abi, bytecode: a.bytecode.object, args });
  const r = await pub.waitForTransactionReceipt({ hash });
  if (r.status !== 'success') throw new Error(`deploy ${n} gagal`);
  return getAddress(r.contractAddress);
}

const token = await deploy('MockIDR');
const cetakan = await deploy('PusakaVault');
const factory = await deploy('PusakaFactory', [token, cetakan]);
const wallet = await deploy('PusakaWallet');
const mitra = await deploy('MitraCair', [token, akun.address]);
const baru = { VITE_TOKEN: token, VITE_FACTORY: factory, VITE_WALLET: wallet, VITE_MITRA: mitra };

const file = new URL(`../${process.env.ENV_FILE || '.env.local'}`, import.meta.url);
const lama = existsSync(file) ? readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean) : ['VITE_CHAIN=anvil', 'VITE_GAS_MON=0.2'];
const sisa = lama.filter((l) => !Object.keys(baru).some((k) => l.startsWith(`${k}=`)));
writeFileSync(file, [...sisa, ...Object.entries(baru).map(([k, v]) => `${k}=${v}`)].join('\n') + '\n');
for (const [k, v] of Object.entries(baru)) console.log(`${k}=${v}`);
console.log(`web/${process.env.ENV_FILE || '.env.local'} diperbarui`);
