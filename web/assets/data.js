/* Pusaka · Nila — data demo, mesin faraid (port faraid-spec.md bagian 5), dan format angka.
   Di aplikasi final, angka diambil dari kontrak (getSummary/preview). Mesin ini hanya untuk
   pratinjau di browser. */
window.Pusaka = (() => {
  /* ---------- pecahan eksak ---------- */
  const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };
  const F = (n, d = 1) => { if (d < 0) { n = -n; d = -d; } const g = gcd(n, d); return { n: n / g, d: d / g }; };
  const add = (a, b) => F(a.n * b.d + b.n * a.d, a.d * b.d);
  const sub = (a, b) => F(a.n * b.d - b.n * a.d, a.d * b.d);
  const mul = (a, b) => F(a.n * b.n, a.d * b.d);
  const div = (a, b) => F(a.n * b.d, a.d * b.n);
  const gt = (a, b) => a.n * b.d > b.n * a.d;
  const isZero = (a) => a.n === 0;
  const NOL = F(0), SATU = F(1);
  const str = (f) => `${f.n}/${f.d}`;

  class Ditolak extends Error { constructor(jenis, kode, pesan) { super(pesan); this.jenis = jenis; this.kode = kode; } }

  const PESAN = {
    'InvalidFamily-1': 'Pewaris laki-laki tidak mungkin meninggalkan suami.',
    'InvalidFamily-2': 'Pewaris perempuan tidak mungkin meninggalkan istri.',
    'InvalidFamily-3': 'Suami hanya boleh satu.',
    'InvalidFamily-4': 'Istri paling banyak empat.',
    'UnsupportedCase-1': 'Saudara ikut mewarisi pada susunan ini. Pusaka belum mendukung bagian saudara, jadi pembagian ditolak.',
    'UnsupportedCase-2': 'Hanya ada pasangan. Menurut jumhur, sisanya untuk baitul mal, dan Pusaka belum mendukung itu.',
    'UnsupportedCase-3': 'Ada kerabat lain yang mungkin ikut mewarisi (misalnya cucu atau kakek). Pusaka belum mendukung kasus ini.',
    'UnsupportedCase-4': 'Tidak ada ahli waris inti (pasangan, anak, ayah, atau ibu).',
  };
  const tolak = (jenis, kode) => { throw new Ditolak(jenis, kode, PESAN[`${jenis}-${kode}`]); };

  /* fam: { laki, suami, istri, putra, putri, ayah, ibu, saudara, kerabatLain }, raddPasangan */
  function faraid(fam, raddPasangan = false) {
    const { laki, suami = 0, istri = 0, putra = 0, putri = 0, ayah = false, ibu = false, saudara = 0, kerabatLain = false } = fam;
    if (laki && suami > 0) tolak('InvalidFamily', 1);
    if (!laki && istri > 0) tolak('InvalidFamily', 2);
    if (suami > 1) tolak('InvalidFamily', 3);
    if (istri > 4) tolak('InvalidFamily', 4);
    if (kerabatLain) tolak('UnsupportedCase', 3);
    if (!(suami || istri || putra || putri || ayah || ibu)) tolak('UnsupportedCase', 4);
    const adaAnak = putra + putri > 0;
    const flags = new Set();
    let pasangan = suami ? (adaAnak ? F(1, 4) : F(1, 2)) : istri ? (adaAnak ? F(1, 8) : F(1, 4)) : NOL;
    let bIbu = NOL;
    if (ibu) {
      if (adaAnak || saudara >= 2) bIbu = F(1, 6);
      else if (ayah && !isZero(pasangan)) { bIbu = mul(sub(SATU, pasangan), F(1, 3)); flags.add('gharrawain'); }
      else bIbu = F(1, 3);
    }
    let ayahPasti = ayah && adaAnak ? F(1, 6) : NOL;
    const ayahSisa = ayah && putra === 0;
    let putriPasti = putra === 0 && putri === 1 ? F(1, 2) : putra === 0 && putri >= 2 ? F(2, 3) : NOL;
    const total = [pasangan, bIbu, ayahPasti, putriPasti].reduce(add, NOL);
    let sisa;
    if (gt(total, SATU)) {
      flags.add('aul');
      [pasangan, bIbu, ayahPasti, putriPasti] = [pasangan, bIbu, ayahPasti, putriPasti].map((x) => div(x, total));
      sisa = NOL;
    } else sisa = sub(SATU, total);

    let putraEach = NOL, putriEach = putri ? div(putriPasti, F(putri)) : NOL, bAyah = ayahPasti;
    if (!isZero(sisa)) {
      if (putra > 0) {
        const unit = div(sisa, F(2 * putra + putri));
        putraEach = mul(unit, F(2)); putriEach = unit;
      } else if (ayahSisa) { bAyah = add(bAyah, sisa); flags.add('ayahSisa'); }
      else if (saudara > 0) tolak('UnsupportedCase', 1);
      else {
        const pen = [];
        if (!isZero(bIbu)) pen.push('ibu');
        if (!isZero(bAyah)) pen.push('ayah');
        if (!isZero(putriPasti)) pen.push('putri');
        if (raddPasangan && !isZero(pasangan)) pen.push('pasangan');
        if (!pen.length) tolak('UnsupportedCase', 2);
        const val = { ibu: bIbu, ayah: bAyah, putri: putriPasti, pasangan };
        const jml = pen.reduce((a, k) => add(a, val[k]), NOL);
        pen.forEach((k) => { val[k] = add(val[k], mul(sisa, div(val[k], jml))); });
        bIbu = val.ibu; bAyah = val.ayah; putriPasti = val.putri; pasangan = val.pasangan;
        if (putri) putriEach = div(putriPasti, F(putri));
        flags.add('radd'); if (pen.includes('pasangan')) flags.add('raddPasangan');
      }
    }
    return {
      suami: suami ? pasangan : NOL,
      istriEach: istri ? div(pasangan, F(istri)) : NOL,
      putraEach, putriEach, ayah: bAyah, ibu: bIbu, flags,
    };
  }

  /* ---------- tampilan ahli waris ---------- */
  const URUT = ['pertama', 'kedua', 'ketiga', 'keempat', 'kelima', 'keenam', 'ketujuh', 'kedelapan'];
  const GAYA = {
    pasangan: { dye: '#7c4e2d', isen: 'truntum' },
    wasiat:   { dye: '#dbc8a0', isen: 'sawut', prada: true, nembok: true },
    putra:    { dye: '#2e406b', isen: 'sisik' },
    putri:    { dye: '#45598a', isen: 'ukel' },
    ayah:     { dye: '#4e301c', isen: 'galaran' },
    ibu:      { dye: '#ab7d4f', isen: 'gringsing' },
  };

  /* Pembagian lengkap menurut urutan KHI: harta bersama → wasiat → faraid.
     harta dalam juta rupiah. Mengembalikan daftar penerima yang siap digambar. */
  function bagi(harta, fam, { bersama = F(0), wasiat = [], raddPasangan = false } = {}) {
    const hasil = faraid(fam, raddPasangan);
    const nPasangan = (fam.suami || 0) + (fam.istri || 0);
    let jointPasangan = 0;
    if (!isZero(bersama)) {
      if (nPasangan !== 1) throw new Ditolak('InvalidEstate', 2, 'Harta bersama hanya bisa dipisah jika pasangan tepat satu orang.');
      jointPasangan = harta * bersama.n / bersama.d / 2;
    }
    const warisan = harta - jointPasangan;
    const totalWasiat = wasiat.reduce((a, w) => add(a, w.bagian), NOL);
    if (gt(totalWasiat, F(1, 3))) throw new Ditolak('InvalidEstate', 4, 'Wasiat melebihi sepertiga harta warisan.');
    const wasiatJt = wasiat.map((w) => warisan * w.bagian.n / w.bagian.d);
    const kolam = warisan - wasiatJt.reduce((a, b) => a + b, 0);

    const orang = [];
    const pasLabel = fam.laki ? 'Istri' : 'Suami';
    const nP = fam.laki ? fam.istri : fam.suami;
    for (let i = 0; i < nP; i++) {
      const f = fam.laki ? hasil.istriEach : hasil.suami;
      orang.push({ rel: 'pasangan', label: nP > 1 ? `${pasLabel} ${URUT[i]}` : pasLabel, frac: f, faraid: kolam * f.n / f.d, bersama: i === 0 ? jointPasangan : 0 });
    }
    wasiat.forEach((w, i) => orang.push({ rel: 'wasiat', label: w.label, frac: w.bagian, faraid: 0, wasiat: wasiatJt[i] }));
    for (let i = 0; i < (fam.putra || 0); i++) orang.push({ rel: 'putra', label: fam.putra > 1 ? `Putra ${URUT[i]}` : 'Putra', frac: hasil.putraEach, faraid: kolam * hasil.putraEach.n / hasil.putraEach.d });
    for (let i = 0; i < (fam.putri || 0); i++) orang.push({ rel: 'putri', label: fam.putri > 1 ? `Putri ${URUT[i]}` : 'Putri', frac: hasil.putriEach, faraid: kolam * hasil.putriEach.n / hasil.putriEach.d });
    if (fam.ayah) orang.push({ rel: 'ayah', label: 'Ayah', frac: hasil.ayah, faraid: kolam * hasil.ayah.n / hasil.ayah.d });
    if (fam.ibu) orang.push({ rel: 'ibu', label: 'Ibu', frac: hasil.ibu, faraid: kolam * hasil.ibu.n / hasil.ibu.d });
    orang.forEach((o) => { o.total = (o.bersama || 0) + (o.wasiat || 0) + o.faraid; Object.assign(o, GAYA[o.rel]); });
    return { orang, warisan, kolam, jointPasangan, flags: hasil.flags, harta };
  }

  /* ---------- demo: Rp300 jt, seluruhnya harta bersama, wakaf masjid 1/5, keluarga K01 ---------- */
  const DEMO_FAM = { laki: true, istri: 1, putra: 2, putri: 1, ayah: true, ibu: true, saudara: 0, kerabatLain: false };
  const demo = bagi(300, DEMO_FAM, { bersama: F(1), wasiat: [{ label: 'Wakaf masjid', bagian: F(1, 5) }] });

  // Bidang di kain, urut kiri ke kanan. Bagian istri dua bidang: harta bersama lalu faraid.
  const alamat = ['0x3f9a…41a1', '0x8c21…e6d0', '0x9c4e…0207', '0x77b3…a1bd', '0x1e88…4f44', '0x5a02…c990', '0xd2f1…0317'];
  const ID = ['istri', 'masjid', 'putra1', 'putra2', 'putri', 'ayah', 'ibu'];
  const penerima = demo.orang.map((o, i) => ({ ...o, id: ID[i], alamat: alamat[i] }));
  const P = Object.fromEntries(penerima.map((p) => [p.id, p]));
  const bidang = [
    { id: 'istri', bagian: 'bersama', amount: 150, ...GAYA.pasangan },
    { id: 'istri', bagian: 'faraid', amount: 15, ...GAYA.pasangan, sambung: true },
    { id: 'masjid', bagian: 'wasiat', amount: 30, ...GAYA.wasiat },
    { id: 'putra1', bagian: 'faraid', amount: 26, ...GAYA.putra },
    { id: 'putra2', bagian: 'faraid', amount: 26, ...GAYA.putra },
    { id: 'putri', bagian: 'faraid', amount: 13, ...GAYA.putri },
    { id: 'ayah', bagian: 'faraid', amount: 20, ...GAYA.ayah },
    { id: 'ibu', bagian: 'faraid', amount: 20, ...GAYA.ibu },
  ];

  const ALASAN = {
    istri: 'Separuh harta bersama adalah milikmu sendiri, jadi dipisahkan lebih dulu (KHI Pasal 96). Dari harta warisan yang tersisa, istri mendapat 1/8 karena almarhum meninggalkan anak.',
    masjid: 'Almarhum berwasiat seperlima harta warisan untuk wakaf masjid. Wasiat dijalankan sebelum faraid dan tidak boleh lebih dari sepertiga (KHI Pasal 195).',
    putra1: 'Anak laki-laki menerima sisa setelah bagian pasti dibagikan. Bagian anak laki-laki dua kali bagian anak perempuan.',
    putra2: 'Anak laki-laki menerima sisa setelah bagian pasti dibagikan. Bagian anak laki-laki dua kali bagian anak perempuan.',
    putri: 'Bersama saudara laki-lakinya, anak perempuan menerima sisa dengan perbandingan 2 : 1. Bagianmu separuh bagian saudara laki-lakimu.',
    ayah: 'Ayah mendapat 1/6 karena almarhum meninggalkan anak laki-laki.',
    ibu: 'Ibu mendapat 1/6 karena almarhum meninggalkan anak.',
  };
  const PERAN_PANJANG = {
    istri: 'Istri', masjid: 'Penerima wasiat', putra1: 'Anak laki-laki pertama', putra2: 'Anak laki-laki kedua',
    putri: 'Anak perempuan', ayah: 'Ayah', ibu: 'Ibu',
  };
  const saksi = [
    { nama: 'Rina Santoso', peran: 'Adik', alamat: '0x4b7e…19c2' },
    { nama: 'Yusuf Pratama', peran: 'Sahabat', alamat: '0xa310…77e5' },
    { nama: 'Ustaz Hamid', peran: 'Guru ngaji', alamat: '0x6d02…b4a8' },
  ];

  /* ---------- bidang kain dari hasil bagi() ----------
     Urut kiri ke kanan seperti urutan KHI. Pasangan yang menerima harta bersama mendapat dua bidang
     (harta bersama, lalu faraid) yang dibatasi garis cecek karena pemiliknya sama. */
  function bidangKain(hasil) {
    const out = [], hitung = {};
    hasil.orang.forEach((o) => {
      const n = (hitung[o.rel] = (hitung[o.rel] || 0) + 1) - 1;
      const key = `${o.rel}-${n}`;
      const gaya = { dye: o.dye, isen: o.isen, prada: !!o.prada, nembok: !!o.nembok, pemilik: key, orang: o };
      if (o.bersama > 0) out.push({ key: key + '-bersama', amount: o.bersama, teks: 'harta bersama', ...gaya });
      out.push({ key, amount: o.rel === 'wasiat' ? o.wasiat : o.faraid, teks: str(o.frac), sambung: o.bersama > 0, ...gaya });
    });
    return out;
  }

  /* Ringkasan per kelompok penerima untuk daftar di layar: ahli waris dengan hubungan yang sama
     digabung ("Anak laki-laki ×2"), tiap kelompok tahu key bidang kainnya untuk disorot. */
  const NAMA = { putra: 'Anak laki-laki', putri: 'Anak perempuan', ayah: 'Ayah', ibu: 'Ibu' };
  function ringkas(hasil, laki) {
    const grup = [], hitung = {};
    hasil.orang.forEach((o) => {
      const n = (hitung[o.rel] = (hitung[o.rel] || 0) + 1) - 1, key = `${o.rel}-${n}`;
      let g = o.rel !== 'wasiat' && grup.find((x) => x.rel === o.rel);
      if (!g) {
        const nama = o.rel === 'wasiat' ? o.label : o.rel === 'pasangan' ? (laki ? 'Istri' : 'Suami') : NAMA[o.rel];
        g = { rel: o.rel, nama, n: 0, keys: [], orang: [], dye: o.dye, isen: o.isen, frac: o.frac, tiap: o.total, total: 0 };
        grup.push(g);
      }
      g.n++; g.keys.push(key); g.orang.push(o); g.total += o.total;
    });
    grup.forEach((g) => {
      const o = g.orang[0];
      g.fracTeks = o.rel === 'wasiat' ? `${str(o.frac)} wasiat`
        : o.bersama > 0 ? `separuh harta bersama + ${str(o.frac)}`
        : str(o.frac) + (g.n > 1 ? ' masing-masing' : '');
      if (g.n > 1) g.nama += ` ×${g.n}`;
    });
    return grup;
  }

  /* ---------- bahasa ---------- */
  const ANGKA = ['nol', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh'];
  const KATA_PECAHAN = { '1/2': 'separuh', '1/3': 'sepertiga', '1/4': 'seperempat', '1/5': 'seperlima', '1/6': 'seperenam', '1/8': 'seperdelapan', '1/10': 'sepersepuluh', '2/3': 'dua pertiga', '3/4': 'tiga perempat' };
  const kataPecahan = (f) => KATA_PECAHAN[str(f)] || str(f);
  const daftarKata = (xs) => xs.length < 2 ? (xs[0] || '') : xs.slice(0, -1).join(', ') + (xs.length > 2 ? ', dan ' : ' dan ') + xs[xs.length - 1];
  const orangKata = (n, nama) => (n === 1 ? `seorang ${nama}` : `${ANGKA[n] || n} ${nama}`);
  function kalimatKeluarga(fam) {
    const x = [];
    if (fam.laki && fam.istri) x.push(orangKata(fam.istri, 'istri'));
    if (!fam.laki && fam.suami) x.push('suami');
    if (fam.putra) x.push(orangKata(fam.putra, 'anak laki-laki'));
    if (fam.putri) x.push(orangKata(fam.putri, 'anak perempuan'));
    if (fam.ayah) x.push('ayah');
    if (fam.ibu) x.push('ibu');
    return daftarKata(x);
  }

  /* Alasan bagian dalam bahasa sederhana, dari susunan keluarga dan flag hasil faraid */
  function alasan(o, fam, flags) {
    const adaAnak = (fam.putra || 0) + (fam.putri || 0) > 0, almarhum = fam.laki ? 'almarhum' : 'almarhumah';
    const aul = flags.has('aul') ? ' Setelah ʻaul, bagian ini dikecilkan sebanding.' : '';
    const radd = flags.has('radd') ? ' Ditambah sisa yang dikembalikan (radd).' : '';
    switch (o.rel) {
      case 'pasangan':
        if (fam.laki) {
          const dasar = adaAnak ? '1/8 karena ' + almarhum + ' meninggalkan anak' : '1/4 karena tidak ada anak';
          const bersama = o.bersama > 0 ? 'Separuh harta bersama adalah miliknya sendiri, jadi dipisahkan lebih dulu (KHI Pasal 96). ' : '';
          const s = fam.istri > 1 ? `Para istri berbagi ${adaAnak ? '1/8' : '1/4'} sama rata.` : `${bersama}Dari harta warisan, istri mendapat ${dasar}.`;
          return s + aul + (flags.has('raddPasangan') ? radd : '');
        }
        return `${o.bersama > 0 ? 'Separuh harta bersama adalah miliknya sendiri, jadi dipisahkan lebih dulu (KHI Pasal 96). ' : ''}Suami mendapat ${adaAnak ? '1/4 karena ' + almarhum + ' meninggalkan anak' : '1/2 karena tidak ada anak'}.` + aul + (flags.has('raddPasangan') ? radd : '');
      case 'wasiat':
        return `Wasiat ${kataPecahan(o.frac)} harta warisan untuk yang bukan ahli waris. Dijalankan sebelum faraid dan paling banyak sepertiga (KHI Pasal 195).`;
      case 'ibu':
        if (adaAnak) return 'Ibu mendapat 1/6 karena ' + almarhum + ' meninggalkan anak.' + aul + radd;
        if ((fam.saudara || 0) >= 2) return 'Ibu mendapat 1/6 karena ada dua saudara atau lebih, walaupun saudara itu sendiri tidak mewarisi.' + aul + radd;
        if (flags.has('gharrawain')) return 'Ibu mendapat sepertiga dari sisa setelah bagian ' + (fam.laki ? 'istri' : 'suami') + ', agar bagian ayah tetap dua kali bagian ibu (gharrawain).';
        return 'Ibu mendapat 1/3 karena tidak ada anak dan saudara kurang dari dua.' + aul + radd;
      case 'ayah':
        if (fam.putra) return 'Ayah mendapat 1/6 karena ' + almarhum + ' meninggalkan anak laki-laki.' + aul;
        if (fam.putri) return 'Ayah mendapat 1/6, ditambah sisa harta karena anak ' + almarhum + ' hanya perempuan.' + aul;
        return 'Ayah menerima sisa harta setelah bagian pasti dibagikan, karena tidak ada anak.' + aul;
      case 'putra':
        return fam.putri ? 'Anak laki-laki menerima sisa setelah bagian pasti dibagikan, dua kali bagian anak perempuan.' : `Anak laki-laki menerima seluruh sisa setelah bagian pasti dibagikan${fam.putra > 1 ? ', dibagi rata' : ''}.`;
      case 'putri':
        if (fam.putra) return 'Bersama saudara laki-lakinya, anak perempuan menerima sisa dengan perbandingan 2 : 1.';
        if (fam.putri === 1) return 'Anak perempuan seorang diri, tanpa saudara laki-laki, mendapat 1/2.' + aul + radd;
        return 'Dua anak perempuan atau lebih, tanpa saudara laki-laki, berbagi 2/3 sama rata.' + aul + radd;
    }
    return '';
  }
  const CATATAN = {
    aul: 'Jumlah bagian pasti melebihi harta, jadi semua bagian dikecilkan sebanding sampai pas (ʻaul).',
    radd: 'Masih ada sisa dan tidak ada yang berhak atas sisa, jadi sisanya dikembalikan sebanding kepada penerima bagian pasti (radd).',
    raddPasangan: 'Mode KHI harfiah: sisa juga dikembalikan kepada pasangan.',
    gharrawain: 'Susunan ini dikenal sebagai gharrawain: ibu menerima sepertiga dari sisa, bukan sepertiga dari seluruh harta.',
  };

  /* ---------- format ---------- */
  const rp = (jt) => 'Rp' + Math.round(jt * 1e6).toLocaleString('id-ID');
  const jt = (n) => 'Rp' + (Math.round(n * 10) / 10).toLocaleString('id-ID') + ' jt';
  const jam = (t) => new Date(t).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/:/g, '.');
  const mmss = (s) => { s = Math.max(0, Math.ceil(s)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };

  return {
    F, add, sub, mul, div, str, faraid, bagi, Ditolak, GAYA, URUT,
    pewaris: { nama: 'Budi Santoso', alamat: '0x8b2c…5de2', laki: true },
    harta: 300, penerima, P, bidang, ALASAN, PERAN_PANJANG, saksi, DEMO_FAM,
    bidangKain, ringkas, kataPecahan, kalimatKeluarga, daftarKata, alasan, CATATAN, ANGKA,
    rp, jt, jam, mmss,
  };
})();
