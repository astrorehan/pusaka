import '@web/src/boot.js';
const D = Pusaka;
Latar.pasang();
Demo.panel({ judul: 'Panel demo', aksiStatus: false });
document.getElementById('logo').outerHTML = UI.MEREK;
const $ = (id) => document.getElementById(id);

/* ---------- tema ---------- */
document.querySelectorAll('input[name="tema"]').forEach((r) => {
  r.checked = (r.value === 'terang') === (document.documentElement.dataset.tema === 'terang');
  r.onchange = () => {
    const terang = r.value === 'terang';
    if (terang) document.documentElement.dataset.tema = 'terang'; else delete document.documentElement.dataset.tema;
    try { localStorage.setItem('pusaka-tema', r.value); } catch {}
    $('warnaTema').content = terang ? '#e8eaef' : '#131b33';
    Latar.gambar && Latar.gambar();
  };
});
if (document.documentElement.dataset.tema === 'terang') $('warnaTema').content = '#e8eaef';

/* ---------- contoh susunan dari faraid-spec.md ---------- */
const DASAR = { harta: 120, laki: true, istri: 0, suami: false, putra: 0, putri: 0, ayah: false, ibu: false, saudara: 0, kerabatLain: false, bersama: 'tidak', wasiat: '', raddPasangan: false };
const CONTOH = [
  ['budi', 'Keluarga Pak Budi', { harta: 300, istri: 1, putra: 2, putri: 1, ayah: true, ibu: true, bersama: 'seluruh', wasiat: '1/5' }],
  ['aul', 'Bagian melebihi harta', { laki: false, suami: true, putri: 2, ayah: true, ibu: true }],
  ['radd', 'Ada sisa harta', { putri: 1, ibu: true }],
  ['gharrawain', 'Gharrawain', { laki: false, suami: true, ayah: true, ibu: true }],
  ['duaistri', 'Dua istri', { harta: 160, istri: 2, putra: 1 }],
  ['saudara', 'Ada saudara', { istri: 1, saudara: 1 }],
];
let f = { ...DASAR, ...CONTOH[0][2] };
$('contoh').innerHTML = CONTOH.map(([k, l]) => `<button type="button" data-c="${k}" aria-pressed="${k === 'budi'}">${l}</button>`).join('');
$('contoh').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  const c = CONTOH.find(([k]) => k === b.dataset.c);
  f = { ...DASAR, ...c[2] };
  isiForm(); hitungUlang();
  if (f.bersama !== 'tidak' || f.wasiat || f.raddPasangan) $('lanjutan').open = true;
});
const tandaiContoh = () => {
  const cocok = CONTOH.find(([, , v]) => JSON.stringify({ ...DASAR, ...v }) === JSON.stringify(f));
  $('contoh').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(!!cocok && b.dataset.c === cocok[0])));
};

/* ---------- isian ---------- */
const fmtRp = (n) => Math.round(n).toLocaleString('id-ID');
function stepper(el) {
  const k = el.dataset.k, min = +el.dataset.min, max = +el.dataset.max;
  el.innerHTML = `<button type="button" aria-label="Kurangi">−</button><output aria-live="polite"></output><button type="button" aria-label="Tambah">+</button>`;
  const [kurang, , tambah] = el.children, out = el.querySelector('output');
  el.set = () => { out.textContent = f[k]; kurang.disabled = f[k] <= min; tambah.disabled = f[k] >= max; };
  kurang.onclick = () => { f[k] = Math.max(min, f[k] - 1); el.set(); hitungUlang(); };
  tambah.onclick = () => { f[k] = Math.min(max, f[k] + 1); el.set(); hitungUlang(); };
}
document.querySelectorAll('#form .stepper').forEach(stepper);
function isiForm() {
  $('harta').value = fmtRp(f.harta * 1e6);
  document.querySelectorAll('#form .stepper').forEach((el) => el.set());
  document.querySelectorAll('#form .saklar input').forEach((c) => { c.checked = !!f[c.dataset.k]; });
  document.querySelectorAll('input[name="kelamin"]').forEach((r) => { r.checked = (r.value === 'laki') === f.laki; });
  document.querySelectorAll('input[name="bersama"]').forEach((r) => { r.checked = r.value === f.bersama; });
  $('selWasiat').value = f.wasiat;
}
document.querySelectorAll('#form .saklar input').forEach((c) => { c.onchange = () => { f[c.dataset.k] = c.checked; hitungUlang(); }; });
document.querySelectorAll('input[name="kelamin"]').forEach((r) => { r.onchange = () => { f.laki = r.value === 'laki'; hitungUlang(); }; });
document.querySelectorAll('input[name="bersama"]').forEach((r) => { r.onchange = () => { f.bersama = r.value; hitungUlang(); }; });
$('selWasiat').onchange = (e) => { f.wasiat = e.target.value; hitungUlang(); };
$('harta').addEventListener('input', (e) => {
  const digit = e.target.value.replace(/\D/g, '').slice(0, 15);
  const n = +digit || 0;
  e.target.value = digit ? fmtRp(n) : '';
  f.harta = n / 1e6;
  hitungUlang(false);
});

/* ---------- hitung ---------- */
function hitung() {
  const fam = { laki: f.laki, istri: f.laki ? f.istri : 0, suami: f.laki ? 0 : (f.suami ? 1 : 0), putra: f.putra, putri: f.putri, ayah: f.ayah, ibu: f.ibu, saudara: f.saudara, kerabatLain: f.kerabatLain };
  const nPas = fam.istri + fam.suami;
  const bersama = nPas === 1 ? ({ seluruh: D.F(1), separuh: D.F(1, 2) }[f.bersama] || D.F(0)) : D.F(0);
  const wasiat = f.wasiat ? [{ label: 'Penerima wasiat', bagian: D.F(...f.wasiat.split('/').map(Number)) }] : [];
  try {
    const hasil = D.bagi(f.harta || 0, fam, { bersama, wasiat, raddPasangan: f.raddPasangan });
    return { ok: true, fam, nPas, hasil, grup: D.ringkas(hasil, f.laki), bands: D.bidangKain(hasil) };
  } catch (e) {
    if (!(e instanceof D.Ditolak)) throw e;
    return { ok: false, fam, nPas, e };
  }
}

let kain = null, akhir = null;
function hitungUlang(animasi = true) {
  const r = hitung(); akhir = r;
  $('rIstri').hidden = !f.laki; $('rSuami').hidden = f.laki;
  const bisaBersama = r.nPas === 1;
  document.querySelectorAll('input[name="bersama"]').forEach((x) => { x.disabled = !bisaBersama && x.value !== 'tidak'; x.checked = (bisaBersama ? f.bersama : 'tidak') === x.value; });
  $('lblBersama').innerHTML = bisaBersama ? 'Harta bersama<small>Separuhnya milik pasangan, dipisahkan sebelum faraid</small>' : 'Harta bersama<small>Hanya bisa jika pasangan tepat satu orang</small>';
  tandaiContoh();
  if (kain) {
    const ada = r.ok && r.bands.some((b) => b.amount > 0);
    if (ada) {
      kain.atur(r.bands, { animasi: animasi && !Demo.diam });
      if (kain.st.a < .5) kain.mode('celup', { dur: .6, animasi: !Demo.diam });
    } else kain.mode('kosong', { dur: .5, animasi: !Demo.diam });
    pesanKain(ada ? '' : r.ok ? 'Isi harta yang dibagi' : 'Kain dibiarkan polos');
  }
  renderHasil(r);
}

/* Kain polos diberi keterangan langsung di atas mori */
function pesanKain(teks) {
  const p = $('kainPesan');
  if (teks === p.dataset.teks) return;
  p.dataset.teks = teks;
  gsap.killTweensOf(p);
  if (!teks) { gsap.to(p, { opacity: 0, duration: Demo.diam ? 0 : .2 }); return; }
  p.textContent = teks;
  gsap.fromTo(p, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: Demo.diam ? 0 : .6, delay: Demo.diam ? 0 : .35, ease: 'power2.out' });
}

function renderHasil(r) {
  const isi = $('isiHasil');
  if (!r.ok) {
    $('alur').innerHTML = ''; $('alur').hidden = true;
    isi.innerHTML = `<div class="tolak-blok"><h2>Pusaka menolak menghitung susunan ini.</h2>
      <p class="tolak"><b>${r.e.jenis === 'InvalidFamily' ? 'Susunan tidak valid.' : 'Belum didukung.'}</b> ${r.e.message}</p>
      <p class="redup">Lebih baik menolak daripada salah membagi. Untuk susunan seperti ini, tanyakan kepada ahli faraid atau Pengadilan Agama.</p></div>`;
    return;
  }
  const h = r.hasil, pas = f.laki ? 'istri' : 'suami';
  const wasiatJt = h.warisan - h.kolam;
  const alur = [[`Harta`, D.jt(h.harta)]];
  if (h.jointPasangan > 0) alur.push([`Harta bersama untuk ${pas}`, D.jt(h.jointPasangan)]);
  if (wasiatJt > 0) alur.push(['Wasiat', D.jt(wasiatJt)]);
  alur.push(['Dibagi menurut faraid', D.jt(h.kolam)]);
  const alurHtml = alur.length > 2 ? alur.map(([a, b]) => `<div><small>${a}</small><b>${b}</b></div>`).join('') : '';
  $('alur').innerHTML = alurHtml; $('alur').hidden = !alurHtml;
  const catatan = ['aul', 'radd', 'raddPasangan', 'gharrawain'].filter((k) => h.flags.has(k)).map((k) => `<p>${D.CATATAN[k]}</p>`).join('');
  isi.innerHTML = `<div class="rincian" id="rincian">${r.grup.map((g) => `<div class="r" data-keys="${g.keys.join(' ')}">
      <i style="background:${g.dye}"></i>
      <div class="nama"><b>${g.nama}</b><span class="frac">${g.fracTeks}</span></div>
      <span class="rp">${g.n > 1 ? `${g.n} × ${D.rp(g.tiap)}` : D.rp(g.total)}</span>
      <p>${D.alasan(g.orang[0], r.fam, h.flags)}</p></div>`).join('')}</div>
    ${catatan ? `<div class="catatan">${catatan}</div>` : ''}`;
}

/* Sorotan dua arah: kain dan daftar */
let sorotAkhir = '';
function sorot(key) {
  const k = key == null ? '' : [].concat(key).join(' ');
  if (k === sorotAkhir || !kain) return;
  sorotAkhir = k; kain.sorot(key);
  const set = new Set(k.split(' '));
  document.querySelectorAll('#rincian .r').forEach((row) => row.classList.toggle('sorot', !!k && row.dataset.keys.split(' ').some((x) => set.has(x))));
}
$('isiHasil').addEventListener('pointerover', (e) => { const row = e.target.closest('.r'); if (row && e.pointerType !== 'touch') sorot(row.dataset.keys.split(' ')); });
$('isiHasil').addEventListener('pointerleave', () => sorot(null));

/* ---------- kain ---------- */
let lebarKain = 0;
function buatKain() {
  const host = $('kainHost');
  host.innerHTML = '';
  const lebar = Math.max(300, Math.round(host.clientWidth));
  lebarKain = lebar;
  const sempit = lebar < 600;
  const F = sempit ? 7 : 12, B = sempit ? 12 : 22, W = lebar - 2 * F, H = Math.round(W * (sempit ? .36 : .38));
  kain = Kain.hidup(host.appendChild(document.createElement('div')), { W, H, B, F, k: .42, q: sempit ? .6 : .5, seed: 7, mode: 'celup' });
  kain.el.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    const rc = kain.el.getBoundingClientRect(), b = kain.bidangDi(e.clientX - rc.left, e.clientY - rc.top);
    sorot(b ? b.pemilik : null);
  });
  kain.el.addEventListener('pointerleave', () => sorot(null));
  sorotAkhir = '';
  if (akhir && akhir.ok) kain.atur(akhir.bands, { animasi: false }); else kain.mode('kosong', { animasi: false });
  document.documentElement.style.setProperty('--tinggi-kain', $('kainBlok').offsetHeight + 'px');
}
addEventListener('resize', () => { clearTimeout(window._rs); window._rs = setTimeout(() => { if (Math.abs($('kainHost').clientWidth - lebarKain) > 24) buatKain(); }, 200); });

/* Alas di belakang kain hanya tampil saat kain sedang menempel */
let rafLekat = 0;
function cekLekat() {
  rafLekat = 0;
  const kb = $('kainBlok'), atas = parseFloat(getComputedStyle(kb).top) || 0;
  kb.classList.toggle('lekat', scrollY > 0 && kb.getBoundingClientRect().top <= atas + .5);
}
addEventListener('scroll', () => { if (!rafLekat) rafLekat = requestAnimationFrame(cekLekat); }, { passive: true });

document.fonts.ready.then(() => {
  isiForm();
  $('lanjutan').open = f.bersama !== 'tidak' || !!f.wasiat;
  akhir = hitung();
  buatKain();
  hitungUlang(false);
  UI.masuk('.judul-halaman .resap');
  if (!Demo.diam) {
    gsap.fromTo('#kainHost', { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 1.2, ease: 'power3.inOut', delay: .15 });
    gsap.from('.contoh button, .isian-blok > *', { opacity: 0, y: -6, duration: .6, stagger: .04, ease: 'power3.out', delay: .2 });
  }
});
