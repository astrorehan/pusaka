import '@web/src/boot.js';
const S = Demo, D = Pusaka;
/* Galat di satu callback tidak boleh menghentikan animasi atau pembacaan kontrak untuk layar proyektor */
const aman = (f) => (...a) => { try { return f(...a); } catch (e) { console.error(e); } };
Latar.pasang();
document.getElementById('ab').insertAdjacentHTML('afterbegin', UI.kawungBesar('putar'));
const panel = Demo.panel({ judul: 'Panel demo (tekan ` untuk buka)' });
// pintasan presenter dicantumkan di panel demo
const isiPanel = panel.querySelector && panel.querySelector('.isi');
if (isiPanel) isiPanel.insertAdjacentHTML('beforeend', '<div class="baris"><span class="judul">Pintasan Panggung</span><span style="font-size:12px;line-height:1.8;opacity:.85">q QR · 1 2 3 saksi · h kabar hidup · y bayar · t tombol hidup · l majukan waktu · b bagikan · m proses mitra · r pewaris baru</span></div>');

/* Kurangi gerak (?diam atau prefers-reduced-motion): langsung ke keadaan akhir */
const jalan = () => !S.diam;
const dur = (x) => (S.diam ? 0 : x);

/* ---------- skala artboard ---------- */
const ab = document.getElementById('ab');
function skala() {
  const k = Math.min(innerWidth / 1920, innerHeight / 1080);
  ab.style.transformOrigin = '50% 50%';
  ab.style.transform = `translate(-50%, -50%) scale(${k})`;
}
skala(); addEventListener('resize', skala);

/* ---------- kain ---------- */
const KX = 80, KY = 296;
const kain = Kain.buat(document.getElementById('kain'), { W: 1732, H: 430, B: 32, F: 14, k: .42, bands: D.bidang, q: .55, seed: 7 });
const BIDANG_DARI = { istri: [0, 1], masjid: [2], putra1: [3], putra2: [4], putri: [5], ayah: [6], ibu: [7] };

/* ---------- label + tali ---------- */
const labelsEl = document.getElementById('labels'), tali = document.getElementById('tali');
const NS = 'http://www.w3.org/2000/svg';
const FRAC = { istri: '1/2 bersama + 1/8', masjid: '1/5 wasiat', putra1: '13/60', putra2: '13/60', putri: '13/120', ayah: '1/6', ibu: '1/6' };
const PENDEK = { istri: 'Istri', masjid: 'Wakaf masjid', putra1: 'Putra pertama', putra2: 'Putra kedua', putri: 'Putri', ayah: 'Ayah', ibu: 'Ibu' };
// untuk kalimat: "Rp165 jt masuk BSI ••••2291 milik istri."
const SEBUT = { istri: 'istri', masjid: 'pengurus masjid', putra1: 'putra pertama', putra2: 'putra kedua', putri: 'putri', ayah: 'ayah', ibu: 'ibu' };
const LABEL_Y = 856;
const labels = D.penerima.map((p) => {
  const idx = BIDANG_DARI[p.id];
  const xs = idx.map((i) => kain.titikBawah(i)[0] + KX);
  const w = p.id === 'istri' ? 224 : 176;
  const div = document.createElement('div');
  div.className = 'label-kain pg' + (p.id === 'istri' ? ' lebar' : '');
  div.style.top = LABEL_Y + 'px';
  div.innerHTML = `<span class="pita" style="background:${p.dye}"></span><div class="peran">${PENDEK[p.id]}</div><span class="frac">${FRAC[p.id]}</span><span class="nominal">${D.rp(p.total)}</span><div class="cara" data-f="cara"><span class="t"></span></div>`;
  labelsEl.appendChild(div);
  return {
    p, idx, xs, w, anchor: xs[0], div, nom: div.querySelector('.nominal'),
    slot: div.querySelector('.cara'), slotT: div.querySelector('.cara .t'),
    kind: null,   // 'bank' | 'amplop' | 'kripto', dikunci setelah dibagikan
    emas: [],     // benang emas yang menyala saat rupiah sampai
    x: 0,
  };
});
// atur posisi: sedekat mungkin di bawah bidangnya, tidak bertumpuk
(function aturLabel() {
  const GAP = 6, MIN = 80, MAX = 1840;
  labels.forEach((l) => { l.x = l.anchor - l.w / 2; });
  for (let i = 1; i < labels.length; i++) labels[i].x = Math.max(labels[i].x, labels[i - 1].x + labels[i - 1].w + GAP);
  const last = labels[labels.length - 1];
  if (last.x + last.w > MAX) { last.x = MAX - last.w; for (let i = labels.length - 2; i >= 0; i--) labels[i].x = Math.min(labels[i].x, labels[i + 1].x - labels[i].w - GAP); }
  if (labels[0].x < MIN) labels[0].x = MIN;
  labels.forEach((l) => { l.div.style.left = l.x + 'px'; });
})();
// tali dari peniti di kain ke lubang label; di atasnya benang emas yang baru tampak saat rupiah sampai
function garis(d, warna, opasitas, lebar) {
  const p = document.createElementNS(NS, 'path');
  p.setAttribute('d', d); p.setAttribute('fill', 'none'); p.setAttribute('stroke', warna);
  p.setAttribute('stroke-opacity', opasitas); p.setAttribute('stroke-width', lebar); p.setAttribute('stroke-linecap', 'round');
  return p;
}
const taliEls = [], peniti = [];
labels.forEach((l) => {
  l.idx.forEach((bi) => {
    const [px, py] = kain.titikBawah(bi);
    const x1 = px + KX, y1 = py + KY - 12;
    const x2 = l.x + l.w / 2, y2 = LABEL_Y + 11;
    const dy = y2 - y1;
    const d = `M${x1} ${y1} C ${x1} ${y1 + dy * .6}, ${x2} ${y2 - dy * .55}, ${x2} ${y2}`;
    const path = garis(d, '#e9dfc9', .55, 1.3);
    tali.appendChild(path); taliEls.push(path);
    const emas = garis(d, '#e3ca8e', .95, 1.7);
    tali.appendChild(emas); l.emas.push(emas);
    const pin = document.createElementNS(NS, 'circle');
    pin.setAttribute('cx', x1); pin.setAttribute('cy', y1); pin.setAttribute('r', 3.6); pin.setAttribute('fill', '#e3ca8e');
    tali.appendChild(pin); peniti.push(pin);
  });
});
function sembunyiEmas(l) {
  l.emas.forEach((e) => { const L = e.getTotalLength(); gsap.killTweensOf(e); gsap.set(e, { strokeDasharray: L, strokeDashoffset: L }); });
}
labels.forEach(sembunyiEmas);

/* ---------- saksi ---------- */
const saksiEl = document.getElementById('saksi');
const tanda = D.saksi.map((sk, i) => {
  const d = document.createElement('div');
  d.innerHTML = `<svg viewBox="-13 -13 26 26"><circle r="11.5" fill="none" stroke="#97a4c3" stroke-width="1.2"/><circle class="isi" r="11.5" fill="#f5efe3" transform="scale(0)"/></svg><span>${sk.nama.split(' ')[0]}, ${sk.peran.toLowerCase()}</span>`;
  saksiEl.appendChild(d);
  return { d, isi: d.querySelector('.isi') };
});

/* ---------- teks dinamis ---------- */
const narasi = document.getElementById('narasi');
let narasiTl, narasiTujuan = narasi.textContent;
function setNarasi(t, animasi = true) {
  if (narasiTujuan === t) return;
  narasiTujuan = t;
  narasiTl && narasiTl.kill();
  if (!animasi || S.diam || skrub) { gsap.set(narasi, { opacity: 1, y: 0 }); narasi.textContent = t; return; }
  narasiTl = gsap.timeline()
    .to(narasi, { opacity: 0, y: 8, duration: .3, ease: 'power1.in' })
    .call(() => { narasi.textContent = t; narasi.classList.remove('is-in'); })
    .set(narasi, { opacity: 1, y: 0 })
    .call(() => { narasi.classList.add('resap'); void narasi.offsetWidth; narasi.classList.add('is-in'); });
}
/* Hentikan peralihan narasi yang sedang jalan; teks yang tampil jadi acuan lagi */
function hentikanNarasi() {
  narasiTl && narasiTl.kill();
  gsap.set(narasi, { opacity: 1, y: 0 });
  narasiTujuan = narasi.textContent;
}
const chip = document.getElementById('chip'), chipT = document.getElementById('chipT');
const ket1 = document.getElementById('ket1'), ket2 = document.getElementById('ket2');
const hitung = document.getElementById('hitung'), btnBagi = document.getElementById('bagikan');
const ringkasEl = document.getElementById('ringkas'), r1El = document.getElementById('r1'), r2El = document.getElementById('r2');
function setChip(st, t) { chip.dataset.s = st; chipT.textContent = t; }
/* Titik status berdenyut halus saat bukti hidup baru tercatat */
function pulsaChip() {
  if (!jalan()) return;
  gsap.fromTo(chip.querySelector('i'), { boxShadow: '0 0 0 0 rgb(245 239 227 / .5)' }, { boxShadow: '0 0 0 10px rgb(245 239 227 / 0)', duration: 1.5, ease: 'power2.out', clearProps: 'boxShadow' });
}
/* Keterangan di bawah status: baris 1 tetap, baris 2 berdetak (sudah berapa lama) */
let ketA = null, ketB = null;
function setKet(a, b = '', animasi = false) {
  if (a !== ketA) { ketA = a; ket1.innerHTML = a; if (animasi && jalan()) UI.masuk(ket1); }
  if (b !== ketB) { ketB = b; ket2.textContent = b; }
}
function tampilHitung(on, animasi = true) {
  gsap.to(hitung, { height: on ? 124 : 0, opacity: on ? 1 : 0, duration: animasi ? .7 : 0, ease: 'power3.inOut' });
}
function setHitung(sisa) {
  const t = D.mmss(sisa);
  hitung.innerHTML = [...t].map((c) => `<span class="${c === ':' ? 'titik' : ''}">${c}</span>`).join('');
  hitung.style.color = sisa <= 0 ? 'var(--prada-300)' : '';
}
function tampilBagikan(on, animasi = true) {
  btnBagi.classList.toggle('on', on);
  gsap.to(btnBagi, { opacity: on ? 1 : 0, y: on ? 0 : -6, duration: animasi ? .6 : 0, ease: 'power3.out' });
}
const lini = document.getElementById('lini');
function renderLini() {
  const l = S.s.log.slice(-3).reverse();
  lini.innerHTML = l.map((e) => `<span><b>${D.jam(e.t)}</b>${e.teks}<span style="margin-left:10px;opacity:.7">${Demo.pendek(e.tx)}</span></span>`).join('');
}
function tampilSaksi(on, animasi = true) {
  gsap.to(saksiEl, { height: on ? 'auto' : 0, opacity: on ? 1 : 0, marginTop: on ? 18 : 0, duration: animasi ? .5 : 0, ease: 'power2.inOut' });
}
function tampilRingkas(on, animasi = true) {
  gsap.to(ringkasEl, { height: on ? 'auto' : 0, opacity: on ? 1 : 0, marginTop: on ? 20 : 0, duration: animasi ? .7 : 0, ease: 'power2.inOut' });
}
const namaSaksi = () => S.s.attest.map((t, i) => (t ? D.saksi[i].nama.split(' ')[0] : null)).filter(Boolean).join(' dan ');
function setSaksi(animasi = true) {
  S.s.attest.forEach((t, i) => {
    tanda[i].d.classList.toggle('ya', !!t);
    gsap.to(tanda[i].isi, { attr: { transform: t ? 'scale(1)' : 'scale(0)' }, duration: animasi ? (t ? .9 : .4) : 0, ease: t ? 'elastic.out(1, .55)' : 'power2.in' });
  });
}
function setLabelNominal(mode, animasi = true) {
  labels.forEach((l) => {
    l.div.classList.toggle('terima', mode === 'terima');
    gsap.to(l.nom, { fontSize: mode === 'terima' ? (l.p.id === 'istri' ? 40 : 36) : 21, duration: animasi ? .6 : 0, ease: 'power3.out' });
    l.nom.textContent = mode === 'terima' ? D.jt(l.p.total) : D.rp(l.p.total);
  });
}

/* ---------- cara terima dan kabar pencairan di tiap label ----------
   Satu baris di bawah nominal. Sebelum dibagikan: cara terima (rekening bank, amplop, dompet kripto).
   Sesudahnya: kabar rupiahnya. Yang tampak di label (FASE_TAMPIL) terpisah dari keadaan sebenarnya di kontrak,
   supaya kabar tidak menyela pembagian dan "sampai" dibacakan satu per satu. */
const FASE_TAMPIL = {};      // id → { fase, teks, ... } yang sedang terlihat
const antreSelesai = [];     // id yang sudah selesai di kontrak dan belum dibacakan
let ditahan = false;         // selama pembagian berjalan, label belum boleh berubah
let beat = null;             // jeda antarbacaan
let skrub = false;           // ?t= : tanpa antrean, langsung keadaan akhir

function teksCara(c) {
  if (c.cara === 'bank') return c.bank ? `${c.bank} ••••${c.akhiran}` : 'Rekening bank';
  if (c.cara === 'amplop') return 'Amplop WhatsApp';
  return 'Dompet kripto';
}
/* Kecilkan huruf sampai teks muat satu baris */
function muatkan(el, maks) {
  el.style.fontSize = '';
  if (!maks) return;
  let f = 16;
  while (el.offsetWidth > maks && f > 12) { f -= .5; el.style.fontSize = f + 'px'; }
}
function setSlot(l, teks, fase, animasi) {
  l.slot.dataset.f = fase;
  if (l.slotT.textContent === teks) return;
  l.slotT.textContent = teks;
  muatkan(l.slotT, l.slot.clientWidth);
  if (animasi && jalan()) UI.masuk(l.slotT);
}
function renderCara() {
  const st = S.s.status;
  labels.forEach((l) => {
    const c = S.caraTerima(l.p.id);
    if (!c) return;
    if (!(st === 3 && l.kind)) l.kind = c.cara;
    if (st === 3 && FASE_TAMPIL[l.p.id]) return;
    setSlot(l, teksCara(c), 'cara', false);
  });
}

const faseTunggu = (l) => (l.kind === 'bank' ? { fase: 'proses', teks: 'Ditransfer…' }
  : l.kind === 'amplop' ? { fase: 'tunggu', teks: 'Menunggu dibuka' } : { fase: 'dompet', teks: 'Di dompet kripto' });
/* Keadaan sebenarnya dari kontrak mitra */
function faseNyata(l) {
  const p = S.s.penerima[l.p.id], cair = p && p.cair;
  if (cair && cair.tahap === 'selesai') return { fase: 'selesai', teks: `Masuk ${cair.bank}`, kunci: String(cair.no), cair };
  if (cair && cair.tahap === 'diproses') return { fase: 'proses', teks: 'Ditransfer…', cair };
  if (cair && cair.tahap === 'dikembalikan') return { fase: 'proses', teks: 'Dikembalikan', cair };
  return faseTunggu(l);
}
const sudahTampil = (l) => (FASE_TAMPIL[l.p.id] || {}).fase === 'selesai';

function tampilkan(l, r, animasi) {
  FASE_TAMPIL[l.p.id] = r;
  setSlot(l, r.teks, r.fase, animasi);
  const sampai = r.fase === 'selesai';
  l.emas.forEach((e) => {
    gsap.killTweensOf(e);
    const L = e.getTotalLength();
    if (sampai && animasi && jalan()) gsap.fromTo(e, { strokeDashoffset: L }, { strokeDashoffset: 0, duration: 1.3, ease: 'power2.inOut' });
    else gsap.set(e, { strokeDashoffset: sampai ? 0 : L });
  });
}

/* Ringkasan di kanan atas, dihitung dari yang sudah tampak di label */
function ringkasan() {
  const bank = labels.filter((l) => l.kind === 'bank');
  const lain = labels.filter((l) => l.kind !== 'bank');
  const amplop = labels.filter((l) => l.kind === 'amplop');
  const kripto = labels.filter((l) => l.kind === 'kripto');
  const aTunggu = amplop.filter((l) => !sudahTampil(l)).length, aCair = amplop.length - aTunggu;
  const kTetap = kripto.filter((l) => !sudahTampil(l)).length, kCair = kripto.length - kTetap;
  const bagian = [];
  if (aTunggu) bagian.push(`${aTunggu} amplop menunggu`);
  if (aCair) bagian.push(`${aCair} amplop dicairkan`);
  if (kTetap) bagian.push(`${kTetap} di dompet kripto`);
  if (kCair) bagian.push(`${kCair} dompet kripto dicairkan`);
  const baris1 = bank.length ? `${bank.filter(sudahTampil).length} dari ${bank.length} rekening bank sudah menerima rupiah` : bagian.shift() || '';
  r1El.textContent = baris1;
  r2El.textContent = bagian.join(' · ');
}

const narasiSampai = (l, r) => `${D.jt(r.cair.jumlah)} masuk ${r.cair.bank} ••••${r.cair.akhiran} milik ${SEBUT[l.p.id]}.`;
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
function narasiPenutup() {
  const bank = labels.filter((l) => l.kind === 'bank');
  if (bank.length && bank.every(sudahTampil)) return 'Ahli waris tidak perlu dompet. Pewaris tidak perlu menekan tombol.';
  return 'Rp300.000.000 terbagi habis kepada tujuh penerima.';
}

/* Yang sudah selesai di kontrak dibacakan satu per satu: label, benang emas, ringkasan, kalimat */
function jalankanAntre() {
  if (beat || ditahan || !antreSelesai.length || S.s.status !== 3) return;
  const id = antreSelesai.shift();
  const l = labels.find((x) => x.p.id === id), r = l && faseNyata(l);
  if (!l || r.fase !== 'selesai') { jalankanAntre(); return; }
  tampilkan(l, r, true);
  ringkasan();
  setNarasi(narasiSampai(l, r));
  beat = gsap.delayedCall(antreSelesai.length > 4 ? 1.5 : 2.2, aman(() => {
    beat = null;
    if (antreSelesai.length) jalankanAntre(); else setNarasi(narasiPenutup());
  }));
}
function renderBayar(animasi = true) {
  if (S.s.status !== 3 || ditahan) return;
  const lanjut = animasi && jalan();
  labels.forEach((l) => {
    const id = l.p.id, r = faseNyata(l), t = FASE_TAMPIL[id];
    if (r.fase === 'selesai') {
      if (t && t.fase === 'selesai' && t.kunci === r.kunci) return;
      if (!lanjut) { tampilkan(l, r, false); return; }
      if (!t || t.fase === 'selesai') tampilkan(l, faseTunggu(l), false); // mulai dari "menunggu", lalu dibacakan
      if (!antreSelesai.includes(id)) antreSelesai.push(id);
      return;
    }
    if (t && t.fase === r.fase && t.teks === r.teks) return;
    const mulaiCair = lanjut && l.kind !== 'bank' && r.cair && r.fase === 'proses' && (!t || t.fase !== 'proses');
    tampilkan(l, r, lanjut);
    // ahli waris membuka amplop di HP-nya: layar langsung menyambutnya
    if (mulaiCair && !beat) setNarasi(`${cap(SEBUT[id])} membuka amplop. ${D.jt(r.cair.jumlah)} dikirim ke ${r.cair.bank} ••••${r.cair.akhiran}.`);
  });
  tampilRingkas(true, lanjut);
  ringkasan();
  jalankanAntre();
}
function hentikanBayar() {
  beat && beat.kill(); beat = null;
  antreSelesai.length = 0;
  Object.keys(FASE_TAMPIL).forEach((k) => delete FASE_TAMPIL[k]);
  ditahan = false;
  labels.forEach(sembunyiEmas);
}

/* ---------- fase QR ---------- */
const qrWrap = document.getElementById('qr');
/* QR berisi tautan ke pemilih peran (tanpa id), lengkap dengan benih amplop di #s=, jadi HP penonton bisa
   memerankan siapa pun dan mencairkan. Benih di bagian # tidak pernah dikirim ke server. */
function buatQR() {
  const url = S.urlAmplop();
  const svg = document.getElementById('qrSvg');
  svg.dataset.url = url;
  const bangun = (ec) => { const k = qrcode(0, ec); k.addData(url); k.make(); return k; };
  let q = bangun('M');
  // tautan panjang membuat kode padat dan sulit dipindai dari jauh: turunkan tingkat koreksi galat jika modulnya jadi lebih besar
  if (q.getModuleCount() > 45) { const l = bangun('L'); if (l.getModuleCount() < q.getModuleCount()) q = l; }
  const n = q.getModuleCount();
  svg.setAttribute('viewBox', `0 0 ${n} ${n}`);
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
  svg.innerHTML = `<path d="${d}" fill="#131b33" shape-rendering="crispEdges"/>`;
  let host = 'pusaka.vercel.app';
  try { const u = new URL(S.PUBLIC_URL); host = u.host + u.pathname.replace(/\/$/, ''); } catch {}
  document.getElementById('qrHost').textContent = `${host}/waris`;
}
buatQR();
function tampilQR(on, animasi = true) {
  const tag = document.getElementById('qrTag');
  const lain = ['#kain', '#labels', '#tali', '.pg-status', '.pg-judul'];
  if (on) {
    qrWrap.hidden = false;
    if (!animasi) { gsap.set(lain, { opacity: lain.map(() => 0) }); gsap.set(tag, { y: 0, rotation: 0 }); gsap.set('.pg-qr .ajak > *', { opacity: 1, y: 0 }); return; }
    gsap.timeline()
      .to(lain, { opacity: 0, duration: .5, ease: 'power1.out' })
      .fromTo(tag, { y: -760, rotation: 0 }, { y: 0, duration: 1.1, ease: 'power3.out' }, .2)
      .to(tag, { keyframes: { rotation: [2.4, -1.6, .9, -.4, 0] }, duration: 1.8, ease: 'sine.inOut' }, '-=.35')
      .fromTo('.pg-qr .ajak > *', { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: .8, stagger: .12, ease: 'power3.out' }, .4);
  } else {
    if (!animasi) { qrWrap.hidden = true; gsap.set(lain, { opacity: 1 }); return; }
    gsap.timeline()
      .to(tag, { y: -900, duration: .8, ease: 'power3.in' })
      .to('.pg-qr .ajak > *', { opacity: 0, duration: .4 }, 0)
      .set(qrWrap, { hidden: true })
      .call(() => { qrWrap.hidden = true; })
      .to(lain, { opacity: 1, duration: .6, ease: 'power1.out' });
  }
}

/* ---------- render per status ---------- */
const namaPewaris = D.pewaris.nama.split(' ')[0];
// bukti hidup terakhir menurut lastVia (0 = saat aturan dipasang)
const BUKTI_VIA = { 0: 'saat aturan dipasang', 1: 'tombol “Saya masih hidup”', 2: 'sentuhan pada pengingat', 3: 'transaksi dari dompetnya', 4: 'sidik jari di HP-nya' };
const viaTeks = (v) => BUKTI_VIA[v] || (S.VIA_TEKS && S.VIA_TEKS[v]) || 'tercatat';
function teksAktif() {
  const n = S.jumlahSaksi();
  if (n === 0) return 'Rp300.000.000, seluruhnya harta bersama. Aturannya terpasang di dompet.';
  const sk = D.saksi[S.s.attest.findIndex(Boolean)];
  return `${sk.nama} (${sk.peran.toLowerCase()}) mengonfirmasi wafat. Perlu satu saksi lagi.`;
}
const teksDipicu = () => (S.s.alasan === 'tidak aktif'
  ? `Tidak ada bukti hidup selama ${UI.durasi(S.s.batas)}. Satu bukti hidup dari ${namaPewaris} membatalkannya.`
  : `Dua dari tiga saksi mengonfirmasi wafat. Satu bukti hidup dari ${namaPewaris} membatalkannya.`);
// via: bagaimana ia membuktikan hidup; tanpaSaksi: masa sanggah tadi dipicu karena tidak aktif, bukan karena saksi
const teksBatal = (via, tanpaSaksi) => `${{
  1: `${namaPewaris} menekan “Saya masih hidup”.`,
  2: `${namaPewaris} menyentuh pengingat: ia masih hidup.`,
  3: `${namaPewaris} membayar dari dompetnya: ia masih hidup.`,
  4: `${namaPewaris} menyentuh sidik jari: ia masih hidup.`,
}[via] || `${namaPewaris} masih hidup.`} ${tanpaSaksi ? 'Masa sanggah dibatalkan.' : 'Semua konfirmasi dibatalkan.'}`;
const teksBukti = (sebab) => ({
  aktivitas: `${namaPewaris} membayar dari dompetnya. Itu sudah cukup jadi bukti hidup, tanpa tombol.`,
  kabar: S.s.lastVia === 4 ? `${namaPewaris} menyentuh sidik jari di HP-nya. Bukti hidup tercatat, biayanya Rp0.` : `${namaPewaris} menyentuh pengingat. Bukti hidup tercatat, biayanya Rp0.`,
  hidup: `${namaPewaris} menekan “Saya masih hidup”. Bukti hidup tercatat.`,
}[sebab]);

function statis() {
  const s = S.s;
  utama && utama.kill();
  hentikanNarasi();
  hentikanBayar();
  tampilQR(s.qr, false);
  setSaksi(false);
  renderLini();
  tampilSaksi(s.status === 1, false);
  tampilRingkas(false, false);
  renderCara();
  if (s.status === 0) {
    // kain masih polos: aturan belum dipasang, belum ada garis lilin dan label
    kain.keadaanAwal({ lilin: false });
    setLabelNominal('pratinjau', false);
    setChip('belum', 'Belum dipasang');
    setKet('Menunggu pewaris memasang aturan');
    tampilHitung(false, false); tampilBagikan(false, false);
    setNarasi('Rp300.000.000 di dompet. Aturan warisan belum dipasang.', false);
    document.getElementById('judul').textContent = 'Harta Budi Santoso';
    gsap.set(labels.map((l) => l.div), { opacity: 0 });
    gsap.set(peniti, { opacity: 0 });
    taliEls.forEach((t) => { const L = t.getTotalLength(); gsap.set(t, { strokeDasharray: L, strokeDashoffset: L }); });
    return;
  }
  kawungKeadaan(s.status === 3 ? 4 : 0, { muncul: s.status === 3 });
  if (s.status === 3) {
    kain.keadaanAkhir();
    setChip('dibagikan', 'Dibagikan');
    setKet(Demo.teksFinal('dibagikan', Demo.blok(s.distributedAt)));
    tampilHitung(false, false); tampilBagikan(false, false);
    setLabelNominal('terima', false);
    setNarasi('Rp300.000.000 terbagi habis kepada tujuh penerima.', false);
    document.getElementById('judul').textContent = 'Harta almarhum Budi Santoso';
  } else {
    kain.keadaanAwal();
    setLabelNominal('pratinjau', false);
    document.getElementById('judul').textContent = 'Harta Budi Santoso';
    if (s.status === 2) {
      setChip('dipicu', 'Masa sanggah');
      tampilHitung(true, false);
      setNarasi(teksDipicu(), false);
    } else {
      setChip('aktif', 'Aktif');
      tampilHitung(false, false); tampilBagikan(false, false);
      setNarasi(teksAktif(), false);
    }
  }
  gsap.set(taliEls, { strokeDasharray: 'none', strokeDashoffset: 0 });
  gsap.set(labels.map((l) => l.div), { opacity: 1, y: 0, rotation: 0 });
  gsap.set(peniti, { opacity: 1, scale: 1 });
  if (s.status === 3) renderBayar(false);
}

/* Pembukaan: kain dibentangkan, lilin digambar, label digantung */
function pembukaan() {
  const tl = gsap.timeline();
  kain.keadaanAwal();
  gsap.set(labels.map((l) => l.div), { opacity: 0, y: -24 });
  gsap.set(peniti, { opacity: 0 });
  taliEls.forEach((t) => { const L = t.getTotalLength(); gsap.set(t, { strokeDasharray: L, strokeDashoffset: L }); });
  tl.from('#judul', { opacity: 0, y: -14, filter: 'blur(4px)', duration: 1, ease: 'power3.out' })
    .from('#narasi', { opacity: 0, y: -10, duration: .9, ease: 'power3.out' }, .25)
    .from('.pg-status > *', { opacity: 0, y: -10, duration: .8, stagger: .08, ease: 'power3.out' }, .35)
    .fromTo('#kain', { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 1.6, ease: 'power3.inOut' }, .2)
    .add(kain.nyanting(), 1.2)
    .to(peniti, { opacity: 1, duration: .3, stagger: .05 }, 3.2)
    .to(taliEls, { strokeDashoffset: 0, duration: .8, stagger: .05, ease: 'power2.out' }, 3.3)
    .to(labels.map((l) => l.div), { opacity: 1, y: 0, duration: .9, stagger: .07, ease: 'power3.out' }, 3.6)
    .add(ayun(.9), 4.1);
  return tl;
}
/* Aturan baru dipasang dari layar Pewaris: lilin digambar di kain yang sudah terbentang */
function pasangAturan() {
  const tl = gsap.timeline();
  kain.keadaanAwal();
  setLabelNominal('pratinjau', false);
  renderCara();
  gsap.set(labels.map((l) => l.div), { opacity: 0, y: -24 });
  gsap.set(peniti, { opacity: 0 });
  taliEls.forEach((t) => { const L = t.getTotalLength(); gsap.set(t, { strokeDasharray: L, strokeDashoffset: L }); });
  setChip('aktif', 'Aktif');
  tampilSaksi(true);
  setNarasi('Aturan warisan dipasang di dompetnya sendiri.');
  tl.add(kain.nyanting(), .2)
    .to(peniti, { opacity: 1, duration: .3, stagger: .05 }, 2.2)
    .to(taliEls, { strokeDashoffset: 0, duration: .8, stagger: .05, ease: 'power2.out' }, 2.3)
    .to(labels.map((l) => l.div), { opacity: 1, y: 0, duration: .9, stagger: .07, ease: 'power3.out' }, 2.6)
    .add(ayun(.9), 3.1)
    .call(() => setNarasi(teksAktif()), null, 4.6);
  return tl;
}
function ayun(kuat = 1) {
  const tl = gsap.timeline();
  labels.forEach((l, i) => {
    gsap.set(l.div, { transformOrigin: '50% 11px' });
    tl.to(l.div, { keyframes: { rotation: [2.6 * kuat, -1.7 * kuat, 1 * kuat, -.45 * kuat, 0] }, duration: 1.9, ease: 'sine.inOut' }, i * .05);
  });
  return tl;
}

/* Supergrafis kawung: tiap kelopak menyala saat bagiannya dibagikan (harta bersama, wasiat, faraid) */
const kawungEl = () => document.querySelector('.artboard > .kawung-besar');
function kawungKeadaan(n, { muncul = n > 0 } = {}) {
  const k = kawungEl(); if (!k) return;
  k.querySelectorAll('.kb-k').forEach((el) => el.classList.toggle('nyala', [...el.classList].some((c) => /^kb-k\d$/.test(c) && Number(c.slice(4)) < n)));
  k.classList.toggle('selesai', n >= 4);
  gsap.set(k, { opacity: muncul ? 1 : 0 });
}
function kawungMekar(tl) {
  const k = kawungEl(); if (!k) return;
  kawungKeadaan(0, { muncul: false });
  tl.fromTo(k, { opacity: 0, scale: .82, rotation: -25 }, { opacity: 1, scale: 1, rotation: 0, duration: 2.4, ease: 'power3.out', transformOrigin: '50% 50%' }, 0);
  [[0, .9], [1, 3.8], [2, 6.1], [3, 6.6]].forEach(([i, at]) => tl.call(() => k.querySelector('.kb-k' + i).classList.add('nyala'), null, at));
  tl.call(() => k.classList.add('selesai'), null, 10.8)
    .fromTo(k, { scale: 1 }, { scale: 1.04, duration: .9, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 10.8);
}

/* Momen signature: celup menurut urutan KHI */
const JEDA_KABAR = 1; // detik setelah label selesai berayun: kalimat "terbagi habis" sempat terbaca, baru kabar pencairan tampak
function bagikan() {
  const tl = gsap.timeline();
  hentikanBayar();
  ditahan = true;       // kabar pencairan menunggu sampai pembagian selesai
  renderCara();
  tampilRingkas(false, false);
  tampilBagikan(false);
  setChip('dibagikan', 'Dibagikan');
  setKet(Demo.teksFinal('dibagikan'));
  tampilHitung(false);
  tampilSaksi(false);
  document.getElementById('judul').textContent = 'Harta almarhum Budi Santoso';
  tl.add(kain.rendam(0, 1.2), 0);
  kawungMekar(tl);
  // nominal berubah jadi besar, lalu dihitung naik
  labels.forEach((l) => { l.nom.textContent = 'Rp0 jt'; l.div.classList.add('terima'); });
  tl.to(labels.map((l) => l.nom), { fontSize: (i) => (labels[i].p.id === 'istri' ? 40 : 36), duration: .7, ease: 'power3.out' }, .2);
  const hitungLabel = (l, dari, ke, at, dur) => {
    const ob = { v: dari };
    tl.to(ob, { v: ke, duration: dur, ease: 'power2.out', onUpdate: () => { l.nom.textContent = `Rp${Math.round(ob.v)} jt`; } }, at);
  };
  const L = Object.fromEntries(labels.map((l) => [l.p.id, l]));
  // 1. harta bersama
  tl.call(() => setNarasi('Pertama, harta bersama: separuh untuk istri.'), null, .5)
    .add(kain.celupBidang(0, 2.6), .9);
  hitungLabel(L.istri, 0, 150, 1.4, 2.0);
  // 2. wasiat
  tl.call(() => setNarasi('Lalu wasiat: seperlima harta warisan untuk wakaf masjid.'), null, 3.4)
    .add(kain.celupBidang(2, 2.0), 3.8);
  hitungLabel(L.masjid, 0, 30, 4.2, 1.5);
  // 3. faraid
  tl.call(() => setNarasi('Sisanya, Rp120 juta, dibagi menurut faraid.'), null, 5.7);
  [1, 3, 4, 5, 6, 7].forEach((bi, k) => tl.add(kain.celupBidang(bi, 2.5), 6.1 + k * .14));
  hitungLabel(L.istri, 150, 165, 6.6, 1.6);
  ['putra1', 'putra2', 'putri', 'ayah', 'ibu'].forEach((id, k) => hitungLabel(L[id], 0, L[id].p.total, 6.7 + (k + 1) * .14, 1.8));
  // 4. lilin dilorod, kain dipotong, label berayun
  tl.add(kain.nglorod(), 8.9)
    .add(kain.potong(10), 10.0)
    .add(ayun(1), 10.5)
    .call(() => setNarasi('Rp300.000.000 terbagi habis kepada tujuh penerima.'), null, 10.8);
  // 5. rupiah mulai mengalir: cara terima berubah jadi kabar pencairan. Di ujung timeline (panjangnya tetap, agar ?t= tidak bergeser)
  tl.call(aman(() => {
    if (skrub) { ditahan = false; renderBayar(false); return; }
    beat = gsap.delayedCall(JEDA_KABAR, aman(() => { beat = null; ditahan = false; renderBayar(true); }));
  }), null, tl.duration());
  return tl;
}

/* ---------- reaksi terhadap perubahan status ---------- */
let utama;
S.on(aman((s, prev, sebab) => {
  renderLini();
  if (sebab === 'qr') { tampilQR(s.qr, jalan()); return; }
  if (sebab === 'ulang') { buatQR(); statis(); return; }
  if (sebab === 'pasang') {
    if (S.diam) { statis(); return; }
    utama && utama.kill(); utama = pasangAturan(); return;
  }
  if (sebab === 'gas') return;
  if (sebab === 'saksi') { setSaksi(jalan()); setNarasi(teksAktif(), jalan()); return; }
  if (sebab === 'dipicu') {
    setSaksi(jalan());
    gsap.delayedCall(dur(.9), () => tampilSaksi(false, jalan()));
    setChip('dipicu', 'Masa sanggah');
    setHitung(s.sanggah); tampilHitung(true, jalan());
    setNarasi(teksDipicu(), jalan());
    return;
  }
  if (sebab === 'batal') {
    setSaksi(jalan()); setChip('aktif', 'Aktif'); tampilHitung(false, jalan()); tampilBagikan(false, jalan()); tampilSaksi(true, jalan());
    kain.rendam(0, dur(1));
    setNarasi(teksBatal(s.lastVia, prev.alasan === 'tidak aktif'), jalan());
    pulsaChip();
    return;
  }
  // bukti hidup: bayar dari dompet, sentuh pengingat, atau tombol cadangan
  if (sebab === 'aktivitas' || sebab === 'kabar' || sebab === 'hidup') { setNarasi(teksBukti(sebab), jalan()); pulsaChip(); return; }
  if (sebab === 'dibagikan') {
    if (S.diam) { statis(); return; }
    utama && utama.kill(); utama = bagikan(); return;
  }
  // rupiah masuk ke bank atau amplop dicairkan: tidak boleh menyela pembagian yang sedang berjalan
  if (sebab === 'pencairan') { if (s.status === 3) renderBayar(true); else renderCara(); return; }
  statis();
}));
btnBagi.addEventListener('click', () => S.bagikan());

/* ---------- jam: hitung mundur, rendaman, blok ---------- */
const blokEl = document.getElementById('blok');
let blokTerakhir = 0, caraTerakhir = 0;
function detak() {
  requestAnimationFrame(detak);   // dipasang dulu: galat satu detak tidak mematikan jam
  try { detakIsi(); } catch (e) { console.error(e); }
}
function detakIsi() {
  const s = S.s, now = Date.now();
  const b = Demo.blok(now);
  if (b !== blokTerakhir) { blokTerakhir = b; blokEl.textContent = b.toLocaleString('id-ID'); gsap.fromTo('#blokTitik', { backgroundColor: '#e3ca8e' }, { backgroundColor: '#6b7da8', duration: .35 }); }
  if (s.status === 2) {
    const sisa = Demo.sisaSanggah(now);
    setHitung(sisa);
    const p = 1 - sisa / s.sanggah;
    kain.celup.soak = .06 + .34 * p;
    setKet(sisa > 0 ? (s.alasan === 'tidak aktif' ? `Dipicu karena tidak aktif pada ${D.jam(s.triggeredAt)}` : `Dikonfirmasi ${namaSaksi()} pada ${D.jam(s.triggeredAt)}`) : 'Masa sanggah selesai. Siapa pun bisa membagikan.');
    if (sisa <= 0 && !btnBagi.classList.contains('on')) {
      tampilHitung(false, jalan()); tampilBagikan(true, jalan());
      setNarasi('Masa sanggah selesai. Pewaris tidak membatalkan.', jalan());
    }
  } else if (s.status === 1) {
    setKet(`Bukti hidup terakhir: <b>${viaTeks(s.lastVia)}</b>`, `${UI.lalu(now - s.lastBeat)} · batas ${UI.durasi(s.batas)} tanpa bukti hidup`, true);
  } else if (s.status === 0) {
    setKet('Menunggu pewaris memasang aturan');
  }
  // aturan di formulir Pewaris bisa berubah tanpa kabar ke layar ini: cara terima disegarkan tiap detik
  if (s.status !== 3 && now - caraTerakhir > 1000) { caraTerakhir = now; renderCara(); }
}

/* ---------- pintasan presenter ---------- */
addEventListener('keydown', (e) => {
  if (e.target.closest && e.target.closest('input, textarea')) return;
  if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
  const k = e.key.toLowerCase();
  if (k === 'q') S.qr(!S.s.qr);
  if (k === 'b') S.bagikan();
  if (k === 'h') S.kabar();          // kabar hidup bertanda tangan (Rp0 untuk pewaris)
  if (k === 'y') S.bayar();          // transaksi biasa dari dompet pewaris
  if (k === 't') S.hidup();          // tombol cadangan "Saya masih hidup"
  if (k === 'm') S.prosesMitra();    // operator mitra: sapu dan selesaikan transfer sekarang
  if (k === '1' || k === '2' || k === '3') S.saksi(+k - 1);
  if (k === 'l') S.lewati();
  if (k === 'r') S.ulang();
});

document.fonts.ready.then(() => {
  statis();
  const q = new URLSearchParams(location.search);
  if (S.s.status === 1 && !S.s.qr && !S.diam) pembukaan();
  if (q.has('t') && S.s.status === 3) {
    skrub = true;
    kain.keadaanAwal(); kain.celup.soak = .4; setLabelNominal('pratinjau', false);
    utama = bagikan(); utama.progress(+q.get('t'), false).pause();
  }
  requestAnimationFrame(detak);
});
