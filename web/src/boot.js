/* Dimuat pertama oleh setiap layar. Urutan impor penting: gsap → data → kain → status kontrak → helper UI. */
import './globals.js';
import '../assets/data.js';
import '../assets/kain.js';
import { siapkan } from './demo.js';
import '../assets/ui.js';

await siapkan();

/* Teks contoh di markup diganti data asli: alamat pewaris, alamat PusakaWallet, nama jaringan. */
const GANTI = [
  ['0x8b2c…5de2', Pusaka.pewaris.alamat],
  ['0x5b1e…a3f0', Demo.pendek(Demo.alamat.wallet)],
  ['Prototipe di Monad testnet', Demo.LOKAL ? 'Demo di blockchain lokal (anvil)' : 'Demo di Monad testnet'],
  ...(Demo.LOKAL ? [['Monad testnet', 'Anvil lokal']] : []),
];
const jalan = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
for (let n = jalan.nextNode(); n; n = jalan.nextNode()) {
  let v = n.nodeValue, ubah = false;
  for (const [a, b] of GANTI) if (v.includes(a)) { v = v.split(a).join(b); ubah = true; }
  if (ubah) n.nodeValue = v;
}
