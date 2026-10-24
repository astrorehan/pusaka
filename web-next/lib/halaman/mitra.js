import '@web/src/boot.js';
const S = Demo, D = Pusaka;
Latar.pasang();
Demo.panel({ judul: 'Panel demo' });
document.getElementById('logo').outerHTML = UI.MEREK;
UI.blok(document.getElementById('jaringan'));
UI.dompetDemo(document.getElementById('kanan'));

const $ = (id) => document.getElementById(id);
const NF = (n) => Number(n).toLocaleString('id-ID');
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tidur = (ms) => new Promise((r) => setTimeout(r, ms));
/* Rupiah penuh; di atas Rp1 miliar diringkas supaya muat di kotak angka. */
const ringkas = (juta) => (juta >= 1000 ? `Rp${(juta / 1000).toLocaleString('id-ID', { maximumFractionDigits: 2 })} miliar` : D.rp(juta));
/* Detik kontrak → jam perangkat (ms). keJamPerangkat milik inti tidak diekspor, jadi dihitung dari jam kontrak. */
const keJam = (ts) => Number(ts) * 1000 - ((S.sekarangKontrak() + .5) * 1000 - Date.now());
const TAHAP_UI = { 1: ['proses', 'Diproses'], 2: ['selesai', 'Selesai'], 3: ['kembali', 'Dikembalikan'] };
const STATUS_TEKS = { 0: 'Aturan belum dipasang', 1: 'Aturan aktif', 2: 'Masa sanggah berjalan', 3: 'Warisan sudah dibagikan' };
const BARIS = 15;

/* ---------- membaca mitra ---------- */
const cair = new Map(); // no → pencairan (final tidak dibaca ulang)
const rek = new Map();  // id rekening → { bank, akhiran }
let akhir = null, sibuk = false, sigTabel = '', sigLog = '', mengerjakan = false;
const pernah = new Set(); // nomor baris yang sudah pernah tampil, untuk animasi masuk
const tahapLama = new Map();

async function ambilCair(nos) {
  for (let i = 0; i < nos.length; i += 25) {
    const bagian = nos.slice(i, i + 25);
    const hasil = await Promise.all(bagian.map((no) => S.bacaMitra('getPencairan', [BigInt(no)])));
    const idBaru = new Set();
    hasil.forEach((p, k) => {
      cair.set(bagian[k], {
        no: bagian[k], rekening: p.rekening, dari: p.dari, diminta: Number(p.diminta), jumlah: S.juta(p.jumlah),
        selesai: Number(p.selesai), tahap: Number(p.tahap), bukti: p.bukti,
      });
      if (!rek.has(p.rekening)) idBaru.add(p.rekening);
    });
    const ids = [...idBaru];
    const rs = await Promise.all(ids.map((id) => S.bacaMitra('getRekening', [id])));
    rs.forEach((r, k) => rek.set(ids[k], { bank: r.bank, akhiran: r.akhiran }));
  }
}

async function tarik() {
  if (sibuk) return;
  sibuk = true;
  try {
    const [nRek, nCair, antre, suplai, berisi] = await Promise.all([
      S.bacaMitra('jumlahRekening'), S.bacaMitra('jumlahPencairan'), S.bacaMitra('antrean'),
      S.bacaToken('totalSupply'), S.bacaMitra('vaBerisi', [0n, 500n]), // kontrak memangkas batas atas ke jumlah rekening
    ]);
    const N = Number(nCair);
    if ([...cair.keys()].some((k) => k >= N)) { cair.clear(); rek.clear(); pernah.clear(); tahapLama.clear(); sigTabel = ''; } // rantai diulang
    const dalamAntre = new Set(antre.map(Number));
    const perlu = [];
    for (let no = N - 1; no >= Math.max(0, N - 300); no--) {
      const c = cair.get(no);
      if (!c || (c.tahap === 1 && !dalamAntre.has(no))) perlu.push(no);
    }
    if (perlu.length) await ambilCair(perlu);
    akhir = { nRek: Number(nRek), N, antre: antre.length, berisi: berisi.length, suplai: S.juta(suplai) };
    gambar();
  } catch (e) {
    console.warn('Mitra: gagal membaca kontrak', e);
  } finally {
    sibuk = false;
  }
}

/* ---------- menggambar ---------- */
function setAngka(el, nilai, fmt) {
  const lama = el._v;
  el._v = nilai;
  if (lama === undefined || lama === nilai || Demo.diam) { el.textContent = fmt(nilai); return; }
  if (el._tw) el._tw.kill();
  el._tw = UI.hitungNaik(el, nilai, { dari: lama, dur: .9, fmt });
}
const bulat = (v) => NF(Math.round(v));

/* Nama peran bila pencairan berasal dari alamat penerima pewaris yang sedang dipantau */
function peranDari(alamat) {
  const a = String(alamat).toLowerCase();
  for (const id of S.ID_PENERIMA) {
    const x = S.s.penerima[id];
    if (x && x.alamat && x.alamat.toLowerCase() === a) return D.PERAN_PANJANG[id];
  }
  return '';
}

function barisHTML(c) {
  const r = rek.get(c.rekening) || { bank: '—', akhiran: '' };
  const t = TAHAP_UI[c.tahap] || TAHAP_UI[1];
  const selesaiMs = c.selesai ? keJam(c.selesai) : null;
  const siapa = peranDari(c.dari);
  return `<tr data-no="${c.no}">
    <td class="no angka">${c.no + 1}</td>
    <td class="angka">${D.jam(keJam(c.diminta))}</td>
    <td><b>${esc(r.bank)} ••••${esc(r.akhiran)}</b>${siapa ? `<span class="siapa">${esc(siapa)}</span>` : ''}</td>
    <td class="r angka">${D.rp(c.jumlah)}</td>
    <td><span class="tahap" data-t="${t[0]}"><i></i>${t[1]}</span></td>
    <td class="ref angka">${c.tahap === 2 && selesaiMs ? esc(S.refBank(c.bukti, selesaiMs)) : '<span class="redup">—</span>'}</td>
    <td class="angka">${selesaiMs ? D.jam(selesaiMs) : '<span class="redup">—</span>'}</td>
  </tr>`;
}

function gambar() {
  if (!akhir) return;
  const semua = [...cair.values()];
  const selesai = semua.filter((c) => c.tahap === 2);
  const jutaSelesai = selesai.reduce((a, c) => a + c.jumlah, 0);
  const dikembalikan = semua.filter((c) => c.tahap === 3).length;

  setAngka($('nRek'), akhir.nRek, bulat);
  setAngka($('nCair'), akhir.N, bulat);
  setAngka($('nAntre'), akhir.antre, bulat);
  setAngka($('nSelesai'), selesai.length, bulat);
  setAngka($('nRupiah'), jutaSelesai, ringkas);
  setAngka($('nSuplai'), akhir.suplai, ringkas);

  // simpul diagram
  $('f1').textContent = STATUS_TEKS[S.s.status] || '';
  $('f2').textContent = `${NF(akhir.nRek)} terdaftar · ${NF(akhir.berisi)} berisi tIDR`;
  $('f3').textContent = `${NF(akhir.antre)} menunggu · ${NF(selesai.length)} selesai`;
  $('f4').textContent = `${ringkas(jutaSelesai)} sudah ditransfer`;
  const kerja = akhir.antre > 0 || akhir.berisi > 0;
  $('s3').classList.toggle('kerja', kerja);
  $('c2').classList.toggle('jalan', akhir.berisi > 0);
  $('c3').classList.toggle('jalan', akhir.antre > 0);
  $('c4').classList.toggle('jalan', akhir.antre > 0);
  $('cb').classList.toggle('jalan', akhir.antre > 0);

  // tabel: terbaru di atas
  const tampil = semua.sort((a, b) => b.no - a.no).slice(0, BARIS);
  $('info').textContent = akhir.N ? `${tampil.length} dari ${NF(akhir.N)}${dikembalikan ? ` · ${dikembalikan} dikembalikan` : ''}` : 'belum ada';
  $('tabel').hidden = !tampil.length;
  $('kosong').hidden = !!tampil.length;
  const sig = tampil.map((c) => `${c.no}:${c.tahap}:${(rek.get(c.rekening) || {}).akhiran}:${peranDari(c.dari)}`).join('|');
  if (sig !== sigTabel) {
    sigTabel = sig;
    $('baris').innerHTML = tampil.map(barisHTML).join('');
    $('baris').querySelectorAll('tr').forEach((tr) => {
      const no = Number(tr.dataset.no), c = cair.get(no);
      const baru = !pernah.has(no), berubah = tahapLama.has(no) && tahapLama.get(no) !== c.tahap;
      if (baru && pernah.size) UI.masuk(tr.querySelectorAll('td'));
      else if (berubah) UI.masuk(tr.querySelectorAll('td:nth-child(n+5)'));
      pernah.add(no); tahapLama.set(no, c.tahap);
    });
  }
  gambarOperator();
}

function gambarOperator() {
  const aktif = S.operatorAktif, ada = !!S.operator;
  const antre = akhir ? akhir.antre : 0;
  const chip = $('chip'), op = $('opStatus');
  chip.dataset.s = aktif ? 'aktif' : 'belum';
  $('chipT').textContent = !ada ? 'Operator tidak ada di perangkat ini' : !aktif ? 'Operator tidak berjalan di tab ini' : antre ? `Memproses ${antre} pencairan` : 'Operator berjalan di tab ini';
  op.dataset.s = aktif ? 'aktif' : 'belum';
  $('opT').textContent = aktif ? `Berjalan di tab ini · ${S.pendek(S.operator.address)}` : 'Tidak berjalan di tab ini';
  $('opIsi').textContent = !ada
    ? 'Perangkat ini tidak memegang kunci operator. Di testnet, operator dijalankan dari laptop presenter.'
    : aktif
      ? 'Rekening virtual yang berisi disapu otomatis. Sekitar satu sampai dua detik kemudian, transfer bank dicatat selesai dengan nomor referensi.'
      : 'Operator hanya berjalan di layar presenter yang terbuka sebagai jendela utama.';
  $('proses').disabled = !aktif || mengerjakan;
  $('proses').textContent = mengerjakan ? 'Memproses…' : 'Proses sekarang';

  const l = S.mitraLog.slice(-6).reverse();
  const sig = l.map((x) => x.t + x.teks).join('|');
  if (sig !== sigLog) {
    sigLog = sig;
    $('log').innerHTML = l.length
      ? l.map((x) => `<li><time>${D.jam(x.t)}</time><span>${esc(x.teks)}${x.tx && S.EXPLORER ? ` <a href="${S.EXPLORER}/tx/${esc(x.tx)}" target="_blank" rel="noopener">lihat</a>` : ''}</span></li>`).join('')
      : '<li class="kosong-log">Belum ada yang diproses.</li>';
  }
}

/* "Proses sekarang": operator butuh beberapa putaran (sapu, lalu tunggu ±1,4 detik, lalu selesaikan). */
$('proses').addEventListener('click', async () => {
  if (mengerjakan) return;
  mengerjakan = true; gambarOperator();
  try {
    for (let i = 0; i < 4; i++) {
      await S.prosesMitra();
      await tidur(1650);
      const [antre, berisi] = await Promise.all([S.bacaMitra('antrean'), S.bacaMitra('vaBerisi', [0n, 500n])]);
      if (!antre.length && !berisi.length) break;
    }
  } finally {
    mengerjakan = false;
    await tarik();
    gambarOperator();
  }
});

S.on((s, prev, sebab) => {
  if (sebab === 'pencairan' || sebab === 'dibagikan' || sebab === 'ulang' || sebab === 'pasang') tarik();
  if (akhir) { $('f1').textContent = STATUS_TEKS[s.status] || ''; if (sebab === 'ulang') { sigTabel = ''; gambar(); } }
});

setInterval(tarik, 1500);
setInterval(gambarOperator, 1000);
tarik();

document.fonts.ready.then(() => {
  if (Demo.diam) return;
  UI.masuk([$('chip'), $('judul'), $('lead')]);
  gsap.from('.simpul', { opacity: 0, y: -8, duration: .7, stagger: .05, ease: 'power3.out', delay: .25 });
  gsap.from('.stat', { opacity: 0, y: -6, duration: .6, stagger: .05, ease: 'power3.out', delay: .2 });
});
