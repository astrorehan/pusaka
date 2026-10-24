// Salin ABI dari hasil `forge build` ke src/abi.js. Jalankan ulang setelah kontrak berubah.
import { readFileSync, writeFileSync } from 'node:fs';

const ambil = (nama) => JSON.parse(readFileSync(new URL(`../../contracts/out/${nama}.sol/${nama}.json`, import.meta.url))).abi;
const isi = ['PusakaWallet', 'PusakaFactory', 'MockIDR', 'MitraCair']
  .map((n) => `export const ${n[0].toLowerCase() + n.slice(1)}Abi = ${JSON.stringify(ambil(n))};`)
  .join('\n');
writeFileSync(new URL('../src/abi.js', import.meta.url), `// Dibuat oleh scripts/abi.mjs dari contracts/out. Jangan diedit manual.\n${isi}\n`);
console.log('src/abi.js diperbarui');
