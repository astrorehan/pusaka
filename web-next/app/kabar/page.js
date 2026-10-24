import Halaman from '@/components/Halaman';
import '@/styles/kabar.css';

export const metadata = { title: "HP Budi Santoso — Pusaka" };
export const viewport = { width: 'device-width', initialScale: 1, viewportFit: "cover" };

export default function Page() {
  return (
    <>
      <meta name="theme-color" content="#131b33" />
    <main>
      <header className="atas">
        <a className="merek" href="index.html" aria-label="Pusaka, beranda">
          <span id="logo" />
          <b>
            Pusaka
          </b>
        </a>
        {' '}
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
      </header>
      <section className="sambut" aria-live="polite">
        <p className="sapa" id="sapa" />
        <h1 id="judul" style={{ "--i": "1" }} />
        <p className="lead" id="lead" style={{ "--i": "2" }} />
      </section>
      <p className="catatan-baca lembar" id="catatanBaca" hidden>
        Layar ini hanya memantau. Kunci Pak Budi ada di perangkat pewaris, jadi tombol di sini tidak aktif.
      </p>
      <section className="kartu-aksi lembar siaga" id="kDipicu" hidden aria-labelledby="dpJudul">
        <span className="status" data-s="dipicu">
          <i />
          <span>
            Masa sanggah
          </span>
        </span>
        <h2 id="dpJudul" role="alert" />
        <p className="isi" id="dpIsi" />
        <div className="hitung angka" id="hitung" role="timer" aria-label="Waktu tersisa untuk membatalkan" />
        <p className="ket-hitung">
          Waktu yang tersisa untuk membatalkan.
        </p>
        <button className="btn btn--denyut tahan" id="btnDipicu" type="button" aria-describedby="dpKet" />
        <p className="ket-aksi" id="dpKet" />
        <p className="ket-aksi">
          Membayar sesuatu dari dompet Bapak juga membatalkannya.
        </p>
      </section>
      <section className="kartu-aksi lembar" id="kSaksi" hidden aria-labelledby="skJudul">
        <span className="status" data-s="aktif">
          <i />
          <span>
            Perlu Bapak ketahui
          </span>
        </span>
        <h2 id="skJudul" />
        <p className="isi" id="skIsi" />
        <button className="btn tahan" id="btnSaksi" type="button" aria-describedby="skKet" />
        <p className="ket-aksi" id="skKet" />
      </section>
      <section className="kartu-aksi lembar" id="kIngat" hidden aria-labelledby="ingJudul">
        <span className="status" data-s="aktif">
          <i />
          <span>
            Pengingat dari Pusaka
          </span>
        </span>
        <h2 id="ingJudul">
          Sudah lama dompet Bapak tidak dipakai.
        </h2>
        <p className="isi" id="ingIsi" />
        <button className="btn tahan" id="btnIngat" type="button" aria-describedby="ingKet" />
        <p className="ket-aksi" id="ingKet" />
        <p className="ket-aksi pratinjau" id="ingPratinjau" hidden>
          Pratinjau untuk presentasi. Di testnet jam tidak bisa dipercepat.
        </p>
      </section>
      <section className="kartu-status lembar" id="kartuStatus" aria-label="Status aturan warisan">
        <span className="status" id="chip" data-s="aktif">
          <i />
          <span id="chipT" />
        </span>
        <dl>
          <div id="b1">
            <dt id="b1k" />
            <dd>
              <span className="nilai angka" id="b1v" />
              <span className="ket" id="b1t" />
            </dd>
          </div>
          <div id="b2">
            <dt id="b2k" />
            <dd>
              <span className="nilai angka" id="b2v" />
              <span className="ket" id="b2t" />
            </dd>
          </div>
          <div id="b3">
            <dt id="b3k" />
            <dd>
              <span className="nilai angka" id="b3v" />
              <span className="ket" id="b3t" />
            </dd>
          </div>
        </dl>
      </section>
      <section className="sidik lembar" id="kSidik" hidden aria-labelledby="sjJudul">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden="true">
          <path d="M6.2 5.6A8.4 8.4 0 0 1 20.4 12M3.6 9.4a8.4 8.4 0 0 0-.2 1.9c0 2 .5 3.9 1.4 5.6M8.4 20.2a12 12 0 0 1-2-6.9 5.6 5.6 0 0 1 11.2 0v.6M12 13.3c0 3.3 1 5.4 2.6 7.3M9.2 13.3a2.8 2.8 0 0 1 5.6 0c0 2.3.6 4.1 1.9 5.6M20.3 15.6c-.2 1.3-.6 2.5-1.1 3.6" />
        </svg>
        <h2 id="sjJudul" />
        <p className="isi" id="sjIsi" />
        <button className="btn btn--garis btn--kecil" id="btnSidik" type="button" />
      </section>
      <section className="bayar" id="blokBayar" hidden>
        <button className="btn btn--garis btn--penuh" id="btnBayar" type="button" aria-describedby="ketBayar" />
        <p className="ket-aksi" id="ketBayar">
          Pembayaran biasa dari dompet Bapak. Otomatis dicatat sebagai tanda hidup, tanpa tombol lain.
        </p>
      </section>
      <section className="kabar" id="blokFeed" aria-labelledby="feedJudul">
        <div className="kabar-kepala">
          <h2 id="feedJudul">
            Kabar dari Pusaka
          </h2>
          <span className="t-micro">
            terbaru di atas
          </span>
        </div>
        <ol id="feed" aria-live="polite" aria-relevant="additions" />
        <p className="kosong" id="kosong">
          Belum ada kabar. Pusaka menulis di sini jika ada yang perlu Bapak ketahui.
        </p>
      </section>
      <details className="presentasi" id="presentasi" hidden>
        <summary>
          Untuk presentasi
        </summary>
        <p id="ketMajukan" />
        <button className="btn btn--garis btn--kecil" id="btnMajukan" type="button" />
      </details>
      <p className="peringatan kaki">
        Prototipe di Monad testnet dengan rupiah mainan (tIDR). Pembayaran QRIS di sini disimulasikan. Bukan nasihat hukum atau fatwa.
      </p>
    </main>
      <Halaman nama="kabar" />
    </>
  );
}
