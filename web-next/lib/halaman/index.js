import '@web/src/boot.js';
const D = Pusaka;
Latar.pasang();
Demo.panel({ judul: 'Panel demo' });
document.getElementById('logo').outerHTML = UI.MEREK;
document.getElementById('logoKaki').outerHTML = UI.MEREK;
document.getElementById('pembuka').insertAdjacentHTML('afterbegin', UI.kawungBesar('putar cahaya'));

/* ---------- bukti on-chain: alamat dibaca dari konfigurasi yang sama dengan demo ---------- */
{
  const EX = Demo.EXPLORER, A = Demo.alamat;
  const CEK = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const baris = [
    ['PusakaWallet', 'Aturan warisan, faraid, saksi, bukti hidup', A.wallet],
    ['MitraCair', 'Rekening virtual dan pencairan ke bank', A.mitra],
    ['MockIDR (tIDR)', 'Rupiah mainan untuk testnet', A.token],
  ].filter((b) => b[2]);
  document.getElementById('daftarKontrak').innerHTML = baris.map(([n, k, a]) => `<div class="k">
      <div><b>${n}</b><small>${k}</small></div>
      <div class="alamat-k"><span>${a.slice(0, 10)}…${a.slice(-8)}</span><button type="button" data-salin="${a}">Salin</button></div>
      ${EX ? `<a class="terverifikasi" href="${EX}/address/${a}" target="_blank" rel="noopener">${CEK}Terverifikasi, lihat source</a>` : '<span class="t-micro">Blockchain lokal</span>'}
    </div>`).join('');
  document.getElementById('daftarKontrak').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-salin]');
    if (!b) return;
    try { await navigator.clipboard.writeText(b.dataset.salin); b.textContent = 'Tersalin'; } catch { b.textContent = 'Gagal'; }
    setTimeout(() => { b.textContent = 'Salin'; }, 1600);
  });
  if (EX && A.wallet) {
    const t = document.getElementById('tautanKontrak');
    t.href = `${EX}/address/${A.wallet}`; t.target = '_blank'; t.rel = 'noopener';
  }
}
UI.blok(document.getElementById('jaringan'));

/* ---------- daftar layar ---------- */
const PANAH = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 8h11M9 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>';
document.getElementById('daftarLayar').innerHTML = [
  ['/pewaris', 'Pewaris', 'Laptop', 'Memasang aturan dan memilih cara terima tiap ahli waris.'],
  ['/kabar', 'HP pewaris', 'HP atau laptop', 'Bukti hidup tanpa tombol: aktivitas dompet dan pengingat.'],
  ['/saksi', 'Saksi', 'Laptop', 'Tiga saksi menandatangani konfirmasi wafat, tanpa biaya.'],
  ['/panggung', 'Panggung', 'Proyektor', 'Kain besar untuk ditonton seisi ruangan.'],
  ['/waris', 'Ahli waris', 'HP penonton', 'Bagian tiap orang: ke rekening bank, amplop digital, atau dompet kripto.'],
  ['/mitra', 'Mitra pencairan', 'Laptop', 'Simulasi bank: tIDR menjadi rupiah di rekening.'],
  ['/hp', 'Simulasi HP', 'Laptop', 'HP pewaris dan HP ahli waris berdampingan.'],
  ['/kalkulator', 'Kalkulator', 'HP atau laptop', 'Hitung bagian untuk keluarga sendiri.'],
].map(([h, n, a, t]) => `<li><a href="${h}"><b>${n}</b><span class="alat">${a}</span><span class="isi-l">${t}</span>${PANAH}</a></li>`).join('');

// "Mulai demo" langsung membuka layar Pewaris. Pewaris baru dibuat dari panel demo.

/* ---------- kain contoh, sama persis dengan kain di Panggung ---------- */
const papan = document.getElementById('papan'), panggung = document.getElementById('panggung');
const kain = Kain.buat(document.getElementById('kain'), { W: 1732, H: 430, B: 32, F: 14, k: .42, bands: D.bidang, q: .55, seed: 7 });
const BIDANG_DARI = { istri: [0, 1], masjid: [2], putra1: [3], putra2: [4], putri: [5], ayah: [6], ibu: [7] };
const FRAC = { istri: '1/2 bersama + 1/8', masjid: '1/5 wasiat', putra1: '13/60', putra2: '13/60', putri: '13/120', ayah: '1/6', ibu: '1/6' };
const PENDEK = { istri: 'Istri', masjid: 'Wakaf masjid', putra1: 'Putra pertama', putra2: 'Putra kedua', putri: 'Putri', ayah: 'Ayah', ibu: 'Ibu' };
const LABEL_Y = 548, NS = 'http://www.w3.org/2000/svg';
const labelsEl = document.getElementById('labels'), tali = document.getElementById('tali');
const labels = D.penerima.map((p) => {
  const idx = BIDANG_DARI[p.id], w = p.id === 'istri' ? 224 : 156;
  const div = document.createElement('div');
  div.className = 'label-kain pg' + (p.id === 'istri' ? ' lebar' : '');
  div.innerHTML = `<span class="pita" style="background:${p.dye}"></span><div class="peran">${PENDEK[p.id]}</div><span class="frac">${FRAC[p.id]}</span><span class="nominal">${D.jt(p.total)}</span>`;
  labelsEl.appendChild(div);
  return { p, idx, w, div, anchor: kain.titikBawah(idx[0])[0], x: 0 };
});
(function aturLabel() {
  const GAP = 10, MIN = 0, MAX = 1760;
  labels.forEach((l) => { l.x = l.anchor - l.w / 2; });
  for (let i = 1; i < labels.length; i++) labels[i].x = Math.max(labels[i].x, labels[i - 1].x + labels[i - 1].w + GAP);
  const last = labels[labels.length - 1];
  if (last.x + last.w > MAX) { last.x = MAX - last.w; for (let i = labels.length - 2; i >= 0; i--) labels[i].x = Math.min(labels[i].x, labels[i + 1].x - labels[i].w - GAP); }
  if (labels[0].x < MIN) labels[0].x = MIN;
  labels.forEach((l) => { l.div.style.left = l.x + 'px'; });
})();
const taliEls = [], peniti = [];
labels.forEach((l) => {
  l.idx.forEach((bi) => {
    const [x1, y0] = kain.titikBawah(bi), y1 = y0 - 12, x2 = l.x + l.w / 2, y2 = LABEL_Y + 11;
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', `M${x1} ${y1} C ${x1} ${y1 + 60}, ${x2} ${y2 - 50}, ${x2} ${y2}`);
    path.setAttribute('fill', 'none'); path.setAttribute('stroke', '#e9dfc9'); path.setAttribute('stroke-opacity', '.55'); path.setAttribute('stroke-width', '1.3');
    tali.appendChild(path); taliEls.push(path);
    const pin = document.createElementNS(NS, 'circle');
    pin.setAttribute('cx', x1); pin.setAttribute('cy', y1); pin.setAttribute('r', 3.6); pin.setAttribute('fill', '#e3ca8e');
    tali.appendChild(pin); peniti.push(pin);
  });
});

/* Redam: bayangan tipis di atas bidang yang tidak disorot */
const redam = document.createElementNS(NS, 'svg');
redam.setAttribute('class', 'redam');
redam.setAttribute('viewBox', `${-kain.F} ${-kain.B} ${kain.W + 2 * kain.F} ${kain.H + 2 * kain.B}`);
redam.setAttribute('width', kain.W + 2 * kain.F); redam.setAttribute('height', kain.H + 2 * kain.B);
const redamPoly = kain.info.map((inf) => {
  const pg = document.createElementNS(NS, 'polygon');
  pg.setAttribute('points', inf.poly.map((p) => p.join(',')).join(' '));
  pg.setAttribute('fill', '#0e1527'); pg.style.opacity = 0; pg.style.transition = 'opacity .28s';
  redam.appendChild(pg);
  return pg;
});
document.getElementById('kain').appendChild(redam);
const pemilik = D.bidang.map((b) => b.id);
let sorotan = null;
function sorot(id) {
  if (id === sorotan) return;
  sorotan = id;
  panggung.classList.toggle('menyorot', !!id);
  redamPoly.forEach((pg, i) => { pg.style.opacity = id && pemilik[i] !== id ? .55 : 0; });
  labels.forEach((l) => l.div.classList.toggle('sorot', l.p.id === id));
}

/* Skala papan mengikuti lebar konten */
let skalaPapan = 1;
function skala() {
  const w = panggung.clientWidth;
  skalaPapan = w / 1760;
  papan.style.transform = `scale(${skalaPapan})`;
  const sempit = innerWidth <= 720;
  panggung.style.height = ((sempit ? 494 : 676) * skalaPapan) + 'px';
}
skala(); addEventListener('resize', skala);

let siapSorot = false;
panggung.addEventListener('pointermove', (e) => {
  if (!siapSorot || e.pointerType === 'touch') return;
  const r = papan.getBoundingClientRect();
  const x = (e.clientX - r.left) / skalaPapan, y = (e.clientY - r.top) / skalaPapan;
  const lab = e.target.closest('.label-kain');
  if (lab) { sorot(labels.find((l) => l.div === lab).p.id); return; }
  const bi = kain.bidangDi(x, y);
  sorot(bi >= 0 ? pemilik[bi] : null);
});
panggung.addEventListener('pointerleave', () => sorot(null));

/* Legenda untuk layar sempit (label gantung disembunyikan) */
document.getElementById('legenda').innerHTML = D.penerima.map((p) => `<span><i style="background:${p.dye}"></i>${PENDEK[p.id]}<b>${D.jt(p.total)}</b></span>`).join('');

/* ---------- tiga contoh kain: lilin, rendaman, celup ---------- */
function contoh(id, keadaan) {
  const host = document.getElementById(id);
  const w = Math.round(host.clientWidth), h = Math.round(w * .6);
  const c = Kain.contoh(host.appendChild(document.createElement('div')), { w, h, dye: '#7c4e2d', isen: 'truntum', q: .8, seed: 11 });
  if (keadaan === 'lilin') c.awal();
  if (keadaan === 'rendam') { c.awal(); c.celup.soak = .42; }
  if (keadaan === 'celup') c.akhir();
  return c;
}

/* ---------- koreografi pembuka ---------- */
const narasi = document.getElementById('narasi');
function setNarasi(t) {
  if (Demo.diam) { narasi.textContent = t; return; }
  gsap.timeline().to(narasi, { opacity: 0, y: 6, duration: .25, ease: 'power1.in' })
    .call(() => { narasi.textContent = t; }).set(narasi, { opacity: 1, y: 0 })
    .call(() => UI.masuk(narasi));
}
function akhir() {
  kain.keadaanAkhir({ potong: false });
  gsap.set(taliEls, { strokeDasharray: 'none', strokeDashoffset: 0 });
  narasi.textContent = 'Rp300 juta terbagi habis kepada tujuh penerima.';
  siapSorot = true;
}
function pembukaan() {
  gsap.set(labels.map((l) => l.div), { opacity: 0, y: -24 });
  gsap.set(peniti, { opacity: 0 });
  taliEls.forEach((t) => { const L = t.getTotalLength(); gsap.set(t, { strokeDasharray: L, strokeDashoffset: L }); });
  const tl = gsap.timeline({ onComplete: () => { siapSorot = true; } });
  tl.fromTo('#kain', { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 1.5, ease: 'power3.inOut' }, .5)
    .add(kain.nyanting(), 1.3)
    .call(() => setNarasi('Aturannya dipasang di dompet itu sendiri.'), null, 1.4)
    .to(peniti, { opacity: 1, duration: .3, stagger: .05 }, 3.4)
    .to(taliEls, { strokeDashoffset: 0, duration: .8, stagger: .05, ease: 'power2.out' }, 3.5)
    .to(labels.map((l) => l.div), { opacity: 1, y: 0, duration: .9, stagger: .07, ease: 'power3.out' }, 3.8)
    .call(() => setNarasi('Pertama, harta bersama: separuh untuk istri.'), null, 4.9)
    .add(kain.celupBidang(0, 2.2), 5.1)
    .call(() => setNarasi('Lalu wasiat: seperlima harta warisan untuk wakaf masjid.'), null, 6.6)
    .add(kain.celupBidang(2, 1.8), 6.8)
    .call(() => setNarasi('Sisanya, Rp120 juta, dibagi menurut faraid.'), null, 8.2);
  [1, 3, 4, 5, 6, 7].forEach((bi, k) => tl.add(kain.celupBidang(bi, 2.2), 8.4 + k * .12));
  tl.add(kain.nglorod(), 10.6)
    .call(() => setNarasi('Rp300 juta terbagi habis kepada tujuh penerima.'), null, 11.4);
  labels.forEach((l, i) => {
    gsap.set(l.div, { transformOrigin: '50% 11px' });
    tl.to(l.div, { keyframes: { rotation: [2.4, -1.5, .9, -.4, 0] }, duration: 1.9, ease: 'sine.inOut' }, 4.3 + i * .05);
  });
  return tl;
}

document.fonts.ready.then(() => {
  UI.masuk('.pembuka .resap');
  contoh('cth1', 'lilin'); contoh('cth2', 'rendam'); contoh('cth3', 'celup');
  if (Demo.diam) akhir(); else pembukaan();
});
