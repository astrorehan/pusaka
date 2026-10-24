/* Pusaka · Nila — mesin kain
   Satu helai kain = harta. Kain dibagi garis lilin miring (lereng) menjadi bidang yang luasnya
   sebanding dengan bagian tiap penerima. Pewarna merambat di kanvas; lilin, isen-isen, dan
   pinggiran digambar di SVG.

   Lapisan (bawah ke atas):
   1. svg.k-dasar   bayangan, pinggiran soga + untu walang, rawis, dasar mori
   2. canvas.k-celup pewarna (dirender per frame dari peta waktu-tiba yang dihitung sekali)
   3. svg.k-lilin   isen-isen per bidang, garis lilin, retak lilin, prada
   4. div.k-serat   tekstur benang + cahaya (dibuat sekali, statis)
   5. svg.k-potong  celah saat kain dipotong

   Tiga pembuat kain:
   - buat()   kain lengkap untuk Panggung dan Beranda (celup organik, nglorod, potong)
   - hidup()  kain yang dibagi ulang langsung saat susunan berubah (Kalkulator, Pewaris)
   - contoh() potongan kain untuk HP ahli waris
   Bergantung pada GSAP untuk tween. */
window.Kain = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs = {}, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };

  /* ---------- derau (value noise) ---------- */
  function rng(seed) {
    let s = (seed >>> 0) || 1;
    return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  }
  function makeNoise(seed) {
    const r = rng(seed), P = new Uint8Array(512), V = new Float32Array(256);
    for (let i = 0; i < 256; i++) { P[i] = i; V[i] = r(); }
    for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = P[i]; P[i] = P[j]; P[j] = t; }
    for (let i = 0; i < 256; i++) P[i + 256] = P[i];
    const h = (x, y) => V[P[P[x & 255] + (y & 255)]];
    const n = (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
    n.fbm = (x, y, oct = 3) => {
      let s = 0, amp = .5, f = 1, norm = 0;
      for (let o = 0; o < oct; o++) { s += amp * n(x * f, y * f); norm += amp; amp *= .5; f *= 2.03; }
      return s / norm;
    };
    return n;
  }

  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const rgbStr = (c) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
  const hashStr = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0) % 997; };

  /* ---------- geometri lereng ----------
     Garis potong: x = s + (H - y)·k. s = posisi x di tepi bawah. Miring ke kanan saat naik. */
  function hitungPotong(amounts, W, H, k) {
    const total = amounts.reduce((a, b) => a + b, 0);
    if (!(total > 0)) return amounts.slice(1).map(() => W / 2 - H * k / 2);
    const luasKiri = (s) => {
      const N = 256; let A = 0;
      for (let i = 0; i <= N; i++) {
        const u = (i / N) * H;
        const x = Math.min(W, Math.max(0, s + u * k));
        A += (i === 0 || i === N ? .5 : 1) * x;
      }
      return A * (H / N);
    };
    const cuts = []; let acc = 0;
    for (let i = 0; i < amounts.length - 1; i++) {
      acc += amounts[i];
      const target = (acc / total) * W * H;
      let lo = -H * k, hi = W;
      for (let it = 0; it < 44; it++) { const m = (lo + hi) / 2; if (luasKiri(m) < target) lo = m; else hi = m; }
      cuts.push((lo + hi) / 2);
    }
    return cuts;
  }
  function klip(poly, f) {
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length], fa = f(a), fb = f(b);
      if (fa >= 0) out.push(a);
      if ((fa >= 0) !== (fb >= 0)) { const t = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
    }
    return out;
  }
  const luas = (p) => { let A = 0; for (let i = 0; i < p.length; i++) { const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length]; A += x1 * y2 - x2 * y1; } return A / 2; };
  /* Poligon cembung digeser ke dalam sejauh d (agar isen tidak menempel ke garis lilin) */
  function ciutkan(poly, d) {
    const n = poly.length;
    if (n < 3) return poly;
    const sgn = luas(poly) > 0 ? 1 : -1;
    const lines = poly.map((a, i) => {
      const b = poly[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
      const nx = -dy / L * sgn, ny = dx / L * sgn;
      return { p: [a[0] + nx * d, a[1] + ny * d], v: [dx, dy] };
    });
    return lines.map((l1, i) => {
      const l0 = lines[(i - 1 + n) % n];
      const det = l0.v[0] * l1.v[1] - l0.v[1] * l1.v[0];
      if (Math.abs(det) < 1e-9) return l1.p;
      const t = ((l1.p[0] - l0.p[0]) * l1.v[1] - (l1.p[1] - l0.p[1]) * l1.v[0]) / det;
      return [l0.p[0] + l0.v[0] * t, l0.p[1] + l0.v[1] * t];
    });
  }
  /* Versi aman: kosong jika bidang terlalu sempit untuk digeser (poligon akan terbalik) */
  function ciutkanAman(poly, d) {
    if (poly.length < 3) return null;
    const A = luas(poly);
    if (Math.abs(A) < d * d * 8) return null;
    const c = ciutkan(poly, d), A2 = luas(c);
    if (Math.sign(A2) !== Math.sign(A) || Math.abs(A2) >= Math.abs(A)) return null;
    const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    if (c.some(([x, y]) => x < x0 - .5 || x > x1 + .5 || y < y0 - .5 || y > y1 + .5)) return null;
    return c;
  }

  function geometri(amounts, W, H, k) {
    const cuts = hitungPotong(amounts, W, H, k);
    const X = (s, y) => s + (H - y) * k;
    const polys = amounts.map((_, i) => {
      let p = [[0, 0], [W, 0], [W, H], [0, H]];
      if (i > 0) p = klip(p, ([x, y]) => x - X(cuts[i - 1], y));
      if (i < amounts.length - 1) p = klip(p, ([x, y]) => X(cuts[i], y) - x);
      return p;
    });
    const info = polys.map((p, i) => {
      const l = i > 0 ? Math.max(0, cuts[i - 1]) : 0, r = i < cuts.length ? Math.min(W, cuts[i]) : W;
      let cx = 0, cy = 0; p.forEach(([x, y]) => { cx += x; cy += y; });
      return { poly: p, bawah: [(l + r) / 2, H], tengah: [cx / p.length, cy / p.length], lebarBawah: r - l };
    });
    return { cuts, info, X };
  }

  /* ---------- isen-isen (pola lilin pengisi) ---------- */
  const ISEN = {
    cecek: (p) => { p.setAttribute('width', 11); p.setAttribute('height', 11);
      el('circle', { cx: 2.75, cy: 2.75, r: 1.45, fill: 'currentColor' }, p); el('circle', { cx: 8.25, cy: 8.25, r: 1.45, fill: 'currentColor' }, p); },
    sawut: (p) => { p.setAttribute('width', 9); p.setAttribute('height', 9);
      el('path', { d: 'M1.2 7.5 L3.6 1.8 M5.7 8.4 L8.1 2.7', stroke: 'currentColor', 'stroke-width': 1.05, 'stroke-linecap': 'round', fill: 'none' }, p); },
    sisik: (p) => { p.setAttribute('width', 14); p.setAttribute('height', 9);
      el('path', { d: 'M0 9 A7 7 0 0 1 14 9 M-7 4.5 A7 7 0 0 1 7 4.5 M7 4.5 A7 7 0 0 1 21 4.5', stroke: 'currentColor', 'stroke-width': 1.05, fill: 'none' }, p); },
    ukel: (p) => { p.setAttribute('width', 15); p.setAttribute('height', 15);
      el('path', { d: 'M7.5 7.5 m-3.4 0 a3.4 3.4 0 1 0 3.4 -3.4 a1.9 1.9 0 1 1 -1.9 1.9', stroke: 'currentColor', 'stroke-width': 1.05, fill: 'none', 'stroke-linecap': 'round' }, p);
      el('circle', { cx: 13.4, cy: 13.4, r: .9, fill: 'currentColor' }, p); },
    galaran: (p) => { p.setAttribute('width', 6); p.setAttribute('height', 6);
      el('path', { d: 'M0 3 H6', stroke: 'currentColor', 'stroke-width': 1.05 }, p); },
    /* bunga truntum ditabur jarang di atas cecek; cecek dikosongkan di sekitar bunga */
    truntum: (p) => { p.setAttribute('width', 77); p.setAttribute('height', 66);
      const bunga = [[19.25, 16.5], [57.75, 49.5]];
      for (let j = 0; j < 6; j++) for (let i = 0; i < 7; i++) {
        const x = i * 11 + (j % 2) * 5.5 + 2.75, y = j * 11 + 2.75;
        if (bunga.some(([bx, by]) => Math.hypot(x - bx, y - by) < 17)) continue;
        el('circle', { cx: x, cy: y, r: 1.45, fill: 'currentColor' }, p);
      }
      bunga.forEach(([cx, cy]) => {
        el('circle', { cx, cy, r: 2.6, fill: 'currentColor' }, p);
        for (let a = 0; a < 8; a++) {
          const t = a / 8 * Math.PI * 2;
          el('circle', { cx: cx + Math.cos(t) * 7.4, cy: cy + Math.sin(t) * 7.4, r: 1.7, fill: 'currentColor' }, p);
          if (a % 2 === 0) el('path', { d: `M${cx + Math.cos(t) * 10.5} ${cy + Math.sin(t) * 10.5} L${cx + Math.cos(t) * 14} ${cy + Math.sin(t) * 14}`, stroke: 'currentColor', 'stroke-width': 1.1, 'stroke-linecap': 'round' }, p);
        }
      }); },
    gringsing: (p) => { p.setAttribute('width', 12); p.setAttribute('height', 10);
      el('path', { d: 'M0 10 A6 6 0 0 1 12 10 M-6 5 A6 6 0 0 1 6 5 M6 5 A6 6 0 0 1 18 5', stroke: 'currentColor', 'stroke-width': 1, fill: 'none' }, p);
      el('circle', { cx: 6, cy: 7.6, r: 1, fill: 'currentColor' }, p); el('circle', { cx: 0, cy: 2.6, r: 1, fill: 'currentColor' }, p); el('circle', { cx: 12, cy: 2.6, r: 1, fill: 'currentColor' }, p); },
    polos: () => {},
  };

  const WARNA_LILIN = '#cdb892';   /* lilin di atas mori: coklat muda bening */
  const WARNA_MORI = '#f3ecdf';    /* setelah dilorod */
  const GRAFIT = '#857d6e';        /* sketsa pensil sebelum dicanting */
  let uid = 0;

  /* ---------- tekstur statis (dibuat sekali per ukuran) ---------- */
  const cacheSerat = new Map();
  function teksturSerat(w, h, seed = 3) {
    const kunci = `${Math.round(w)}x${Math.round(h)}:${seed}`;
    if (cacheSerat.has(kunci)) return cacheSerat.get(kunci);
    const c = document.createElement('canvas');
    const q = Math.min(1, 1600 / w);
    c.width = Math.round(w * q); c.height = Math.round(h * q);
    const g = c.getContext('2d'), img = g.createImageData(c.width, c.height), d = img.data, n = makeNoise(seed), n2 = makeNoise(seed + 9);
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
      const X = x / q, Y = y / q;
      // benang lusi (vertikal) dan pakan (horizontal) + belang besar
      const v = .55 * n(X / 1.6, Y / 14) + .45 * n2(X / 12, Y / 1.7);
      const m = n.fbm(X / 260, Y / 180, 3);
      const t = (v - .5) * 1.1 + (m - .5) * .9;
      const i = (y * c.width + x) * 4;
      const val = 128 + t * 120;
      d[i] = d[i + 1] = d[i + 2] = Math.max(0, Math.min(255, val));
      d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const url = c.toDataURL();
    cacheSerat.set(kunci, url);
    return url;
  }

  /* ---------- pewarna (kanvas) ---------- */
  function pewarna(canvas, { W, H, k, cuts, dyes, q, seed }) {
    const cw = Math.max(2, Math.round(W * q)), ch = Math.max(2, Math.round(H * q));
    canvas.width = cw; canvas.height = ch;
    const g = canvas.getContext('2d');
    const img = g.createImageData(cw, ch), D = img.data;
    const N = cw * ch, band = new Uint8Array(N), T = new Float32Array(N), shade = new Float32Array(N);
    const nz = makeNoise(seed), nf = makeNoise(seed + 5);
    const nb = cuts.length + 1;
    for (let j = 0; j < ch; j++) {
      const Y = (j + .5) / q;
      const L = cuts.map((s) => s + (H - Y) * k);
      for (let x = 0; x < cw; x++) {
        const X = (x + .5) / q, i = j * cw + x;
        let b = 0; while (b < L.length && X >= L[b]) b++;
        band[i] = b;
        const left = b > 0 ? Math.max(0, L[b - 1]) : 0, right = b < L.length ? Math.min(W, L[b]) : W;
        const hw = Math.max(1, (right - left) / 2), lat = Math.min(1, Math.abs(X - (left + right) / 2) / hw);
        const n1 = nz.fbm(X / 85, Y / 70, 4);
        T[i] = Math.max(0, Math.min(1, .66 * (Y / H) + .14 * lat + .34 * (n1 - .5) + .06));
        shade[i] = (.93 + .1 * nf(X / 1.5, Y / 11)) * (.95 + .1 * nf.fbm(X / 210, Y / 150, 3));
      }
    }
    const cols = dyes.map(hex), soakC = hex('#2b4a96');
    const prog = new Float32Array(nb);
    let soak = 0;
    const FEATHER = .045, TIDE = .11;
    const sw = makeNoise(seed + 13);
    const amp = Math.max(.4, H / 430);

    function render() {
      const soakFront = H * (1 - soak);
      for (let j = 0; j < ch; j++) {
        const Y = (j + .5) / q;
        for (let x = 0; x < cw; x++) {
          const i = j * cw + x, o = i * 4, b = band[i], p = prog[b];
          let a = 0, r = 0, gg = 0, bb = 0;
          if (p > 0) {
            const d = p - T[i];
            if (d > -FEATHER) {
              a = d >= 0 ? 1 : 1 + d / FEATHER; a = a * a * (3 - 2 * a);
              const tide = d >= 0 && d < TIDE ? 1 - .24 * (1 - d / TIDE) : d < 0 ? .76 : 1;
              const s = shade[i] * tide, c = cols[b];
              r = c[0] * s; gg = c[1] * s; bb = c[2] * s;
            }
          }
          if (soak > 0 && a < 1) {
            const X = (x + .5) / q;
            const f = soakFront + ((sw(X / 190, 0) - .5) * 14 + (sw(X / 37, 3) - .5) * 3) * amp;
            if (Y > f) {
              // air celup: pekat ke bawah, garis air sedikit lebih gelap di permukaan
              const dlm = Y - f;
              const sa = (.27 + .17 * Math.min(1, dlm / (140 * amp)) + (dlm < 5 * amp ? .12 : 0)) * shade[i];
              const fa = a + sa * (1 - a);
              r = (r * a + soakC[0] * sa * (1 - a)) / fa; gg = (gg * a + soakC[1] * sa * (1 - a)) / fa; bb = (bb * a + soakC[2] * sa * (1 - a)) / fa;
              a = fa;
            }
          }
          D[o] = r; D[o + 1] = gg; D[o + 2] = bb; D[o + 3] = a * 255;
        }
      }
      g.putImageData(img, 0, 0);
    }
    let raf = 0;
    const jadwal = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; render(); }); };
    return {
      prog,
      set(i, p) { prog[i] = p; jadwal(); },
      setAll(p) { prog.fill(p); jadwal(); },
      get soak() { return soak; },
      set soak(v) { soak = v; jadwal(); },
      render,
    };
  }

  /* ---------- dasar kain: bayangan, pinggiran soga + untu walang, rawis, mori ----------
     Detail pinggiran diukur untuk tebal 32px dan diskalakan mengikuti B. */
  function dasarKain(svg, { W, H, B, F, seed, pinggir = true, rawis = true }, id) {
    const s = B / 32, totH = H + 2 * B;
    const defs = el('defs', {}, svg);
    const fb = el('filter', { id: id + '-blur', x: '-10%', y: '-20%', width: '120%', height: '160%' }, defs);
    el('feGaussianBlur', { stdDeviation: 18 * Math.max(.5, s) }, fb);
    const bayang = el('rect', { x: 0, y: -B, width: W, height: totH, fill: '#060a16', class: 'k-bayang', filter: `url(#${id}-blur)`, transform: `translate(0 ${22 * Math.max(.5, s)})` }, svg);
    bayang.style.opacity = 'var(--bayang-kain, .55)';
    el('rect', { x: 0, y: 0, width: W, height: H, fill: '#ede5d4' }, svg);
    if (pinggir) {
      [[-B, 0], [H, 1]].forEach(([y0, bawah]) => {
        el('rect', { x: 0, y: y0, width: W, height: B, fill: '#4e301c' }, svg);
        // seret: dua garis tipis
        const ya = bawah ? y0 + B - 6 * s : y0 + 6 * s;
        el('line', { x1: 0, x2: W, y1: ya, y2: ya, stroke: '#e6dccb', 'stroke-width': Math.max(.6, 1.1 * s), opacity: .8 }, svg);
        const yb = bawah ? y0 + B - 10 * s : y0 + 10 * s;
        el('line', { x1: 0, x2: W, y1: yb, y2: yb, stroke: '#e6dccb', 'stroke-width': Math.max(.45, .7 * s), opacity: .55 }, svg);
        // untu walang: segitiga kecil menghadap bidang
        const t = 12 * s, base = bawah ? y0 + 2 * s : y0 + B - 2 * s, dir = bawah ? 1 : -1;
        let d = '';
        for (let x = 0; x < W - t / 2; x += t) d += `M${x.toFixed(2)} ${base.toFixed(2)} L${(x + t / 2).toFixed(2)} ${(base + dir * 9 * s).toFixed(2)} L${(x + t).toFixed(2)} ${base.toFixed(2)} Z`;
        el('path', { d, fill: '#e6dccb', opacity: .9 }, svg);
        // cecek di antara garis seret
        let dd = '';
        const yc = bawah ? y0 + B - 18 * s : y0 + 18 * s, rc = 1.1 * s;
        for (let x = 6 * s; x < W; x += 9 * s) dd += `M${x.toFixed(2)} ${yc.toFixed(2)} m-${rc} 0 a${rc} ${rc} 0 1 0 ${2 * rc} 0 a${rc} ${rc} 0 1 0 -${2 * rc} 0`;
        el('path', { d: dd, fill: '#e6dccb', opacity: .6 }, svg);
      });
    }
    if (rawis) {
      const r = rng(seed + 3);
      let d = '';
      const st = 3.2 * Math.max(.6, s);
      for (let y = -B + 2; y < H + B - 1; y += st) {
        const l1 = 7 * s + r() * (F - 6 * s), l2 = 7 * s + r() * (F - 6 * s), a1 = (r() - .5) * 3 * s, a2 = (r() - .5) * 3 * s;
        d += `M0 ${y.toFixed(1)} L${(-l1).toFixed(1)} ${(y + a1).toFixed(1)} M${W} ${y.toFixed(1)} L${(W + l2).toFixed(1)} ${(y + a2).toFixed(1)}`;
      }
      el('path', { d, stroke: '#ddd2bd', 'stroke-width': Math.max(.5, .9 * s), opacity: .8, fill: 'none' }, svg);
    }
    return { defs, bayang };
  }

  /* Tekstur benang + cahaya di atas kain */
  function lapisSerat(container, { W, F, totH, seed }) {
    const serat = document.createElement('div');
    serat.className = 'k-serat';
    serat.style.cssText = `position:absolute;left:${F}px;top:0;width:${W}px;height:${totH}px;pointer-events:none;mix-blend-mode:multiply;opacity:.28;background-size:100% 100%;`;
    serat.style.backgroundImage = `url(${teksturSerat(W, totH, seed)})`;
    container.appendChild(serat);
    const cahaya = document.createElement('div');
    cahaya.style.cssText = `position:absolute;left:${F}px;top:0;width:${W}px;height:${totH}px;pointer-events:none;mix-blend-mode:soft-light;background:radial-gradient(120% 140% at 35% 20%, rgba(255,250,235,.55), rgba(255,250,235,0) 55%, rgba(0,0,20,.35) 100%);`;
    container.appendChild(cahaya);
  }

  /* ---------- kain lengkap ---------- */
  function buat(container, opts) {
    const o = Object.assign({ W: 1600, H: 420, B: 32, F: 16, k: .42, q: .55, seed: 7, rawis: true, pinggir: true }, opts);
    const { W, H, B, F, k } = o;
    const id = 'k' + (++uid);
    const bands = o.bands;
    const geo = geometri(bands.map((b) => b.amount), W, H, k);
    const totW = W + 2 * F, totH = H + 2 * B;

    container.classList.add('kain');
    container.style.cssText += `;position:relative;width:${totW}px;height:${totH}px;`;
    const vb = `${-F} ${-B} ${totW} ${totH}`;
    const layer = (cls) => { const s = el('svg', { class: cls, viewBox: vb, width: totW, height: totH }, container); s.style.cssText = 'position:absolute;inset:0;overflow:visible'; return s; };

    // 1. dasar
    dasarKain(layer('k-dasar'), o, id);

    // 2. pewarna
    const cv = document.createElement('canvas');
    cv.className = 'k-celup';
    cv.style.cssText = `position:absolute;left:${F}px;top:${B}px;width:${W}px;height:${H}px;`;
    container.appendChild(cv);
    const celup = pewarna(cv, { W, H, k, cuts: geo.cuts, dyes: bands.map((b) => b.dye), q: o.q, seed: o.seed });

    // 3. lilin
    const lilin = layer('k-lilin');
    const defs = el('defs', {}, lilin);
    const isenG = el('g', {}, lilin);
    const retakG = el('g', { opacity: 0, stroke: '#1b1712', 'stroke-width': .6, fill: 'none', 'stroke-opacity': .45 }, lilin);
    const pradaG = el('g', {}, lilin);
    const garisG = el('g', { fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, lilin);
    const ujung = el('circle', { r: 4.5, fill: '#fff3d6', opacity: 0 }, lilin);
    const ang = Math.atan(k) * 180 / Math.PI;

    const pats = bands.map((b, i) => {
      const p = el('pattern', { id: `${id}-p${i}`, patternUnits: 'userSpaceOnUse' }, defs);
      p.style.color = WARNA_LILIN;
      (ISEN[b.isen] || ISEN.polos)(p);
      if (b.isen === 'galaran') p.setAttribute('patternTransform', `rotate(${-ang})`);
      return p;
    });
    const isenEls = geo.info.map((g, i) => {
      const cp = el('clipPath', { id: `${id}-c${i}` }, defs);
      el('polygon', { points: g.poly.map((p) => p.join(',')).join(' ') }, cp);
      // isen sedikit menjauh dari garis lilin dan tepi kain
      const dalam = ciutkan(g.poly, 6);
      const pts = dalam.map((p) => p.map((v) => v.toFixed(2)).join(',')).join(' ');
      return el('polygon', { points: pts, fill: `url(#${id}-p${i})` }, isenG);
    });

    // garis lilin buatan tangan
    const rr = rng(o.seed + 11), nn = makeNoise(o.seed + 17);
    const garis = geo.cuts.map((s, ci) => {
      const y0 = H, y1 = 0, len = Math.hypot((y0 - y1) * k, y0 - y1), steps = Math.ceil(len / 9);
      let d = '';
      for (let t = 0; t <= steps; t++) {
        const y = y0 - (t / steps) * (y0 - y1), x = s + (H - y) * k;
        const off = (nn(t * .35, ci * 7.1) - .5) * 1.6;
        const px = x + off * Math.cos(Math.atan(k)), py = y + off * Math.sin(Math.atan(k)) * .3;
        d += (t ? 'L' : 'M') + px.toFixed(2) + ' ' + py.toFixed(2);
      }
      // dua bidang milik orang yang sama dibatasi garis cecek, bukan garis penuh
      const sambung = bands[ci + 1] && bands[ci + 1].sambung;
      const bawah = el('path', { d, stroke: '#b59d73', 'stroke-width': sambung ? 0 : 4.6, opacity: .35 }, garisG);
      const atas = el('path', { d, stroke: WARNA_LILIN, 'stroke-width': sambung ? 3.4 : 3.1, ...(sambung ? { 'stroke-dasharray': '.1 8', class: 'sambung' } : {}) }, garisG);
      const tetes = el('ellipse', { cx: s + (rr() - .5) * 2, cy: H - 2, rx: 3.4, ry: 2.2, fill: WARNA_LILIN, opacity: sambung ? 0 : 1 }, garisG);
      return { bawah, atas, tetes, s, sambung };
    });

    // retak lilin dan prada hanya di bidang yang ditutup lilin (nembok)
    geo.info.forEach((g, i) => {
      const b = bands[i];
      if (!b.nembok && !b.prada) return;
      const grp = el('g', { 'clip-path': `url(#${id}-c${i})` }, retakG);
      const r = rng(o.seed + i * 31);
      const xs = g.poly.map((p) => p[0]), minX = Math.min(...xs), maxX = Math.max(...xs);
      const n = Math.round((maxX - minX) * H / 2600);
      for (let c = 0; c < n; c++) {
        let x = minX + r() * (maxX - minX), y = r() * H, d = `M${x.toFixed(1)} ${y.toFixed(1)}`;
        const segs = 4 + Math.floor(r() * 6);
        for (let s = 0; s < segs; s++) { x += (r() - .5) * 34; y += (r() - .35) * 26; d += `L${x.toFixed(1)} ${y.toFixed(1)}`; }
        el('path', { d }, grp);
      }
      if (b.prada) {
        const pg = el('g', { 'clip-path': `url(#${id}-c${i})` }, pradaG);
        const gid = `${id}-emas`;
        const lg = el('linearGradient', { id: gid, x1: 0, y1: 0, x2: 1, y2: 1 }, defs);
        el('stop', { offset: 0, 'stop-color': '#a8843e' }, lg); el('stop', { offset: .5, 'stop-color': '#ecd59b' }, lg); el('stop', { offset: 1, 'stop-color': '#b38f46' }, lg);
        const m = Math.round((maxX - minX) * H / 900);
        for (let c = 0; c < m; c++) {
          const cx = minX + r() * (maxX - minX), cy = r() * H, s = 2 + r() * 4.5;
          let d = '';
          const sides = 4 + Math.floor(r() * 3);
          for (let v = 0; v < sides; v++) { const a = (v / sides) * Math.PI * 2 + r() * .6, rad = s * (.6 + r() * .6); d += (v ? 'L' : 'M') + (cx + Math.cos(a) * rad).toFixed(1) + ' ' + (cy + Math.sin(a) * rad).toFixed(1); }
          el('path', { d: d + 'Z', fill: `url(#${gid})`, opacity: 0, class: 'prada' }, pg);
        }
      }
    });

    // 4. serat + cahaya
    lapisSerat(container, { W, F, totH, seed: o.seed });

    // 5. potong
    const potong = layer('k-potong');
    // celah mengikuti garis potong x = s + (H - y)k, menembus pinggiran atas dan bawah
    const yA = H + B + 4, yB = -B - 4;
    const celah = geo.cuts.map((s) => el('path', { d: `M${s + (H - yA) * k} ${yA} L${s + (H - yB) * k} ${yB}`, stroke: 'var(--bg)', 'stroke-width': 0, fill: 'none' }, potong))
      .filter((_, ci) => !(bands[ci + 1] && bands[ci + 1].sambung));

    /* ---------- koreografi ---------- */
    const api = {
      el: container, geo, bands, celup, W, H, B, F, k,
      info: geo.info,
      /* posisi dalam koordinat container (px), misal untuk tali label */
      titikBawah(i) { const [x, y] = geo.info[i].bawah; return [x + F, y + B]; },
      tengah(i) { const [x, y] = geo.info[i].tengah; return [x + F, y + B]; },
      /* indeks bidang di titik (koordinat container), untuk hover */
      bidangDi(px, py) {
        const x = px - F, y = py - B;
        if (x < 0 || x > W || y < 0 || y > H) return -1;
        let b = 0; while (b < geo.cuts.length && x >= geo.X(geo.cuts[b], y)) b++;
        return b;
      },

      keadaanAwal({ lilin = true } = {}) {
        celup.setAll(0); celup.soak = 0;
        gsap.set(isenEls, { opacity: lilin ? 1 : 0 });
        garis.forEach((g) => {
          gsap.set([g.atas, g.bawah], { strokeDasharray: 'none', strokeDashoffset: 0 });
          if (g.sambung) gsap.set(g.atas, { strokeDasharray: '.1 8' });
          gsap.set(g.atas, { opacity: lilin ? 1 : 0 });
          gsap.set(g.bawah, { opacity: lilin ? .35 : 0 });
          gsap.set(g.tetes, { opacity: lilin && !g.sambung ? 1 : 0, scale: 1 });
        });
        pats.forEach((p) => { p.style.color = WARNA_LILIN; });
        garis.forEach((g) => { g.atas.setAttribute('stroke', WARNA_LILIN); g.tetes.setAttribute('fill', WARNA_LILIN); });
        gsap.set(retakG, { opacity: 0 });
        gsap.set(container.querySelectorAll('.prada'), { opacity: 0 });
        gsap.set(celah, { attr: { 'stroke-width': 0 } });
      },

      /* Nyanting: garis lilin digambar dengan canting, lalu isen-isen muncul per bidang */
      nyanting() {
        const tl = gsap.timeline();
        gsap.set(isenEls, { opacity: 0 });
        garis.forEach((g, i) => {
          const L = g.atas.getTotalLength();
          if (g.sambung) {
            gsap.set(g.atas, { strokeDasharray: '.1 8', opacity: 0 });
            tl.to(g.atas, { opacity: 1, duration: .8 }, i * .32 + .4);
            return;
          }
          gsap.set([g.atas, g.bawah], { strokeDasharray: L, strokeDashoffset: L, opacity: (_, t) => (t === g.bawah ? .35 : 1) });
          gsap.set(g.tetes, { opacity: 0, scale: 0, transformOrigin: 'center' });
          const at = i * .32;
          tl.to(g.tetes, { opacity: 1, scale: 1, duration: .25, ease: 'back.out(3)' }, at)
            .to([g.atas, g.bawah], { strokeDashoffset: 0, duration: 1.15, ease: 'sine.inOut',
              onUpdate() {
                if (this.targets()[0] !== g.atas) return;
                const len = L * this.progress(), pt = g.atas.getPointAtLength(len);
                ujung.setAttribute('cx', pt.x); ujung.setAttribute('cy', pt.y);
              } }, at + .1)
            .to(ujung, { opacity: .9, duration: .15 }, at + .1)
            .to(ujung, { opacity: 0, duration: .25 }, at + 1.1);
        });
        tl.to(isenEls, { opacity: 1, duration: 1.1, stagger: { each: .12, from: 'start' }, ease: 'sine.out' }, .5);
        return tl;
      },

      /* Masa sanggah: kain direndam perlahan; bisa ditarik kembali */
      rendam(level, dur = .8) { return gsap.to(celup, { soak: level, duration: dur, ease: 'sine.inOut' }); },

      /* Celup satu bidang */
      celupBidang(i, dur = 2.4) {
        const o2 = { p: celup.prog[i] };
        return gsap.to(o2, { p: 1.25, duration: dur, ease: 'sine.inOut', onUpdate: () => celup.set(i, o2.p) });
      },

      /* Nglorod: lilin dilepas, garis dan isen menjadi putih mori, retak dan prada muncul */
      nglorod() {
        const tl = gsap.timeline();
        tl.to(pats, { color: WARNA_MORI, duration: 1.4, ease: 'sine.inOut' }, 0)
          .to(garis.map((g) => g.atas), { attr: { stroke: WARNA_MORI }, duration: 1.4, ease: 'sine.inOut' }, 0)
          .to(garis.map((g) => g.tetes), { attr: { fill: WARNA_MORI }, duration: 1.4 }, 0)
          .to(garis.map((g) => g.bawah), { opacity: 0, duration: 1 }, 0)
          .to(retakG, { opacity: 1, duration: 1.6 }, .2)
          .to(container.querySelectorAll('.prada'), { opacity: 1, duration: .5, stagger: { each: .015, from: 'random' } }, .3);
        return tl;
      },

      /* Kain dipotong mengikuti garis lilin */
      potong(lebar = 9) {
        return gsap.to(celah, { attr: { 'stroke-width': lebar }, duration: 1.2, ease: 'expo.inOut', stagger: .06 });
      },

      /* Lompat ke keadaan akhir tanpa animasi */
      keadaanAkhir({ potong: dipotong = true } = {}) {
        celup.setAll(1.25); celup.soak = 0;
        gsap.set(isenEls, { opacity: 1 });
        pats.forEach((p) => { p.style.color = WARNA_MORI; });
        garis.forEach((g) => {
          g.atas.setAttribute('stroke', WARNA_MORI); g.tetes.setAttribute('fill', WARNA_MORI);
          gsap.set(g.bawah, { opacity: 0 });
          gsap.set(g.atas, { opacity: 1, strokeDasharray: g.sambung ? '.1 8' : 'none' });
          gsap.set(g.tetes, { opacity: g.sambung ? 0 : 1 });
        });
        gsap.set(retakG, { opacity: 1 });
        gsap.set(container.querySelectorAll('.prada'), { opacity: 1 });
        gsap.set(celah, { attr: { 'stroke-width': dipotong ? 9 : 0 } });
      },
    };
    api.keadaanAwal();
    return api;
  }

  /* ---------- kain hidup ----------
     Kain yang dibagi ulang langsung saat susunan keluarga berubah. Tidak ada peta waktu-tiba per
     bidang, jadi kanvas murah digambar ulang tiap frame selama garis lilin bergeser.
     Mode:
       pola    sketsa pensil sebelum aturan dipasang (rencana warna tipis)
       lilin   garis dan isen sudah dicanting, belum diwarnai
       celup   sudah diwarnai dan dilorod
       kosong  mori polos (susunan keluarga ditolak)
     Bidang: { key, amount, dye, isen, teks, sambung, prada, nembok, pemilik } */
  const MODE = {
    pola:   { tint: .16, celup: 0,    a: 1, pensil: 1, garis: 0, bawah: 0,   isen: .5, teks: 1, retak: 0, warna: GRAFIT },
    lilin:  { tint: 0,   celup: 0,    a: 1, pensil: 0, garis: 1, bawah: .35, isen: 1,  teks: 1, retak: 0, warna: WARNA_LILIN },
    celup:  { tint: 0,   celup: 1.25, a: 1, pensil: 0, garis: 1, bawah: 0,   isen: 1,  teks: 1, retak: 1, warna: WARNA_MORI },
    kosong: { tint: 0,   celup: 1.25, a: 0, pensil: 0, garis: 0, bawah: 0,   isen: 0,  teks: 0, retak: 0, warna: WARNA_MORI },
  };
  const ANGKA = ['tint', 'celup', 'a', 'pensil', 'garis', 'bawah', 'isen', 'teks', 'retak'];

  function hidup(container, opts) {
    const o = Object.assign({ W: 760, H: 300, B: 24, F: 12, k: .42, q: .5, seed: 7, mode: 'celup', font: null }, opts);
    const { W, H, B, F, k } = o;
    const id = 'h' + (++uid), sB = B / 32, sk = Math.max(.6, Math.min(1, H / 430));
    const totW = W + 2 * F, totH = H + 2 * B;
    container.classList.add('kain');
    container.style.cssText += `;position:relative;width:${totW}px;height:${totH}px;`;
    const vb = `${-F} ${-B} ${totW} ${totH}`;
    const layer = (cls) => { const v = el('svg', { class: cls, viewBox: vb, width: totW, height: totH }, container); v.style.cssText = 'position:absolute;inset:0;overflow:visible'; return v; };
    dasarKain(layer('k-dasar'), o, id);

    /* kanvas: bayangan serat dan waktu-tiba statis (tidak bergantung geometri) */
    const cv = document.createElement('canvas');
    cv.className = 'k-celup';
    const cw = Math.max(2, Math.round(W * o.q)), ch = Math.max(2, Math.round(H * o.q));
    cv.width = cw; cv.height = ch;
    cv.style.cssText = `position:absolute;left:${F}px;top:${B}px;width:${W}px;height:${H}px;`;
    container.appendChild(cv);
    const g = cv.getContext('2d'), img = g.createImageData(cw, ch), D = img.data;
    const shade = new Float32Array(cw * ch), T = new Float32Array(cw * ch);
    const nz = makeNoise(o.seed), nf = makeNoise(o.seed + 5), swn = makeNoise(o.seed + 13);
    for (let j = 0; j < ch; j++) for (let x = 0; x < cw; x++) {
      const X = (x + .5) / o.q, Y = (j + .5) / o.q, i = j * cw + x;
      shade[i] = (.93 + .1 * nf(X / 1.5, Y / 11)) * (.95 + .1 * nf.fbm(X / 210, Y / 150, 3));
      T[i] = Math.max(0, Math.min(1, .66 * (Y / H) + .34 * (nz.fbm(X / 85, Y / 70, 4) - .5) + .13));
    }
    const amp = Math.max(.4, H / 430);
    const gel = new Float32Array(cw);
    for (let x = 0; x < cw; x++) { const X = (x + .5) / o.q; gel[x] = ((swn(X / 190, 0) - .5) * 14 + (swn(X / 37, 3) - .5) * 3) * amp; }
    const soakC = hex('#2b4a96');

    /* SVG: isen, retak, pensil, lilin, tulisan */
    const lilin = layer('k-lilin');
    const defs = el('defs', {}, lilin);
    const ang = Math.atan(k) * 180 / Math.PI;
    const maskT = el('mask', { id: id + '-mt', maskUnits: 'userSpaceOnUse', x: -F, y: -B, width: totW, height: totH }, defs);
    el('rect', { x: -F, y: -B, width: totW, height: totH, fill: '#fff' }, maskT);
    // retak lilin dan serpih prada sebagai pola ubin (untuk bidang yang ditutup lilin)
    const pr = rng(o.seed + 41);
    const pRetak = el('pattern', { id: id + '-retak', patternUnits: 'userSpaceOnUse', width: 170, height: 130, patternTransform: `scale(${sk})` }, defs);
    for (let c = 0; c < 6; c++) {
      let x = pr() * 170, y = pr() * 130, d = `M${x.toFixed(1)} ${y.toFixed(1)}`;
      for (let s = 0, n = 4 + Math.floor(pr() * 5); s < n; s++) { x += (pr() - .5) * 34; y += (pr() - .35) * 26; d += `L${x.toFixed(1)} ${y.toFixed(1)}`; }
      el('path', { d, stroke: '#1b1712', 'stroke-width': .6, 'stroke-opacity': .45, fill: 'none' }, pRetak);
    }
    const emas = el('linearGradient', { id: id + '-emas', x1: 0, y1: 0, x2: 1, y2: 1 }, defs);
    el('stop', { offset: 0, 'stop-color': '#a8843e' }, emas); el('stop', { offset: .5, 'stop-color': '#ecd59b' }, emas); el('stop', { offset: 1, 'stop-color': '#b38f46' }, emas);
    const pPrada = el('pattern', { id: id + '-prada', patternUnits: 'userSpaceOnUse', width: 96, height: 74, patternTransform: `scale(${sk})` }, defs);
    for (let c = 0; c < 4; c++) {
      const cx = pr() * 96, cy = pr() * 74, s = 2 + pr() * 4;
      let d = '';
      for (let v = 0, sides = 4 + Math.floor(pr() * 3); v < sides; v++) { const a = (v / sides) * Math.PI * 2 + pr() * .6, rad = s * (.6 + pr() * .6); d += (v ? 'L' : 'M') + (cx + Math.cos(a) * rad).toFixed(1) + ' ' + (cy + Math.sin(a) * rad).toFixed(1); }
      el('path', { d: d + 'Z', fill: `url(#${id}-emas)` }, pPrada);
    }
    const isenG = el('g', { mask: `url(#${id}-mt)` }, lilin);
    const retakG = el('g', {}, lilin);
    const pensilG = el('g', { fill: 'none', 'stroke-linecap': 'round' }, lilin);
    const garisG = el('g', { fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, lilin);
    const teksG = el('g', { 'text-anchor': 'middle', 'font-style': 'italic' }, lilin);
    const ujung = el('circle', { r: 4.5 * sk, fill: '#fff3d6', opacity: 0 }, lilin);
    const font = o.font || getComputedStyle(document.documentElement).getPropertyValue('--font-serif');
    const fs = Math.max(12, Math.min(26, H * .075));
    teksG.style.fontFamily = font; teksG.setAttribute('font-size', fs);
    teksG.setAttribute('font-weight', 600);
    teksG.setAttribute('stroke', 'rgba(27,23,18,.78)'); teksG.setAttribute('stroke-width', 3.2 * sk);
    teksG.setAttribute('stroke-linejoin', 'round'); teksG.setAttribute('paint-order', 'stroke');

    lapisSerat(container, { W, F, totH, seed: o.seed });

    /* ---------- status ---------- */
    const st = { ...MODE[o.mode], soak: 0, warnaRGB: hex(MODE[o.mode].warna) };
    let bands = [], cutsAkhir = [], raf = 0;
    const nn = makeNoise(o.seed + 17);
    const Lgaris = Math.hypot(H * k, H) * 1.02;

    function buatBidang(b) {
      const key = b.key, safe = key.replace(/[^a-z0-9-]/gi, '_');
      const pat = el('pattern', { id: `${id}-p-${safe}`, patternUnits: 'userSpaceOnUse' }, defs);
      (ISEN[b.isen] || ISEN.polos)(pat);
      pat.setAttribute('patternTransform', `${b.isen === 'galaran' ? `rotate(${-ang}) ` : ''}scale(${sk})`);
      const n = {
        key, pat, a: 0, f: 1, g: 1, hs: hashStr(key), lebarTeks: 0,
        isenEl: el('polygon', { fill: `url(#${id}-p-${safe})` }, isenG),
        retakEl: b.nembok ? el('polygon', { fill: `url(#${id}-retak)` }, retakG) : null,
        pradaEl: b.prada ? el('polygon', { fill: `url(#${id}-prada)` }, retakG) : null,
        pensil: el('path', { stroke: GRAFIT, 'stroke-width': 1.2 * sk, 'stroke-opacity': .85 }, pensilG),
        pensil2: el('path', { stroke: GRAFIT, 'stroke-width': .7 * sk, 'stroke-opacity': .4 }, pensilG),
        bawahEl: el('path', { stroke: '#b59d73', 'stroke-width': 4.6 * sk }, garisG),
        atasEl: el('path', { 'stroke-width': 3.1 * sk }, garisG),
        tetes: el('ellipse', { rx: 3.4 * sk, ry: 2.2 * sk }, garisG),
        teksEl: el('text', {}, teksG),
        teksM: el('text', { 'text-anchor': 'middle', 'font-style': 'italic', 'font-size': fs, fill: '#000', stroke: '#000', 'stroke-width': 9 * sk, 'stroke-linejoin': 'round' }, maskT),
      };
      n.teksM.style.fontFamily = font;
      return n;
    }
    function hapusBidang(b) {
      [b.pat, b.isenEl, b.retakEl, b.pradaEl, b.pensil, b.pensil2, b.bawahEl, b.atasEl, b.tetes, b.teksEl, b.teksM].forEach((e) => e && e.remove());
    }
    function setData(b, nb) {
      b.dye = nb.dye; b.rgb = hex(nb.dye); b.sambung = !!nb.sambung; b.pemilik = nb.pemilik || nb.key; b.target = nb.amount; b.data = nb;
      if (b.teks !== (nb.teks || '')) {
        b.teks = nb.teks || '';
        b.teksEl.textContent = b.teks; b.teksM.textContent = b.teks;
        try { b.lebarTeks = b.teksEl.getComputedTextLength(); } catch { b.lebarTeks = b.teks.length * fs * .5; }
        if (!b.lebarTeks) b.lebarTeks = b.teks.length * fs * .5;
      }
    }

    const X = (c, y) => c + (H - y) * k;
    /* Rentang tinggi garis yang berada di dalam kain (garis bisa keluar lewat tepi kiri/kanan) */
    const rentang = (c) => [Math.min(H, H + c / k), Math.max(0, H - (W - c) / k)];
    function garisPath(c, hs, geser = 0, lewat = 0) {
      let [yb, yt] = rentang(c);
      if (yb <= yt) return '';
      // goresan pensil sedikit melewati tepi atas/bawah, tidak melewati tepi samping
      if (yb >= H) yb += lewat;
      if (yt <= 0) yt -= lewat;
      const steps = Math.max(2, Math.ceil((yb - yt) / (H / Lgaris * 9)));
      let d = '';
      for (let t = 0; t <= steps; t++) {
        const y = yb - (t / steps) * (yb - yt), x = X(c, y) + geser;
        const off = (nn((H - y) / H * Lgaris / 9 * .35, hs * .013) - .5) * 1.6 * sk;
        d += (t ? 'L' : 'M') + (x + off * .92).toFixed(2) + ' ' + y.toFixed(2);
      }
      return d;
    }

    function render() {
      raf = 0;
      const n = bands.length;
      const amts = bands.map((b) => Math.max(0, b.a));
      const cuts = n > 1 ? hitungPotong(amts, W, H, k) : [];
      cutsAkhir = cuts;
      // --- kanvas ---
      const cols = bands.map((b) => b.rgb), fa = bands.map((b) => b.f * st.a), tintB = bands.map((b) => st.tint * (1 + 1.8 * (b.angkat || 0)));
      const soakFront = H * (1 - st.soak), FEATHER = .05, TIDE = .11;
      for (let j = 0; j < ch; j++) {
        const Y = (j + .5) / o.q;
        const L = cuts.map((c) => X(c, Y));
        let b = 0;
        for (let x = 0; x < cw; x++) {
          const i = j * cw + x, oo = i * 4, Xp = (x + .5) / o.q;
          while (b < L.length && Xp >= L[b]) b++;
          let a = 0, r = 0, gg = 0, bb = 0;
          if (n) {
            let ad = 0, tide = 1;
            if (st.celup > 0) {
              const d = st.celup - T[i];
              if (d > -FEATHER) { ad = d >= 0 ? 1 : 1 + d / FEATHER; ad = ad * ad * (3 - 2 * ad); tide = d >= 0 && d < TIDE ? 1 - .24 * (1 - d / TIDE) : d < 0 ? .76 : 1; }
            }
            a = Math.max(ad, tintB[b]) * fa[b];
            if (a > 0) { const c = cols[b], s = shade[i] * (ad > tintB[b] ? tide : 1); r = c[0] * s; gg = c[1] * s; bb = c[2] * s; }
          }
          if (st.soak > 0 && a < 1) {
            const f = soakFront + gel[x];
            if (Y > f) {
              const dlm = Y - f;
              const sa = (.27 + .17 * Math.min(1, dlm / (140 * amp)) + (dlm < 5 * amp ? .12 : 0)) * shade[i];
              const fa2 = a + sa * (1 - a);
              r = (r * a + soakC[0] * sa * (1 - a)) / fa2; gg = (gg * a + soakC[1] * sa * (1 - a)) / fa2; bb = (bb * a + soakC[2] * sa * (1 - a)) / fa2;
              a = fa2;
            }
          }
          D[oo] = r; D[oo + 1] = gg; D[oo + 2] = bb; D[oo + 3] = a * 255;
        }
      }
      g.putImageData(img, 0, 0);

      // --- SVG ---
      const warna = rgbStr(st.warnaRGB);
      const lebarDi = (i, y) => {
        const kanan = i < n - 1 ? Math.min(W, X(cuts[i], y)) : W, kiri = i > 0 ? Math.max(0, X(cuts[i - 1], y)) : 0;
        return kanan - kiri;
      };
      bands.forEach((b, i) => {
        let p = [[0, 0], [W, 0], [W, H], [0, H]];
        if (i > 0) p = klip(p, ([x, y]) => x - X(cuts[i - 1], y));
        if (i < n - 1) p = klip(p, ([x, y]) => X(cuts[i], y) - x);
        const pts = (q) => q.map((v) => v[0].toFixed(1) + ',' + v[1].toFixed(1)).join(' ');
        const dalam = b.a > 0 ? ciutkanAman(p, 6 * sk) : null;
        b.isenEl.setAttribute('points', dalam ? pts(dalam) : '');
        b.isenEl.style.opacity = st.isen * (.35 + .65 * b.f);
        b.pat.style.color = warna;
        if (b.retakEl) { b.retakEl.setAttribute('points', p.length > 2 ? pts(p) : ''); b.retakEl.style.opacity = st.retak * b.f; }
        if (b.pradaEl) { b.pradaEl.setAttribute('points', p.length > 2 ? pts(p) : ''); b.pradaEl.style.opacity = st.retak * b.f; }
        // garis kiri bidang ini (bidang pertama tidak punya)
        const punyaGaris = i > 0;
        if (punyaGaris) {
          const c = cuts[i - 1];
          b.pensil.setAttribute('d', garisPath(c, b.hs + 3, 0, 5 * sk));
          b.pensil2.setAttribute('d', garisPath(c, b.hs + 9, .9 * sk, 2 * sk));
          const d = garisPath(c, b.hs);
          b.atasEl.setAttribute('d', d); b.bawahEl.setAttribute('d', d);
          if (b.sambung) {
            b.atasEl.setAttribute('stroke-dasharray', `.1 ${8 * sk}`); b.atasEl.setAttribute('stroke-width', 3.4 * sk);
            b.atasEl.removeAttribute('stroke-dashoffset');
          } else if (b.g < 1) {
            b.atasEl.setAttribute('stroke-dasharray', `${Lgaris} ${Lgaris}`); b.atasEl.setAttribute('stroke-dashoffset', Lgaris * (1 - b.g));
            b.bawahEl.setAttribute('stroke-dasharray', `${Lgaris} ${Lgaris}`); b.bawahEl.setAttribute('stroke-dashoffset', Lgaris * (1 - b.g));
          } else {
            b.atasEl.removeAttribute('stroke-dasharray'); b.atasEl.removeAttribute('stroke-dashoffset'); b.atasEl.setAttribute('stroke-width', 3.1 * sk);
            b.bawahEl.removeAttribute('stroke-dasharray'); b.bawahEl.removeAttribute('stroke-dashoffset');
          }
          b.atasEl.setAttribute('stroke', warna);
          b.atasEl.style.opacity = st.garis * (b.sambung ? b.g : 1);
          b.bawahEl.style.opacity = b.sambung ? 0 : st.bawah;
          b.pensil.style.opacity = b.pensil2.style.opacity = st.pensil;
          b.tetes.setAttribute('cx', (c + ((b.hs % 7) - 3) * .3).toFixed(1)); b.tetes.setAttribute('cy', H - 2 * sk);
          b.tetes.setAttribute('fill', warna);
          b.tetes.style.opacity = b.sambung || c < 0 || c > W ? 0 : st.garis * Math.min(1, b.g * 6);
        } else {
          b.pensil.setAttribute('d', ''); b.pensil2.setAttribute('d', ''); b.atasEl.setAttribute('d', ''); b.bawahEl.setAttribute('d', '');
          b.tetes.style.opacity = 0;
        }
        // tulisan pecahan di tengah bidang, hanya jika muat
        let cx = 0, cy = 0; p.forEach(([x, y]) => { cx += x; cy += y; });
        if (p.length) { cx /= p.length; cy /= p.length; }
        const ty = Math.min(H - fs * .6, Math.max(fs * 1.2, cy + fs * .35));
        const muat = p.length > 2 ? (lebarDi(i, ty - fs * .35) - (b.lebarTeks + 18 * sk)) / (10 * sk) : -1;
        const vis = Math.max(0, Math.min(1, muat)) * st.teks;
        // titik tengah garis horizontal pada tinggi tulisan
        const kiri = i > 0 ? Math.max(0, X(cuts[i - 1], ty - fs * .35)) : 0, kanan = i < n - 1 ? Math.min(W, X(cuts[i], ty - fs * .35)) : W;
        const tx = (kiri + kanan) / 2;
        b.teksEl.setAttribute('x', tx.toFixed(1)); b.teksEl.setAttribute('y', ty.toFixed(1));
        b.teksM.setAttribute('x', tx.toFixed(1)); b.teksM.setAttribute('y', ty.toFixed(1));
        // Putih dengan tepi gelap: terbaca di layar besar, baik di kain krem maupun yang sudah dicelup.
        b.teksEl.setAttribute('fill', '#fffaf0');
        b.teksEl.style.opacity = vis;
        b.teksM.style.opacity = vis > .02 ? 1 : 0;
      });
    }
    const jadwal = () => { if (!raf) raf = requestAnimationFrame(render); };

    let tweenAtur = null, tweenMode = null, tweenSorot = null;
    const api = {
      el: container, W, H, B, F, k,
      get bands() { return bands; },
      get cuts() { return cutsAkhir; },
      st, render, jadwal,

      /* Atur ulang bidang. Bidang baru tumbuh dari nol, bidang yang hilang menciut di tempatnya. */
      atur(list, { animasi = true, dur = .75, ease = 'power3.inOut' } = {}) {
        const baru = new Map(list.map((b) => [b.key, b]));
        const urut = list.map((b) => b.key);
        bands.forEach((b, i) => {
          if (baru.has(b.key)) return;
          let j = i - 1; while (j >= 0 && !urut.includes(bands[j].key)) j--;
          urut.splice(j < 0 ? 0 : urut.indexOf(bands[j].key) + 1, 0, b.key);
        });
        const lama = new Map(bands.map((b) => [b.key, b]));
        bands = urut.map((key) => {
          let b = lama.get(key);
          const nb = baru.get(key);
          if (!b) { b = buatBidang(nb); b.a = animasi ? 0 : nb.amount; }
          if (nb) setData(b, nb); else b.target = 0;
          return b;
        });
        tweenAtur && tweenAtur.kill();
        const bersihkan = () => { bands = bands.filter((b) => { if (b.target > 0) return true; hapusBidang(b); return false; }); jadwal(); };
        if (!animasi) { bands.forEach((b) => { b.a = b.target; }); bersihkan(); return null; }
        const awal = bands.map((b) => b.a), t = { v: 0 };
        tweenAtur = gsap.to(t, { v: 1, duration: dur, ease,
          onUpdate: () => { bands.forEach((b, i) => { b.a = awal[i] + (b.target - awal[i]) * t.v; }); jadwal(); },
          onComplete: bersihkan });
        return tweenAtur;
      },

      /* Ganti mode dengan peralihan. Celup dari lilin: pewarna merambat dulu, lilin baru dilorod. */
      mode(m, { dur = .9, animasi = true } = {}) {
        const tujuan = MODE[m];
        tweenMode && tweenMode.kill();
        if (!animasi) { ANGKA.forEach((f) => { st[f] = tujuan[f]; }); st.warnaRGB = hex(tujuan.warna); jadwal(); return null; }
        const dari = { ...st, warnaRGB: st.warnaRGB.slice() }, ke = hex(tujuan.warna);
        const celupDulu = m === 'celup' && st.celup < .5;
        const t = { a: 0, b: 0 };
        const tl = gsap.timeline({ onUpdate: jadwal });
        const lerp = (f, v) => { st[f] = dari[f] + (tujuan[f] - dari[f]) * v; };
        if (celupDulu) {
          tl.to(t, { a: 1, duration: dur, ease: 'sine.inOut', onUpdate: () => { lerp('celup', t.a); lerp('tint', t.a); lerp('a', t.a); } }, 0)
            .to(t, { b: 1, duration: dur * .5, ease: 'sine.inOut', onUpdate: () => {
              ['pensil', 'garis', 'bawah', 'isen', 'teks', 'retak'].forEach((f) => lerp(f, t.b));
              st.warnaRGB = dari.warnaRGB.map((c, i) => c + (ke[i] - c) * t.b);
            } }, dur * .62);
        } else {
          tl.to(t, { a: 1, duration: dur, ease: 'power2.inOut', onUpdate: () => {
            ANGKA.forEach((f) => lerp(f, t.a));
            st.warnaRGB = dari.warnaRGB.map((c, i) => c + (ke[i] - c) * t.a);
          } }, 0);
        }
        tweenMode = tl;
        return tl;
      },

      /* Sorot penerima (key bidang, key pemilik, atau daftar key); null = semua */
      sorot(key, dur = .35) {
        tweenSorot && tweenSorot.kill();
        const awal = bands.map((b) => b.f), t = { v: 0 };
        const set = key == null ? null : new Set([].concat(key));
        const kena = (b) => set && (set.has(b.key) || set.has(b.pemilik));
        const tuju = bands.map((b) => (!set || kena(b) ? 1 : .26));
        // di mode sketsa, bidang yang disorot juga diberi rencana warna lebih pekat
        const awalA = bands.map((b) => b.angkat || 0), tujuA = bands.map((b) => (kena(b) ? 1 : 0));
        tweenSorot = gsap.to(t, { v: 1, duration: dur, ease: 'power2.out', onUpdate: () => {
          bands.forEach((b, i) => { b.f = awal[i] + (tuju[i] - awal[i]) * t.v; b.angkat = awalA[i] + (tujuA[i] - awalA[i]) * t.v; });
          jadwal();
        } });
        return tweenSorot;
      },

      rendam(level, dur = .8) { return gsap.to(st, { soak: level, duration: dur, ease: 'sine.inOut', onUpdate: jadwal }); },
      set soak(v) { st.soak = v; jadwal(); },
      get soak() { return st.soak; },

      /* Nyanting di atas sketsa: tiap garis pensil ditimpa lilin dengan canting, satu per satu */
      nyanting({ jeda = .32 } = {}) {
        const tl = gsap.timeline({ onUpdate: jadwal });
        const garisan = bands.slice(1);
        st.garis = 1; st.bawah = .35;
        garisan.forEach((b) => { b.g = 0; });
        jadwal();
        garisan.forEach((b, i) => {
          const at = i * jeda;
          tl.to(b, { g: 1, duration: b.sambung ? .8 : 1.15, ease: 'sine.inOut', onUpdate() {
            if (b.sambung) return;
            const idx = bands.indexOf(b), c = cutsAkhir[idx - 1];
            if (c == null) return;
            const [yb, yt] = rentang(c), y = yb - b.g * (yb - yt);
            ujung.setAttribute('cx', X(c, y)); ujung.setAttribute('cy', y);
          } }, at + .1);
          if (!b.sambung) tl.to(ujung, { opacity: .9, duration: .15 }, at + .1).to(ujung, { opacity: 0, duration: .25 }, at + 1.1);
        });
        const dari = { ...st, warnaRGB: st.warnaRGB.slice() }, tujuan = MODE.lilin, ke = hex(tujuan.warna), t = { v: 0 };
        tl.to(t, { v: 1, duration: 2.2, ease: 'sine.inOut', onUpdate: () => {
          ['tint', 'pensil', 'isen', 'teks'].forEach((f) => { st[f] = dari[f] + (tujuan[f] - dari[f]) * t.v; });
          st.warnaRGB = dari.warnaRGB.map((c, i) => c + (ke[i] - c) * t.v);
        } }, .5);
        return tl;
      },

      /* Penerima di titik (koordinat container, belum diskalakan) */
      bidangDi(px, py) {
        const x = px - F, y = py - B;
        if (x < 0 || x > W || y < 0 || y > H || !bands.length) return null;
        let b = 0; while (b < cutsAkhir.length && x >= X(cutsAkhir[b], y)) b++;
        return bands[b] || null;
      },
      /* Titik bawah tengah bidang (koordinat container) untuk tali label */
      titikBawah(key) {
        const i = bands.findIndex((b) => b.key === key);
        if (i < 0) return null;
        const kiri = i > 0 ? Math.max(0, cutsAkhir[i - 1]) : 0, kanan = i < bands.length - 1 ? Math.min(W, cutsAkhir[i]) : W;
        return [(kiri + kanan) / 2 + F, H + B];
      },
    };
    jadwal();
    return api;
  }

  /* ---------- contoh kain (swatch) untuk HP ----------
     Potongan kain bertepi gunting zigzag, satu warna celup, satu isen, tulisan lilin. */
  function contoh(container, { w, h, dye, isen, tulisan = '', q = 1, seed = 5, fontFamily }) {
    container.style.cssText += `;position:relative;width:${w}px;height:${h}px;`;
    const id = 's' + (++uid);
    const zig = 7;
    // tepi gunting zigzag di keempat sisi
    const pinked = () => {
      const d = zig * .8, pts = [];
      const nx = Math.max(2, Math.round(w / zig)), ny = Math.max(2, Math.round(h / zig));
      for (let i = 0; i <= nx; i++) pts.push(`${(i * w / nx).toFixed(1)}px ${i % 2 ? d : 0}px`);
      for (let j = 1; j <= ny; j++) pts.push(`${w - (j % 2 ? d : 0)}px ${(j * h / ny).toFixed(1)}px`);
      for (let i = nx - 1; i >= 0; i--) pts.push(`${(i * w / nx).toFixed(1)}px ${h - ((nx - i) % 2 ? d : 0)}px`);
      for (let j = ny - 1; j >= 1; j--) pts.push(`${(ny - j) % 2 ? d : 0}px ${(j * h / ny).toFixed(1)}px`);
      return `polygon(${pts.join(',')})`;
    };
    const wrap = document.createElement('div');
    wrap.style.cssText = `position:absolute;inset:0;clip-path:${pinked()};`;
    container.appendChild(wrap);
    const base = el('svg', { viewBox: `0 0 ${w} ${h}`, width: w, height: h }, wrap);
    base.style.cssText = 'position:absolute;inset:0';
    el('rect', { width: w, height: h, fill: '#ede5d4' }, base);
    const cv = document.createElement('canvas');
    cv.style.cssText = `position:absolute;inset:0;width:${w}px;height:${h}px`;
    wrap.appendChild(cv);
    const celup = pewarna(cv, { W: w, H: h, k: 0, cuts: [], dyes: [dye], q, seed });
    const top = el('svg', { viewBox: `0 0 ${w} ${h}`, width: w, height: h }, wrap);
    top.style.cssText = 'position:absolute;inset:0;overflow:visible';
    const defs = el('defs', {}, top);
    const p = el('pattern', { id: id + '-p', patternUnits: 'userSpaceOnUse' }, defs);
    p.style.color = WARNA_LILIN;
    (ISEN[isen] || ISEN.polos)(p);
    if (isen === 'galaran') p.setAttribute('patternTransform', 'rotate(-23)');
    // isen mengitari tulisan: tulisan ditulis dengan lilin tebal (tidak berisen)
    const mask = el('mask', { id: id + '-m' }, defs);
    el('rect', { width: w, height: h, fill: '#fff' }, mask);
    const ff = fontFamily || getComputedStyle(document.documentElement).getPropertyValue('--font-serif');
    const tm = el('text', { x: w / 2, y: h * .6, 'text-anchor': 'middle', 'font-size': h * .3, 'font-style': 'italic', fill: '#000', stroke: '#000', 'stroke-width': 10, 'stroke-linejoin': 'round' }, mask);
    tm.textContent = tulisan; tm.style.fontFamily = ff;
    el('rect', { width: w, height: h, fill: `url(#${id}-p)`, mask: `url(#${id}-m)` }, top);
    const t = el('text', { x: w / 2, y: h * .6, 'text-anchor': 'middle', 'font-size': h * .3, 'font-style': 'italic', fill: WARNA_LILIN }, top);
    t.textContent = tulisan; t.style.fontFamily = ff;
    const serat = document.createElement('div');
    serat.style.cssText = `position:absolute;inset:0;mix-blend-mode:multiply;opacity:.3;background-size:100% 100%;pointer-events:none`;
    serat.style.backgroundImage = `url(${teksturSerat(w, h, seed)})`;
    wrap.appendChild(serat);
    const cahaya = document.createElement('div');
    cahaya.style.cssText = `position:absolute;inset:0;pointer-events:none;mix-blend-mode:soft-light;background:radial-gradient(120% 120% at 30% 15%, rgba(255,250,235,.6), rgba(255,250,235,0) 55%, rgba(0,0,20,.3) 100%)`;
    wrap.appendChild(cahaya);
    return {
      celup, teks: t, pola: p, svg: top,
      setTulisan(s) { t.textContent = s; tm.textContent = s; },
      awal() { celup.setAll(0); celup.soak = 0; p.style.color = WARNA_LILIN; t.setAttribute('fill', WARNA_LILIN); },
      akhir() { celup.setAll(1.25); celup.soak = 0; p.style.color = WARNA_MORI; t.setAttribute('fill', WARNA_MORI); },
      rendam(level, dur = .8) { return gsap.to(celup, { soak: level, duration: dur, ease: 'sine.inOut' }); },
      celupkan(dur = 2.6) {
        const o2 = { p: celup.prog[0] };
        const tl = gsap.timeline();
        tl.to(o2, { p: 1.25, duration: dur, ease: 'sine.inOut', onUpdate: () => celup.set(0, o2.p) })
          .to(p, { color: WARNA_MORI, duration: 1.2 }, dur * .7)
          .to(t, { attr: { fill: WARNA_MORI }, duration: 1.2 }, dur * .7);
        return tl;
      },
    };
  }

  /* ---------- peta kain kecil (rata, tanpa kanvas) ---------- */
  /* sorot: daftar indeks bidang yang diwarnai; bidang lain hanya bayangan tipis */
  function peta(svgParent, { W, H, k, bands, sorot = null, warnaGaris = '#f3ecdf' }) {
    const geo = geometri(bands.map((b) => b.amount), W, H, k);
    const g = el('g', {}, svgParent);
    const semua = !sorot;
    geo.info.forEach((inf, i) => {
      const aktif = semua || sorot.includes(i);
      el('polygon', { points: inf.poly.map((p) => p.join(',')).join(' '), fill: aktif ? bands[i].dye : warnaGaris, 'fill-opacity': aktif ? 1 : .07 }, g);
    });
    el('rect', { x: 0, y: 0, width: W, height: H, fill: 'none', stroke: warnaGaris, 'stroke-opacity': .35, 'stroke-width': 1 }, g);
    geo.cuts.forEach((s, i) => el('line', { x1: s, y1: H, x2: s + H * k, y2: 0, stroke: warnaGaris, 'stroke-opacity': bands[i + 1] && bands[i + 1].sambung ? .25 : .55, 'stroke-width': 1, 'stroke-dasharray': bands[i + 1] && bands[i + 1].sambung ? '1 3' : 'none' }, g));
    return { g, geo };
  }

  return { buat, hidup, contoh, peta, geometri, makeNoise, rng, teksturSerat, ISEN, WARNA_LILIN, WARNA_MORI, GRAFIT, el };
})();

/* Latar tong celup: tekstur indigo besar, digambar sekali seukuran layar (tidak ber-tile) */
window.Latar = {
  pasang(host = document.body) {
    const wrap = document.createElement('div');
    wrap.className = 'latar';
    const c = document.createElement('canvas');
    wrap.appendChild(c);
    host.prepend(wrap);
    const draw = () => {
      const w = Math.max(1, Math.ceil(innerWidth / 3)), h = Math.max(1, Math.ceil(innerHeight / 3));
      c.width = w; c.height = h;
      const g = c.getContext('2d'), img = g.createImageData(w, h), d = img.data;
      const n = Kain.makeNoise(21);
      const base = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#131b33';
      const terang = document.documentElement.dataset.tema === 'terang';
      const [r0, g0, b0] = [parseInt(base.slice(1, 3), 16), parseInt(base.slice(3, 5), 16), parseInt(base.slice(5, 7), 16)];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const v = n.fbm(x / 70, y / 55, 4) - .5;
        const vig = Math.hypot((x / w - .5) * 1.1, (y / h - .45));
        const i = (y * w + x) * 4;
        if (terang) {
          // kertas mori: belang halus, tepi sedikit lebih hangat
          const t = v * 7 - vig * 9;
          d[i] = r0 + t * 1.1; d[i + 1] = g0 + t; d[i + 2] = b0 + t * .8;
        } else {
          const t = v * 14 - vig * 16;
          d[i] = r0 + t * .8; d[i + 1] = g0 + t * .9; d[i + 2] = b0 + t * 1.3;
        }
        d[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      // dipakai elemen yang menempel (sticky) sebagai alas yang menyatu dengan latar
      document.documentElement.style.setProperty('--latar-gambar', `url(${c.toDataURL('image/jpeg', .9)})`);
    };
    draw();
    this.gambar = draw;
    let to;
    addEventListener('resize', () => { clearTimeout(to); to = setTimeout(draw, 200); });
  },
};
