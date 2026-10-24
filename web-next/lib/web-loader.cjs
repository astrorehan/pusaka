/* Loader untuk berkas di web/ yang dipakai bersama dengan versi Vite.
   - web/src/env.js diganti dengan lib/env.js (nilai dari NEXT_PUBLIC_*).
   - Sisa pemakaian import.meta.env (jika masih ada) diarahkan ke objek yang sama. */
const path = require('node:path');

const garis = (s) => s.split(path.sep).join('/');

module.exports = function webLoader(source) {
  const env = garis(path.join(__dirname, 'env.js'));
  const berkas = garis(this.resourcePath);
  if (/\/web\/src\/env\.js$/.test(berkas)) return `export { env } from ${JSON.stringify(env)};\n`;
  if (!source.includes('import.meta.env')) return source;
  return `import { env as __pusakaEnv } from ${JSON.stringify(env)};\n` + source.split('import.meta.env').join('__pusakaEnv');
};
