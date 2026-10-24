import '@web/src/boot.js';
const S = Demo, D = Pusaka;
Latar.pasang();
Demo.panel({ judul: 'Panel demo' });
document.getElementById('logo').outerHTML = UI.MEREK;
UI.blok(document.getElementById('jaringan'));
UI.dompetDemo(document.getElementById('kanan'));
const $ = (id) => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';
const CENTANG = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 8.5l3.5 3.5 7.5-8" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
const DOK = '<svg viewBox="0 0 18 18" aria-hidden="true"><path d="M4 1.5h7l3.5 3.5v11.5h-10.5z M11 1.5v3.5h3.5" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>';

/* ---------- kain akta dengan tiga tempat cap ---------- */
let kain, caps = [], lebarAkta = 0;
function capSVG(r) {
  // cap lilin: cincin cecek, kawung di tengah
  let titik = '';
  for (let a = 0; a < 28; a++) { const t = a / 28 * Math.PI * 2; titik += `<circle cx="${(Math.cos(t) * r * .86).toFixed(2)}" cy="${(Math.sin(t) * r * .86).toFixed(2)}" r="${(r * .035).toFixed(2)}"/>`; }
  let kelopak = '';
  for (let k = 0; k < 4; k++) kelopak += `<g transform="rotate(${45 + k * 90})"><ellipse cx="0" cy="${-r * .33}" rx="${r * .2}" ry="${r * .3}" fill="none" stroke="currentColor" stroke-width="${r * .045}"/><circle cx="0" cy="${-r * .36}" r="${r * .06}"/></g>`;
  return `<circle r="${r}" fill="none" stroke="currentColor" stroke-width="${r * .06}"/><circle r="${r * .74}" fill="none" stroke="currentColor" stroke-width="${r * .03}"/><g fill="currentColor">${titik}${kelopak}<circle r="${r * .07}"/></g>`;
}
function buatAkta() {
  const host = $('akta');
  host.innerHTML = '';
  const lebar = Math.max(320, host.clientWidth);
  lebarAkta = lebar;
  const sempit = lebar < 700;
  const F = sempit ? 8 : 12, B = sempit ? 14 : 22, W = lebar - 2 * F, H = sempit ? 120 : 150;
  kain = Kain.hidup(host.appendChild(document.createElement('div')), { W, H, B, F, k: .42, q: .5, seed: 23, mode: 'lilin' });
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'cap-lapis');
  svg.setAttribute('width', W + 2 * F); svg.setAttribute('height', H + 2 * B);
  svg.setAttribute('viewBox', `${-F} ${-B} ${W + 2 * F} ${H + 2 * B}`);
  host.appendChild(svg);
  const r = Math.min(46, H * .3);
  caps = D.saksi.map((sk, i) => {
    const cx = W * (i * 2 + 1) / 6, cy = H * .43;
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('transform', `translate(${cx} ${cy})`);
    g.innerHTML = `<circle class="slot" r="${r}" fill="none" stroke="#857d6e" stroke-width="1.1" stroke-dasharray="3 5" opacity=".8"/>
      <g class="cap">${capSVG(r)}</g>
      <circle class="sebar" r="${r}" fill="none" stroke="#b59c6c" stroke-width="2" opacity="0"/>
      <text class="nama" y="${r + (sempit ? 18 : 24)}" text-anchor="middle" font-style="italic" font-size="${sempit ? 13 : 17}" fill="#857d6e">${sk.nama}</text>`;
    g.querySelector('.nama').style.fontFamily = 'var(--font-serif)';
    svg.appendChild(g);
    return { g, cap: g.querySelector('.cap'), slot: g.querySelector('.slot'), sebar: g.querySelector('.sebar'), nama: g.querySelector('.nama') };
  });
  setCaps(false);
}
function setCaps(animasi = true) {
  S.s.attest.forEach((t, i) => {
    const c = caps[i]; if (!c) return;
    const sudah = c.cap.dataset.on === '1';
    if (!!t === sudah && animasi) return;
    c.cap.dataset.on = t ? '1' : '0';
    gsap.killTweensOf([c.cap, c.slot, c.sebar, c.nama]);
    if (t && animasi && !Demo.diam) {
      // cap ditekan: turun dari atas, sedikit berputar, lilin menyebar
      gsap.timeline()
        .set(c.cap, { opacity: 0, scale: 1.4, rotation: -14, transformOrigin: '50% 50%' })
        .to(c.cap, { opacity: 1, scale: 1, rotation: 0, duration: .42, ease: 'power4.in' })
        .to(c.slot, { opacity: 0, duration: .2 }, .38)
        .fromTo(c.sebar, { opacity: .6, scale: 1, transformOrigin: '50% 50%' }, { opacity: 0, scale: 1.22, duration: .7, ease: 'power2.out' }, .42)
        .to(c.cap, { scale: 1.03, duration: .08, yoyo: true, repeat: 1, ease: 'power1.out' }, .42)
        .to(c.nama, { attr: { fill: '#8f7b55' }, duration: .5 }, .45);
    } else {
      gsap.set(c.cap, { opacity: t ? 1 : 0, scale: 1, rotation: 0, transformOrigin: '50% 50%' });
      gsap.set(c.slot, { opacity: t ? 0 : .8 });
      gsap.set(c.sebar, { opacity: 0 });
      c.nama.setAttribute('fill', t ? '#8f7b55' : '#857d6e');
    }
  });
}

/* ---------- kartu saksi ---------- */
const bukti = D.saksi.map(() => ({ nama: 'contoh-akta-budi.pdf', hash: Demo.AKTA_CONTOH }));
const kartu = D.saksi.map((sk, i) => {
  const d = document.createElement('article');
  d.className = 'ks lembar';
  d.innerHTML = `<h2>${sk.nama}</h2>
    <p class="siapa">${sk.peran}, dompet ${sk.alamat}</p>
    <div class="bagian">
      <span>Akta kematian</span>
      <div class="berkas">${DOK}<b class="nb"></b><button class="btn btn--teks" type="button" data-ganti>Ganti file</button></div>
      <p class="sidik">Sidik jari <span class="hs"></span><small>File tidak dikirim ke mana pun. Hanya sidik jarinya yang dicatat di blockchain.</small></p>
    </div>
    <div class="aksi">
      <button class="btn tahan" type="button">Tahan untuk konfirmasi wafat</button>
      <div class="hasil"><p>${CENTANG}<span class="kapan"></span></p><small class="tx"></small></div>
      <p class="ket-aksi"></p>
    </div>`;
  $('kartu').appendChild(d);
  const btn = d.querySelector('.tahan');
  const h = UI.tahan(btn, {
    lama: 1100,
    onSelesai: async () => {
      btn.innerHTML = '<i class="spin"></i>Mengirim';
      await S.saksi(i, bukti[i].hash);
      // ditolak kontrak (misalnya status sudah berubah): kembalikan tombol
      if (!S.s.attest[i]) { btn.textContent = 'Tahan untuk konfirmasi wafat'; kartu[i].h.reset(); renderKartu(); }
    },
  });
  d.querySelector('[data-ganti]').addEventListener('click', () => { pilihUntuk = i; $('pilihBerkas').click(); });
  return { d, btn, h, nb: d.querySelector('.nb'), hs: d.querySelector('.hs'), kapan: d.querySelector('.kapan'), tx: d.querySelector('.tx'), ket: d.querySelector('.ket-aksi') };
});

/* Sidik jari akta dihitung di browser (SHA-256). File tidak diunggah. */
let pilihUntuk = 0;
$('pilihBerkas').addEventListener('change', async (e) => {
  const file = e.target.files[0]; if (!file) return;
  const i = pilihUntuk;
  kartu[i].hs.textContent = 'menghitung…';
  const buf = await file.arrayBuffer();
  const dig = await crypto.subtle.digest('SHA-256', buf);
  bukti[i] = { nama: file.name, hash: '0x' + [...new Uint8Array(dig)].map((b) => b.toString(16).padStart(2, '0')).join('') };
  e.target.value = '';
  renderKartu();
});

function renderKartu() {
  const s = S.s, n = S.jumlahSaksi();
  kartu.forEach((k, i) => {
    const t = s.attest[i], gas = s.gas.saksi[i];
    k.d.classList.toggle('ya', !!t);
    k.nb.textContent = t ? 'Akta sudah dicatat' : bukti[i].nama;
    k.hs.textContent = Demo.pendek(t ? (s.bukti[i] || Demo.AKTA_CONTOH) : bukti[i].hash);
    let mati = false, ket = '';
    if (t) {
      k.kapan.textContent = `Dikonfirmasi pukul ${D.jam(t)}`;
      const r = Demo.hasilTerakhir('saksi' + i);
      k.tx.textContent = (Demo.tx('saksi' + i) ? `Transaksi ${Demo.pendek(Demo.tx('saksi' + i))}` : 'Tercatat di blockchain') + (r && r.relayer ? ' · dikirim relayer, biaya untukmu Rp0' : '');
    } else if (s.status === 0) { mati = true; ket = 'Aturan warisan belum dipasang di dompet Budi Santoso.'; }
    else if (s.status !== 1) { mati = true; ket = s.status === 3 ? 'Warisan sudah dibagikan.' : 'Tidak diperlukan lagi. Ambang saksi sudah terpenuhi.'; }
    else if (!Demo.induk && gas < .01) { mati = true; ket = 'Dompet saksi ini belum punya gas. Bagikan gas dari menu Dompet demo.'; }
    else ket = (n === 0 ? 'Dibutuhkan dua dari tiga saksi.' : 'Satu konfirmasi lagi memulai masa sanggah.') + ' Kamu cukup menandatangani; biaya pengirimannya ditanggung Pusaka.';
    k.d.classList.toggle('mati', mati);
    k.btn.disabled = mati;
    if (!t && !k.btn.querySelector('.spin')) { k.btn.textContent = 'Tahan untuk konfirmasi wafat'; }
    if (!t) k.h.reset();
    k.ket.textContent = t ? '' : ket;
  });
}

/* ---------- judul, progres, langkah berikutnya ---------- */
function renderAtas() {
  const s = S.s, n = S.jumlahSaksi();
  const chip = $('chip'), chipT = $('chipT');
  const data = { 0: ['belum', 'Belum dipasang'], 1: ['aktif', 'Aturan aktif'], 2: ['dipicu', 'Masa sanggah'], 3: ['dibagikan', 'Sudah dibagikan'] }[s.status];
  chip.dataset.s = data[0]; chipT.textContent = data[1];
  $('judul').textContent = s.status === 3 ? 'Warisan almarhum Budi Santoso sudah dibagikan' : 'Konfirmasi wafat Budi Santoso';
  $('lead').innerHTML = {
    0: 'Budi Santoso belum memasang aturan warisan di dompetnya. Konfirmasi baru bisa dilakukan setelah aturan terpasang.',
    1: `Aturan warisan di dompet <b>${D.pewaris.alamat}</b> meminta <b>${s.ambang} dari 3 saksi</b>. Konfirmasimu berupa tanda tangan, tanpa biaya, tercatat di blockchain dan tidak bisa ditarik.`,
    2: (s.alasan === 'tidak aktif' ? 'Pewaris tidak aktif melewati batas waktu, jadi masa sanggah dimulai.' : 'Dua saksi sudah mengonfirmasi, jadi masa sanggah dimulai.')
      + ' Jika Budi Santoso masih hidup, satu transaksi apa pun dari dompetnya atau satu kabar hidup dari HP-nya langsung membatalkan.',
    3: `Konfirmasi kalian sudah dijalankan. Warisan dibagikan pukul ${s.distributedAt ? D.jam(s.distributedAt) : ''} kepada tujuh penerima.`,
  }[s.status];
  [...$('titik').children].forEach((el, i) => el.classList.toggle('ya', !!s.attest[i]));
  $('hitung').hidden = s.status !== 2;
  $('btnBagi').hidden = s.status !== 2;
}
function detak() {
  const s = S.s, now = Date.now(), n = S.jumlahSaksi();
  const p = $('progresT');
  if (s.status === 2) {
    const sisa = S.sisaSanggah(now);
    UI.digit($('hitung'), D.mmss(sisa));
    p.textContent = sisa > 0 ? 'Sisa masa sanggah' : 'Masa sanggah selesai';
    if (!kain._rendam) kain.soak = .06 + .36 * (1 - sisa / s.sanggah);
    $('btnBagi').disabled = sisa > 0;
    $('bagiT').textContent = sisa > 0 ? `Setelah masa sanggah habis, siapa pun bisa membagikan warisan. Tunggu ${D.mmss(sisa)} lagi.` : 'Masa sanggah sudah habis dan pewaris tidak membatalkan. Siapa pun bisa membagikan warisan sekarang.';
  } else {
    p.textContent = s.status === 3 ? 'Dua dari tiga saksi mengonfirmasi' : s.status === 0 ? 'Belum ada aturan' : `${n} dari 2 konfirmasi yang dibutuhkan`;
    $('bagiT').textContent = s.status === 3 ? `Sudah dibagikan pukul ${D.jam(s.distributedAt)}, final di blok ${Demo.blok(s.distributedAt).toLocaleString('id-ID')}.` : 'Tombol pembagian muncul di sini setelah masa sanggah dimulai dan selesai.';
  }
  const sisaB = S.sisaBatas(now);
  $('btnPicu').disabled = !(s.status === 1 && sisaB <= 0);
  $('tidakAktifT').textContent = s.status === 1
    ? (sisaB > 0
      ? `Bukti hidup terakhir Budi Santoso: ${Demo.VIA_TEKS[s.lastVia] || 'aktivitas dompet'}, ${UI.lalu(now - s.lastBeat)}. Jika tidak ada bukti hidup sampai ${batasTeks(s.lastBeat + s.batas * 1000, s.batas)}, siapa pun bisa memicu masa sanggah tanpa saksi.`
      : `Budi Santoso tidak memberi bukti hidup lebih dari ${UI.durasi(s.batas)}. Siapa pun sekarang bisa memicu masa sanggah.`)
    : 'Jalur ini hanya bisa dipakai selama aturan aktif dan belum terpicu.';
}
/* Batas bukti hidup: jam untuk batas pendek (demo), tanggal untuk batas berbulan-bulan */
const batasTeks = (t, batas) => (batas < 86400 ? `pukul ${D.jam(t).slice(0, 5)}` : new Date(t).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }));
setInterval(detak, 250);

$('btnPicu').addEventListener('click', () => S.picu());
$('btnBagi').addEventListener('click', () => S.bagikan());

S.on((s, prev, sebab) => {
  if (sebab === 'gas') { renderKartu(); return; }
  renderAtas(); renderKartu();
  if (sebab === 'saksi' || sebab === 'dipicu') setCaps(true);
  else setCaps(false);
  if (sebab === 'dipicu') { const t = kain.rendam(.06, .8); kain._rendam = t; t.eventCallback('onComplete', () => { kain._rendam = null; }); }
  if (sebab === 'batal' || (s.status !== 2 && kain.soak > 0)) { const t = kain.rendam(0, 1.1); kain._rendam = t; t.eventCallback('onComplete', () => { kain._rendam = null; }); }
  detak();
});

addEventListener('resize', () => { clearTimeout(window._rs); window._rs = setTimeout(() => { if (Math.abs($('akta').clientWidth - lebarAkta) > 30) buatAkta(); }, 250); });

document.fonts.ready.then(() => {
  buatAkta(); renderAtas(); renderKartu(); detak();
  if (!Demo.diam) {
    UI.masuk([$('chip'), $('judul'), $('lead')]);
    gsap.fromTo('#akta', { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 1.2, ease: 'power3.inOut', delay: .15 });
    gsap.from('.ks', { opacity: 0, y: -8, duration: .7, stagger: .08, ease: 'power3.out', delay: .4 });
  }
});
