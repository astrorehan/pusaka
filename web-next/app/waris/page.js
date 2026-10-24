import Halaman from '@/components/Halaman';
import '@/styles/waris.css';

export const metadata = { title: "Bagianmu — Pusaka" };
export const viewport = { width: 'device-width', initialScale: 1, viewportFit: "cover" };

export default function Page() {
  return (
    <>
      <meta name="theme-color" content="#131b33" />
    <main>
      <div className="atas">
        <a className="merek" href="/" aria-label="Pusaka">
          <svg className="logo" viewBox="6.6 6.6 18.8 18.8" aria-hidden="true">
            <path className="logo-k" d="M24.415 7.585A5.2 3.4 -45 0 0 17.061 14.939A5.2 3.4 -45 0 0 24.415 7.585ZM7.585 7.585A5.2 3.4 45 0 1 14.939 14.939A5.2 3.4 45 0 1 7.585 7.585ZM7.585 24.415A5.2 3.4 -45 0 0 14.939 17.061A5.2 3.4 -45 0 0 7.585 24.415ZM24.415 24.415A5.2 3.4 45 0 1 17.061 17.061A5.2 3.4 45 0 1 24.415 24.415Z" />
            <circle className="logo-titik" cx="16" cy="16" r="1.2" />
          </svg>
          {' '}
          <b>
            Pusaka
          </b>
        </a>
        {' '}
        <span className="t-micro">
          Monad testnet
        </span>
      </div>
      <section className="pilih" id="pilih" hidden>
        <h1 className="resap">
          Pilih peranmu.
        </h1>
        <p className="t-lead resap" style={{ "--i": "1" }}>
          Kamu akan melihat bagian orang ini dari harta Budi Santoso, dan bagaimana ia menerimanya.
        </p>
        <div className="daftar" id="daftar" />
      </section>
      <section className="ahli" id="ahli" hidden>
        <p className="sapa resap" id="sapa">
          Kamu menerima warisan sebagai
        </p>
        <h1 className="resap" style={{ "--i": "1" }} id="peran">
          Anak perempuan
        </h1>
        <p className="dari resap" style={{ "--i": "2" }} id="dari">
          dari Budi Santoso
        </p>
        <div className="contoh-wrap">
          <div id="contoh" />
        </div>
        <div className="nominal-blok">
          <div className="lbl" id="lblNom">
            Bagianmu jika dibagikan hari ini
          </div>
          <div className="nominal calon" id="nominal">
            Rp13.000.000
          </div>
          <div className="rinci" id="rinci">
            13/120 dari harta faraid Rp120.000.000
          </div>
          <a className="tx" id="tx" href="#" hidden>
            Lihat transaksinya di MonadVision
          </a>
        </div>
        <div className="cara lembar" id="cara">
          <div className="t-micro">
            Cara menerima
          </div>
          <h2 id="caraJ">
            Ke rekeningmu
          </h2>
          <p className="sub" id="caraSub" hidden />
          <p className="isi" id="caraT" hidden />
          <span className="status" id="caraChip" data-s="belum" hidden>
            <i />
            <span>
              Terkunci sampai warisan dibagikan
            </span>
          </span>
          <ol className="urut" id="urut" role="status" hidden />
          <div id="slotAmplop">
            <form className="cair" id="formCair" noValidate autoComplete="off" hidden>
              <label className="isian">
                <span>
                  Cairkan ke
                </span>
                <select id="fBank" name="bank" />
              </label>
              {' '}
              <label className="isian">
                <span id="fNomorL">
                  Nomor rekening
                </span>
                <input id="fNomor" name="nomor" type="text" inputMode="numeric" autoComplete="off" placeholder="Hanya angka" />
              </label>
              {' '}
              <label className="isian">
                <span>
                  Atas nama
                </span>
                <input id="fNama" name="nama" type="text" autoComplete="off" autoCapitalize="words" placeholder="Nama sesuai rekening" />
              </label>
              <p className="tolak" id="fErr" role="alert" hidden>
                <b id="fErrT" />
              </p>
              <button className="btn tahan" id="fTahan" type="button">
                Tahan untuk mencairkan
              </button>
              <p className="kecil">
                Tanpa biaya. Biaya jaringan ditanggung Pusaka.
              </p>
            </form>
          </div>
          <a className="tx" id="caraLink" href="#" target="_blank" rel="noopener" hidden>
            Lihat di MonadVision
          </a>
          <details className="buka" id="bukaCair" hidden>
            <summary>
              Cairkan ke rekening
            </summary>
            <div>
              <p className="isi">
                Mau rupiah di rekening bank atau e-wallet? Cairkan bagianmu ke sana, tanpa biaya.
              </p>
              <div id="slotKripto" />
            </div>
          </details>
          <p className="kecil" id="caraKaki" hidden />
        </div>
        <div className="kartu lembar" id="kartu">
          <span className="status" id="chip" data-s="aktif">
            <i />
            <span id="chipT">
              Pewaris masih aktif
            </span>
          </span>
          <div className="hitung angka" id="hitung" hidden />
          <div className="jalur" id="jalur" hidden>
            <i id="jalurI" />
          </div>
          <p id="ketKartu">
            Bagian ini dikirim otomatis setelah 2 dari 3 saksi mengonfirmasi wafat dan masa sanggah selesai. Kamu tidak perlu menekan apa pun.
          </p>
        </div>
        <section className="alasan">
          <h2 id="alasanJ">
            Mengapa 13/120?
          </h2>
          <p id="alasanT" />
          <svg className="peta" id="peta" viewBox="-2 -2 354 92" aria-label="Seluruh kain, bagianmu disorot" />
          <div className="rincian" id="rincian" />
        </section>
      </section>
      <p className="peringatan kaki">
        Prototipe di Monad testnet dengan rupiah mainan (tIDR). Transfer bank disimulasikan. Bukan nasihat hukum atau fatwa.
      </p>
    </main>
      <Halaman nama="waris" />
    </>
  );
}
