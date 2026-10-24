/* Pengganti web/src/env.js di Next (di-alias oleh next.config.mjs). Nama kunci sama dengan Vite (VITE_*),
   nilainya dari NEXT_PUBLIC_*. Harus ditulis literal satu per satu: Next hanya mengganti process.env.NEXT_PUBLIC_X
   yang tertulis utuh. Kunci pribadi (dompet induk) TIDAK ada di sini: hanya ada di server (/api/induk). */
export const env = {
  VITE_CHAIN: process.env.NEXT_PUBLIC_CHAIN,
  VITE_RPC: process.env.NEXT_PUBLIC_RPC,
  VITE_TOKEN: process.env.NEXT_PUBLIC_TOKEN,
  VITE_FACTORY: process.env.NEXT_PUBLIC_FACTORY,
  VITE_WALLET: process.env.NEXT_PUBLIC_WALLET,
  VITE_MITRA: process.env.NEXT_PUBLIC_MITRA,
  VITE_GAS_MON: process.env.NEXT_PUBLIC_GAS_MON,
  VITE_GAS_AMPLOP: process.env.NEXT_PUBLIC_GAS_AMPLOP,
  VITE_PUBLIC_URL: process.env.NEXT_PUBLIC_PUBLIC_URL,
  VITE_RELAYER_URL: process.env.NEXT_PUBLIC_RELAYER_URL,
  MODE: process.env.NODE_ENV,
  DEV: process.env.NODE_ENV !== 'production',
  PROD: process.env.NODE_ENV === 'production',
  BASE_URL: '/',
  SSR: false,
};
