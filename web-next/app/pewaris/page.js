import Halaman from '@/components/Halaman';
import '@/styles/pewaris.css';

export const metadata = { title: "Pewaris — Pusaka" };
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
          Pewaris
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
      <section id="vPasang" hidden>
        <div className="judul-halaman">
          <h1 className="resap">
            Pasang aturan warisan di dompetmu
          </h1>
          <p className="t-lead resap" style={{ "--i": "1" }}>
            Dompet{' '}
            <b>
              0x8b2c…5de2
            </b>
            {' '}berisi{' '}
            <b>
              Rp300.000.000 tIDR
            </b>
            . Aturan dipasang dengan satu tanda tangan, jadi hartanya tetap di dompet ini. Ahli waris tidak perlu punya dompet, dan kamu tidak perlu menekan tombol apa pun.
          </p>
        </div>
        <div className="dua-kolom">
          <form className="formulir" id="form" noValidate>
            <fieldset className="klausul">
              <legend>
                Pewaris
              </legend>
              <div className="isi-k">
                <div className="baris">
                  <span>
                    Nama
                  </span>
                  <b>
                    Budi Santoso
                  </b>
                </div>
                <div className="baris tumpuk">
                  <span>
                    Jenis kelamin
                  </span>
                  <div className="segmen" role="radiogroup" aria-label="Jenis kelamin pewaris">
                    <label>
                      <input type="radio" name="kelamin" defaultValue="laki" defaultChecked />
                      <span>
                        Laki-laki
                      </span>
                    </label>
                    {' '}
                    <label>
                      <input type="radio" name="kelamin" defaultValue="perempuan" />
                      <span>
                        Perempuan
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </fieldset>
            <fieldset className="klausul">
              <legend>
                Keluarga yang ditinggalkan
              </legend>
              <div className="isi-k">
                <div className="baris" id="rIstri">
                  <span>
                    Istri
                  </span>
                  <div className="stepper" data-k="istri" data-min="0" data-max="4" />
                </div>
                <div className="baris" id="rSuami" hidden>
                  <span>
                    Suami
                  </span>
                  <label className="saklar">
                    <input type="checkbox" data-k="suami" aria-label="Suami" />
                  </label>
                </div>
                <div className="baris">
                  <span>
                    Anak laki-laki
                  </span>
                  <div className="stepper" data-k="putra" data-min="0" data-max="9" />
                </div>
                <div className="baris">
                  <span>
                    Anak perempuan
                  </span>
                  <div className="stepper" data-k="putri" data-min="0" data-max="9" />
                </div>
                <div className="baris">
                  <span>
                    Ayah
                  </span>
                  <label className="saklar">
                    <input type="checkbox" data-k="ayah" aria-label="Ayah" />
                  </label>
                </div>
                <div className="baris">
                  <span>
                    Ibu
                  </span>
                  <label className="saklar">
                    <input type="checkbox" data-k="ibu" aria-label="Ibu" />
                  </label>
                </div>
                <div className="baris">
                  <span>
                    Saudara kandung yang masih hidup
                    <small>
                      Tidak ikut mewarisi jika ada anak laki-laki atau ayah, tetapi dua saudara atau lebih mengurangi bagian ibu.
                    </small>
                  </span>
                  <div className="stepper" data-k="saudara" data-min="0" data-max="9" />
                </div>
                <div className="baris">
                  <span>
                    Ada kerabat lain yang mungkin mewarisi
                    <small>
                      Misalnya cucu, kakek, atau nenek.
                    </small>
                  </span>
                  <label className="saklar">
                    <input type="checkbox" data-k="kerabatLain" aria-label="Ada kerabat lain" />
                  </label>
                </div>
              </div>
            </fieldset>
            <fieldset className="klausul">
              <legend>
                Harta bersama
              </legend>
              <div className="isi-k">
                <p className="ket">
                  Bagian harta di dompet ini yang diperoleh bersama pasangan selama menikah. Separuhnya milik pasangan dan dipisahkan sebelum faraid (KHI Pasal 96).
                </p>
                <div className="baris tumpuk">
                  <span id="lblBersama">
                    Porsi harta bersama
                  </span>
                  <div className="segmen" role="radiogroup" aria-label="Porsi harta bersama" id="segBersama">
                    <label>
                      <input type="radio" name="bersama" defaultValue="tidak" />
                      <span>
                        Tidak ada
                      </span>
                    </label>
                    {' '}
                    <label>
                      <input type="radio" name="bersama" defaultValue="separuh" />
                      <span>
                        Separuh
                      </span>
                    </label>
                    {' '}
                    <label>
                      <input type="radio" name="bersama" defaultValue="seluruh" defaultChecked />
                      <span>
                        Seluruhnya
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </fieldset>
            <fieldset className="klausul">
              <legend>
                Wasiat
              </legend>
              <div className="isi-k">
                <p className="ket">
                  Untuk yang bukan ahli waris, misalnya wakaf. Paling banyak tiga penerima dan sepertiga harta warisan (KHI Pasal 195).
                </p>
                <div id="daftarWasiat" />
                <button type="button" className="btn btn--teks" id="tambahWasiat">
                  Tambah penerima wasiat
                </button>
              </div>
            </fieldset>
            <fieldset className="klausul" id="fsTerima">
              <legend>
                Cara menerima
              </legend>
              <div className="isi-k">
                <p className="ket">
                  Ahli waris tidak perlu punya dompet kripto. Pilih bagaimana tiap orang menerima bagiannya.
                </p>
                <ul className="legenda">
                  <li>
                    <b>
                      Rekening bank.
                    </b>
                    {' '}Ahli waris tidak melakukan apa pun. Uangnya masuk ke rekening atau e-wallet-nya.
                  </li>
                  <li>
                    <b>
                      Amplop WhatsApp.
                    </b>
                    {' '}Ahli waris menerima tautan, memilih bank atau e-wallet, lalu mencairkan.
                  </li>
                  <li>
                    <b>
                      Dompet kripto.
                    </b>
                    {' '}Untuk yang sudah punya. Bagiannya langsung masuk ke dompetnya.
                  </li>
                </ul>
                <p className="privasi">
                  Nomor rekening lengkap tidak pernah ditulis di blockchain. Yang tercatat hanya nama bank, empat angka terakhir, dan sidik bergaram.
                </p>
                <div id="daftarTerima" />
                <p className="ket" id="terimaKosong" hidden>
                  Belum ada penerima. Tambahkan anggota keluarga atau wasiat di atas.
                </p>
                <details className="alamat">
                  <summary>
                    Alamat tujuan di blockchain
                  </summary>
                  <div className="daftar-alamat" id="daftarAlamat" />
                  <p>
                    Rekening bank memakai rekening virtual di mitra pencairan, amplop memakai alamat kunci amplop, dan dompet kripto memakai alamat yang kamu isi. Dibuat otomatis untuk demo.
                  </p>
                </details>
              </div>
            </fieldset>
            <fieldset className="klausul">
              <legend>
                Saksi
              </legend>
              <div className="isi-k">
                <p className="ket">
                  Orang yang kamu percaya untuk mengonfirmasi wafatmu. Saksi tidak boleh sekaligus menjadi penerima.
                </p>
                <div id="daftarSaksi" />
                <div className="baris tumpuk">
                  <span>
                    Konfirmasi yang dibutuhkan
                  </span>
                  <div className="segmen" role="radiogroup" aria-label="Ambang saksi">
                    <label>
                      <input type="radio" name="ambang" defaultValue="2" defaultChecked />
                      <span>
                        2 dari 3
                      </span>
                    </label>
                    {' '}
                    <label>
                      <input type="radio" name="ambang" defaultValue="3" />
                      <span>
                        3 dari 3
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </fieldset>
            <fieldset className="klausul">
              <legend>
                Waktu
              </legend>
              <div className="isi-k">
                <div className="baris tumpuk">
                  <span>
                    Batas tanpa bukti hidup
                    <small>
                      Selama ini tidak ada bukti hidup, siapa pun bisa memicu masa sanggah.
                    </small>
                  </span>
                  <select className="pilih" id="selBatas" aria-label="Batas tanpa bukti hidup">
                    <option value="31536000">
                      12 bulan
                    </option>
                    <option value="15552000">
                      6 bulan
                    </option>
                    <option value="2592000">
                      30 hari
                    </option>
                    <option value="600">
                      10 menit (demo)
                    </option>
                  </select>
                </div>
                <p className="ket" id="ketBatas" style={{ "marginTop": "6px" }} />
                <div className="baris tumpuk">
                  <span>
                    Masa sanggah
                    <small>
                      Waktu untuk membatalkan jika ternyata kamu masih hidup.
                    </small>
                  </span>
                  <select className="pilih" id="selSanggah" aria-label="Masa sanggah">
                    <option value="20">
                      20 detik (demo)
                    </option>
                    <option value="604800">
                      7 hari
                    </option>
                    <option value="2592000">
                      30 hari
                    </option>
                  </select>
                </div>
                <p className="ket" style={{ "marginTop": "10px" }}>
                  Untuk penggunaan nyata, kami menyarankan 12 bulan dan 30 hari.
                </p>
              </div>
            </fieldset>
          </form>
          <aside className="pratinjau" id="pratinjau" aria-label="Pratinjau pembagian">
            <div className="kain-host" id="kainPasang" />
            <p className="bunyi" id="bunyi" aria-live="polite" />
            <div className="rincian" id="rincianPasang" />
            <div className="total" id="total" />
            <button className="btn btn--besar btn--penuh" id="btnPasang" type="button">
              Pasang aturan di dompet
            </button>
            <p className="alasan-pasang" id="alasanPasang" aria-live="polite" hidden />
            <p className="t-micro catatan">
              Satu tanda tangan dari dompetmu. Kunci tetap di tanganmu, dan aturan bisa dicabut kapan saja selama kamu hidup.
            </p>
            <p className="peringatan catatan-proto" id="catatanProto" hidden>
              Layar Panggung dan HP penonton disiapkan untuk keluarga contoh. Susunan lain tetap dipasang dan dibagikan dengan benar oleh kontrak, tetapi tampil penuh hanya di layar ini.
            </p>
          </aside>
        </div>
      </section>
      <section id="vKelola" hidden>
        <div className="kepala-kelola">
          <span className="status" id="chip" data-s="aktif">
            <i />
            <span id="chipT">
              Aturan aktif
            </span>
          </span>
          <h1 id="kJudul">
            Dompet Budi Santoso
          </h1>
          <p className="t-lead" id="kSub">
            <b>
              0x8b2c…5de2
            </b>
            {' '}berisi{' '}
            <b>
              Rp300.000.000 tIDR
            </b>
          </p>
        </div>
        <div className="kelola-grid">
          <div>
            <div className="kain-host" id="kainKelola" />
            <p className="bunyi" id="bunyiK" />
          </div>
          <aside className="bukti lembar" id="bukti" aria-label="Bukti hidup" aria-live="polite" />
        </div>
        <section className="aturan" aria-label="Aturan yang terpasang">
          <div>
            <h2>
              Penerima
            </h2>
            <div className="rincian" id="rincianKelola" />
            <p className="t-micro catatan-sim">
              Transfer bank disimulasikan di testnet. Nomor referensinya buatan.
            </p>
          </div>
          <div>
            <h2>
              Saksi
            </h2>
            <div className="daftar-saksi" id="daftarSaksiK" />
          </div>
          <div>
            <h2>
              Waktu dan dompet
            </h2>
            <dl className="daftar-waktu" id="daftarWaktu" />
            <p className="kode">
              Kode dompet sekarang{' '}
              <b>
                0xef0100
              </b>
              {' '}+ alamat PusakaWallet{' '}
              <b>
                0x5b1e…a3f0
              </b>
              . Tanda inilah yang terlihat di explorer.
            </p>
            <button className="btn btn--teks" id="btnCabut" type="button" style={{ "marginTop": "8px" }}>
              Cabut aturan dari dompet
            </button>
          </div>
        </section>
      </section>
    </main>
    <div className="lapis" id="lapis" hidden>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="sJudul">
        <h2 id="sJudul">
          Tanda tangani pemasangan aturan
        </h2>
        <p className="t-small" id="sKet" />
        <dl className="tx-rinci" id="sRinci" />
        <p className="t-micro sheet-catatan" id="sCatatan" hidden />
        <p className="sheet-status" id="sStatus" />
        <div className="sheet-aksi">
          <button className="btn" id="sTanda" type="button">
            Tanda tangani
          </button>
          <button className="btn btn--garis" id="sBatal" type="button">
            Batal
          </button>
        </div>
      </div>
    </div>
      <Halaman nama="pewaris" />
    </>
  );
}
