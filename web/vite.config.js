import { defineConfig, loadEnv } from 'vite';

const HALAMAN = ['index', 'pewaris', 'saksi', 'waris', 'panggung', 'kalkulator', 'hp', 'mitra', 'kabar'];

/* Nama variabel .env web (VITE_*) → nama variabel server relayer (lihat docs/relayer-api.md). Berkas .env.local dan
   .env.<mode>.local yang lama tetap jalan. Hanya dipakai dev server; di Vercel isi variabel server langsung. */
function envServer(e) {
  const monad = e.VITE_CHAIN === 'monad';
  return {
    INDUK_KEY: e.INDUK_KEY || e.VITE_INDUK_KEY || '',
    CHAIN_ID: e.CHAIN_ID || (monad ? '10143' : '31337'),
    RPC_URL: e.RPC_URL || (monad ? e.VITE_RPC : e.ANVIL_URL) || '',
    TOKEN: e.TOKEN || e.VITE_TOKEN,
    WALLET: e.WALLET || e.VITE_WALLET,
    MITRA: e.MITRA || e.VITE_MITRA,
    GAS_MON: e.GAS_MON || e.VITE_GAS_MON,
    GAS_AMPLOP: e.GAS_AMPLOP || e.VITE_GAS_AMPLOP,
    BATAS_JAM: e.BATAS_JAM,
  };
}

/* Dev server ikut melayani /api/induk memakai relayer/ yang sama dengan fungsi Vercel, jadi `npm run dev` tetap satu
   perintah. Kunci induk dibaca dari .env di sisi server saja. */
function relayerDev(env) {
  return {
    name: 'relayer-dev',
    apply: 'serve',
    configureServer(server) {
      let siap = null;
      const muat = () => (siap ||= (async () => {
        const { atur } = await import('../relayer/inti.js');
        atur(envServer(env));
        return (await import('../relayer/http.js')).layani;
      })());
      server.middlewares.use('/api/induk', async (req, res) => {
        try { await (await muat())(req, res); } catch (e) {
          console.error('[relayer]', e);
          res.statusCode = 500;
          res.end(JSON.stringify({ ok: false, pesan: 'Relayer gagal dimuat di dev server.' }));
        }
      });
    },
  };
}

/* Jaga-jaga: build gagal bila kunci privat dompet induk dari berkas .env ikut tertanam di hasil build. */
function tanpaKunci(env) {
  const rahasia = [env.INDUK_KEY, env.VITE_INDUK_KEY]
    .filter((k) => k && /^(0x)?[0-9a-fA-F]{64}$/.test(k.trim()))
    .map((k) => k.trim().replace(/^0x/, '').toLowerCase());
  return {
    name: 'tanpa-kunci-induk',
    apply: 'build',
    generateBundle(_, bundle) {
      for (const [nama, f] of Object.entries(bundle)) {
        const isi = f.type === 'chunk' ? f.code : typeof f.source === 'string' ? f.source : Buffer.from(f.source).toString('latin1');
        if (rahasia.some((k) => isi.toLowerCase().includes(k))) {
          this.error(`Kunci dompet induk ada di hasil build (${nama}). Kunci hanya boleh ada di server (relayer/).`);
        }
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [relayerDev(env), tanpaKunci(env)],
    build: {
      target: 'es2022',
      rollupOptions: { input: Object.fromEntries(HALAMAN.map((h) => [h, `${h}.html`])) },
    },
    server: {
      port: 5180,
      strictPort: true,
      // relayer/serial.js ada di luar folder web/
      fs: { allow: ['..'] },
      // HP di Wi-Fi yang sama memakai RPC lewat server ini, jadi cukup satu alamat.
      proxy: { '/rpc': { target: env.ANVIL_URL || 'http://127.0.0.1:8545', changeOrigin: true, rewrite: () => '/' } },
    },
  };
});
