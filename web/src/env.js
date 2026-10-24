/* Konfigurasi publik untuk browser. Hanya nama di bawah yang dibaca (bukan seluruh import.meta.env), supaya variabel
   lain di berkas .env, mis. VITE_INDUK_KEY lama, tidak ikut tertanam di hasil build. Kunci dompet induk ada di server
   (relayer/), bukan di sini. Aplikasi Next.js menggantinya dengan env.js miliknya sendiri. */
export const env = {
  VITE_CHAIN: import.meta.env.VITE_CHAIN,
  VITE_RPC: import.meta.env.VITE_RPC,
  VITE_TOKEN: import.meta.env.VITE_TOKEN,
  VITE_FACTORY: import.meta.env.VITE_FACTORY,
  VITE_WALLET: import.meta.env.VITE_WALLET,
  VITE_MITRA: import.meta.env.VITE_MITRA,
  VITE_GAS_MON: import.meta.env.VITE_GAS_MON,
  VITE_GAS_AMPLOP: import.meta.env.VITE_GAS_AMPLOP,
  VITE_PUBLIC_URL: import.meta.env.VITE_PUBLIC_URL,
  // Alamat relayer. Kosong = /api/induk di situs yang sama. Isi bila situs statis (GitHub Pages) memakai relayer di Vercel.
  VITE_RELAYER_URL: import.meta.env.VITE_RELAYER_URL,
};
