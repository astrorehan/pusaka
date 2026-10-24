import Halaman from '@/components/Halaman';
import '@/styles/saksi.css';

export const metadata = { title: "Saksi — Pusaka" };
export const viewport = { width: 'device-width', initialScale: 1 };

export default function Page() {
  return (
    <>
      <meta name="theme-color" content="#131b33" />
    <header className="atas">
      <div className="konteks">
        <a className="merek" href="index.html" aria-label="Pusaka, beranda">
          <span id="logo" />
          <b>
            Pusaka
          </b>
        </a>
        <i className="garis-v" />
        <span>
          Saksi
        </span>
      </div>
      <div className="kanan" id="kanan">
        <span className="jaringan" id="jaringan">
          <i />
          <span>
            Monad testnet
          </span>
          <span>
            blok{' '}
            <b>
              0
            </b>
          </span>
        </span>
      </div>
    </header>
    <main>
      <div className="judul-halaman">
        <div>
          <span className="status" id="chip" data-s="aktif">
            <i />
            <span id="chipT">
              Aturan aktif
            </span>
          </span>
          <h1 id="judul">
            Konfirmasi wafat Budi Santoso
          </h1>
          <p className="t-lead" id="lead" />
        </div>
        <div className="progres" aria-live="polite">
          <div className="titik" id="titik">
            <i />
            <i />
            <i />
          </div>
          <div className="hitung angka" id="hitung" hidden />
          <p id="progresT" />
        </div>
      </div>
      <div className="akta" id="akta" aria-hidden="true" />
      <div className="kartu-saksi" id="kartu" />
      <section className="lanjut">
        <div>
          <h2>
            Jalur kedua: pewaris tidak aktif
          </h2>
          <p id="tidakAktifT" />
          <button className="btn btn--garis" id="btnPicu" type="button">
            Picu karena tidak aktif
          </button>
        </div>
        <div>
          <h2>
            Pembagian
          </h2>
          <p id="bagiT" />
          <button className="btn" id="btnBagi" type="button">
            Bagikan warisan
          </button>
        </div>
      </section>
    </main>
    <input type="file" id="pilihBerkas" hidden />
    {' '}
      <Halaman nama="saksi" />
    </>
  );
}
