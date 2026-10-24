import Halaman from '@/components/Halaman';
import '@/styles/hp.css';

export const metadata = { title: "Simulasi HP — Pusaka" };
export const viewport = { width: 'device-width', initialScale: 1 };

export default function Page() {
  return (
    <>

    <header>
      <h1>
        Simulasi HP
      </h1>
      <p>
        Empat HP berdampingan: HP pewaris dan HP ahli waris. Pilih peran tiap HP di atas bingkainya; pilihan diingat di browser ini. Statusnya ikut berubah saat kamu memakai panel demo (tab kecil di kiri bawah, atau tombol{' '}
        <kbd>
          `
        </kbd>
        ), layar Saksi, atau layar Panggung yang terbuka di tab lain.
      </p>
    </header>
    <div className="deret" id="deret" />
      <Halaman nama="hp" />
    </>
  );
}
