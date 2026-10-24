import Halaman from '@/components/Halaman';
import '@/styles/mitra.css';

export const metadata = { title: "Mitra pencairan — Pusaka" };
export const viewport = { width: 'device-width', initialScale: 1 };

export default function Page() {
  return (
    <>
      <meta name="theme-color" content="#131b33" />
    <header className="atas">
      <div className="konteks">
        <a className="merek" href="/" aria-label="Pusaka, beranda">
          <span id="logo" />
          <b>
            Pusaka
          </b>
        </a>
        <i className="garis-v" />
        <span>
          Mitra pencairan
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
      <section className="kepala">
        <div>
          <span className="status" id="chip" data-s="belum">
            <i />
            <span id="chipT">
              Membaca mitra
            </span>
          </span>
          <h1 id="judul">
            Mitra pencairan (simulasi)
          </h1>
          <p className="t-lead" id="lead">
            Di sinilah tIDR menjadi rupiah di rekening. Mitra pencairan berizin menyapu tIDR dari rekening virtual ahli waris, menukarnya dengan rupiah, lalu mentransfernya lewat BI-FAST. Ahli waris tidak melakukan apa pun.
          </p>
          <p className="peringatan">
            Simulasi: transfer bank tidak sungguhan di testnet.
          </p>
        </div>
        <dl className="deret" aria-live="off">
          <div className="stat">
            <dt>
              Rekening virtual
            </dt>
            <dd className="n angka" id="nRek">
              —
            </dd>
            <dd className="sebab">
              Satu per ahli waris yang menerima lewat bank atau e-wallet.
            </dd>
          </div>
          <div className="stat">
            <dt>
              Pencairan
            </dt>
            <dd className="n angka" id="nCair">
              —
            </dd>
            <dd className="sebab">
              Tiap kali tIDR masuk ke mitra untuk ditukar rupiah.
            </dd>
          </div>
          <div className="stat">
            <dt>
              Menunggu
            </dt>
            <dd className="n angka" id="nAntre">
              —
            </dd>
            <dd className="sebab">
              Sedang diproses mitra, biasanya hanya beberapa detik.
            </dd>
          </div>
          <div className="stat">
            <dt>
              Selesai
            </dt>
            <dd className="n angka" id="nSelesai">
              —
            </dd>
            <dd className="sebab">
              Sudah ditransfer dan nomor referensinya tercatat.
            </dd>
          </div>
          <div className="stat">
            <dt>
              Rupiah ditransfer
            </dt>
            <dd className="n angka" id="nRupiah">
              —
            </dd>
            <dd className="sebab">
              Jumlah semua pencairan yang selesai (simulasi).
            </dd>
          </div>
          <div className="stat">
            <dt>
              tIDR beredar
            </dt>
            <dd className="n angka" id="nSuplai">
              —
            </dd>
            <dd className="sebab">
              Berkurang tiap transfer selesai: tIDR dibakar sebagai tanda penukaran.
            </dd>
          </div>
        </dl>
      </section>
      <section className="alur-wrap" aria-labelledby="alurJ">
        <h2 id="alurJ">
          Dari dompet pewaris ke rekening ahli waris
        </h2>
        <p>
          Dua jalur masuk ke mitra yang sama. Titik-titik mengalir saat ada yang sedang diproses.
        </p>
        <div className="alur" role="list">
          <p className="jalur-label jl1">
            <b>
              Jalur 1.
            </b>
            {' '}Rekening bank atau e-wallet: ahli waris tidak melakukan apa pun
          </p>
          <div className="simpul lembar s1" role="listitem">
            <h3>
              Dompet Budi Santoso
            </h3>
            <p>
              Aturan warisan ada di dompetnya. Saat dibagikan, tIDR dikirim ke tiap ahli waris.
            </p>
            <b className="fakta" id="f1" />
          </div>
          <div className="sambung c1" aria-hidden="true">
            <span>
              tIDR
            </span>
          </div>
          <div className="simpul lembar s2" role="listitem">
            <h3>
              Rekening virtual
            </h3>
            <p>
              Satu per ahli waris, didaftarkan di mitra saat aturan dipasang.
            </p>
            <b className="fakta" id="f2" />
          </div>
          <div className="sambung c2" id="c2" aria-hidden="true">
            <span>
              disapu
            </span>
          </div>
          <p className="jalur-label jl2">
            <b>
              Jalur 2.
            </b>
            {' '}Amplop digital: ahli waris memilih tujuannya sendiri
          </p>
          <div className="simpul lembar a1" role="listitem">
            <h3>
              Amplop digital
            </h3>
            <p>
              Tautan WhatsApp. Baru berguna setelah warisan dibagikan.
            </p>
            <b className="fakta">
              Tanpa aplikasi, tanpa dompet
            </b>
          </div>
          <div className="sambung ca" aria-hidden="true">
            <span>
              buka
            </span>
          </div>
          <div className="simpul lembar a2" role="listitem">
            <h3>
              Memilih bank atau e-wallet
            </h3>
            <p>
              Ahli waris mengetik nomor tujuan lalu menandatangani. Pusaka menanggung biaya jaringan.
            </p>
            <b className="fakta">
              Satu tanda tangan di HP-nya
            </b>
          </div>
          <div className="sambung cb" id="cb" aria-hidden="true">
            <span>
              cairkan
            </span>
          </div>
          <div className="simpul lembar inti s3" id="s3" role="listitem">
            <h3>
              Mitra pencairan
            </h3>
            <p>
              Menyapu tIDR dari rekening virtual dan amplop, lalu menukarnya dengan rupiah. Di testnet tIDR dibakar sebagai tanda penukaran.
            </p>
            <b className="fakta" id="f3" />
          </div>
          <div className="sambung c3" id="c3" aria-hidden="true">
            <span>
              tukar
            </span>
          </div>
          <div className="simpul lembar s4" role="listitem">
            <h3>
              Transfer BI-FAST
            </h3>
            <p>
              Rupiah dikirim ke rekening tujuan dengan nomor referensi (buatan di testnet).
            </p>
            <b className="fakta" id="f4" />
          </div>
          <div className="sambung c4" id="c4" aria-hidden="true">
            <span>
              rupiah
            </span>
          </div>
          <div className="simpul lembar s5" role="listitem">
            <h3>
              Rekening ahli waris
            </h3>
            <p>
              Bank atau e-wallet. Di blockchain hanya tercatat nama bank dan empat digit terakhir.
            </p>
            <b className="fakta">
              Tanpa dompet kripto
            </b>
          </div>
        </div>
      </section>
      <section className="bawah">
        <div className="tabel-wrap lembar">
          <div className="tabel-kepala">
            <h2>
              Pencairan terbaru
            </h2>
            <span className="t-micro angka" id="info">
              —
            </span>
          </div>
          <div className="tabel-gulir">
            <table className="tabel" id="tabel" hidden>
              <thead>
                <tr>
                  <th>
                    No
                  </th>
                  <th>
                    Diminta
                  </th>
                  <th>
                    Tujuan
                  </th>
                  <th className="r">
                    Jumlah
                  </th>
                  <th>
                    Tahap
                  </th>
                  <th>
                    Referensi BI-FAST
                  </th>
                  <th>
                    Selesai
                  </th>
                </tr>
              </thead>
              <tbody id="baris" />
            </table>
          </div>
          <p className="kosong" id="kosong">
            Belum ada pencairan. Setelah warisan dibagikan, rekening virtual disapu dan baris pertama muncul di sini.
          </p>
          <p className="tabel-kaki">
            Satu baris adalah seluruh tIDR dari satu rekening virtual atau amplop. Setelah transfer selesai, tIDR itu dibakar dan nomor referensinya tercatat di blockchain.
          </p>
        </div>
        <aside className="operator lembar" aria-labelledby="opJ">
          <h2 id="opJ">
            Operator mitra
          </h2>
          <span className="status" id="opStatus" data-s="belum">
            <i />
            <span id="opT" />
          </span>
          <p className="isi-op" id="opIsi" />
          <ul className="log" id="log" aria-label="Catatan operator" />
          <button className="btn btn--garis btn--penuh" id="proses" type="button">
            Proses sekarang
          </button>
          <p className="peringatan">
            Operator berjalan di laptop presenter. Catatan di atas hanya berisi yang diproses dari tab ini.
          </p>
        </aside>
      </section>
      <section className="catatan">
        <div>
          <h2>
            Yang tercatat di blockchain
          </h2>
          <p>
            Hanya{' '}
            <b>
              nama bank
            </b>
            ,{' '}
            <b>
              empat digit terakhir
            </b>
            , dan{' '}
            <b>
              sidik bergaram
            </b>
            {' '}dari rincian rekening. Nomor lengkap dan nama pemilik rekening tidak ditulis di blockchain. Pencocokan rincian lengkap terjadi di luar blockchain; di testnet tidak ada, karena transfernya disimulasikan.
          </p>
        </div>
        <div>
          <h2>
            Produk nyata dan testnet
          </h2>
          <p>
            Di produk nyata,{' '}
            <b>
              mitra pencairan berizin
            </b>
            {' '}menukar stablecoin rupiah dengan rupiah sungguhan, lalu mentransfernya lewat BI-FAST. Di testnet semuanya simulasi: operator di laptop presenter yang “mentransfer”, tIDR dibakar sebagai tanda penukaran, dan nomor referensi dibuat dari bukti yang dicatat di kontrak.
          </p>
        </div>
      </section>
    </main>
      <Halaman nama="mitra" />
    </>
  );
}
