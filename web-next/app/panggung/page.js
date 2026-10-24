import Halaman from '@/components/Halaman';
import '@/styles/panggung.css';

export const metadata = { title: "Panggung — Pusaka" };
export const viewport = { width: 'device-width', initialScale: 1 };

export default function Page() {
  return (
    <>

    <div className="wadah-panggung">
      <div className="artboard" id="ab">
        <header className="pg-atas">
          <a className="merek" href="index.html" aria-label="Pusaka">
            <svg className="logo" viewBox="6.6 6.6 18.8 18.8" aria-hidden="true">
              <path className="logo-k" d="M24.415 7.585A5.2 3.4 -45 0 0 17.061 14.939A5.2 3.4 -45 0 0 24.415 7.585ZM7.585 7.585A5.2 3.4 45 0 1 14.939 14.939A5.2 3.4 45 0 1 7.585 7.585ZM7.585 24.415A5.2 3.4 -45 0 0 14.939 17.061A5.2 3.4 -45 0 0 7.585 24.415ZM24.415 24.415A5.2 3.4 45 0 1 17.061 17.061A5.2 3.4 45 0 1 24.415 24.415Z" />
              <circle className="logo-titik" cx="16" cy="16" r="1.2" />
            </svg>
            {' '}
            <b>
              Pusaka
            </b>
            <span className="aksara" lang="jv">
              ꦥꦸꦱꦏ
            </span>
          </a>
          <div className="blok">
            <i id="blokTitik" />
            <span>
              Monad testnet
            </span>
            <span>
              blok{' '}
              <b id="blok">
                …
              </b>
            </span>
          </div>
        </header>
        <section className="pg-judul">
          <h1 id="judul">
            Harta Budi Santoso
          </h1>
          <p className="narasi" id="narasi">
            Rp300.000.000, seluruhnya harta bersama.
          </p>
        </section>
        <section className="pg-status" aria-live="polite">
          <span className="status" id="chip" data-s="aktif">
            <i />
            <span id="chipT">
              Aktif
            </span>
          </span>
          <div className="hitung angka" id="hitung" aria-label="Sisa masa sanggah" />
          <div className="ket-status">
            <div className="k1" id="ket1">
              Bukti hidup terakhir
            </div>
            <div className="k2" id="ket2" />
          </div>
          <div className="saksi" id="saksi" />
          <div className="ringkas" id="ringkas">
            <div className="r1 angka" id="r1" />
            <div className="r2 angka" id="r2" />
            <div className="r3">
              Transfer bank disimulasikan di testnet
            </div>
          </div>
          <button className="btn btn-bagikan" id="bagikan">
            Bagikan warisan
          </button>
        </section>
        <div className="pg-kain" id="kain" />
        <svg className="pg-tali" id="tali" viewBox="0 0 1920 1080" aria-hidden="true" />
        <div id="labels" />
        <div className="pg-qr" id="qr" hidden>
          <div className="ajak">
            <h2>
              Pindai, lalu pilih peranmu.
            </h2>
            <p className="inti">
              Tanpa aplikasi. Tanpa dompet kripto.
            </p>
            <p>
              Bagianmu masuk ke rekening bank, atau ke amplop digital di HP-mu.
            </p>
            <p className="kecil">
              Enam orang menjadi keluarga Budi Santoso, satu orang menjadi pengurus masjid.
            </p>
          </div>
          <svg className="tali-qr" viewBox="0 0 4 171" preserveAspectRatio="none">
            <line x1="2" y1="0" x2="2" y2="171" stroke="#e9dfc9" strokeOpacity=".6" strokeWidth="1.4" />
          </svg>
          <div className="label-kain tag" id="qrTag">
            <svg className="qr" id="qrSvg" aria-label="Kode QR menuju halaman ahli waris" />
            <div className="t">
              Keluarga Budi Santoso
            </div>
            <div className="u" id="qrHost">
              pusaka.vercel.app/waris
            </div>
          </div>
        </div>
        <footer className="lini" id="lini" />
      </div>
    </div>
      <Halaman nama="panggung" />
    </>
  );
}
