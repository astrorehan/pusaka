/* Pusaka · Nila — helper UI bersama untuk semua layar */
window.UI = (() => {
  const MEREK = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="2.5" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M7 21.5 L12.5 2.5 M12 21.5 L17.5 2.5" stroke="currentColor" stroke-width="1.3"/></svg>`;

  /* Resapan teks: picu ulang animasi .resap */
  function masuk(target) {
    const els = typeof target === 'string' ? document.querySelectorAll(target) : [].concat(target);
    els.forEach((e) => { if (!e) return; e.classList.add('resap'); e.classList.remove('is-in'); void e.offsetWidth; e.classList.add('is-in'); });
  }

  /* Blok Monad berdetak tiap 400 ms. el berisi <i> (titik) dan <b> (angka). */
  function blok(el) {
    if (!el) return;
    const b = el.querySelector('b'), i = el.querySelector('i');
    let akhir = 0;
    const jalan = () => {
      const n = Demo.blok();
      if (n !== akhir) {
        akhir = n; b.textContent = n.toLocaleString('id-ID');
        if (i && window.gsap && !Demo.diam) gsap.fromTo(i, { backgroundColor: '#e3ca8e' }, { backgroundColor: '#6b7da8', duration: .35, overwrite: true });
      }
    };
    jalan(); setInterval(jalan, 100);
  }

  /* Digit hitung mundur dalam span lebar tetap, agar angka tidak bergoyang */
  function digit(el, teks) {
    el.innerHTML = [...teks].map((c) => `<span class="${c === ':' ? 'titik' : ''}">${c}</span>`).join('');
  }

  /* "12 detik lalu" */
  function lalu(ms) {
    const dt = Math.max(0, Math.round(ms / 1000));
    if (dt < 3) return 'baru saja';
    if (dt < 60) return `${dt} detik lalu`;
    if (dt < 3600) return `${Math.round(dt / 60)} menit lalu`;
    return `${Math.round(dt / 3600)} jam lalu`;
  }
  /* durasi dalam kata: 600 → "10 menit" */
  function durasi(detik) {
    if (detik < 60) return `${detik} detik`;
    if (detik < 3600) return `${Math.round(detik / 60)} menit`;
    if (detik < 86400 * 2) return `${Math.round(detik / 3600)} jam`;
    if (detik < 86400 * 60) return `${Math.round(detik / 86400)} hari`;
    return `${Math.round(detik / (86400 * 30))} bulan`;
  }

  /* Tahan untuk konfirmasi. Penunjuk atau Spasi/Enter ditahan selama `lama` ms.
     Dilepas sebelum penuh: isi surut kembali. */
  function tahan(btn, { lama = 1100, onMulai, onSelesai, onBatal } = {}) {
    let raf = 0, t0 = 0, p = 0, aktif = false, selesai = false;
    const set = (v) => { p = v; btn.style.setProperty('--p', v.toFixed(3)); };
    const langkah = (t) => {
      if (!aktif) return;
      p = Math.min(1, (t - t0) / lama);
      set(p);
      if (p >= 1) { aktif = false; selesai = true; btn.classList.add('selesai'); onSelesai && onSelesai(); return; }
      raf = requestAnimationFrame(langkah);
    };
    const mulai = (e) => {
      if (selesai || btn.disabled || aktif) return;
      if (e && e.type === 'pointerdown') { if (e.button !== 0) return; btn.setPointerCapture && btn.setPointerCapture(e.pointerId); }
      aktif = true; t0 = performance.now() - p * lama; onMulai && onMulai();
      raf = requestAnimationFrame(langkah);
    };
    const lepas = () => {
      if (!aktif) return;
      aktif = false; cancelAnimationFrame(raf);
      onBatal && onBatal();
      const dari = p, s0 = performance.now();
      const surut = (t) => { const v = Math.max(0, dari - (t - s0) / 380 * dari); set(v); if (v > 0 && !aktif) requestAnimationFrame(surut); };
      requestAnimationFrame(surut);
    };
    btn.addEventListener('pointerdown', mulai);
    btn.addEventListener('pointerup', lepas);
    btn.addEventListener('pointercancel', lepas);
    btn.addEventListener('lostpointercapture', lepas);
    btn.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); mulai(); } });
    btn.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') lepas(); });
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
    return { reset() { selesai = false; aktif = false; btn.classList.remove('selesai'); set(0); } };
  }

  /* Rupiah dihitung naik */
  function hitungNaik(el, ke, { dari = 0, dur = 1.6, fmt = Pusaka.rp, ease = 'power2.out' } = {}) {
    const o = { v: dari };
    return gsap.to(o, { v: ke, duration: dur, ease, onUpdate: () => { el.textContent = fmt(o.v); } });
  }

  /* Alamat dompet acak yang stabil untuk demo */
  function alamat(seed) {
    const h = Demo.hash('alamat' + seed).slice(2);
    return '0x' + h.slice(0, 4) + '…' + h.slice(-4);
  }

  /* Menu "Dompet demo": kunci pewaris + 3 saksi yang dibuat browser, saldo gas, tombol Bagikan gas */
  const mon = (m) => m.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' MON';
  function dompetDemo(host) {
    const d = document.createElement('details');
    d.className = 'menu dompet-demo';
    d.innerHTML = `<summary class="btn btn--garis btn--kecil">Dompet demo</summary><div class="isi-menu" role="group" aria-label="Dompet demo"></div>`;
    const isi = d.querySelector('.isi-menu');
    const render = () => {
      const g = Demo.s.gas;
      // Saksi hanya menandatangani; relayer (dompet induk) yang mengirim dan membayar gas.
      const baris = [['Pewaris', Pusaka.pewaris.nama, Pusaka.pewaris.alamat, g.pewaris],
        ...Pusaka.saksi.map((k, i) => [`Saksi ${i + 1}`, k.nama, k.alamat, null]),
        ...(Demo.operator ? [['Operator', 'Mitra pencairan', Demo.pendek(Demo.operator.address), g.operator || 0]] : [])];
      const perlu = baris.some((b) => b[3] != null && b[3] < .1);
      isi.innerHTML = `<p class="dd-judul">Kunci demo di browser ini</p>
        <div class="dd-daftar">${baris.map(([p, n, a, m]) => `<div><span>${n}<small>${p}, ${a}</small></span>${m == null ? '<b>tanpa gas</b>' : `<b class="${m < .01 ? 'kosong' : ''}">${mon(m)}</b>`}</div>`).join('')}</div>
        <div class="dd-induk"><span>Dompet induk<small>Diisi dari faucet sebelum acara. Juga relayer: mengirim tanda tangan saksi dan kabar hidup</small></span><b>${mon(g.induk)}</b></div>
        <button class="btn btn--penuh btn--kecil" type="button" data-gas ${perlu ? '' : 'disabled'}>${perlu ? 'Bagikan gas (pewaris, amplop, mitra)' : 'Gas sudah dibagikan'}</button>
        <p class="peringatan">Kunci demo hanya untuk testnet. Jangan pernah memakai private key dompet asli.</p>`;
    };
    render();
    Demo.on(render);
    isi.addEventListener('click', (e) => { if (e.target.closest('[data-gas]')) Demo.bagikanGas(); });
    document.addEventListener('click', (e) => { if (d.open && !d.contains(e.target)) d.open = false; });
    host.appendChild(d);
    return d;
  }

  return { MEREK, masuk, blok, digit, lalu, durasi, tahan, hitungNaik, alamat, dompetDemo, mon };
})();
