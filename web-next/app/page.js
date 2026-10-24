import Halaman from '@/components/Halaman';
import '@/styles/index.css';

export const metadata = { title: "Pusaka — harta pusaka digital, dibagi sesuai faraid", description: "Warisan kripto dibagi sesuai faraid (KHI) di Monad. Aturan dipasang di dompetmu sendiri, bagian ahli waris masuk ke rekening bank tanpa dompet kripto." };
export const viewport = { width: 'device-width', initialScale: 1 };

export default function Page() {
  return (
    <>
      <meta name="theme-color" content="#131b33" />
      <meta property="og:title" content="Pusaka — harta pusaka digital, dibagi sesuai faraid" />
      <meta property="og:description" content="Aturan warisan dipasang di dompetmu sendiri. Ahli waris menerima bagiannya di rekening bank, tanpa dompet kripto. Berjalan di Monad testnet." />
      <meta property="og:type" content="website" />
      <meta property="og:url" content="https://astrorehan.github.io/pusaka/" />
      <meta property="og:image" content="https://astrorehan.github.io/pusaka/og.png" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:image" content="https://astrorehan.github.io/pusaka/og.png" />
    <header className="atas">
      <a className="merek" href="/" aria-label="Pusaka, beranda">
        <span id="logo" />
        <b>
          Pusaka
        </b>
        <span className="aksara" lang="jv">
          ꦥꦸꦱꦏ
        </span>
      </a>
      <nav>
        <a href="/kalkulator">
          Kalkulator faraid
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
      </nav>
    </header>
    <main>
      <section className="pembuka" id="pembuka">
        <h1 className="resap" id="judul">
          Harta pusaka digital, dibagi sesuai faraid.
        </h1>
        <div className="ajak">
          <p className="resap" style={{ "--i": "2" }}>
            Aturan warisan dipasang di dompetmu sendiri. Setelah dua dari tiga saksi mengonfirmasi wafat dan masa sanggah lewat, bagian tiap ahli waris masuk ke rekening banknya, atau ke amplop digital yang dicairkan dari HP. Ahli waris tidak perlu dompet kripto, dan kamu tidak perlu menekan tombol apa pun untuk membuktikan masih hidup.
          </p>
          <div className="tombol resap" style={{ "--i": "3" }}>
            <a className="btn" href="/pewaris" id="mulai">
              Mulai demo
            </a>
            {' '}
            <a className="btn btn--garis" href="/kalkulator">
              Buka kalkulator faraid
            </a>
          </div>
          <p className="bukti-kecil resap" style={{ "--i": "4" }}>
            <a id="tautanKontrak" href="#bukti">
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M8 1.5l1.7 1.2 2.1-.1.6 2 1.7 1.3-.7 2 .7 2-1.7 1.3-.6 2-2.1-.1L8 14.5l-1.7-1.2-2.1.1-.6-2-1.7-1.3.7-2-.7-2 1.7-1.3.6-2 2.1.1z" fill="currentColor" opacity=".25" />
                <path d="M5.2 8.2l1.9 1.9 3.8-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>
                Kontrak terverifikasi di Monad testnet
              </span>
            </a>
            {' '}
            <a href="https://github.com/astrorehan/pusaka" target="_blank" rel="noopener">
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M5.5 4.5 2 8l3.5 3.5M10.5 4.5 14 8l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>
                Kode sumber terbuka
              </span>
            </a>
          </p>
        </div>
      </section>
      <section className="contoh-kain" aria-label="Contoh pembagian harta Budi Santoso">
        <p className="narasi" id="narasi">
          Dompet Budi Santoso berisi Rp300 juta.
        </p>
        <div className="panggung" id="panggung">
          <div className="papan" id="papan">
            <div id="kain" />
            <svg className="tali" id="tali" viewBox="0 0 1760 696" aria-hidden="true" />
            <div id="labels" />
          </div>
        </div>
        <div className="legenda" id="legenda" />
      </section>
      <section className="bagian" aria-labelledby="jMasalah">
        <header>
          <h2 id="jMasalah">
            Saat pemilik kunci wafat, hartanya ikut terkunci.
          </h2>
          <p>
            Bank, notaris, dan pengadilan tidak bisa mengatur ulang kunci dompet kripto. Membagikan seed phrase semasa hidup berisiko dicuri, tidak membagikannya berarti hilang.
          </p>
        </header>
        <div className="fakta">
          <div className="angka-besar lembar">
            <b>
              22,69
              <span>
                juta
              </span>
            </b>
            <div>
              <p>
                investor kripto terdaftar di Indonesia, sebagian besar Muslim. Pembagian warisan mereka di Pengadilan Agama merujuk{' '}
                <strong>
                  Kompilasi Hukum Islam
                </strong>
                .
              </p>
              <cite>
                Bisnis.com, 10 Agustus 2026, data per Juni 2026
              </cite>
            </div>
          </div>
          <div className="lembar">
            <h3>
              Belum ada aturannya
            </h3>
            <p>
              Majalah Badan Peradilan Umum MA menyebut pewarisan aset kripto sebagai kekosongan hukum. Hakim bisa mengakui hak waris, tetapi tidak bisa memaksakan eksekusinya.
            </p>
            <cite>
              Dandapala, 3 Agustus 2026
            </cite>
          </div>
          <div className="lembar">
            <h3>
              Dompet pribadi tanpa jalur
            </h3>
            <p>
              Aset di exchange masih bisa diklaim dengan akta kematian. Aset di dompet pribadi dan DeFi tidak punya jalur apa pun.
            </p>
          </div>
        </div>
      </section>
      <section className="cara">
        <header>
          <h2>
            Tiga keadaan kain, tiga keadaan dompet.
          </h2>
          <p>
            Di setiap layar Pusaka, harta digambarkan sebagai sehelai kain batik. Garis lilinnya adalah aturan warisan, dan pewarnanya adalah harta yang sudah sampai ke tangan ahli waris.
          </p>
        </header>
        <ol className="langkah">
          <li>
            <div className="cth" id="cth1" />
            <p className="gloss">
              Garis lilin: aturan sudah terpasang.
            </p>
            <h3>
              Pasang aturan di dompetmu
            </h3>
            <p>
              Satu transaksi EIP-7702 menambahkan aturan warisan ke dompetmu sendiri. Hartanya tidak dipindah dan kuncinya tetap di tanganmu. Setiap transaksimu otomatis tercatat sebagai bukti hidup, dan selama hidup kamu bebas mengubah atau mencabut aturannya.
            </p>
          </li>
          <li>
            <div className="cth" id="cth2" />
            <p className="gloss">
              Rendaman: masa sanggah berjalan.
            </p>
            <h3>
              Dua saksi mengonfirmasi wafat
            </h3>
            <p>
              Kamu memilih tiga saksi. Mereka cukup menandatangani, tanpa biaya. Setelah dua di antaranya mengonfirmasi, masa sanggah dimulai. Jika kamu ternyata masih hidup, satu transaksi apa pun atau satu sentuhan pada pengingat di HP membatalkan semuanya.
            </p>
          </li>
          <li>
            <div className="cth" id="cth3" />
            <p className="gloss">
              Pewarna: bagian sudah diterima.
            </p>
            <h3>
              Bagian dikirim sesuai faraid
            </h3>
            <p>
              Setelah masa sanggah lewat, siapa pun bisa menekan "Bagikan warisan". Kontrak memisahkan harta bersama, menjalankan wasiat, lalu membagi sisanya menurut faraid. Bagian untuk rekening bank ditukar ke rupiah oleh mitra pencairan dan ditransfer lewat BI-FAST. Ahli waris tidak perlu menekan apa pun.
            </p>
          </li>
        </ol>
      </section>
      <section className="batas">
        <h2>
          Lebih baik menolak daripada salah membagi.
        </h2>
        <div>
          <p>
            Pusaka menghitung ahli waris inti menurut KHI: pasangan, anak laki-laki, anak perempuan, ayah, dan ibu, termasuk ʻaul, radd, dan gharrawain. Jika saudara, cucu, atau kakek ikut mewarisi, Pusaka menolak membuat aturan dan menjelaskan alasannya.
          </p>
          <p>
            Penetapan ahli waris tetap bisa lewat Pengadilan Agama. Pusaka menjalankan pembagian yang sudah kamu tetapkan semasa hidup.
          </p>
        </div>
      </section>
      <section className="bagian" aria-labelledby="jHarga">
        <header>
          <h2 id="jHarga">
            Warisannya tidak dipotong.
          </h2>
          <p>
            Kontrak membagi seluruh harta sesuai urutan KHI. Pusaka dibayar dari layanan yang dipakai keluarga dan mitra, tidak dari kematian seseorang.
          </p>
        </header>
        <div>
          <div className="harga panel">
            <div>
              <span className="siapa">
                Untuk pewaris
              </span>
              {' '}
              <b>
                Gratis
              </b>
              <p>
                Memasang aturan, memilih saksi, bukti hidup, dan pembagian. Langganan tahunan opsional untuk pengingat WhatsApp, dokumen penetapan ahli waris, dan banyak jenis aset.
              </p>
            </div>
            <div className="utama">
              <span className="siapa">
                Sumber utama
              </span>
              {' '}
              <b>
                Rp5.000
                <small>
                  per pencairan
                </small>
              </b>
              <p>
                Ditagih saat bagian ditransfer ke rekening atau e-wallet, seperti biaya antarbank. Dibagi dengan mitra pencairan berizin.
              </p>
              <p className="contoh-hitung">
                Keluarga contoh: 5 pencairan,{' '}
                <strong>
                  Rp25.000
                </strong>
                {' '}per warisan
              </p>
            </div>
            <div>
              <span className="siapa">
                Untuk exchange dan dompet
              </span>
              {' '}
              <b>
                Lisensi
              </b>
              <p>
                Biaya integrasi ditambah biaya per pengguna aktif per tahun. Mereka mendapat fitur warisan sesuai faraid, Pusaka mendapat pengguna dengan biaya akuisisi rendah.
              </p>
            </div>
          </div>
          <p className="catatan-harga">
            Potongan persentase dari warisan hanya sah jika disepakati pewaris semasa hidup sebagai upah, dan tetap terdengar seperti untung dari orang meninggal. Biaya pencairan dan lisensi menghindari keduanya.
          </p>
        </div>
      </section>
      <section className="bagian" aria-labelledby="jMonad">
        <header>
          <h2 id="jMonad">
            Hanya masuk akal di Monad.
          </h2>
          <p>
            Empat kemampuan Monad yang membuat warisan on-chain terasa seperti aplikasi biasa bagi keluarga.
          </p>
        </header>
        <ul className="monad">
          <li className="lembar">
            <span className="glif">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="3.5" y="6" width="17" height="13" rx="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <path d="M3.5 10h17" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="16.5" cy="14.5" r="1.4" fill="currentColor" />
                <path d="M8 3.5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </span>
            <h3>
              Aturan di dompet yang sudah ada
            </h3>
            <p>
              EIP-7702 menambahkan aturan warisan ke dompet pewaris. Hartanya tidak dipindah ke brankas, kuncinya tetap di tangannya.
            </p>
          </li>
          <li className="lembar">
            <span className="glif">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M7 10.5a5 5 0 0 1 10 0v2.5M12 10.5v5.5M9.3 13v3.8M14.7 13.5V18M5 13.5c0 3 1 5 2.2 6.5M19 14.5c0 2-.6 3.6-1.4 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </span>
            <h3>
              Sidik jari sebagai bukti hidup
            </h3>
            <p>
              Precompile P-256 memverifikasi passkey langsung di kontrak. Sentuhan sidik jari atau wajah di HP tercatat on-chain, tanpa biaya untuk pewaris.
            </p>
          </li>
          <li className="lembar">
            <span className="glif">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 3.5 20 8v8l-8 4.5L4 16V8z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                <path d="M4 8l8 4.5L20 8M12 12.5v8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
            </span>
            <h3>
              Faraid lengkap di dalam kontrak
            </h3>
            <p>
              ʻAul, radd, dan gharrawain dihitung on-chain. Kontraknya sekitar 28 KB, di atas batas 24 KB Ethereum, dan Monad mengizinkannya.
            </p>
          </li>
          <li className="lembar">
            <span className="glif">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M13 3 5.5 13.5H12L11 21l7.5-10.5H12z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
            </span>
            <h3>
              Final dalam satu-dua detik
            </h3>
            <p>
              Konfirmasi saksi, kabar hidup, dan pembagian selesai sebelum keluarga sempat bertanya apakah sudah masuk.
            </p>
          </li>
        </ul>
      </section>
      <section className="bagian" id="bukti" aria-labelledby="jBukti">
        <header>
          <h2 id="jBukti">
            Semuanya bisa diperiksa.
          </h2>
          <p>
            Kontrak sudah di-deploy di Monad testnet dan kode sumbernya terverifikasi. Setiap tombol di demo mengirim transaksi sungguhan.
          </p>
        </header>
        <div>
          <div className="kontrak panel" id="daftarKontrak" />
          <div className="tautan-bukti">
            <a className="btn btn--garis btn--kecil" href="https://github.com/astrorehan/pusaka" target="_blank" rel="noopener">
              Repo GitHub
            </a>
            {' '}
            <a className="btn btn--garis btn--kecil" href="https://astrorehan.github.io/pusaka/" target="_blank" rel="noopener">
              Demo publik
            </a>
            {' '}
            <a className="btn btn--garis btn--kecil" href="/kalkulator">
              Kalkulator faraid
            </a>
          </div>
        </div>
      </section>
      <section className="bagian" aria-labelledby="jRencana">
        <header>
          <h2 id="jRencana">
            Setelah hari ini.
          </h2>
          <p>
            Urutan kerja dari prototipe testnet sampai dipakai di exchange.
          </p>
        </header>
        <ol className="rencana">
          <li className="lembar">
            <span className="kapan">
              Bulan pertama
            </span>
            <h3>
              Mitra pencairan berizin
            </h3>
            <p>
              Redeem stablecoin rupiah ke BI-FAST, pengingat lewat WhatsApp, dan konfirmasi saksi dengan passkey.
            </p>
          </li>
          <li className="lembar">
            <span className="kapan">
              Bulan kedua dan ketiga
            </span>
            <h3>
              Validasi dengan ahli
            </h3>
            <p>
              Ahli faraid, hakim Pengadilan Agama, dan notaris. Ditambah saudara, kakek-nenek, ahli waris pengganti, serta utang dan biaya jenazah.
            </p>
          </li>
          <li className="lembar">
            <span className="kapan">
              2027
            </span>
            <h3>
              Mainnet dan exchange
            </h3>
            <p>
              Setelah aturan stablecoin OJK terbit: mainnet dengan rupiah digital, tombol warisan di exchange, dan audit keamanan.
            </p>
          </li>
        </ol>
      </section>
      <section className="layar">
        <div>
          <h2>
            Layar demo
          </h2>
          <p>
            Buka di perangkat yang berbeda. Semua layar mengikuti status dompet yang sama.
          </p>
        </div>
        <ul className="daftar-layar" id="daftarLayar" />
      </section>
      <footer className="kaki">
        <div className="merek-kaki">
          <span id="logoKaki" />
          <div>
            <b>
              Pusaka
            </b>
            <span>
              Harta pusaka digital, dibagi sesuai faraid
            </span>
          </div>
        </div>
        <p className="peringatan">
          Prototipe di Monad testnet dengan rupiah mainan (tIDR). Transfer bank disimulasikan. Kunci demo hanya untuk testnet, jangan pernah memakai private key dompet asli. Bukan nasihat hukum atau fatwa.
        </p>
        <span className="t-micro">
          Monad Blitz Jogja Vol. 2
        </span>
      </footer>
    </main>
      <Halaman nama="index" />
    </>
  );
}
