'use client';
import { useEffect } from 'react';

/* Menjalankan skrip tiap layar (dulu <script type="module"> di akhir HTML) setelah markup terpasang.
   Hanya di browser: skrip memakai window.Demo, window.gsap, localStorage, dan seterusnya. */
const MUAT = {
  index: () => import('@/lib/halaman/index.js'),
  pewaris: () => import('@/lib/halaman/pewaris.js'),
  saksi: () => import('@/lib/halaman/saksi.js'),
  waris: () => import('@/lib/halaman/waris.js'),
  panggung: () => import('@/lib/halaman/panggung.js'),
  kalkulator: () => import('@/lib/halaman/kalkulator.js'),
  hp: () => import('@/lib/halaman/hp.js'),
  mitra: () => import('@/lib/halaman/mitra.js'),
  kabar: () => import('@/lib/halaman/kabar.js'),
};

export default function Halaman({ nama }) {
  useEffect(() => {
    // dulu: <form onsubmit="return false">
    document.querySelectorAll('form').forEach((f) => f.addEventListener('submit', (e) => e.preventDefault()));
    MUAT[nama]().catch((e) => {
      console.error(e);
      window.PembukaPusaka && window.PembukaPusaka.tutup();
    });
  }, [nama]);
  return null;
}
