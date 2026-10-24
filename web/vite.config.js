import { defineConfig, loadEnv } from 'vite';

const HALAMAN = ['index', 'pewaris', 'saksi', 'waris', 'panggung', 'kalkulator', 'hp', 'mitra', 'kabar'];

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    build: {
      target: 'es2022',
      rollupOptions: { input: Object.fromEntries(HALAMAN.map((h) => [h, `${h}.html`])) },
    },
    server: {
      port: 5180,
      strictPort: true,
      // HP di Wi-Fi yang sama memakai RPC lewat server ini, jadi cukup satu alamat.
      proxy: { '/rpc': { target: env.ANVIL_URL || 'http://127.0.0.1:8545', changeOrigin: true, rewrite: () => '/' } },
    },
  };
});
