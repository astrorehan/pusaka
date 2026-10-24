import '@web/src/boot.js';
const S = Demo, D = Pusaka;
Latar.pasang();
Demo.panel({ judul: 'Panel demo' });

const PERAN = { istri: 'Istri', masjid: 'Penerima wakaf', putra1: 'Anak laki-laki pertama', putra2: 'Anak laki-laki kedua', putri: 'Anak perempuan', ayah: 'Ayah', ibu: 'Ibu' };
const FRAC = { istri: '1/2 harta bersama + 1/8', masjid: '1/5 wasiat', putra1: '13/60', putra2: '13/60', putri: '13/120', ayah: '1/6', ibu: '1/6' };
const RINCI = {
  istri: 'Rp150.000.000 harta bersama, ditambah 1/8 dari harta faraid Rp120.000.000',
  masjid: '1/5 dari harta warisan Rp150.000.000',
  putra1: '13/60 dari harta faraid Rp120.000.000', putra2: '13/60 dari harta faraid Rp120.000.000',
  putri: '13/120 dari harta faraid Rp120.000.000', ayah: '1/6 dari harta faraid Rp120.000.000', ibu: '1/6 dari harta faraid Rp120.000.000',
};
const JUDUL_ALASAN = { istri: 'Mengapa Rp165 juta?', masjid: 'Mengapa seperlima?', putra1: 'Mengapa 13/60?', putra2: 'Mengapa 13/60?', putri: 'Mengapa 13/120?', ayah: 'Mengapa 1/6?', ibu: 'Mengapa 1/6?' };
const SIMULASI = 'Transfer bank disimulasikan di testnet.';

const E = Object.fromEntries(['pilih', 'ahli', 'daftar', 'sapa', 'peran', 'dari', 'contoh', 'lblNom', 'nominal', 'rinci', 'tx', 'cara', 'caraJ', 'caraSub', 'caraT', 'caraChip',
  'urut', 'slotAmplop', 'caraLink', 'bukaCair', 'slotKripto', 'caraKaki', 'formCair', 'fBank', 'fNomorL', 'fNomor', 'fNama', 'fErr', 'fErrT', 'fTahan',
  'kartu', 'chip', 'chipT', 'ketKartu', 'hitung', 'jalur', 'jalurI', 'alasanJ', 'alasanT', 'peta', 'rincian'].map((k) => [k, document.getElementById(k)]));

const setT = (e, t) => { if (e.textContent !== t) e.textContent = t; };
/* Teks dengan satu bagian yang tidak boleh terputus antarbaris (nomor, alamat). Dirakit dari simpul teks, bukan innerHTML. */
function setNB(e, depan, nb) {
  const k = `${depan}\u0001${nb || ''}`;
  if (e.dataset.k === k) return;
  e.dataset.k = k;
  e.textContent = depan;
  if (nb) { const x = document.createElement('span'); x.className = 'nb'; x.textContent = nb; e.append(x); }
}
const tampil = (e, ya) => { if (e.hidden === ya) e.hidden = !ya; };
const getar = (pola) => {
  if (Demo.diam) return;
  // Chrome menolak (dan mencatat galat) bila halaman belum pernah disentuh; lewati saja
  try { if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return; navigator.vibrate && navigator.vibrate(pola); } catch {}
};

/* ---------- cara terima ----------
   Demo.caraTerima salah menebak saat aturan belum terpasang (rekening virtual belum ada, jadi penerima bank terbaca
   sebagai dompet kripto). Jenisnya diturunkan di sini: dari aturan, lalu dikoreksi oleh apa yang terbaca di rantai. */
function info(id) {
  const c = S.caraTerima(id);
  if (!c) return null;
  const key = S.KEY_PENERIMA[id], p = S.s.penerima[id];
  const t = S.milikSendiri ? S.terimaDari(S.bacaAturan(), key) : S.TERIMA_AWAL()[key];
  let jenis = t.cara;
  if (p.bank) jenis = 'bank';
  else if (S.s.status > 0 && p.rekening === null) {
    // terpasang tetapi bukan rekening virtual: amplop (kunci amplop) atau dompet kripto milik sendiri
    const a = S.amplopUntuk(id);
    jenis = t.cara === 'kripto' || (a && p.alamat && p.alamat.toLowerCase() !== a.address.toLowerCase()) ? 'kripto' : 'amplop';
  }
  const bank = jenis === 'bank' ? (p.bank || t.bank || '') : '';
  const akhiran = jenis === 'bank' ? (p.akhiran || S.akhiranDari(t.nomor)) : '';
  return { id, cara: jenis, nama: t.nama || '', wa: t.wa || '', bank, akhiran, ewallet: S.EWALLET.has(bank), alamat: p.alamat };
}
const tujuan = (c) => (c.bank ? `${c.bank} ••••${c.akhiran}` : '');
const tempat = (c) => (c.bank ? (c.ewallet ? tujuan(c) : `rekening ${tujuan(c)}`) : 'rekeningmu');

/* Tahap penerimaan:
   pra (belum dibagikan) · mitra (bank: menunggu mitra menyapu) · proses (transfer berjalan) · tiba (sudah masuk)
   siap (amplop siap dicairkan) · kirim (permintaan pencairan sedang dikirim dari HP ini) · dompet (kripto, sudah di dompet)
   balik (transfer dikembalikan) · kosong (amplop belum terbaca) */
function fase(id, c = info(id)) {
  const s = S.s, p = s.penerima[id];
  if (s.status < 3) return 'pra';
  const cair = p.cair;
  if (cair && cair.tahap === 'selesai') return 'tiba';
  if (cair && cair.tahap === 'diproses') return 'proses';
  if (c.cara !== 'bank' && id === idSaya && kirimAktif()) return 'kirim';
  if (cair && cair.tahap === 'dikembalikan') return 'balik';
  if (c.cara === 'bank') return 'mitra';
  if (c.cara === 'kripto') return 'dompet';
  return p.saldo > 0 ? 'siap' : 'kosong';
}

/* ---------- pemilih peran ---------- */
let barisPilih = null;
function barisKanal(c) {
  if (c.cara === 'bank') return c.bank ? (c.ewallet ? tujuan(c) : `Rekening ${tujuan(c)}`) : 'Rekening bank';
  return c.cara === 'amplop' ? 'Amplop WhatsApp' : 'Dompet kripto';
}
function barisStatus(id, c) {
  const f = fase(id, c);
  if (f === 'pra') return null;
  if (f === 'tiba' || f === 'dompet') return { s: 'masuk', t: 'Sudah masuk' };
  if (f === 'proses' || f === 'mitra' || f === 'kirim') return { s: 'proses', t: 'Sedang ditransfer' };
  if (f === 'balik') return c.cara === 'kripto' ? { s: 'masuk', t: 'Sudah masuk' } : { s: 'belum', t: 'Dikembalikan' };
  return { s: 'belum', t: 'Belum dicairkan' };
}
function segarPilih() {
  if (!barisPilih) return;
  barisPilih.forEach((r) => {
    const c = info(r.id);
    if (!c) return;
    setT(r.kanal, barisKanal(c));
    const st = barisStatus(r.id, c);
    tampil(r.st, !!st);
    if (st) { if (r.st.dataset.s !== st.s) r.st.dataset.s = st.s; setT(r.stT, st.t); }
  });
}
function tampilPilih() {
  bersihkan();
  saya = null; idSaya = null;
  E.pilih.hidden = false; E.ahli.hidden = true;
  E.daftar.innerHTML = '';
  barisPilih = D.penerima.map((p, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = `<div class="cth"></div><div><b>${PERAN[p.id]}</b><span class="kanal"></span><span class="st" hidden><i></i><span></span></span></div><span class="frac">${FRAC[p.id].replace(' harta bersama', '')}</span>`;
    E.daftar.appendChild(b);
    Kain.contoh(b.querySelector('.cth'), { w: 52, h: 52, dye: p.dye, isen: p.isen, q: 1, seed: i + 3 }).akhir();
    b.onclick = () => pilihPeran(p.id);
    return { id: p.id, kanal: b.querySelector('.kanal'), st: b.querySelector('.st'), stT: b.querySelector('.st span') };
  });
  segarPilih();
  UI.masuk('.pilih .resap');
  if (!Demo.diam) gsap.from('.daftar button', { opacity: 0, y: -8, duration: .6, stagger: .06, ease: 'power3.out', delay: .2 });
}
function pilihPeran(id) {
  const qs = new URLSearchParams(location.search);
  qs.set('id', id);
  // bagian # (benih amplop dari QR) ikut dibawa, kalau tidak HP kehilangan kunci amplopnya
  history.pushState({}, '', `${location.pathname}?${qs}${location.hash}`);
  tampilAhli(id, true);
}

/* ---------- tampilan ahli waris ---------- */
let saya = null, idSaya = null, contoh = null, lebar = 0, modeKain = null, faseLalu = null, momen = false, momenTl = null, hitungLalu = '';
let lokal = { mengirim: false, terkirim: null, bank: '', nomor: '', nama: '', galat: '' };
function bersihkan() { if (momenTl) { momenTl.kill(); momenTl = null; } momen = false; }

function tampilAhli(id, animasi) {
  bersihkan();
  barisPilih = null;
  saya = D.P[id]; idSaya = id; faseLalu = null; modeKain = null; hitungLalu = '';
  const c = info(id);
  lokal = { mengirim: false, terkirim: null, bank: '', nomor: '', nama: c ? c.nama : '', galat: '' };
  E.fBank.value = ''; E.fNomor.value = ''; E.fNama.value = lokal.nama;
  tahanH.reset(); labelForm(); galat('');

  E.pilih.hidden = true;
  E.ahli.hidden = false;
  setT(E.peran, PERAN[id]);
  setT(E.sapa, id === 'masjid' ? 'Kamu menerima wasiat sebagai' : 'Kamu menerima warisan sebagai');
  setT(E.rinci, RINCI[id]);
  setT(E.alasanJ, JUDUL_ALASAN[id]);
  setT(E.alasanT, D.ALASAN[id]);
  document.title = PERAN[id] + ' — Pusaka';

  // contoh kain milikmu, tulisan lilin = pecahanmu
  const wrap = E.contoh;
  wrap.innerHTML = ''; wrap.removeAttribute('style');
  lebar = Math.min(400, document.querySelector('main').clientWidth - 32);
  contoh = Kain.contoh(wrap, { w: lebar, h: Math.round(lebar * .72), dye: saya.dye, isen: saya.isen, tulisan: id === 'istri' ? '165 jt' : FRAC[id], q: .9, seed: 9 });

  // peta seluruh kain
  E.peta.innerHTML = '';
  const idx = D.bidang.map((b, i) => (b.id === id ? i : -1)).filter((i) => i >= 0);
  Kain.peta(E.peta, { W: 350, H: 88, k: .42, bands: D.bidang, sorot: idx });
  E.rincian.innerHTML = D.penerima.map((p) => `<span class="${p.id === id ? 'saya' : ''}">${PERAN[p.id]}</span><span>${D.rp(p.total)}</span>`).join('');

  render();
  if (animasi && !Demo.diam) {
    UI.masuk('.ahli .resap');
    gsap.fromTo('#contoh', { clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)', duration: 1.3, ease: 'power3.inOut', delay: .25 });
    gsap.from('.nominal-blok, .cara, .kartu, .alasan', { opacity: 0, y: -8, duration: .8, stagger: .1, ease: 'power3.out', delay: .6 });
  } else UI.masuk('.ahli .resap');
}

/* Nominal: teks di atas angka, menurut cara terima dan tahapnya */
function tujuanCair(f) {
  const cair = S.s.penerima[idSaya].cair;
  const baru = cair && cair.bank && cair.tahap !== 'dikembalikan' && f !== 'kirim';
  const bank = baru ? cair.bank : lokal.bank, akh = baru ? cair.akhiran : S.akhiranDari(lokal.nomor);
  return { tuj: bank ? `${bank} ••••${akh}` : 'rekeningmu', ew: S.EWALLET.has(bank), bank };
}
function labelNominal(c, f) {
  if (S.s.status < 3) return 'Bagianmu jika dibagikan hari ini';
  if (c.cara === 'bank') {
    if (f === 'tiba') return `Sudah masuk ke ${tempat(c)}`;
    if (f === 'balik') return 'Transfer tertunda, dananya aman';
    return `Sedang dikirim ke ${c.bank ? tujuan(c) : 'rekeningmu'}`;
  }
  if (f === 'kirim' || f === 'proses') return `Sedang dikirim ke ${tujuanCair(f).tuj}`;
  if (f === 'tiba') return `Sudah dicairkan ke ${tujuanCair(f).tuj}`;
  return c.cara === 'amplop' ? 'Ada di amplopmu' : 'Sudah masuk ke dompetmu';
}

/* "Final di blok 16 pukul 18.43.24". Nomor blok baru diketahui setelah dibaca dari rantai; sebelum itu dilewati. */
function teksFinal() {
  const s = S.s, n = S.blok(s.distributedAt);
  return `Final${n > 0 ? ` di blok ${n.toLocaleString('id-ID')}` : ''} pukul ${D.jam(s.distributedAt)}`;
}

/* Urutan langkah (titik prada = sedang berjalan, teks redup = belum) */
function setUrut(langkah) {
  const ol = E.urut;
  const baru = ol.children.length !== langkah.length;
  if (baru) ol.innerHTML = langkah.map(() => '<li><i></i><div><b></b><small hidden></small></div></li>').join('');
  langkah.forEach((l, i) => {
    const li = ol.children[i], b = li.querySelector('b'), k = li.querySelector('small');
    if (li.dataset.s !== l.s) li.dataset.s = l.s;
    if (b.textContent !== l.t) { b.textContent = l.t; if (!baru && !Demo.diam) UI.masuk(b); }
    const kecil = l.k || '';
    if (k.textContent !== kecil) { k.textContent = kecil; tampil(k, !!kecil); if (kecil && !baru && !Demo.diam) UI.masuk(k); }
  });
}
function langkahBank(c, f) {
  const s = S.s, cair = s.penerima[idSaya].cair;
  const jam = cair && cair.selesai ? D.jam(cair.selesai) : '';
  return [
    { t: 'Warisan dibagikan', k: teksFinal(), s: 'selesai' },
    { t: 'Diterima mitra pencairan', s: f === 'mitra' ? 'kini' : 'selesai' },
    { t: `Transfer BI-FAST ke ${c.bank ? tujuan(c) : 'rekeningmu'}`, s: f === 'mitra' ? 'nanti' : f === 'proses' ? 'kini' : 'selesai' },
    f === 'tiba'
      ? { t: `Masuk ${c.ewallet ? tujuan(c) : 'rekening'}${jam ? ` pukul ${jam}` : ''}`, k: S.refBank(cair.bukti, cair.selesai), s: 'selesai' }
      : { t: `Masuk ${c.ewallet ? tujuan(c) : 'rekening'}`, s: 'nanti' },
  ];
}
function langkahCair(f) {
  const cair = S.s.penerima[idSaya].cair;
  const x = tujuanCair(f);
  const jam = f === 'tiba' && cair.selesai ? D.jam(cair.selesai) : '';
  return [
    { t: f === 'kirim' ? 'Mengirim permintaanmu' : 'Permintaan diterima mitra pencairan', s: f === 'kirim' ? 'kini' : 'selesai' },
    { t: `Transfer BI-FAST ke ${x.tuj}`, s: f === 'kirim' ? 'nanti' : f === 'proses' ? 'kini' : 'selesai' },
    f === 'tiba'
      ? { t: `Masuk ${x.ew ? x.tuj : 'rekening'}${jam ? ` pukul ${jam}` : ''}`, k: S.refBank(cair.bukti, cair.selesai), s: 'selesai' }
      : { t: `Masuk ${x.ew ? x.tuj : 'rekening'}`, s: 'nanti' },
  ];
}

/* Kartu "Cara menerima" */
function renderCara(c, f) {
  const id = idSaya, p = S.s.penerima[id], kunci = S.amplopUntuk(id);
  // judul dan sub: [teks depan, bagian yang tidak boleh terputus]
  let judul, sub = ['', ''], teks = '', chip = false, urutan = null, kaki = '', link = null, form = null, buka = false;

  if (c.cara === 'bank') {
    judul = [`Ke ${c.bank && !c.ewallet ? 'rekening ' : ''}`, c.bank ? tujuan(c) : 'rekeningmu'];
    sub = [c.nama ? `atas nama ${c.nama}` : '', ''];
    if (f === 'pra') teks = `Rupiah langsung masuk ke ${c.ewallet ? 'e-wallet' : 'rekening'} ini setelah warisan dibagikan. Kamu tidak perlu aplikasi atau dompet kripto, dan tidak perlu menekan apa pun.`;
    else if (f === 'balik') teks = `Transfer ke ${c.bank ? tujuan(c) : 'rekeningmu'} belum berhasil, jadi dananya dikembalikan ke amplopmu. Dananya aman.`;
    else { urutan = langkahBank(c, f); kaki = SIMULASI; }
  } else {
    if (c.cara === 'amplop') {
      judul = ['Lewat amplop digital', ''];
      sub = c.wa ? ['Tautan dikirim ke WhatsApp ', c.wa] : ['Tautan dikirim lewat WhatsApp', ''];
    } else {
      judul = p.alamat ? ['Ke dompet kripto ', S.pendek(p.alamat)] : ['Ke dompet kripto', ''];
    }
    if (f === 'kirim' || f === 'proses' || f === 'tiba') {
      // sudah diminta cair: kartu menunjuk ke tujuannya, bukan ke amplop atau dompet lagi
      const x = tujuanCair(f);
      judul = [`Ke ${x.bank && !x.ew ? 'rekening ' : ''}`, x.tuj];
      sub = ['', ''];
      urutan = langkahCair(f); kaki = SIMULASI;
    } else if (c.cara === 'amplop') {
      if (f === 'pra') { teks = 'Tautan amplopmu dikirim lewat WhatsApp dan terkunci sampai warisan dibagikan. Setelah itu kamu bisa mencairkannya ke bank atau e-wallet mana pun. Tanpa aplikasi, tanpa biaya.'; chip = true; }
      else if (!kunci) teks = 'Amplop ini belum terbuka di HP ini. Buka tautan amplop dari WhatsApp, atau pindai QR di layar panggung, lalu pilih perannya.';
      else if (p.saldo > 0) {
        teks = f === 'balik' ? 'Pencairan tadi tidak berhasil, dan dananya kembali ke amplopmu. Dananya aman. Coba lagi.' : 'Warisan sudah dibagikan. Pilih bank atau e-wallet tujuanmu, lalu tahan tombolnya.';
        form = E.slotAmplop;
      } else teks = 'Sedang membaca isi amplopmu…';
    } else if (f === 'pra') {
      teks = 'Bagianmu masuk langsung ke dompet kripto ini saat warisan dibagikan. Kamu tidak perlu melakukan apa pun.';
    } else {
      teks = f === 'balik' ? 'Sudah di dompetmu. Pencairan ke rekening tadi tidak berhasil, dananya tetap aman di dompetmu.' : 'Sudah di dompetmu. Masuk langsung, tanpa perantara.';
      link = Demo.EXPLORER && p.alamat ? `${Demo.EXPLORER}/address/${p.alamat}` : null;
      // dompet di demo = kunci amplop; hanya kalau kuncinya ada di HP ini, bagian bisa dicairkan ke rekening
      buka = !!(kunci && p.alamat && p.alamat.toLowerCase() === kunci.address.toLowerCase() && p.saldo > 0);
      if (buka) form = E.slotKripto;
    }
  }

  setNB(E.caraJ, judul[0], judul[1]);
  setNB(E.caraSub, sub[0], sub[1]); tampil(E.caraSub, !!(sub[0] || sub[1]));
  setT(E.caraT, teks); tampil(E.caraT, !!teks);
  tampil(E.caraChip, chip);
  tampil(E.urut, !!urutan); if (urutan) setUrut(urutan);
  tampil(E.caraLink, !!link); if (link && E.caraLink.href !== link) E.caraLink.href = link;
  tampil(E.bukaCair, buka);
  if (form) {
    if (E.formCair.parentNode !== form) form.appendChild(E.formCair);
    setT(E.fTahan, `Tahan untuk mencairkan ${D.rp(p.saldo)}`);
  }
  tampil(E.formCair, !!form);
  setT(E.caraKaki, kaki); tampil(E.caraKaki, !!kaki);
}

/* Kartu status: aktif · masa sanggah · dibagikan */
function renderKartu(c) {
  const s = S.s;
  tampil(E.hitung, s.status === 2); tampil(E.jalur, s.status === 2);
  if (s.status === 3) {
    E.chip.dataset.s = 'dibagikan'; setT(E.chipT, 'Sudah dibagikan');
    setT(E.ketKartu, `${teksFinal()}. Pembagian ini tidak bisa diubah lagi.`);
  } else if (s.status === 2) {
    E.chip.dataset.s = 'dipicu'; setT(E.chipT, 'Masa sanggah');
    const nama = s.attest.map((t, i) => (t ? D.saksi[i].nama.split(' ')[0] : null)).filter(Boolean).join(' dan ');
    setT(E.ketKartu, s.alasan === 'tidak aktif'
      ? 'Pewaris tidak aktif melewati batas waktu. Jika ia masih hidup, ia bisa membatalkan sebelum waktu habis.'
      : `Wafat dikonfirmasi oleh ${nama}. Jika ini keliru, pewaris masih bisa membatalkan sebelum waktu habis.`);
  } else if (s.status === 0) {
    E.chip.dataset.s = 'belum'; setT(E.chipT, 'Aturan belum dipasang');
    setT(E.ketKartu, 'Budi Santoso belum memasang aturan warisan di dompetnya. Angka di atas masih pratinjau.');
  } else {
    E.chip.dataset.s = 'aktif'; setT(E.chipT, 'Pewaris masih aktif');
    const masuk = c.cara === 'bank' ? 'Bagian ini dikirim otomatis ke rekeningmu' : c.cara === 'amplop' ? 'Bagian ini masuk ke amplopmu' : 'Bagian ini masuk ke dompetmu';
    const akhir = c.cara === 'amplop' ? 'Setelah itu kamu tinggal mencairkannya.' : 'Kamu tidak perlu menekan apa pun.';
    setT(E.ketKartu, `${masuk} setelah ${s.ambang} dari 3 saksi mengonfirmasi wafat dan masa sanggah selesai. ${akhir}`);
  }
}

function render() {
  if (!saya) return;
  const s = S.s, id = idSaya, p = s.penerima[id];
  const c = info(id), f = fase(id, c), final = s.status === 3;
  setT(E.dari, final ? 'dari almarhum Budi Santoso' : 'dari Budi Santoso');

  // saat momen "bagian masuk" berjalan, kain dan angka dipegang animasinya
  if (!momen) {
    const mode = final ? 'akhir' : 'awal';
    if (mode !== modeKain) { contoh[mode](); modeKain = mode; }
    setT(E.lblNom, labelNominal(c, f));
    E.nominal.classList.toggle('calon', !final);
    setT(E.nominal, D.rp(saya.total));
  }
  const adaTx = final && !!Demo.EXPLORER && c.cara !== 'kripto';
  tampil(E.tx, adaTx);
  if (adaTx) { E.tx.href = `${Demo.EXPLORER}/address/${p.alamat || saya.alamatPenuh}`; E.tx.target = '_blank'; E.tx.rel = 'noopener'; }

  renderCara(c, f);
  renderKartu(c);

  // getaran halus saat rupiah benar-benar tiba (transfer bank atau pencairan selesai)
  if (faseLalu && faseLalu !== 'tiba' && f === 'tiba' && !momen) getar(24);
  faseLalu = f;
}

/* Momen: bagian masuk. Pewarna merambat dari atas, nominal dihitung naik, HP bergetar sekali */
function terima() {
  if (!saya) return;
  if (Demo.diam || document.hidden) { render(); return; }
  const c = info(idSaya);
  momen = true;
  render();
  contoh.awal(); modeKain = 'awal'; contoh.celup.soak = .38;
  setT(E.lblNom, c.cara === 'bank' ? `Sedang dikirim ke ${c.bank ? tujuan(c) : 'rekeningmu'}` : c.cara === 'amplop' ? 'Sedang masuk ke amplopmu' : 'Sedang masuk ke dompetmu');
  E.nominal.classList.remove('calon');
  setT(E.nominal, D.rp(0));
  const o = { v: 0 };
  momenTl = gsap.timeline({ onComplete: () => { momenTl = null; } });
  momenTl.add(contoh.rendam(0, 1), 0)
    .add(contoh.celupkan(2.8), .1)
    .to(o, { v: saya.total, duration: 2.4, ease: 'power2.out', onUpdate: () => { E.nominal.textContent = D.rp(o.v); } }, .5)
    .call(() => { momen = false; modeKain = 'akhir'; render(); getar([18, 60, 28]); }, null, 2.9)
    .fromTo('#tx, #caraLink', { opacity: 0, y: -6 }, { opacity: 1, y: 0, duration: .6 }, 3)
    .fromTo('#cara, #kartu', { opacity: .4 }, { opacity: 1, duration: .6 }, 3);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ---------- pencairan dari amplop ---------- */
function kirimAktif() {
  if (lokal.mengirim) return true;
  const k = lokal.terkirim;
  if (!k) return false;
  const cair = S.s.penerima[idSaya].cair;
  // selesai ditunggu sampai pencairan baru terbaca dari rantai (atau 12 detik, supaya tidak macet)
  if ((cair && cair.no !== k.no) || Date.now() - k.t > 12000) { lokal.terkirim = null; return false; }
  return true;
}
function labelForm() {
  const ew = S.EWALLET.has(lokal.bank);
  setT(E.fNomorL, ew ? 'Nomor HP' : 'Nomor rekening');
}
function galat(t) { lokal.galat = t; setT(E.fErrT, t); tampil(E.fErr, !!t); }
function cekIsian() {
  if (!lokal.bank) return 'Pilih bank atau e-wallet dulu.';
  const ew = S.EWALLET.has(lokal.bank), nama = ew ? 'nomor HP' : 'nomor rekening';
  const digit = String(lokal.nomor).replace(/\D/g, '');
  if (!digit) return `Isi ${nama} dulu.`;
  if (digit.length < 6) return `Periksa lagi, ${nama} terlalu pendek.`;
  if (!String(lokal.nama || '').trim()) return `Isi nama pemilik ${ew ? 'akun' : 'rekening'} dulu.`;
  return '';
}
const rapikan = (m) => {
  m = String(m || '').trim();
  return !m || /gas|nonce|revert|kontrak|simulat|viem|rpc|0x[0-9a-f]{6}/i.test(m) ? 'Pencairan belum berhasil. Coba lagi sebentar lagi.' : m;
};
async function cairSekarang() {
  const id = idSaya, p0 = S.s.penerima[id];
  const rek = { bank: lokal.bank, nomor: lokal.nomor, nama: String(lokal.nama || '').trim() };
  lokal.mengirim = true; galat('');
  render();
  let hasil = null;
  try { hasil = await S.cairkan(id, rek); } catch { hasil = null; }
  if (id !== idSaya) return;
  lokal.mengirim = false;
  const p = S.s.penerima[id];
  if (hasil) lokal.terkirim = { no: p0.cair ? p0.cair.no : -1, t: Date.now() };
  // kalau HP lain sudah mencairkan lebih dulu, tampilkan hasilnya, bukan galat
  else if (!(p.cair && p.cair.tahap !== 'dikembalikan' && p.saldo === 0)) galat(rapikan(S.pesanTerakhir));
  tahanH.reset();
  render();
}
E.fBank.innerHTML = '<option value="" disabled selected>Pilih bank atau e-wallet</option>'
  + `<optgroup label="Bank">${S.BANK.filter((b) => !S.EWALLET.has(b)).map((b) => `<option>${b}</option>`).join('')}</optgroup>`
  + `<optgroup label="E-wallet">${S.BANK.filter((b) => S.EWALLET.has(b)).map((b) => `<option>${b}</option>`).join('')}</optgroup>`;
E.fBank.addEventListener('change', () => { lokal.bank = E.fBank.value; labelForm(); galat(''); });
E.fNomor.addEventListener('input', () => { lokal.nomor = E.fNomor.value; galat(''); });
E.fNama.addEventListener('input', () => { lokal.nama = E.fNama.value; galat(''); });
E.formCair.addEventListener('submit', (e) => e.preventDefault());
// isian diperiksa sebelum tahan dimulai (pendengar ini lebih dulu dari milik UI.tahan)
const cegat = (e) => {
  if (e.type === 'keydown' && e.key !== ' ' && e.key !== 'Enter') return;
  if (e.type === 'pointerdown' && e.button !== 0) return;
  const m = lokal.mengirim ? 'sibuk' : cekIsian();
  if (!m) { galat(''); return; }
  e.stopImmediatePropagation(); e.preventDefault();
  if (m !== 'sibuk') galat(m);
};
E.fTahan.addEventListener('pointerdown', cegat);
E.fTahan.addEventListener('keydown', cegat);
const tahanH = UI.tahan(E.fTahan, { lama: 1100, onSelesai: cairSekarang });

S.on((s, prev, sebab) => {
  if (!saya) { segarPilih(); return; }
  if (sebab === 'dibagikan') { terima(); return; }
  if (sebab === 'batal') { render(); contoh.rendam(0, 1.2); return; }
  render();
});

/* jam: hitung mundur + rendaman di contoh kain */
function detak() {
  const s = S.s;
  if (saya && s.status === 2) {
    const sisa = Demo.sisaSanggah();
    const m = D.mmss(sisa);
    if (m !== hitungLalu) { hitungLalu = m; E.hitung.innerHTML = [...m].map((ch) => `<span class="${ch === ':' ? 'titik' : ''}">${ch}</span>`).join(''); }
    const p = Math.min(1, Math.max(0, 1 - sisa / s.sanggah));
    E.jalurI.style.width = (p * 100) + '%';
    if (!momen) contoh.celup.soak = .06 + .32 * p;
    if (sisa <= 0) setT(E.ketKartu, 'Masa sanggah selesai. Warisan siap dibagikan.');
  }
  requestAnimationFrame(detak);
}

function mulai() {
  const id = new URLSearchParams(location.search).get('id');
  if (id && D.P[id]) tampilAhli(id, true); else tampilPilih();
}
addEventListener('popstate', mulai);
// nomor blok "Final di blok N" baru terbaca dari rantai setelah halaman tampil, tanpa kejadian baru yang memicu render
setInterval(() => { if (saya && S.s.status === 3) render(); }, 1500);
document.fonts.ready.then(() => { mulai(); requestAnimationFrame(detak); });
