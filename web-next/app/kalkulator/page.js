import Halaman from '@/components/Halaman';
import '@/styles/kalkulator.css';

export const metadata = { title: "Kalkulator faraid — Pusaka" };
export const viewport = { width: 'device-width', initialScale: 1, viewportFit: "cover" };

export default function Page() {
  return (
    <>
      <meta name="theme-color" content="#131b33" id="warnaTema" />
      <script dangerouslySetInnerHTML={{ __html: "\n  /* tema dipilih sebelum gambar pertama agar tidak berkedip */\n  (() => {\n    let t = null;\n    try { t = localStorage.getItem('pusaka-tema'); } catch {}\n    if (!t) t = matchMedia('(prefers-color-scheme: light)').matches ? 'terang' : 'gelap';\n    if (t === 'terang') document.documentElement.dataset.tema = 'terang';\n  })();\n" }} />
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
          Kalkulator faraid
        </span>
      </div>
      <div className="kanan tema-tombol">
        <div className="segmen" role="radiogroup" aria-label="Tema">
          <label>
            <input type="radio" name="tema" defaultValue="gelap" />
            <span>
              Gelap
            </span>
          </label>
          {' '}
          <label>
            <input type="radio" name="tema" defaultValue="terang" />
            <span>
              Terang
            </span>
          </label>
        </div>
      </div>
    </header>
    <main>
      <div className="judul-halaman">
        <h1 className="resap">
          Kalkulator faraid
        </h1>
        <p className="t-lead resap" style={{ "--i": "1" }}>
          Isi susunan keluarga, lalu lihat bagian masing-masing menurut Kompilasi Hukum Islam. Hitungannya sama dengan aturan yang dijalankan kontrak Pusaka.
        </p>
      </div>
      <div className="contoh" id="contoh" role="group" aria-label="Contoh susunan keluarga" />
      <div className="kerja">
        <div className="kain-blok" id="kainBlok">
          <div className="kain-bingkai">
            <div className="kain-host" id="kainHost" />
            <p className="kain-pesan" id="kainPesan" aria-hidden="true" />
          </div>
        </div>
        <form className="isian-blok" id="form" noValidate>
          <div className="harta">
            <label htmlFor="harta">
              Harta yang dibagi
            </label>
            <div className="rp">
              <span>
                Rp
              </span>
              <input id="harta" inputMode="numeric" autoComplete="off" defaultValue="120.000.000" />
            </div>
          </div>
          <div className="grup-isi">
            <div className="baris">
              <span>
                Pewaris
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
          <div className="grup-isi">
            <div className="baris" id="rIstri">
              <span>
                Istri
              </span>
              <div className="stepper" data-k="istri" data-min="0" data-max="5" />
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
              <div className="stepper" data-k="putra" data-min="0" data-max="12" />
            </div>
            <div className="baris">
              <span>
                Anak perempuan
              </span>
              <div className="stepper" data-k="putri" data-min="0" data-max="12" />
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
                Saudara kandung
                <small>
                  Yang masih hidup
                </small>
              </span>
              <div className="stepper" data-k="saudara" data-min="0" data-max="12" />
            </div>
            <div className="baris">
              <span>
                Kerabat lain
                <small>
                  Cucu, kakek, atau nenek yang mungkin mewarisi
                </small>
              </span>
              <label className="saklar">
                <input type="checkbox" data-k="kerabatLain" aria-label="Ada kerabat lain" />
              </label>
            </div>
          </div>
          <details className="lanjutan" id="lanjutan">
            <summary>
              Harta bersama, wasiat, dan mode radd
            </summary>
            <div className="isi-l">
              <div className="baris tumpuk">
                <span id="lblBersama">
                  Harta bersama
                </span>
                <div className="segmen" role="radiogroup" aria-label="Porsi harta bersama">
                  <label>
                    <input type="radio" name="bersama" defaultValue="tidak" defaultChecked />
                    <span>
                      Tidak
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
                    <input type="radio" name="bersama" defaultValue="seluruh" />
                    <span>
                      Semua
                    </span>
                  </label>
                </div>
              </div>
              <div className="baris">
                <span>
                  Wasiat
                  <small>
                    Untuk yang bukan ahli waris, paling banyak sepertiga
                  </small>
                </span>
                <select className="pilih" id="selWasiat" aria-label="Bagian wasiat">
                  <option value="">
                    Tidak ada
                  </option>
                  <option>
                    1/10
                  </option>
                  <option>
                    1/8
                  </option>
                  <option>
                    1/6
                  </option>
                  <option>
                    1/5
                  </option>
                  <option>
                    1/4
                  </option>
                  <option>
                    1/3
                  </option>
                </select>
              </div>
              <div className="baris">
                <span>
                  Sisa juga untuk pasangan
                  <small>
                    Mode KHI harfiah. Bawaan Pusaka mengikuti jumhur: sisa tidak dikembalikan kepada suami atau istri.
                  </small>
                </span>
                <label className="saklar">
                  <input type="checkbox" data-k="raddPasangan" aria-label="Radd ke pasangan" />
                </label>
              </div>
            </div>
          </details>
        </form>
        <section className="hasil-blok" id="hasil" aria-live="polite">
          <div className="alur" id="alur" hidden />
          <div id="isiHasil" />
          <div className="kaki">
            <p className="peringatan">
              Hanya untuk ahli waris inti: pasangan, anak, ayah, dan ibu. Bukan fatwa. Untuk kepastian hukum, tanyakan kepada ahli faraid atau Pengadilan Agama.
            </p>
          </div>
        </section>
      </div>
    </main>
      <Halaman nama="kalkulator" />
    </>
  );
}
