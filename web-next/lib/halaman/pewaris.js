import '@web/src/boot.js';
const S = Demo, D = Pusaka;
Latar.pasang();
Demo.panel({ judul: 'Panel demo' });
document.getElementById('logo').outerHTML = UI.MEREK;
UI.blok(document.getElementById('jaringan'));
UI.dompetDemo(document.getElementById('kanan'));
const $ = (id) => document.getElementById(id);
const CENTANG = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 8.5l3.5 3.5 7.5-8" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const setTeks = (id, teks) => { const e = $(id); if (e && e.textContent !== teks) e.textContent = teks; };

/* ---------- aturan (isi formulir) ----------
   Disimpan lewat inti (Demo.simpanAturan) supaya layar lain membaca aturan yang sama, termasuk cara terima tiap penerima. */
let f = S.bacaAturan();
let ingat = {};   // isian lama tiap penerima saat ganti cara, supaya bisa kembali tanpa mengetik ulang
const simpan = () => S.simpanAturan(f);
const pecahan = (t) => { const [n, d] = t.split('/').map(Number); return D.F(n, d); };
const IDKEY = Object.fromEntries(Object.entries(S.KEY_PENERIMA).map(([id, k]) => [k, id]));

function hitung() {
  const fam = { laki: f.laki, istri: f.laki ? f.istri : 0, suami: f.laki ? 0 : (f.suami ? 1 : 0), putra: f.putra, putri: f.putri, ayah: f.ayah, ibu: f.ibu, saudara: f.saudara, kerabatLain: f.kerabatLain };
  const nPas = fam.istri + fam.suami;
  const bersama = nPas === 1 ? (f.bersama === 'seluruh' ? D.F(1) : f.bersama === 'separuh' ? D.F(1, 2) : D.F(0)) : D.F(0);
  const wasiat = f.wasiat.map((w, i) => ({ label: w.label.trim() || `Penerima wasiat ${i + 1}`, bagian: pecahan(w.bagian) }));
  try {
    const hasil = D.bagi(300, fam, { bersama, wasiat });
    return { ok: true, fam, nPas, hasil, grup: D.ringkas(hasil, f.laki), bands: D.bidangKain(hasil) };
  } catch (e) {
    if (!(e instanceof D.Ditolak)) throw e;
    return { ok: false, fam, nPas, e };
  }
}

/* Bunyi aturan dalam satu-dua kalimat, seperti membaca surat wasiat */
function bunyiAturan(r) {
  if (!r.ok) return '';
  const pas = f.laki ? 'istri' : 'suami', x = [];
  const adaBersama = r.nPas === 1 && f.bersama !== 'tidak';
  if (adaBersama) x.push(`${f.bersama === 'seluruh' ? 'Seluruh' : 'Separuh'} harta di dompet ini adalah harta bersama, dan separuhnya milik ${pas}.`);
  if (f.wasiat.length) {
    const w = D.daftarKata(f.wasiat.map((w, i) => `${D.kataPecahan(pecahan(w.bagian))} untuk ${(w.label.trim() || `penerima wasiat ${i + 1}`).toLowerCase()}`));
    x.push(`${adaBersama ? 'Dari harta warisan' : 'Dari harta di dompet ini'}, diwasiatkan ${w}.`);
  }
  x.push(`${x.length ? 'Sisanya' : 'Seluruh harta'} dibagi menurut faraid kepada ${D.kalimatKeluarga(r.fam)}.`);
  return x.join(' ');
}

/* Daftar ringkas per kelompok (dipakai pratinjau di layar Pasang) */
function htmlRincian(r) {
  return r.grup.map((g) => `<div class="r" data-keys="${g.keys.join(' ')}"><i style="background:${g.dye}"></i><span>${esc(g.nama)}</span><span class="frac">${g.fracTeks}</span><b>${g.n > 1 ? `${g.n} × ${D.rp(g.tiap)}` : D.rp(g.total)}</b></div>`).join('');
}

/* ---------- kain hidup: dibuat seukuran kolomnya, dibuat ulang saat ukuran berubah ---------- */
function kainDi(host, mode, rasio) {
  host.innerHTML = '';
  const lebar = Math.max(300, Math.round(host.clientWidth));
  const F = lebar > 600 ? 12 : 8, B = lebar > 600 ? 22 : 14;
  const W = lebar - 2 * F, H = Math.round(W * rasio);
  return Kain.hidup(host.appendChild(document.createElement('div')), { W, H, B, F, k: .42, q: .5, seed: 7, mode });
}
/* Sorotan dua arah: kursor di kain menyorot barisnya, kursor di baris menyorot bidangnya.
   Satu pasangan host per tampilan; kain di dalamnya boleh dibuat ulang. */
const pasanganSorot = new Map();   // hostRincian → { kain, akhir }
function hubungkanSorot(kain, hostRincian) {
  let p = pasanganSorot.get(hostRincian);
  if (!p) {
    p = { kain, akhir: '' };
    pasanganSorot.set(hostRincian, p);
    hostRincian.addEventListener('pointerover', (e) => { const row = e.target.closest('.r'); if (row) sorotKe(hostRincian, row.dataset.keys.split(' ')); });
    hostRincian.addEventListener('pointerleave', () => sorotKe(hostRincian, null));
  }
  p.kain = kain; p.akhir = '';
  kain.el.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    const r = kain.el.getBoundingClientRect(), b = kain.bidangDi(e.clientX - r.left, e.clientY - r.top);
    sorotKe(hostRincian, b ? b.pemilik : null);
  });
  kain.el.addEventListener('pointerleave', () => sorotKe(hostRincian, null));
}
function sorotKe(hostRincian, key) {
  const p = pasanganSorot.get(hostRincian), k = key == null ? '' : [].concat(key).join(' ');
  if (!p || k === p.akhir) return;
  p.akhir = k;
  p.kain.sorot(key);
  const set = new Set(k.split(' '));
  hostRincian.querySelectorAll('.r').forEach((row) => row.classList.toggle('sorot', !!k && row.dataset.keys.split(' ').some((x) => set.has(x))));
}

/* ---------- kata-kata waktu ---------- */
/* Sisa waktu dalam kata: "365 hari", "3 hari 4 jam", "2 jam 5 menit", "1 menit 8 detik" */
function kataSisa(detik) {
  const d = Math.max(0, Math.ceil(detik)), H = 86400;
  if (d >= 60 * H) return `${Math.ceil(d / H)} hari`;
  if (d >= H) { const h = Math.floor(d / H), j = Math.floor((d % H) / 3600); return `${h} hari${j ? ` ${j} jam` : ''}`; }
  if (d >= 3600) { const j = Math.floor(d / 3600), m = Math.floor((d % 3600) / 60); return `${j} jam${m ? ` ${m} menit` : ''}`; }
  if (d >= 60) { const m = Math.floor(d / 60), s = d % 60; return `${m} menit${s ? ` ${s} detik` : ''}`; }
  return `${d} detik`;
}
/* "12 detik lalu" sampai "N jam lalu" dari UI.lalu; lebih dari sehari dihitung hari dan bulan */
function laluPanjang(ms) {
  const hari = Math.floor(Math.max(0, ms) / 86400000);
  if (hari < 1) return UI.lalu(ms);
  return hari < 60 ? `${hari} hari lalu` : `${Math.floor(hari / 30)} bulan lalu`;
}
const tglPanjang = (ms) => new Date(ms).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
/* Pengingat dikirim sekitar sebulan sebelum batas; untuk batas pendek: mendekati batas */
const teksPengingat = (batas) => (batas >= 15552000 ? `sekitar ${Math.max(1, Math.round(batas / 2628000) - 1)} bulan` : 'mendekati batas');
/* Panggilan singkat: "Rina Santoso" → "Rina", tetapi "Ustaz Hamid" tetap utuh (gelar tidak dibuang) */
const GELAR = new Set(['ustaz', 'ustadz', 'ustazah', 'ustadzah', 'kyai', 'kiai', 'haji', 'hajjah', 'hj', 'h', 'bapak', 'pak', 'ibu', 'bu', 'dr', 'drs', 'dra', 'prof', 'abah', 'buya', 'syekh', 'mas', 'mbak', 'kak', 'bang', 'om', 'tante', 'paman', 'bibi']);
function namaPendek(nama) {
  const kata = String(nama || '').trim().split(/\s+/).filter(Boolean);
  if (!kata.length) return '';
  const gelar = GELAR.has(kata[0].toLowerCase().replace(/\./g, ''));
  return gelar && kata.length > 1 ? `${kata[0]} ${kata[1]}` : kata[0];
}

/* =====================================================================
   CARA MENERIMA
   Satu baris per penerima: rekening bank, amplop WhatsApp, atau dompet kripto. Disimpan di f.terima[key].
   ===================================================================== */
const CARA = { bank: 'Rekening bank', amplop: 'Amplop WhatsApp', kripto: 'Dompet kripto' };
const angka = (t) => String(t || '').replace(/\D/g, '');
const bersih = (t) => (t.cara === 'bank' ? { cara: 'bank', bank: t.bank || S.BANK[0], nomor: t.nomor || '', nama: t.nama || '' }
  : t.cara === 'kripto' ? { cara: 'kripto', alamat: t.alamat || '', nama: t.nama || '' }
  : { cara: 'amplop', wa: t.wa || '', nama: t.nama || '' });
/* Isian awal saat penerima ganti cara: bawaan keluarga contoh jika ada, selain itu kosong (nama ikut terbawa) */
const bawaanCara = (key, cara, nama = '') => {
  const awal = S.TERIMA_AWAL()[key];
  return awal && awal.cara === cara ? bersih({ ...awal, nama: nama || awal.nama }) : bersih({ cara, nama });
};
/* Penerima menurut susunan keluarga di formulir: ahli waris lebih dulu, lalu penerima wasiat */
function daftarPenerima() {
  const x = [], urut = (n, nama) => Array.from({ length: n }, (_, i) => (n > 1 ? `${nama} ${D.URUT[i]}` : nama));
  const nPas = f.laki ? f.istri : (f.suami ? 1 : 0);
  urut(nPas, f.laki ? 'Istri' : 'Suami').forEach((label, i) => x.push({ key: `pasangan-${i}`, label }));
  urut(f.putra, 'Anak laki-laki').forEach((label, i) => x.push({ key: `putra-${i}`, label }));
  urut(f.putri, 'Anak perempuan').forEach((label, i) => x.push({ key: `putri-${i}`, label }));
  if (f.ayah) x.push({ key: 'ayah-0', label: 'Ayah' });
  if (f.ibu) x.push({ key: 'ibu-0', label: 'Ibu' });
  f.wasiat.forEach((w, i) => x.push({ key: `wasiat-${i}`, label: w.label.trim() || `Penerima wasiat ${i + 1}` }));
  return x;
}
const terimaDi = (key) => S.terimaDari(f, key);
const namaWasiat = (key) => { const m = /^wasiat-(\d+)$/.exec(key); const w = m && f.wasiat[+m[1]]; return w ? String(w.label || '').trim() : ''; };
const jumlahBank = () => daftarPenerima().filter((p) => terimaDi(p.key).cara === 'bank').length;
const tujuanAman = (key) => { try { return S.alamatTujuan(key, terimaDi(key)) || ''; } catch { return ''; } };
/* Alamat kripto dianggap sah jika inti benar-benar memakainya (checksum ikut diperiksa), bukan jatuh ke kunci amplop */
function alamatKriptoValid(key, a) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(a)) return false;
  try { return S.alamatTujuan(key, { cara: 'kripto', alamat: a }).toLowerCase() === a.toLowerCase(); } catch { return false; }
}
/* Galat isian satu penerima: { bidang, pesan } atau null */
function periksaTerima(key, t) {
  if (t.cara === 'bank') {
    const ew = S.EWALLET.has(t.bank), d = angka(t.nomor);
    if (!String(t.nama || '').trim()) return { bidang: 'nama', pesan: ew ? 'Isi nama pemilik akun.' : 'Isi nama pemilik rekening.' };
    if (d.length < (ew ? 9 : 6) || d.length > 20) return { bidang: 'nomor', pesan: ew ? 'Nomor HP belum lengkap.' : 'Nomor rekening belum lengkap.' };
  } else if (t.cara === 'amplop') {
    const w = angka(t.wa);
    if (String(t.wa || '').trim() && (w.length < 9 || w.length > 15)) return { bidang: 'wa', pesan: 'Nomor WhatsApp belum lengkap.' };
  } else {
    const a = String(t.alamat || '').trim();
    if (a && !alamatKriptoValid(key, a)) return { bidang: 'alamat', pesan: 'Alamat dompet tidak sah. Kosongkan jika ingin memakai amplop.' };
  }
  return null;
}

function htmlIsian(t) {
  if (t.cara === 'bank') {
    const ew = S.EWALLET.has(t.bank);
    return `<label class="fld penuh" data-b="nama"><span data-lbl="nama">${ew ? 'Nama pemilik akun' : 'Nama pemilik rekening'}</span><input class="teks-isian" data-f="nama" value="${esc(t.nama)}" autocomplete="off" placeholder="Sesuai nama di bank"></label>
      <label class="fld" data-b="bank"><span>Bank atau e-wallet</span><select class="pilih" data-f="bank">${S.BANK.map((b) => `<option${b === t.bank ? ' selected' : ''}>${esc(b)}</option>`).join('')}</select></label>
      <label class="fld" data-b="nomor"><span data-lbl="nomor">${ew ? 'Nomor HP' : 'Nomor rekening'}</span><input class="teks-isian" data-f="nomor" value="${esc(t.nomor)}" inputmode="numeric" autocomplete="off" placeholder="Hanya angka"></label>`;
  }
  if (t.cara === 'kripto') {
    return `<label class="fld penuh" data-b="nama"><span>Nama ahli waris</span><input class="teks-isian" data-f="nama" value="${esc(t.nama)}" autocomplete="off"></label>
      <label class="fld penuh" data-b="alamat"><span>Alamat dompet <em>(kosong = pakai amplop)</em></span><input class="teks-isian" data-f="alamat" value="${esc(t.alamat)}" autocomplete="off" spellcheck="false" placeholder="0x…"></label>`;
  }
  return `<label class="fld" data-b="nama"><span>Nama ahli waris</span><input class="teks-isian" data-f="nama" value="${esc(t.nama)}" autocomplete="off"></label>
    <label class="fld" data-b="wa"><span>Nomor WhatsApp</span><input class="teks-isian" data-f="wa" value="${esc(t.wa)}" inputmode="tel" autocomplete="off" placeholder="0812-…"></label>`;
}

const barisTerima = new Map();   // key → baris
function buatBaris(p) {
  const el = document.createElement('div');
  el.className = 'terima'; el.dataset.key = p.key; el.setAttribute('role', 'group');
  el.innerHTML = `<div class="terima-kepala"><b></b></div>
    <div class="segmen" role="radiogroup">${Object.keys(CARA).map((c) => `<label><input type="radio" name="cara:${p.key}" value="${c}"><span>${CARA[c]}</span></label>`).join('')}</div>
    <div class="terima-isian"></div>
    <p class="terima-ket" aria-live="polite" hidden></p>`;
  const judul = el.querySelector('b'), isian = el.querySelector('.terima-isian'), ket = el.querySelector('.terima-ket');
  const b = { el, ref: null, label: null, sentuh: new Set() };
  b.setLabel = (txt) => {
    if (txt === b.label) return;
    b.label = txt; judul.textContent = txt;
    el.setAttribute('aria-label', txt);
    el.querySelector('.segmen').setAttribute('aria-label', `Cara menerima: ${txt}`);
  };
  b.isi = () => {
    const t = f.terima[p.key];
    b.ref = t; b.sentuh = new Set();
    el.dataset.cara = t.cara;
    el.querySelectorAll('input[type="radio"]').forEach((r) => { r.checked = r.value === t.cara; });
    isian.innerHTML = htmlIsian(t);
    ket.hidden = true; ket.textContent = '';
  };
  /* Ganti bank ke e-wallet (atau sebaliknya): label ikut berubah tanpa membuang fokus */
  b.labelIsian = () => {
    const ew = S.EWALLET.has(f.terima[p.key].bank);
    const n = isian.querySelector('[data-lbl="nama"]'), m = isian.querySelector('[data-lbl="nomor"]');
    if (n) n.textContent = ew ? 'Nama pemilik akun' : 'Nama pemilik rekening';
    if (m) m.textContent = ew ? 'Nomor HP' : 'Nomor rekening';
  };
  b.tampilkan = (err) => {
    const lihat = !!err && b.sentuh.has(err.bidang);
    ket.hidden = !lihat; ket.textContent = lihat ? err.pesan : '';
    isian.querySelectorAll('.fld').forEach((x) => x.classList.toggle('salah', lihat && x.dataset.b === err.bidang));
  };
  el.addEventListener('change', (e) => { if (e.target.matches('input[type="radio"]')) ubahCara(p.key, e.target.value, b); });
  el.addEventListener('input', (e) => {
    const x = e.target.closest('[data-f]'); if (!x) return;
    f.terima[p.key][x.dataset.f] = x.tagName === 'SELECT' ? x.value : x.value.trim();
    if (x.dataset.f === 'bank') b.labelIsian();
    ubahForm(false);
  });
  el.addEventListener('focusout', (e) => {
    const x = e.target.closest('[data-f]'); if (!x) return;
    b.sentuh.add(x.dataset.f); periksaSemua();
  });
  return b;
}
function ubahCara(key, cara, b) {
  const lama = f.terima[key];
  if (lama.cara === cara) return;
  (ingat[key] = ingat[key] || {})[lama.cara] = lama;
  const lalu = ingat[key][cara];
  // penerima wasiat belum punya nama pemilik: pinjam nama yang sudah diketik di bagian Wasiat (tetap bisa diubah)
  const nama0 = lama.nama || (lalu && lalu.nama) || namaWasiat(key);
  f.terima[key] = lalu ? { ...lalu, nama: nama0 } : bawaanCara(key, cara, nama0);
  b.isi();
  ubahForm(false);
}
/* Samakan baris dengan susunan keluarga dan wasiat. Baris yang sudah ada dipakai ulang (fokus ketikan tidak hilang). */
function renderTerima() {
  const host = $('daftarTerima'), daftar = daftarPenerima();
  daftar.forEach((p) => { const t = f.terima[p.key]; if (!t || !CARA[t.cara]) f.terima[p.key] = bersih(terimaDi(p.key)); });
  const ada = new Set(daftar.map((p) => p.key));
  [...barisTerima].forEach(([k, b]) => { if (!ada.has(k)) { b.el.remove(); barisTerima.delete(k); } });
  daftar.forEach((p, i) => {
    let b = barisTerima.get(p.key);
    if (!b) { b = buatBaris(p); barisTerima.set(p.key, b); }
    if (b.ref !== f.terima[p.key]) b.isi();
    b.setLabel(p.label);
    if (host.children[i] !== b.el) host.insertBefore(b.el, host.children[i] || null);
  });
  $('terimaKosong').hidden = daftar.length > 0;
}
/* Periksa semua baris, tampilkan galatnya, dan kembalikan daftar masalah untuk tombol Pasang */
function periksaSemua() {
  const masalah = [], dipakai = new Map();
  daftarPenerima().forEach((p) => {
    const t = f.terima[p.key];
    let err = periksaTerima(p.key, t);
    if (!err) {
      const a = tujuanAman(p.key).toLowerCase();
      if (a) {
        const lain = dipakai.get(a);
        if (lain) err = { bidang: t.cara === 'bank' ? 'nomor' : 'alamat', pesan: `Sama dengan tujuan ${lain}. Tiap penerima butuh tujuan sendiri.` };
        else dipakai.set(a, p.label);
      }
    }
    if (err) masalah.push({ ...p, ...err });
    const b = barisTerima.get(p.key);
    if (b) b.tampilkan(err);
  });
  return masalah;
}
function renderAlamat() {
  const det = $('fsTerima').querySelector('details.alamat');
  if (!det.open) return;
  $('daftarAlamat').innerHTML = daftarPenerima().map((p) => {
    const t = terimaDi(p.key), a = periksaTerima(p.key, t) ? '' : tujuanAman(p.key);
    return `<span>${esc(p.label)}<small>${CARA[t.cara]}</small></span><span>${a ? S.pendek(a) : '—'}</span>`;
  }).join('');
}
$('fsTerima').querySelector('details.alamat').addEventListener('toggle', renderAlamat);

/* =====================================================================
   PASANG
   ===================================================================== */
let kainP = null, rP = null;
function stepper(el) {
  const k = el.dataset.k, min = +el.dataset.min, max = +el.dataset.max;
  el.innerHTML = `<button type="button" aria-label="Kurangi">−</button><output aria-live="polite"></output><button type="button" aria-label="Tambah">+</button>`;
  const [kurang, , tambah] = el.children, out = el.querySelector('output');
  const set = () => { out.textContent = f[k]; kurang.disabled = f[k] <= min; tambah.disabled = f[k] >= max; };
  kurang.onclick = () => { f[k] = Math.max(min, f[k] - 1); set(); ubahForm(); };
  tambah.onclick = () => { f[k] = Math.min(max, f[k] + 1); set(); ubahForm(); };
  el.set = set; set();
}
function isiForm() {
  document.querySelectorAll('#form .stepper').forEach(stepper);
  document.querySelectorAll('#form .saklar input').forEach((c) => { c.checked = !!f[c.dataset.k]; c.onchange = () => { f[c.dataset.k] = c.checked; ubahForm(); }; });
  document.querySelectorAll('input[name="kelamin"]').forEach((r) => { r.checked = (r.value === 'laki') === f.laki; r.onchange = () => { f.laki = r.value === 'laki'; ubahForm(); }; });
  document.querySelectorAll('input[name="bersama"]').forEach((r) => { r.checked = r.value === f.bersama; r.onchange = () => { f.bersama = r.value; ubahForm(); }; });
  document.querySelectorAll('input[name="ambang"]').forEach((r) => { r.checked = +r.value === f.ambang; r.onchange = () => { f.ambang = +r.value; ubahForm(false); }; });
  // nilai tersimpan di luar pilihan (mis. dari versi lama) tetap ditampilkan
  [['selBatas', 'batas'], ['selSanggah', 'sanggah']].forEach(([id, k]) => {
    const sel = $(id);
    if (![...sel.options].some((o) => +o.value === f[k])) sel.add(new Option(UI.durasi(f[k]), String(f[k])));
    sel.value = String(f[k]);
    sel.onchange = (e) => { f[k] = +e.target.value; ubahForm(false); };
  });
  renderWasiat(); renderSaksi();
}
function renderWasiat() {
  const host = $('daftarWasiat');
  host.innerHTML = f.wasiat.map((w, i) => `<div class="wasiat-baris" data-i="${i}">
      <input class="teks-isian" value="${esc(w.label)}" aria-label="Nama penerima wasiat ${i + 1}" placeholder="Nama penerima">
      <select class="pilih" aria-label="Bagian wasiat ${i + 1}">${['1/10', '1/8', '1/6', '1/5', '1/4', '1/3'].map((b) => `<option ${b === w.bagian ? 'selected' : ''}>${b}</option>`).join('')}</select>
      <button type="button" class="btn btn--teks" data-hapus>Hapus</button></div>`).join('');
  host.querySelectorAll('.wasiat-baris').forEach((row) => {
    const i = +row.dataset.i;
    row.querySelector('input').oninput = (e) => { f.wasiat[i].label = e.target.value; ubahForm(false); };
    row.querySelector('select').onchange = (e) => { f.wasiat[i].bagian = e.target.value; ubahForm(); };
    row.querySelector('[data-hapus]').onclick = () => {
      f.wasiat.splice(i, 1);
      // cara terima ikut bergeser, dan yang paling belakang dilepas
      for (let j = i; j < f.wasiat.length; j++) f.terima[`wasiat-${j}`] = f.terima[`wasiat-${j + 1}`];
      delete f.terima[`wasiat-${f.wasiat.length}`];
      Object.keys(ingat).filter((k) => k.startsWith('wasiat-')).forEach((k) => delete ingat[k]);
      renderWasiat(); ubahForm();
    };
  });
  $('tambahWasiat').disabled = f.wasiat.length >= 3;
  $('tambahWasiat').onclick = () => {
    // penerima wasiat baru dimulai kosong, bukan mewarisi bawaan Masjid
    f.terima[`wasiat-${f.wasiat.length}`] = bersih({ cara: 'amplop' });
    delete ingat[`wasiat-${f.wasiat.length}`];
    f.wasiat.push({ label: '', bagian: '1/10' });
    renderWasiat(); ubahForm(); host.querySelector('.wasiat-baris:last-child input').focus();
  };
}
function renderSaksi() {
  $('daftarSaksi').innerHTML = f.saksi.map((s, i) => `<div class="saksi-baris" data-i="${i}"><span class="no">${i + 1}</span>
      <input class="teks-isian" data-f="nama" value="${esc(s.nama)}" aria-label="Nama saksi ${i + 1}">
      <input class="teks-isian" data-f="peran" value="${esc(s.peran)}" aria-label="Hubungan saksi ${i + 1}">
      <small>Alamat ${D.saksi[i].alamat}</small></div>`).join('');
  $('daftarSaksi').querySelectorAll('input').forEach((inp) => { inp.oninput = () => { f.saksi[+inp.closest('.saksi-baris').dataset.i][inp.dataset.f] = inp.value; ubahForm(false); }; });
}

let bunyiTl;
function ubahForm(ulangKain = true) {
  renderTerima();
  simpan();
  const r = hitung(); rP = r;
  // pasangan: istri (stepper) untuk pewaris laki-laki, suami (saklar) untuk perempuan
  $('rIstri').hidden = !f.laki; $('rSuami').hidden = f.laki;
  // harta bersama hanya jika pasangan tepat satu
  const bisaBersama = r.nPas === 1;
  document.querySelectorAll('input[name="bersama"]').forEach((x) => { x.disabled = !bisaBersama && x.value !== 'tidak'; x.checked = bisaBersama ? x.value === f.bersama : x.value === 'tidak'; });
  $('lblBersama').innerHTML = bisaBersama ? 'Porsi harta bersama' : 'Porsi harta bersama<small>Hanya bisa jika pasangan tepat satu orang.</small>';
  // batas waktu: tanpa tombol, jadi jelaskan apa yang menjadi bukti hidup
  $('ketBatas').textContent = f.batas >= 15552000
    ? `Kamu tidak perlu menekan apa pun. Setiap transaksi dari dompetmu otomatis tercatat sebagai bukti hidup. Jika dompet diam ${teksPengingat(f.batas)}, Pusaka mengirim pengingat; satu sentuhan "Saya masih hidup" sudah cukup (hanya tanda tangan, Rp0 untukmu).`
    : `Kamu tidak perlu menekan apa pun. Setiap transaksi dari dompetmu otomatis tercatat sebagai bukti hidup. Kabar hidup bertanda tangan juga cukup (hanya tanda tangan, Rp0 untukmu).`;
  // pratinjau
  if (kainP && ulangKain) {
    if (r.ok) { kainP.atur(r.bands); if (kainP.st.a < .5) kainP.mode('pola', { dur: .6 }); }
    else kainP.mode('kosong', { dur: .5 });
  }
  const bunyi = $('bunyi'), teks = r.ok ? bunyiAturan(r) : '';
  if (bunyi.textContent !== teks) { bunyi.textContent = teks; if (!Demo.diam) UI.masuk(bunyi); }
  $('rincianPasang').innerHTML = r.ok ? htmlRincian(r) : '';
  if (r.ok) {
    const jml = r.hasil.orang.length, total = r.hasil.orang.reduce((a, o) => a + o.total, 0);
    $('total').innerHTML = `${CENTANG}<span>Terbagi habis: ${D.rp(total)} untuk ${jml} penerima.</span>`;
  } else {
    $('total').innerHTML = `<p class="tolak"><b>Belum bisa dipasang.</b> ${esc(r.e.message)}</p>`;
  }
  // tombol Pasang: aturan sah, cara menerima lengkap, saksi bernama
  const masalah = periksaSemua(), alasan = [];
  if (masalah.length) alasan.push(`Lengkapi cara menerima untuk ${D.daftarKata(masalah.map((m) => m.label))}.`);
  if (f.saksi.some((s) => !s.nama.trim())) alasan.push('Isi nama ketiga saksi.');
  $('btnPasang').disabled = !r.ok || alasan.length > 0;
  $('alasanPasang').hidden = !r.ok || !alasan.length;
  $('alasanPasang').textContent = alasan.join(' ');
  renderAlamat();
  const kunci = (x) => JSON.stringify({ ...x, saksi: 0, batas: 0, sanggah: 0, ambang: 0, terima: 0 });
  $('catatanProto').hidden = kunci(f) === kunci(S.AWAL_ATURAN());
}

function tampilPasang(animasi = true) {
  $('vKelola').hidden = true; $('vPasang').hidden = false;
  document.title = 'Pasang aturan — Pusaka';
  barisTerima.clear(); $('daftarTerima').innerHTML = '';
  isiForm();
  kainP = kainDi($('kainPasang'), 'pola', .34);
  hubungkanSorot(kainP, $('rincianPasang'));
  ubahForm(false);
  if (rP.ok) kainP.atur(rP.bands, { animasi: false }); else kainP.mode('kosong', { animasi: false });
  UI.masuk('#vPasang .judul-halaman .resap');
  if (animasi && !Demo.diam) {
    gsap.fromTo('.klausul', { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: .7, stagger: .06, ease: 'power3.out', delay: .15, overwrite: true, clearProps: 'opacity,transform' });
    gsap.fromTo('#kainPasang', { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 1.2, ease: 'power3.inOut', delay: .2 });
  }
}

/* ---------- lembar tanda tangan / konfirmasi ---------- */
const lapis = $('lapis');
let onYa = null, pemicuLembar = null;
function bukaLembar({ judul, ket, rinci = [], catatan = '', tombol, statusAwal = '', ya }) {
  pemicuLembar = document.activeElement;
  $('sJudul').textContent = judul;
  $('sKet').textContent = ket;
  $('sRinci').innerHTML = rinci.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('');
  $('sRinci').hidden = !rinci.length;
  $('sCatatan').textContent = catatan; $('sCatatan').hidden = !catatan;
  $('sStatus').innerHTML = statusAwal;
  $('sTanda').textContent = tombol;
  $('sTanda').disabled = false; $('sBatal').disabled = false;
  onYa = ya;
  giliranLembar++;
  lapis.hidden = false;
  if (!Demo.diam) { gsap.fromTo(lapis, { opacity: 0 }, { opacity: 1, duration: .3 }); gsap.fromTo('.sheet', { y: -14, opacity: 0 }, { y: 0, opacity: 1, duration: .5, ease: 'power3.out' }); }
  $('sTanda').focus();
}
function lembarPasang() {
  const perluGas = S.s.gas.pewaris < .06, n = jumlahBank();
  const batasGas = Number(S.GAS.pasang + S.GAS.perRekening * BigInt(n));
  bukaLembar({
    judul: 'Tanda tangani pemasangan aturan',
    ket: n
      ? `Satu tanda tangan memasang aturan di dompetmu dan sekaligus mendaftarkan ${n} rekening bank ahli waris di mitra pencairan berizin.`
      : 'Satu tanda tangan memasang aturan di dompetmu. Tidak ada rekening bank yang didaftarkan karena semua penerima memakai amplop atau dompet kripto.',
    rinci: [
      ['Dari dan ke', `${D.pewaris.alamat} (dompetmu sendiri)`],
      ['Otorisasi EIP-7702', `PusakaWallet ${S.pendek(S.alamat.wallet)}`],
      ['Isi aturan', `${rP.hasil.orang.length} penerima, 3 saksi, butuh ${f.ambang}`],
      ['Rekening bank', n ? `${n} didaftarkan di mitra` : 'Tidak ada'],
      ['Batas gas', batasGas.toLocaleString('id-ID')],
      ['Gas di dompet demo', UI.mon(S.s.gas.pewaris)],
    ],
    catatan: n ? 'Nomor rekening lengkap tidak dikirim ke blockchain, hanya nama bank, empat angka terakhir, dan sidik bergaram. Pendaftaran rekening dan transfer bank disimulasikan di testnet.' : '',
    statusAwal: perluGas ? '<span>Dompet demo belum punya gas. Gas dibagikan dari dompet induk lebih dulu.</span>' : '',
    tombol: perluGas ? 'Bagikan gas, lalu tanda tangani' : 'Tanda tangani',
    ya: tandaTangani,
  });
}
let giliranLembar = 0;   // menandai buka/tutup terakhir, supaya jaring pengaman lama tidak menutup lembar yang baru dibuka
function tutupLembar() {
  const giliran = ++giliranLembar;
  const kembali = () => {
    if (giliran !== giliranLembar || lapis.hidden) return;
    lapis.hidden = true;
    if (pemicuLembar && document.contains(pemicuLembar)) pemicuLembar.focus();
  };
  if (Demo.diam) { kembali(); return; }
  gsap.to(lapis, { opacity: 0, duration: .25, overwrite: true, onComplete: kembali });
  setTimeout(kembali, 700);   // jaring pengaman: tab di latar belakang tidak menjalankan animasi
}
const tunggu = (ms) => new Promise((r) => setTimeout(r, Demo.diam ? 0 : ms));
const status = (html) => { $('sStatus').innerHTML = html; };
let sedangPasang = false;
async function tandaTangani() {
  $('sTanda').disabled = true; $('sBatal').disabled = true;
  sedangPasang = true;
  const n = jumlahBank();
  const LANGKAH = {
    gas: 'Membagikan gas dan tIDR dari dompet induk…',
    otorisasi: 'Menandatangani otorisasi EIP-7702…',
    kirim: `Mengirim satu transaksi ke ${Demo.NAMA_JARINGAN}${n ? `: pasang aturan dan daftarkan ${n} rekening` : ''}…`,
  };
  status(`<i class="spin"></i><span>${LANGKAH.otorisasi}</span>`);
  let hasil = null;
  try { hasil = await S.pasang({ aturan: f, onStatus: (k) => status(`<i class="spin"></i><span>${LANGKAH[k] || ''}</span>`) }); } catch (e) { console.error(e); }
  if (!hasil) {
    // ditolak atau gagal: lembar tetap terbuka dengan sebabnya
    sedangPasang = false;
    status(`<p class="tolak"><b>Belum terpasang.</b> ${esc(Demo.pesanTerakhir || 'Coba lagi.')}</p>`);
    $('sTanda').disabled = false; $('sBatal').disabled = false;
    if (S.s.status !== 0) { tutupLembar(); tampil(); }
    return;
  }
  status(`${CENTANG}<span>Aturan terpasang${n ? ` dan ${n} rekening terdaftar` : ''}. Final di blok ${hasil.blok.toLocaleString('id-ID')} dalam ${hasil.detik.toLocaleString('id-ID', { maximumFractionDigits: 1 })} detik.</span>`);
  await tunggu(1100);
  tutupLembar();
  await tunggu(250);
  // lilin menimpa sketsa pensil: aturan kini terpasang
  $('btnPasang').disabled = true;
  $('bunyi').textContent = 'Aturan terpasang di dompet. ' + bunyiAturan(rP); UI.masuk($('bunyi'));
  if (Demo.diam) { sedangPasang = false; tampil(); return; }
  let lanjutSekali = false;
  const lanjut = () => { if (lanjutSekali) return; lanjutSekali = true; gsap.set('#vPasang', { opacity: 1 }); sedangPasang = false; tampil(); };
  const tl = kainP.nyanting();
  tl.eventCallback('onComplete', () => { gsap.to('#vPasang', { opacity: 0, duration: .5, delay: .4, onComplete: lanjut }); });
  setTimeout(lanjut, 10000);   // jaring pengaman: animasi tidak berjalan bila tab sedang di latar belakang
}
$('btnPasang').addEventListener('click', lembarPasang);
$('sTanda').addEventListener('click', () => onYa && onYa());
$('sBatal').addEventListener('click', tutupLembar);
lapis.addEventListener('click', (e) => { if (e.target === lapis && !$('sBatal').disabled) tutupLembar(); });
lapis.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('sBatal').disabled) tutupLembar(); });

/* =====================================================================
   KELOLA
   ===================================================================== */
let kainK = null, rK = null, daftarK = [], bMode = '', hTahan = null;
const tambahan = new Map();   // key → { saldo, cair } untuk penerima di luar tujuh id demo (tidak dilacak inti)

function tampilKelola(animasi = true) {
  $('vPasang').hidden = true; $('vKelola').hidden = false;
  rK = hitung();
  if (!rK.ok) { f = S.AWAL_ATURAN(); simpan(); rK = hitung(); }
  const s = S.s;
  kainK = kainDi($('kainKelola'), s.status === 3 ? 'celup' : 'lilin', .35);
  kainK.atur(rK.bands, { animasi: false });
  hubungkanSorot(kainK, $('rincianKelola'));
  $('bunyiK').textContent = bunyiAturan(rK);
  bangunPenerimaK();
  bMode = '';
  renderKelola(true);
  if (animasi && !Demo.diam) {
    UI.masuk([document.querySelector('#chip'), $('kJudul'), $('kSub')]);
    gsap.fromTo('#bukti, .aturan > div', { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: .7, stagger: .08, ease: 'power3.out', delay: .2, overwrite: true, clearProps: 'opacity,transform' });
  }
}

/* ---------- daftar penerima: cara menerima dan, setelah dibagikan, status pencairan ---------- */
const fracOrang = (o) => (o.rel === 'wasiat' ? `${D.str(o.frac)} wasiat` : o.bersama > 0 ? `separuh harta bersama + ${D.str(o.frac)}` : D.str(o.frac));
function bangunPenerimaK() {
  const hit = {}, banyak = {};
  rK.hasil.orang.forEach((o) => { banyak[o.rel] = (banyak[o.rel] || 0) + 1; });
  daftarK = rK.hasil.orang.map((o) => {
    const n = (hit[o.rel] = (hit[o.rel] || 0) + 1) - 1, key = `${o.rel}-${n}`;
    const dasar = { pasangan: f.laki ? 'Istri' : 'Suami', putra: 'Anak laki-laki', putri: 'Anak perempuan', ayah: 'Ayah', ibu: 'Ibu' }[o.rel];
    const label = o.rel === 'wasiat' ? o.label : (banyak[o.rel] > 1 ? `${dasar} ${D.URUT[n]}` : dasar);
    return { key, id: IDKEY[key] || null, label, o, htmlCara: '', htmlCair: '' };
  });
  const host = $('rincianKelola');
  host.innerHTML = daftarK.map((p) => `<div class="r" data-keys="${p.key}"><i style="background:${p.o.dye}"></i><span>${esc(p.label)}</span><span class="frac">${fracOrang(p.o)}</span><b>${D.rp(p.o.total)}</b><small class="cara"></small><small class="cair" hidden></small></div>`).join('');
  [...host.children].forEach((row, i) => { daftarK[i].elCara = row.querySelector('.cara'); daftarK[i].elCair = row.querySelector('.cair'); });
  pasanganSorot.get(host).akhir = '';
}
/* Cara terima dari inti (Demo.caraTerima) untuk tujuh id demo; selain itu dari aturan di formulir */
function infoCara(p) {
  const c = p.id ? S.caraTerima(p.id) : null;
  const t = terimaDi(p.key);
  const dasar = c || { id: null, cara: t.cara, nama: t.nama || '', wa: t.wa || '', bank: t.cara === 'bank' ? t.bank : '', akhiran: t.cara === 'bank' ? S.akhiranDari(t.nomor) : '', alamat: null, saldo: 0, cair: null, ewallet: S.EWALLET.has(t.bank) };
  const x = p.id ? null : tambahan.get(p.key);
  return x ? { ...dasar, saldo: x.saldo, cair: x.cair } : dasar;
}
function teksCara(p, c) {
  const t = terimaDi(p.key), nama = String(t.nama || c.nama || '').trim();
  let cara;
  if (c.cara === 'bank') cara = `${c.ewallet ? 'E-wallet' : 'Rekening bank'} · ${esc(c.bank)} ••••${esc(c.akhiran)}`;
  else if (c.cara === 'amplop') cara = `Amplop WhatsApp${c.wa ? ' · ' + esc(c.wa) : ''}`;
  else {
    const a = String(t.alamat || '').trim();
    cara = alamatKriptoValid(p.key, a) ? `Dompet kripto · ${S.pendek(a)}` : 'Dompet kripto · memakai amplop';
  }
  return (nama ? `${esc(nama)} · ` : '') + cara;
}
/* Status pencairan satu penerima setelah warisan dibagikan. j = jenis, dipakai untuk ringkasan. */
function keadaanBayar(p, c) {
  const cair = c.cair, saldo = c.saldo || 0, t = terimaDi(p.key);
  const rek = (x) => `${esc(x.bank)} ••••${esc(x.akhiran)}`;
  const ref = (x) => { const r = S.refBank(x.bukti, x.selesai || Date.now()); return r ? ` · ${r}` : ''; };
  const jam = (x) => (x.selesai ? ` pukul ${D.jam(x.selesai)}` : '');
  if (c.cara === 'bank') {
    if (cair && cair.tahap === 'selesai') return { j: 'selesai', ya: true, teks: `Sudah ditransfer ke ${rek(cair)}${jam(cair)}${ref(cair)}` };
    if (cair && cair.tahap === 'diproses') return { j: 'proses', ya: false, teks: `Transfer ke ${rek(cair)} sedang diproses…` };
    if (cair && cair.tahap === 'dikembalikan') return { j: 'gagal', ya: false, teks: 'Transfer gagal. Dana dikembalikan ke amplopnya.' };
    return { j: 'tunggu', ya: false, teks: saldo > 0 ? 'Dana sudah di rekening virtual. Menunggu mitra mentransfer…' : 'Menunggu mitra pencairan…' };
  }
  if (c.cara === 'kripto' && alamatKriptoValid(p.key, String(t.alamat || '').trim())) return { j: 'dompet', ya: true, teks: 'tIDR sudah masuk ke dompetnya' };
  // amplop, atau dompet kripto yang dikosongkan (memakai amplop)
  if (cair && cair.tahap === 'selesai') return { j: 'dicairkan', ya: true, teks: `Sudah dicairkan ke ${rek(cair)}${jam(cair)}${ref(cair)}` };
  if (cair && cair.tahap === 'diproses') return { j: 'dicairkan', ya: false, teks: `Sedang dicairkan ke ${rek(cair)}…` };
  if (cair && cair.tahap === 'dikembalikan') return { j: 'gagal', ya: false, teks: 'Pencairan gagal. Dana kembali ke amplop.' };
  if (saldo > 0) return { j: 'belum', ya: false, teks: 'Belum dicairkan. Menunggu ahli waris membuka tautannya.' };
  return { j: 'muat', ya: false, teks: 'Memeriksa saldo…' };
}
function perbaruiCair() {
  if (!daftarK.length || $('vKelola').hidden) return;
  const status = S.s.status, n = { bank: 0, bankSelesai: 0, amplop: 0, amplopCair: 0, amplopBelum: 0, dompet: 0 };
  daftarK.forEach((p) => {
    const c = infoCara(p), hCara = teksCara(p, c);
    if (hCara !== p.htmlCara) { p.htmlCara = hCara; p.elCara.innerHTML = hCara; }
    const a = p.id ? S.s.penerima[p.id].alamat : tujuanAman(p.key);
    if (a && p.elCara.title !== a) p.elCara.title = a;
    if (status !== 3) { p.elCair.hidden = true; return; }
    const k = keadaanBayar(p, c);
    const h = `${k.ya ? 'ya|' : ''}<i></i><span>${k.teks}</span>`;
    if (h !== p.htmlCair) { p.htmlCair = h; p.elCair.className = 'cair' + (k.ya ? ' ya' : ''); p.elCair.innerHTML = `<i></i><span>${k.teks}</span>`; }
    p.elCair.hidden = false;
    if (k.j === 'dompet') n.dompet++;
    else if (c.cara === 'bank') { n.bank++; if (k.j === 'selesai') n.bankSelesai++; }
    else { n.amplop++; if (k.j === 'dicairkan') n.amplopCair++; if (k.j === 'belum') n.amplopBelum++; }
  });
  const ringkas = $('bRingkas');
  if (ringkas && status === 3) {
    const baris = [];
    if (n.bank) baris.push(n.bankSelesai === n.bank ? `Semua ${n.bank} rekening bank sudah menerima transfer.` : `${n.bankSelesai} dari ${n.bank} rekening bank sudah menerima transfer.`);
    if (n.amplop) baris.push(n.amplopCair ? `${n.amplopCair} dari ${n.amplop} amplop sudah dicairkan.` : `${n.amplop} amplop menunggu dibuka ahli waris.`);
    if (n.dompet) baris.push(`${n.dompet} dompet kripto sudah menerima tIDR.`);
    const h = baris.map((b) => `<p>${b}</p>`).join('');
    if (ringkas.innerHTML !== h) ringkas.innerHTML = h;
  }
}
/* Penerima di luar tujuh id demo tidak dilacak inti; statusnya dibaca langsung dari mitra selama status 3 */
let sedangBaca = false;
async function bacaTambahan() {
  if (sedangBaca || S.s.status !== 3 || $('vKelola').hidden || document.hidden) return;
  const luar = daftarK.filter((p) => !p.id && tujuanAman(p.key));
  if (!luar.length) return;
  sedangBaca = true;
  try {
    const st = await S.bacaMitra('statusBanyak', [luar.map((p) => tujuanAman(p.key))]);
    luar.forEach((p, i) => {
      const x = st[i], lama = tambahan.get(p.key);
      const tahap = x.adaPencairan ? S.TAHAP[Number(x.pencairan.tahap)] : null;
      tambahan.set(p.key, {
        saldo: S.juta(x.saldo),
        cair: x.adaPencairan ? {
          no: Number(x.no), tahap, jumlah: S.juta(x.pencairan.jumlah), bank: x.bankTujuan, akhiran: x.akhiranTujuan, bukti: x.pencairan.bukti,
          selesai: tahap === 'selesai' ? ((lama && lama.cair && lama.cair.selesai) || Date.now()) : null,
        } : null,
      });
    });
    perbaruiCair();
  } catch (e) { console.warn('Status mitra untuk penerima tambahan belum terbaca', e); } finally { sedangBaca = false; }
}
setInterval(bacaTambahan, 2000);

function renderKelola(paksa = false) {
  const s = S.s;
  document.title = (s.status === 3 ? 'Dompet almarhum Budi Santoso' : 'Dompet Budi Santoso') + ' — Pusaka';
  const chip = $('chip'), chipT = $('chipT');
  if (s.status === 3) { chip.dataset.s = 'dibagikan'; chipT.textContent = 'Warisan sudah dibagikan'; }
  else if (s.status === 2) { chip.dataset.s = 'dipicu'; chipT.textContent = 'Masa sanggah'; }
  else { chip.dataset.s = 'aktif'; chipT.textContent = 'Aturan aktif'; }
  $('kJudul').textContent = s.status === 3 ? 'Dompet almarhum Budi Santoso' : 'Dompet Budi Santoso';
  $('kSub').innerHTML = `<b>${D.pewaris.alamat}</b> ${s.status === 3 ? 'sekarang berisi' : 'berisi'} <b>${D.rp(s.tidr)} tIDR</b>`;
  // saksi
  $('daftarSaksiK').innerHTML = f.saksi.map((k, i) => {
    const t = s.attest[i];
    return `<div><span>${esc(k.nama)}</span><small>${esc(k.peran)}, ${D.saksi[i].alamat}</small><em class="${t ? 'ya' : ''}"><i></i>${t ? 'Mengonfirmasi ' + D.jam(t) : 'Belum'}</em></div>`;
  }).join('');
  const nBank = jumlahBank();
  $('daftarWaktu').innerHTML = [
    ['Konfirmasi dibutuhkan', `${f.ambang} dari 3 saksi`],
    ['Batas tanpa bukti hidup', UI.durasi(s.batas)],
    ['Masa sanggah', UI.durasi(s.sanggah)],
    ['Rekening bank terdaftar', nBank ? `${nBank} di mitra pencairan` : 'Tidak ada'],
    ['Token', 'tIDR'],
    ['Dipasang', s.setupAt ? D.jam(s.setupAt) : '—'],
  ].map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('');
  $('btnCabut').hidden = s.status !== 1;
  renderBukti(paksa);
  perbaruiCair();
}

/* ---------- panel Bukti hidup ----------
   Tidak ada tombol yang wajib ditekan. Aktivitas dompet dan kabar hidup bertanda tangan sudah cukup;
   saat masa sanggah, tahan "Saya masih hidup" atau lakukan transaksi apa pun. */
function modeBukti() {
  const s = S.s;
  if (s.status === 3) return 'dibagikan';
  if (s.status === 2) return S.sisaSanggah() > 0 ? 'sanggah' : 'habis';
  return 'aktif';
}
const TEKS_TAHAN = 'Tahan: Saya masih hidup';
const viaTeks = (v) => S.VIA_TEKS[v] || 'pemasangan aturan';
function renderBukti(paksa) {
  const m = modeBukti(), s = S.s, j = $('bukti');
  if (m === bMode && !paksa) return;
  bMode = m; hTahan = null;
  j.classList.toggle('genting', m === 'sanggah');
  if (m === 'aktif') {
    j.innerHTML = `<h2>Bukti hidup</h2>
      <p class="ket-j">Kamu tidak perlu menekan apa pun. Setiap transaksi dari dompetmu otomatis tercatat sebagai bukti hidup.</p>
      <div class="baris-j"><span>Terakhir tercatat</span><b id="bLalu"></b></div>
      <p class="via" id="bVia"></p>
      <div class="jalur"><i id="bJalur"></i></div>
      <div class="baris-j"><span id="bBatas"></span><b id="bSisa"></b></div>
      <p class="ket-j" id="bKet"></p>
      <div class="aksi">
        <button class="btn btn--penuh" id="bBayar" type="button">Bayar Rp250.000 (contoh transaksi)</button>
        <p class="ket-aksi">Transaksi biasa dari dompetmu, misalnya membayar di warung. Transaksi apa pun otomatis jadi bukti hidup, tanpa langkah tambahan.</p>
        <button class="btn btn--garis btn--penuh" id="bKabar" type="button">Kirim kabar hidup</button>
        <p class="ket-aksi">Hanya tanda tangan. Pusaka yang mengirimnya, biaya untukmu Rp0.</p>
      </div>
      <p class="pesan" id="bPesan"></p>
      <button class="btn btn--teks btn--kecil cadangan" id="bCadangan" type="button" title="Transaksi heartbeat() biasa dari dompetmu">Tombol cadangan: Saya masih hidup</button>`;
    $('bBayar').onclick = (e) => aksiBukti(e.currentTarget, 'aktivitas', () => S.bayar());
    $('bKabar').onclick = (e) => aksiBukti(e.currentTarget, 'kabar', () => S.kabar());
    $('bCadangan').onclick = (e) => aksiBukti(e.currentTarget, 'hidup', () => S.hidup());
  } else if (m === 'sanggah') {
    const lengkap = s.attest.map((t, i) => (t && f.saksi[i] ? f.saksi[i].nama : null)).filter(Boolean);
    const nama = lengkap.map(namaPendek);
    j.innerHTML = `<h2>${s.alasan === 'tidak aktif' ? 'Kamu dianggap tidak aktif.' : `${esc(D.daftarKata(nama))} mengonfirmasi wafatmu.`}</h2>
      <p class="via">${s.alasan === 'tidak aktif' ? `Tidak ada bukti hidup selama ${UI.durasi(s.batas)}.` : `${lengkap.length} dari ${f.saksi.length} saksi menandatangani: ${esc(D.daftarKata(lengkap))}.`}</p>
      <div class="hitung angka" id="bHitung"></div>
      <div class="jalur"><i id="bJalur"></i></div>
      <p class="ket-j">Jika kamu masih hidup, tandai sebelum waktu habis. Pemicu dibatalkan dan semua konfirmasi saksi dihapus.</p>
      <button class="btn btn--besar btn--penuh tahan btn--denyut" id="bTahan" type="button">${TEKS_TAHAN}</button>
      <p class="ket-aksi">Tahan sampai penuh. Kamu hanya menandatangani, biaya untukmu Rp0.</p>
      <div class="aksi atau">
        <button class="btn btn--teks btn--kecil" id="bBayarS" type="button">atau lakukan transaksi apa pun</button>
        <p class="ket-aksi">Contoh: bayar Rp250.000 dari dompetmu. Transaksi apa pun otomatis membatalkan pemicu.</p>
      </div>
      <p class="pesan" id="bPesan"></p>`;
    const tb = $('bTahan');
    hTahan = UI.tahan(tb, {
      lama: 1100,
      onSelesai: async () => {
        $('bBayarS').disabled = true;
        tb.classList.remove('btn--denyut');
        tb.innerHTML = '<i class="spin"></i>Mengirim';
        const hasil = await S.kabar();
        if (hasil) { catatBukti('batal', hasil.blok); return; }
        // ditolak (mis. masa sanggah baru saja habis): tombol kembali siap
        const t2 = $('bTahan'), b2 = $('bBayarS');
        if (t2) { t2.textContent = TEKS_TAHAN; t2.classList.add('btn--denyut'); }
        if (hTahan) hTahan.reset();
        if (b2) b2.disabled = false;
      },
    });
    $('bBayarS').onclick = (e) => aksiBukti(e.currentTarget, 'batal', () => S.bayar());
  } else if (m === 'habis') {
    j.innerHTML = `<h2>Masa sanggah sudah habis.</h2>
      <p class="ket-j">Aturan tidak bisa dibatalkan lagi. Siapa pun sekarang bisa membagikan warisan, termasuk dari layar Saksi atau Panggung.</p>
      <div class="aksi"><button class="btn btn--besar btn--penuh" id="bBagi" type="button">Bagikan warisan</button></div>`;
    $('bBagi').onclick = (e) => aksiBukti(e.currentTarget, 'bagikan', () => S.bagikan());
  } else {
    j.innerHTML = `<h2>Warisan sudah dibagikan.</h2>
      <p class="ket-j">Final di blok ${Demo.blok(s.distributedAt).toLocaleString('id-ID')} pukul ${D.jam(s.distributedAt)}. Seluruh tIDR di dompet ini sudah dibagikan ke ${rK.hasil.orang.length} penerima.</p>
      <div class="ringkas-cair" id="bRingkas"></div>
      <p class="t-micro">Transfer bank disimulasikan di testnet.</p>
      ${Demo.EXPLORER ? `<a class="btn btn--garis btn--penuh penuh-tautan" href="${Demo.EXPLORER}/address/${Demo.pewaris}" target="_blank" rel="noopener">Lihat dompet di MonadVision</a>` : ''}`;
  }
  if (!Demo.diam && !paksa) UI.masuk(j.querySelector('h2'));
  detak();
}

/* Jalankan satu aksi dari panel: semua tombol dikunci, yang ditekan menampilkan "Mengirim", lalu hasilnya dicatat */
let tekanTerakhir = 0, pesanAktif = false;
async function aksiBukti(tombol, jenis, kerja) {
  const awal = tombol.innerHTML;
  $('bukti').querySelectorAll('button').forEach((b) => { b.disabled = true; });
  tombol.innerHTML = '<i class="spin"></i>Mengirim';
  let hasil = null;
  try { hasil = await kerja(); } catch (e) { console.error(e); }
  // panel mungkin sudah digambar ulang (mis. masa sanggah dibatalkan): yang tersisa cukup dibuka kuncinya
  tombol.innerHTML = awal;
  $('bukti').querySelectorAll('button').forEach((b) => { b.disabled = false; });
  if (hasil) catatBukti(jenis, hasil.blok);
}
/* Satu baris di bawah tombol: apa yang baru saja tercatat */
function catatBukti(sebab, blokN) {
  const by = $('bPesan'); if (!by) return;
  const n = (blokN || S.blok()).toLocaleString('id-ID');
  const teks = sebab === 'kabar' ? `Tercatat di blok ${n} · biaya untukmu Rp0`
    : sebab === 'aktivitas' ? `Tercatat di blok ${n} · transaksi dari dompetmu otomatis jadi bukti hidup`
    : sebab === 'hidup' ? `Tercatat di blok ${n} · lewat tombol cadangan`
    : sebab === 'batal' ? `Pemicu dibatalkan di blok ${n} (${viaTeks(S.s.lastVia)}). Konfirmasi saksi dihapus.` : '';
  if (!teks) return;
  tekanTerakhir = Date.now(); pesanAktif = true;
  if (by.textContent === teks) return;
  by.textContent = teks; by.classList.add('ok');
  if (!Demo.diam) UI.masuk(by);
}

function detak() {
  if ($('vKelola').hidden) return;
  const s = S.s, now = Date.now(), m = modeBukti();
  if (m !== bMode) renderBukti();
  if (m === 'aktif') {
    const lalu = now - s.lastBeat, sisa = S.sisaBatas(now), batasMs = s.lastBeat + s.batas * 1000;
    setTeks('bLalu', laluPanjang(lalu));
    setTeks('bVia', `Lewat ${viaTeks(s.lastVia)}`);
    setTeks('bBatas', `Batas ${UI.durasi(s.batas)}`);
    setTeks('bSisa', sisa > 0 ? `sisa ${kataSisa(sisa)}` : 'sudah lewat');
    const jl = $('bJalur'); if (jl) jl.style.width = Math.min(100, lalu / (s.batas * 1000) * 100) + '%';
    setTeks('bKet', sisa > 0
      ? `Tanpa bukti hidup sampai ${s.batas < 86400 ? 'pukul ' + D.jam(batasMs).slice(0, 5) : tglPanjang(batasMs)}, siapa pun bisa memicu masa sanggah. Jika dompetmu diam ${teksPengingat(s.batas)}, Pusaka mengirim pengingat.`
      : 'Batas tanpa bukti hidup sudah lewat. Siapa pun bisa memicu masa sanggah sekarang. Satu transaksi atau kabar hidup masih bisa menundanya.');
    const by = $('bPesan');
    if (by && pesanAktif && now - tekanTerakhir > 8000) { pesanAktif = false; by.classList.remove('ok'); by.textContent = ''; }
  } else if (m === 'sanggah') {
    const sisa = S.sisaSanggah(now), p = 1 - sisa / s.sanggah;
    const h = $('bHitung');
    if (h) {
      if (sisa >= 3600) { h.classList.add('panjang'); setTeks('bHitung', kataSisa(sisa)); } else { h.classList.remove('panjang'); UI.digit(h, D.mmss(sisa)); }
    }
    const jl = $('bJalur'); if (jl) jl.style.width = (p * 100) + '%';
    if (kainK && !kainK._rendamTween) kainK.soak = .06 + .34 * p;
  }
}
setInterval(detak, 250);

$('btnCabut').addEventListener('click', () => bukaLembar({
  judul: 'Cabut aturan dari dompet?',
  ket: 'Dompet kembali menjadi dompet biasa. Saksi tidak bisa lagi mengonfirmasi, dan tidak ada yang dibagikan. Rekening bank yang sudah didaftarkan tetap tercatat di mitra dan dipakai lagi jika kamu memasang aturan baru.',
  rinci: [['Fungsi', 'cancelSetup()'], ['Batas gas', '300.000']],
  tombol: 'Cabut aturan',
  ya: async () => {
    $('sTanda').disabled = true; $('sBatal').disabled = true;
    status('<i class="spin"></i><span>Mengirim transaksi…</span>');
    const hasil = await S.cabut();
    if (!hasil) { status(`<p class="tolak"><b>Belum dicabut.</b> ${esc(Demo.pesanTerakhir || '')}</p>`); $('sTanda').disabled = false; $('sBatal').disabled = false; return; }
    tutupLembar();
  },
}));

/* ---------- reaksi status ---------- */
function tampil(animasi = true) {
  if (S.s.status === 0) tampilPasang(animasi); else tampilKelola(animasi);
}
S.on((s, prev, sebab) => {
  if (sebab === 'gas' || sebab === 'qr') return;
  if (sebab === 'ulang' || sebab === 'preset') { sedangPasang = false; f = S.AWAL_ATURAN(); ingat = {}; simpan(); tampil(false); return; }
  if (sedangPasang) return;   // kain sedang dilukis; tampil() dipanggil sendiri begitu animasinya selesai
  if (sebab === 'cabut' || sebab === 'pasang') { tampil(); return; }
  if ($('vKelola').hidden) { if (s.status !== 0) tampil(); return; }
  if (s.status === 0) { tampil(); return; }
  if (sebab === 'dibagikan') {
    renderKelola(true);
    kainK.rendam(0, 1.2);
    kainK.mode('celup', { dur: 3.2 });
    return;
  }
  if (sebab === 'batal') {
    renderKelola(true);
    const t = kainK.rendam(0, 1.2); kainK._rendamTween = t; t.eventCallback('onComplete', () => { kainK._rendamTween = null; });
    catatBukti('batal', (Demo.hasilTerakhir('batal') || {}).blok);
    return;
  }
  if (sebab === 'dipicu') {
    const t = kainK.rendam(.06, .8); kainK._rendamTween = t;
    t.eventCallback('onComplete', () => { kainK._rendamTween = null; });
  }
  if (sebab === 'hidup' || sebab === 'aktivitas' || sebab === 'kabar') {
    renderKelola(false);
    catatBukti(sebab, (Demo.hasilTerakhir(sebab) || {}).blok);
    return;
  }
  renderKelola(sebab === 'dipicu');
});

let ukuranTerakhir = innerWidth;
addEventListener('resize', () => {
  clearTimeout(window._rs);
  window._rs = setTimeout(() => { if (Math.abs(innerWidth - ukuranTerakhir) > 40) { ukuranTerakhir = innerWidth; tampil(false); } }, 250);
});

document.fonts.ready.then(() => tampil(true));
