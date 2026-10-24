import '@web/src/boot.js';
const S = Demo, D = Pusaka;
Latar.pasang();
Demo.panel({ judul: 'Panel demo' });
const $ = (id) => document.getElementById(id);
$('logo').outerHTML = UI.MEREK;
UI.blok($('jaringan'));

const SAPA = D.pewaris.nama.split(' ')[0];       // "Budi"
const BULAN = 86400 * 365 / 12;                  // satu bulan, agar 12 bulan = 365 hari
const SAYA = 'Saya masih hidup';
const BAYAR = '<span class="dua"><span>Bayar QRIS Rp250.000</span><small>Warung Bu Sri</small></span>';
const GRATIS = !!S.induk;                        // relayer ada: Pak Budi hanya menandatangani, biaya Rp0

const huruf1 = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const kata = (n) => D.ANGKA[n] || String(n);     // 1 → "satu"
const set = (el, t) => { if (el.textContent !== t) el.textContent = t; };
function tampil(el, ya) {
  if (el.hidden === !ya) return;
  el.hidden = !ya;
  if (ya && !S.diam) gsap.fromTo(el, { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: .7, ease: 'power3.out', clearProps: 'opacity,transform' });
}

/* ---------- bahasa waktu (UI.lalu hanya sampai jam, padahal batasnya berbulan-bulan) ---------- */
function salam() {
  const j = new Date().getHours();
  return j < 4 ? 'Selamat malam' : j < 11 ? 'Selamat pagi' : j < 15 ? 'Selamat siang' : j < 18 ? 'Selamat sore' : 'Selamat malam';
}
function lalu(ms) {
  const d = (Date.now() - ms) / 1000;
  if (d < 86400) return UI.lalu(Date.now() - ms);
  if (d < 86400 * 60) return `${Math.round(d / 86400)} hari lalu`;
  return `${Math.round(d / BULAN)} bulan lalu`;
}
function sisaKata(detik) {
  const d = Math.max(0, Math.ceil(detik));
  if (d >= BULAN) {
    const b = Math.floor(d / BULAN), h = Math.floor((d - b * BULAN) / 86400);
    return h ? `${b} bulan ${h} hari` : `${b} bulan`;
  }
  if (d >= 86400) { const h = Math.floor(d / 86400), j = Math.floor((d % 86400) / 3600); return j ? `${h} hari ${j} jam` : `${h} hari`; }
  if (d >= 3600) { const j = Math.floor(d / 3600), m = Math.floor((d % 3600) / 60); return m ? `${j} jam ${m} menit` : `${j} jam`; }
  if (d >= 60) { const m = Math.floor(d / 60), t = d % 60; return t ? `${m} menit ${t} detik` : `${m} menit`; }
  return `${d} detik`;
}
const VIA = { 0: 'Tercatat saat aturan dipasang.', 1: 'Dari tombol "Saya masih hidup".', 2: 'Dari kabar hidup yang Bapak tanda tangani.', 3: 'Dari pembayaran yang Bapak lakukan.', 4: 'Dari sidik jari Bapak.' };

/* ---------- jam perangkat ----------
   Di anvil tanpa --block-time, jam kontrak berhenti di blok terakhir, sehingga "N detik lalu" dan hitung mundur
   ikut macet. Waktu bukti hidup, pemicu, dan pembagian karena itu dicatat dari jam perangkat saat kabarnya masuk,
   dan hitung mundur masa sanggah berjalan dari jam perangkat setelah dijangkar ke bacaan kontrak
   (bacaan kontrak yang lebih kecil, misalnya setelah waktu dimajukan, menggantikan jangkar). */
let buktiLokal = null, dipicuLokal = null, bagiLokal = null, jangkarSg = null;
const jamBukti = () => (buktiLokal && buktiLokal.putaran === S.s.round ? buktiLokal.ms : S.s.lastBeat);
function sisaSanggah() {
  const n = S.sisaSanggah();
  if (n == null) { jangkarSg = null; return null; }
  const kini = Date.now(), jalan = (a) => a.sisa - (kini - a.ms) / 1000;
  if (!jangkarSg || jangkarSg.putaran !== S.s.round || n < jalan(jangkarSg) - 2) jangkarSg = { putaran: S.s.round, ms: kini, sisa: n };
  return Math.max(0, Math.min(n, jalan(jangkarSg)));
}

/* ---------- kabar dari Pusaka ---------- */
const feed = $('feed');
const sudah = new Set();                          // kunci pesan yang sudah dibuat, agar tidak ganda
const sekali = (kunci, buat) => { if (!sudah.has(kunci)) { sudah.add(kunci); buat(); } };

function tambahPesan({ j, teks, catatan = '', t = Date.now() }) {
  const li = document.createElement('li');
  li.className = 'pesan';
  li.dataset.j = j;
  li.innerHTML = `<div class="pesan-kepala">${UI.MEREK}<b>Pusaka</b><time>${D.jam(t)}</time></div><p class="pesan-teks"></p>`;
  li.querySelector('.pesan-teks').textContent = teks;
  setCatatan(li, catatan);
  feed.prepend(li);
  while (feed.children.length > 40) feed.lastElementChild.remove();
  $('kosong').hidden = true;
  if (!S.diam) { UI.masuk(li.querySelector('.pesan-teks')); gsap.from(li, { opacity: 0, y: -10, duration: .7, ease: 'power3.out', clearProps: 'opacity,transform' }); }
  return li;
}
function setCatatan(li, teks) {
  let p = li.querySelector('.pesan-catatan');
  if (!teks) { if (p) p.remove(); return; }
  if (!p) { p = document.createElement('p'); p.className = 'pesan-catatan'; li.appendChild(p); }
  p.textContent = teks;
}

/* Hasil transaksi terakhir hanya dipakai jika baru (bukan dari aksi lama). Dari tab lain hasilnya bisa tiba
   sedikit terlambat lewat BroadcastChannel, jadi pesan diperiksa lagi setelah 1,6 detik. */
function hasilSegar(sebab) {
  const h = S.hasilTerakhir(sebab);
  return h && Math.abs(S.blok() - h.blok) <= (S.LOKAL ? 8 : 25) ? h : null;
}
const blokTeks = (h) => (h ? `blok ${h.blok.toLocaleString('id-ID')}` : 'blockchain');
const finalTeks = (sebab, h) => (h ? `${S.teksFinal(sebab)}.` : '');
function pesanBukti({ j, sebab, teks, catatan }) {
  const li = tambahPesan({ j, teks: teks(hasilSegar(sebab)), catatan: catatan(hasilSegar(sebab)) });
  if (!hasilSegar(sebab)) setTimeout(() => {
    const h = hasilSegar(sebab);
    if (!h) return;
    li.querySelector('.pesan-teks').textContent = teks(h);
    setCatatan(li, catatan(h));
  }, 1600);
}

let bayarDariSini = false;
function pesanPasang(t) {
  tambahPesan({ j: 'pasang', t, teks: 'Aturan warisan sudah aktif di dompet Bapak. Tidak ada yang perlu Bapak lakukan: setiap pembayaran dari dompet ini otomatis dihitung sebagai tanda hidup.', catatan: 'Pusaka hanya menulis di sini jika ada yang perlu Bapak ketahui.' });
}
function pesanAktivitas() {
  pesanBukti({
    j: 'aktivitas', sebab: 'aktivitas',
    teks: () => `Pembayaran${bayarDariSini ? ' Rp250.000' : ''} tercatat sebagai bukti hidup. Tidak ada yang perlu Bapak lakukan.`,
    catatan: (h) => [`Batas ${UI.durasi(S.s.batas)} tanpa tanda hidup dihitung ulang dari sekarang.`, finalTeks('aktivitas', h)].filter(Boolean).join(' '),
  });
}
function pesanKabar(prev) {
  const hapus = prev && prev.attest.some(Boolean);
  pesanBukti({
    j: 'kabar', sebab: 'kabar',
    teks: (h) => `Terima kasih, Pak ${SAPA}. Kabar hidup tercatat di ${blokTeks(h)}. Biaya untuk Bapak: Rp0.`,
    catatan: (h) => [S.s.lastVia === 4 ? 'Bapak hanya menyentuh sidik jari. Pusaka yang mengirim dan membayar biayanya.' : 'Bapak hanya menandatangani. Pusaka yang mengirim dan membayar biayanya.', hapus ? 'Konfirmasi saksi sebelumnya dihapus.' : '', finalTeks('kabar', h)].filter(Boolean).join(' '),
  });
}
function pesanHidup() {
  pesanBukti({
    j: 'kabar', sebab: 'hidup',
    teks: (h) => `Terima kasih, Pak ${SAPA}. Tanda hidup Bapak tercatat di ${blokTeks(h)}.`,
    catatan: (h) => [`Batas ${UI.durasi(S.s.batas)} tanpa tanda hidup dihitung ulang dari sekarang.`, finalTeks('hidup', h)].filter(Boolean).join(' '),
  });
}
function pesanSaksi(i) {
  const s = S.s, sk = D.saksi[i];
  tambahPesan({
    j: 'saksi', t: s.attest[i] || Date.now(),
    teks: `${sk.nama} (${sk.peran.toLowerCase()}) menandatangani konfirmasi bahwa Bapak telah wafat.`,
    catatan: `Baru ${kata(S.jumlahSaksi())} dari ${kata(s.ambang)} saksi yang dibutuhkan, jadi warisan belum berjalan. Jika ini keliru, sentuh "${SAYA}".`,
  });
}
function pesanDipicu() {
  const s = S.s, ada = s.attest.map((t, i) => (t ? i : -1)).filter((i) => i >= 0);
  const diam = s.alasan === 'tidak aktif' || !ada.length;
  tambahPesan({
    j: 'dipicu', t: dipicuLokal || s.triggeredAt || Date.now(),
    teks: diam
      ? `Tidak ada tanda hidup dari dompet Bapak selama ${UI.durasi(s.batas)}. Masa sanggah dimulai.`
      : `${huruf1(D.ANGKA[ada.length] || String(ada.length))} saksi, ${D.daftarKata(ada.map((i) => D.saksi[i].nama))}, menyatakan Bapak telah wafat. Masa sanggah dimulai.`,
    catatan: `Jika ini keliru, tahan "${SAYA}" sebelum waktu habis. Membayar sesuatu dari dompet Bapak juga membatalkannya.`,
  });
}
function pesanBatal() {
  const via = S.s.lastVia;
  pesanBukti({
    j: 'batal', sebab: 'batal',
    teks: () => (via === 3
      ? 'Pembayaran dari dompet Bapak tercatat sebagai tanda hidup. Pemicu warisan dibatalkan.'
      : `Terima kasih, Pak ${SAPA}. ${via === 1 ? 'Tanda hidup' : via === 4 ? 'Sidik jari' : 'Kabar hidup'} Bapak tercatat dan pemicu warisan dibatalkan.`),
    catatan: (h) => ['Konfirmasi saksi dihapus. Keluarga diberi tahu bahwa Bapak masih hidup.', finalTeks('batal', h)].filter(Boolean).join(' '),
  });
}
function pesanDibagikan() {
  const n = S.ID_PENERIMA.length;
  tambahPesan({ j: 'dibagikan', t: bagiLokal || S.s.distributedAt || Date.now(), teks: `Aturan warisan Bapak telah dijalankan. Warisan dibagikan kepada ${D.ANGKA[n] || n} penerima.` });
}

/* Pesan yang bisa disusun ulang dari keadaan kontrak: dipakai saat halaman dibuka di tengah jalan dan sebagai jaring pengaman. */
function rekonsiliasi() {
  const s = S.s;
  if (s.status >= 1) sekali('pasang', () => pesanPasang(s.setupAt || s.lastBeat));
  if (s.status === 1) s.attest.forEach((t, i) => { if (t) sekali(`saksi:${s.round}:${i}`, () => pesanSaksi(i)); });
  if (s.status === 2) {
    s.attest.forEach((t, i) => { if (t) sudah.add(`saksi:${s.round}:${i}`); });   // sudah disebut di pesan terpicu
    sekali(`dipicu:${s.round}`, pesanDipicu);
  }
  if (s.status === 3) sekali('dibagikan', pesanDibagikan);
}

/* ---------- pengingat sebulan sebelum batas ---------- */
let pratinjau = false, pengingat = false;
const ingatAktif = () => { const s = S.s, b = S.sisaBatas(); return s.status === 1 && ((b != null && b <= s.batas / 12) || pratinjau); };
function cekPengingat() {
  const on = S.milikSendiri && ingatAktif();
  if (on && !pengingat) {
    pengingat = true;
    tambahPesan({
      j: 'pengingat',
      teks: `Pusaka mengingatkan: sudah lama dompet Bapak tidak dipakai. Jika Bapak masih hidup, sentuh "${SAYA}".`,
      catatan: `Batas ${UI.durasi(S.s.batas)} tanpa tanda hidup hampir habis. Hitungannya dimulai lagi dari hari ini.`,
    });
  } else if (!on) pengingat = false;
}

/* ---------- tombol tahan: kabar hidup tanpa gas, Pusaka yang mengirim ---------- */
function tombolTahan(btn) {
  let sibuk = false;
  const h = UI.tahan(btn, {
    lama: 1100,
    onSelesai: async () => {
      sibuk = true;
      btn.innerHTML = S.sidikJari.aktif ? '<i class="spin"></i>Sentuh sidik jari' : '<i class="spin"></i>Mengirim';
      const hasil = await S.kabar();
      sibuk = false;
      if (hasil) pratinjau = false;
      reset();
      gambar();
    },
  });
  const reset = () => { if (sibuk) return; btn.textContent = SAYA; h.reset(); };
  reset();
  return { reset };
}
const tahanDipicu = tombolTahan($('btnDipicu')), tahanSaksi = tombolTahan($('btnSaksi')), tahanIngat = tombolTahan($('btnIngat'));

/* ---------- sidik jari: daftar sekali, lalu kabar hidup cukup sentuhan ---------- */
let sidikSibuk = false;
$('btnSidik').addEventListener('click', async () => {
  if (sidikSibuk) return;
  sidikSibuk = true; gambar();
  if (S.sidikJari.aktif) await S.hapusSidikJari();
  else {
    const hasil = await S.daftarSidikJari();
    if (hasil) tambahPesan({ j: 'kabar', teks: 'Sidik jari Bapak sudah terdaftar. Mulai sekarang kabar hidup cukup dengan sentuhan.', catatan: 'Kuncinya tidak pernah keluar dari perangkat ini. Kontrak hanya menyimpan kunci publiknya.' });
  }
  sidikSibuk = false; gambar();
});
const ketTahan = () => (S.sidikJari.aktif
  ? (GRATIS ? 'Tahan tombol ini, lalu sentuh sidik jari. Biaya untuk Bapak: Rp0.' : 'Tahan tombol ini, lalu sentuh sidik jari.')
  : (GRATIS ? 'Tahan tombol ini sebentar. Biaya untuk Bapak: Rp0.' : 'Tahan tombol ini sebentar.'));

/* ---------- bayar ---------- */
let bayarSibuk = false;
$('btnBayar').innerHTML = BAYAR;
$('btnBayar').addEventListener('click', async () => {
  if (bayarSibuk) return;
  bayarSibuk = true; bayarDariSini = true;
  const b = $('btnBayar');
  b.disabled = true; b.innerHTML = '<i class="spin"></i>Membayar';
  await S.bayar();
  bayarSibuk = false; bayarDariSini = false;
  b.disabled = false; b.innerHTML = BAYAR;
});

/* ---------- untuk presentasi: sebelas bulan tanpa transaksi ---------- */
let majukanSibuk = false;
$('btnMajukan').addEventListener('click', async () => {
  if (majukanSibuk || !ingatAktifBisaDiminta()) return;
  if (S.LOKAL) {
    majukanSibuk = true; gambar();
    await S.majukan(S.sisaBatas() - S.s.batas / 12 + 5);
    majukanSibuk = false;
  } else pratinjau = true;
  cekPengingat(); gambar();
  if (!S.diam) $('kIngat').scrollIntoView({ behavior: 'smooth', block: 'center' });
});
const ingatAktifBisaDiminta = () => S.milikSendiri && S.s.status === 1 && !ingatAktif();

/* ---------- gambar ulang (dipanggil tiap perubahan dan tiap 250 ms) ---------- */
let kunciJudul = '', digit = '';
function gambar() {
  const s = S.s, st = s.status, milik = S.milikSendiri;
  const sisaS = sisaSanggah(), sisaB = S.sisaBatas(), nSaksi = S.jumlahSaksi();
  const habis = st === 2 && sisaS <= 0;
  const saksiTunggu = st === 1 && nSaksi > 0;
  const ingat = st === 1 && ingatAktif();
  const kartu = !milik ? null : st === 2 ? (habis ? null : 'dipicu') : saksiTunggu ? 'saksi' : ingat ? 'ingat' : null;
  const nama = s.attest.map((t, i) => (t ? D.saksi[i].nama : null)).filter(Boolean);
  const karenaSaksi = s.alasan === 'saksi' || (s.alasan !== 'tidak aktif' && nama.length > 0);

  // sapaan dan judul menurut keadaan
  const mode = !milik ? 'baca' : st === 0 ? 'belum' : st === 3 ? 'dibagikan' : st === 2 ? (habis ? 'habis' : karenaSaksi ? 'sanggahSaksi' : 'sanggahDiam') : saksiTunggu ? 'saksi' : ingat ? 'ingat' : 'tenang';
  const JUDUL = {
    baca: ['', `HP ${D.pewaris.nama}`, 'Status aturan warisan dibaca langsung dari blockchain.'],
    belum: [salam(), 'Aturan warisan belum dipasang.', 'Pasang aturan di layar Pewaris. Setelah itu kabar dari Pusaka muncul di sini.'],
    tenang: [salam(), 'Tidak ada yang perlu Bapak lakukan.', 'Aturan warisan Bapak aktif dan dijaga di dompet Bapak sendiri. Pusaka mengabari Bapak di sini jika ada yang perlu Bapak ketahui.'],
    ingat: [salam(), `Apa kabar, Pak ${SAPA}?`, 'Sudah lama dompet Bapak tidak dipakai. Pusaka ingin memastikan Bapak baik-baik saja.'],
    saksi: [salam(), 'Ada yang menyatakan Bapak wafat.', 'Baru satu saksi, jadi warisan belum berjalan. Jika ini keliru, Bapak cukup menyentuh "Saya masih hidup".'],
    sanggahSaksi: [salam(), 'Ada yang menyatakan Bapak wafat.', 'Jika ini keliru, Bapak masih punya waktu untuk membatalkannya.'],
    sanggahDiam: [salam(), 'Sudah lama tidak ada kabar dari Bapak.', 'Jika Bapak masih hidup, Bapak masih punya waktu untuk membatalkannya.'],
    habis: ['', 'Masa sanggah sudah habis.', 'Waktu untuk membatalkan sudah lewat. Warisan menunggu dibagikan sesuai aturan yang Bapak pasang.'],
    dibagikan: ['', 'Warisan telah dibagikan.', 'Sesuai aturan yang Bapak pasang.'],
  }[mode];
  if (kunciJudul !== mode) {
    kunciJudul = mode;
    set($('sapa'), JUDUL[0] ? `${JUDUL[0]}, Pak ${SAPA}` : '');
    set($('judul'), JUDUL[1]); set($('lead'), JUDUL[2]);
    if (!S.diam) UI.masuk('#sapa, #judul, #lead');
  }
  tampil($('catatanBaca'), !milik);

  // kartu terpicu
  tampil($('kDipicu'), kartu === 'dipicu');
  if (kartu === 'dipicu') {
    set($('dpJudul'), karenaSaksi ? `${huruf1(kata(nama.length))} saksi menyatakan Bapak telah wafat.` : 'Sudah lama tidak ada kabar dari Bapak.');
    set($('dpIsi'), karenaSaksi ? `${D.daftarKata(nama)} menandatangani konfirmasi. Jika ini keliru, Bapak masih bisa membatalkannya.`
      : `Dompet Bapak tidak dipakai melewati batas ${UI.durasi(s.batas)}. Jika Bapak masih hidup, Bapak masih bisa membatalkannya.`);
    const t = D.mmss(sisaS);
    if (t !== digit) { digit = t; UI.digit($('hitung'), t); $('hitung').setAttribute('aria-label', `Waktu tersisa ${t}`); }
    set($('dpKet'), ketTahan());
  } else tahanDipicu.reset();

  // kartu saksi menunggu
  tampil($('kSaksi'), kartu === 'saksi');
  if (kartu === 'saksi') {
    set($('skJudul'), `${D.daftarKata(nama)} menyatakan Bapak wafat.`);
    set($('skIsi'), `Baru ${kata(nSaksi)} dari ${kata(s.ambang)} saksi yang dibutuhkan, jadi warisan belum berjalan. Jika ini keliru, tahan tombol di bawah. Konfirmasi saksi dihapus dan semuanya kembali tenang.`);
    set($('skKet'), ketTahan());
  } else tahanSaksi.reset();

  // kartu pengingat
  tampil($('kIngat'), kartu === 'ingat');
  if (kartu === 'ingat') {
    set($('ingIsi'), `Tinggal ${sisaKata(sisaB)} dari batas ${UI.durasi(s.batas)} tanpa tanda hidup. Jika Bapak baik-baik saja, tahan tombol di bawah. Hitungannya dimulai lagi dari hari ini.`);
    set($('ingKet'), ketTahan());
    $('ingPratinjau').hidden = !(pratinjau && !(sisaB <= s.batas / 12));
  } else tahanIngat.reset();

  // kartu status
  const chip = [['belum', 'Aturan belum dipasang'], ['aktif', 'Aturan aktif'], ['dipicu', 'Masa sanggah'], ['dibagikan', 'Sudah dibagikan']][st];
  $('chip').dataset.s = chip[0]; set($('chipT'), chip[1]);
  let baris;
  if (st === 1) baris = [
    ['Bukti hidup terakhir', lalu(jamBukti()), VIA[s.lastVia] || VIA[0]],
    ['Batas tanpa tanda hidup', UI.durasi(s.batas), 'Lewat batas ini tanpa tanda hidup, masa sanggah bisa dimulai.'],
    ['Sisa waktu', sisaKata(sisaB), 'Dihitung dari bukti hidup terakhir. Pembayaran dari dompet Bapak mengulangnya dari awal.'],
  ];
  else if (st === 2) baris = [
    ['Dimulai karena', karenaSaksi ? 'Konfirmasi saksi' : 'Melewati batas', karenaSaksi ? `${D.daftarKata(nama)} menandatangani.` : `Tidak ada tanda hidup selama ${UI.durasi(s.batas)}.`],
    ['Sisa masa sanggah', D.mmss(sisaS), 'Waktu untuk membatalkan sebelum warisan dibagikan.'],
  ];
  else if (st === 3) baris = [
    ['Dibagikan pukul', bagiLokal || s.distributedAt ? D.jam(bagiLokal || s.distributedAt) : '-', `Dalam satu transaksi${s.distributedAt && S.blok(s.distributedAt) > 0 ? `, di blok ${S.blok(s.distributedAt).toLocaleString('id-ID')}` : ''}.`],
    ['Dibagikan kepada', `${S.ID_PENERIMA.length} penerima`, 'Bagian masing-masing mengikuti faraid dan wasiat Bapak.'],
  ];
  else baris = [['Aturan warisan', 'Belum dipasang', 'Setelah dipasang, bukti hidup dan sisa waktu tampil di sini.']];
  [1, 2, 3].forEach((n) => {
    const b = baris[n - 1];
    $('b' + n).hidden = !b;
    if (b) { set($(`b${n}k`), b[0]); set($(`b${n}v`), b[1]); set($(`b${n}t`), b[2]); }
  });

  // sidik jari: hanya saat aturan aktif dan perangkat ini bisa memakai sidik jari/wajah
  const sj = S.sidikJari;
  tampil($('kSidik'), milik && st === 1 && (sj.didukung || sj.aktif));
  if (milik && st === 1) {
    if (sj.aktif) $('kSidik').dataset.aktif = ''; else delete $('kSidik').dataset.aktif;
    set($('sjJudul'), sj.aktif ? 'Sidik jari aktif' : 'Kabar hidup dengan sidik jari');
    set($('sjIsi'), sj.aktif
      ? 'Saat Pusaka bertanya kabar, Bapak cukup menahan "Saya masih hidup" lalu menyentuh sidik jari. Tanpa kunci dompet, tanpa biaya.'
      : 'Daftarkan sidik jari atau wajah sekali. Setelah itu kabar hidup cukup dengan sentuhan. Kuncinya tidak pernah keluar dari perangkat ini.');
    const b = $('btnSidik');
    b.disabled = sidikSibuk || sj.sibuk;
    set(b, sidikSibuk || sj.sibuk ? (sj.aktif ? 'Mematikan…' : 'Sentuh sidik jari…') : sj.aktif ? 'Matikan sidik jari' : 'Aktifkan sidik jari');
  }

  // bayar, kabar, presentasi
  tampil($('blokBayar'), milik && (st === 1 || (st === 2 && !habis)));
  $('blokFeed').hidden = !milik;
  const bisaMajukan = milik && st === 1;
  $('presentasi').hidden = !bisaMajukan;
  if (bisaMajukan) {
    set($('btnMajukan'), S.LOKAL ? `Simulasikan ${UI.durasi(s.batas * 11 / 12)} tanpa transaksi` : 'Tampilkan pratinjau pengingat');
    set($('ketMajukan'), S.LOKAL
      ? `Memajukan jam blockchain lokal sampai tinggal ${UI.durasi(s.batas / 12)} dari batas ${UI.durasi(s.batas)}. Kartu pengingat akan muncul.`
      : 'Di testnet jam tidak bisa dipercepat, jadi ini hanya menampilkan contoh kartu pengingat.');
    $('btnMajukan').disabled = majukanSibuk || ingat;
  }
}

/* ---------- peristiwa dari kontrak ---------- */
function mulaiUlang() {
  sudah.clear(); feed.innerHTML = ''; $('kosong').hidden = false;
  pengingat = false; pratinjau = false; kunciJudul = '';
  buktiLokal = dipicuLokal = bagiLokal = jangkarSg = null;
}
S.on((s, prev, sebab) => {
  if (['pasang', 'batal', 'kabar', 'hidup', 'aktivitas'].includes(sebab)) buktiLokal = { ms: Date.now(), putaran: s.round };
  if (sebab === 'dipicu') dipicuLokal = Date.now();
  if (sebab === 'dibagikan') bagiLokal = Date.now();
  if (sebab === 'ulang') mulaiUlang();
  else if (sebab === 'pasang') sudah.delete('pasang');
  else if (sebab === 'cabut') { sudah.delete('pasang'); tambahPesan({ j: 'cabut', teks: 'Aturan warisan Bapak dicabut. Dompet Bapak kembali seperti biasa.' }); }
  else if (sebab === 'batal') pesanBatal();
  else if (sebab === 'kabar') pesanKabar(prev);
  else if (sebab === 'hidup') pesanHidup();
  else if (sebab === 'aktivitas') pesanAktivitas();
  rekonsiliasi(); cekPengingat(); gambar();
});

/* ---------- mulai ---------- */
rekonsiliasi(); cekPengingat(); gambar();
setInterval(() => { cekPengingat(); gambar(); }, 250);
