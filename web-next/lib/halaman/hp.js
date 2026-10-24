import '@web/src/boot.js';
const D = Pusaka, S = Demo;
const deret = document.getElementById('deret');
const diam = new URLSearchParams(location.search).has('diam') ? 'diam=1' : '';

/* ---------- peran ---------- */
const AWAL = ['kabar', 'istri', 'putra1', 'putra2'];
const KUNCI = 'pusaka-hp-peran';
const CARA = { bank: 'rekening bank', amplop: 'amplop WhatsApp', kripto: 'dompet kripto' };
const IDS = ['kabar', ...S.ID_PENERIMA];
function label(id) {
  if (id === 'kabar') return `HP ${D.pewaris.nama} (pewaris)`;
  const c = S.caraTerima(id);
  return `${D.PERAN_PANJANG[id] || id}${c && CARA[c.cara] ? ` · ${CARA[c.cara]}` : ''}`;
}
const urlHP = (id) => (id === 'kabar'
  ? `/kabar${diam ? `?${diam}` : ''}`
  : `/waris?id=${id}${diam ? `&${diam}` : ''}`);

let simpan = [];
try { const j = JSON.parse(localStorage.getItem(KUNCI)); if (Array.isArray(j)) simpan = j; } catch {}
const simpanKe = () => { try { localStorage.setItem(KUNCI, JSON.stringify([...deret.querySelectorAll('select')].map((x) => x.value))); } catch {} };

const pilihan = [];
AWAL.forEach((awal, i) => {
  const id = IDS.includes(simpan[i]) ? simpan[i] : awal;
  const d = document.createElement('div');
  d.className = 'hp';
  d.innerHTML = `<select aria-label="Peran di HP ke-${i + 1}">${IDS.map((v) => `<option value="${v}"></option>`).join('')}</select>
    <div class="bingkai"><iframe loading="eager"></iframe></div>`;
  const sel = d.querySelector('select'), f = d.querySelector('iframe');
  sel.value = id;
  const muat = () => { f.title = label(sel.value); f.src = urlHP(sel.value); };
  sel.onchange = () => { simpanKe(); muat(); };
  pilihan.push(sel);
  deret.appendChild(d);
  muat();
});

/* Teks pilihan ikut cara terima yang berlaku (bank, amplop, atau dompet kripto). */
function segarkanLabel() {
  pilihan.forEach((sel) => [...sel.options].forEach((o) => { const t = label(o.value); if (o.textContent !== t) o.textContent = t; }));
}
segarkanLabel();
S.on(segarkanLabel);

/* ---------- ukuran: empat HP di satu layar (maksimal skala 1), makin sempit 2 kolom lalu 1 kolom ---------- */
function atur() {
  const cs = getComputedStyle(deret);
  const sisi = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  const celah = parseFloat(cs.columnGap) || 28;
  const lebar = document.documentElement.clientWidth;
  const kLebar = (n) => (lebar - sisi - (n - 1) * celah - n * 20) / (n * 390);
  const dipakai = 18 + pilihan[0].offsetHeight + 10 + 20 + 24;       // padding atas, pilihan, bingkai, ruang bawah
  const kTinggi = (innerHeight - deret.offsetTop - dipakai) / 844;
  let n = 4, k = Math.min(1, kLebar(4), kTinggi);
  if (k < 0.6) { n = 2; k = Math.min(1, kLebar(2)); }
  if (k < 0.5) { n = 1; k = Math.min(1, kLebar(1)); }
  deret.style.setProperty('--k', Math.max(0.3, k).toFixed(3));
  deret.style.gridTemplateColumns = `repeat(${n}, max-content)`;
}
atur();
addEventListener('resize', atur);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(atur);

Demo.panel({ judul: 'Panel demo' });
