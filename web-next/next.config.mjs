import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const akar = path.resolve(dir, '..');
const web = path.join(akar, 'web');

const HALAMAN = ['pewaris', 'saksi', 'waris', 'panggung', 'kalkulator', 'hp', 'mitra', 'kabar'];

/* Di mesin lokal, alamat kontrak hasil `node scripts/deploy-lokal.mjs` ada di web/.env.local (nama VITE_*).
   Dipakai sebagai cadangan bila NEXT_PUBLIC_* / variabel server belum diisi, jadi alur anvil tetap satu perintah.
   Di Vercel berkas itu tidak ada. Kunci pribadi tidak pernah dipetakan ke NEXT_PUBLIC_*. */
function bacaEnvWeb() {
  if (process.env.VERCEL) return {};
  const berkas = path.join(web, process.env.WEB_ENV_FILE || '.env.local');
  if (!fs.existsSync(berkas)) return {};
  const hasil = {};
  for (const baris of fs.readFileSync(berkas, 'utf8').split(/\r?\n/)) {
    const m = baris.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) hasil[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return hasil;
}
const dw = bacaEnvWeb();
const pakai = (...nilai) => nilai.find((v) => v !== undefined && v !== '');

const chainId = pakai(process.env.CHAIN_ID);
const chain = pakai(process.env.NEXT_PUBLIC_CHAIN, chainId && (String(chainId) === '31337' ? 'anvil' : 'monad'), dw.VITE_CHAIN);

/* Variabel publik (alamat dan pengaturan, tidak ada rahasia). Boleh diisi lewat NEXT_PUBLIC_* atau diturunkan dari
   variabel server yang sama (TOKEN, WALLET, MITRA) supaya di Vercel cukup mengisi satu set. */
const publik = {
  NEXT_PUBLIC_CHAIN: chain,
  NEXT_PUBLIC_RPC: pakai(process.env.NEXT_PUBLIC_RPC, dw.VITE_RPC),
  NEXT_PUBLIC_TOKEN: pakai(process.env.NEXT_PUBLIC_TOKEN, process.env.TOKEN, dw.VITE_TOKEN),
  NEXT_PUBLIC_FACTORY: pakai(process.env.NEXT_PUBLIC_FACTORY, process.env.FACTORY, dw.VITE_FACTORY),
  NEXT_PUBLIC_WALLET: pakai(process.env.NEXT_PUBLIC_WALLET, process.env.WALLET, dw.VITE_WALLET),
  NEXT_PUBLIC_MITRA: pakai(process.env.NEXT_PUBLIC_MITRA, process.env.MITRA, dw.VITE_MITRA),
  NEXT_PUBLIC_GAS_MON: pakai(process.env.NEXT_PUBLIC_GAS_MON, process.env.GAS_MON, dw.VITE_GAS_MON),
  NEXT_PUBLIC_GAS_AMPLOP: pakai(process.env.NEXT_PUBLIC_GAS_AMPLOP, process.env.GAS_AMPLOP, dw.VITE_GAS_AMPLOP),
  NEXT_PUBLIC_PUBLIC_URL: pakai(process.env.NEXT_PUBLIC_PUBLIC_URL, dw.VITE_PUBLIC_URL),
  NEXT_PUBLIC_RELAYER_URL: pakai(process.env.NEXT_PUBLIC_RELAYER_URL, dw.VITE_RELAYER_URL),
};
for (const k of Object.keys(publik)) if (publik[k] === undefined) delete publik[k];

/* Server (route /api/induk): isi variabel yang kosong dari web/.env.local (hanya lokal). */
const server = {
  RPC_URL: process.env.RPC_URL || dw.VITE_RPC || (dw.VITE_CHAIN !== 'monad' ? dw.ANVIL_URL || 'http://127.0.0.1:8545' : undefined),
  TOKEN: dw.VITE_TOKEN, WALLET: dw.VITE_WALLET, MITRA: dw.VITE_MITRA, GAS_MON: dw.VITE_GAS_MON, GAS_AMPLOP: dw.VITE_GAS_AMPLOP,
  CHAIN_ID: dw.VITE_CHAIN ? (dw.VITE_CHAIN === 'monad' ? '10143' : '31337') : undefined,
  INDUK_KEY: dw.VITE_INDUK_KEY,
};
for (const [k, v] of Object.entries(server)) if (v && !process.env[k]) process.env[k] = v;

const anvil = process.env.ANVIL_URL || dw.ANVIL_URL || 'http://127.0.0.1:8545';

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: false,
  poweredByHeader: false,
  env: publik,
  // kode bersama di ../web/src dan ../relayer dipakai langsung (satu sumber kebenaran)
  experimental: { externalDir: true },
  outputFileTracingRoot: akar,

  /* Alamat utama tanpa .html (/pewaris, /panggung, ...). Alamat lama (*.html, mis. QR atau tautan lama dari
     GitHub Pages) dialihkan ke sana. */
  async rewrites() {
    return {
      beforeFiles: [
        // RPC anvil lewat server yang sama (HP di Wi-Fi yang sama tidak perlu akses langsung ke anvil)
        { source: '/rpc', destination: anvil },
      ],
    };
  },
  async redirects() {
    return [
      { source: '/index.html', destination: '/', permanent: false },
      ...HALAMAN.map((h) => ({ source: `/${h}.html`, destination: `/${h}`, permanent: false })),
    ];
  },

  webpack(cfg) {
    cfg.resolve.alias['@web'] = web;
    // berkas di ../web dan ../relayer mencari viem, gsap, dst. di web-next/node_modules (di Vercel hanya itu yang terpasang)
    cfg.resolve.modules = [path.join(dir, 'node_modules'), ...(cfg.resolve.modules || ['node_modules'])];
    cfg.module.rules.unshift({
      test: /\.js$/,
      include: [path.join(web, 'src'), path.join(web, 'assets')],
      enforce: 'pre',
      use: [{ loader: path.join(dir, 'lib/web-loader.cjs') }],
    });
    return cfg;
  },
};

export default config;
