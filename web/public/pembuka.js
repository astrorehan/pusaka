/* Layar pembuka: logo kawung besar, kelopak putih bercahaya, selama layar membaca kontrak.
   Dimuat biasa (bukan modul) di <head> agar tampil sejak gambar pertama. boot.js menutupnya lewat PembukaPusaka.tutup():
   logo mengecil dan terbang ke logo di kepala halaman, lalu lapisannya memudar. */
(function () {
  var d = document.documentElement;
  if (/[?&]diam=1/.test(location.search)) { window.PembukaPusaka = { tutup: function () {} }; return; }

  var KELOPAK = [
    ['M7.585 7.585A5.2 3.4 45 0 1 14.939 14.939A5.2 3.4 45 0 1 7.585 7.585Z', 0],
    ['M24.415 7.585A5.2 3.4 -45 0 0 17.061 14.939A5.2 3.4 -45 0 0 24.415 7.585Z', 1],
    ['M24.415 24.415A5.2 3.4 45 0 1 17.061 17.061A5.2 3.4 45 0 1 24.415 24.415Z', 2],
    ['M7.585 24.415A5.2 3.4 -45 0 0 14.939 17.061A5.2 3.4 -45 0 0 7.585 24.415Z', 3],
  ];
  var pernah = false;
  try { pernah = sessionStorage.getItem('pusaka-pembuka') === '1'; sessionStorage.setItem('pusaka-pembuka', '1'); } catch (e) {}
  var hening = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Kunjungan pertama: biarkan kelopak mekar penuh. Berikutnya: hanya selama kontrak dibaca.
  var MIN = pernah ? 0 : 1500;
  var t0 = performance.now();

  var el = document.createElement('div');
  el.className = 'pembuka-muat' + (pernah ? ' cepat' : '');
  el.setAttribute('role', 'status');
  el.setAttribute('aria-label', 'Memuat Pusaka');
  el.innerHTML =
    '<div class="pm-pusat"><div class="pm-cahaya"></div><div class="pm-cincin"></div>' +
    '<svg class="pm-logo" viewBox="6.6 6.6 18.8 18.8" aria-hidden="true"><defs>' +
    '<filter id="pmCahaya" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation=".75" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>' +
    '<g class="pm-kelopak">' +
    KELOPAK.map(function (k) { return '<path class="pm-k" style="--k:' + k[1] + '" d="' + k[0] + '"/>'; }).join('') +
    '</g><circle class="pm-titik" cx="16" cy="16" r="1.2"/></svg></div>' +
    '<p class="pm-teks"><b>Pusaka</b><span>Membaca aturan dari kontrak</span></p>';
  d.classList.add('memuat');

  var pasang = function () { if (document.body && !el.isConnected) document.body.prepend(el); };
  if (document.body) pasang();
  else new MutationObserver(function (m, o) { if (document.body) { o.disconnect(); pasang(); } }).observe(d, { childList: true });

  var selesai = false;
  function tutup() {
    if (selesai) return;
    selesai = true;
    setTimeout(function () {
      pasang();
      var pusat = el.querySelector('.pm-pusat');
      var tujuan = document.querySelector('.merek svg.logo');
      if (tujuan && !hening) {
        var a = pusat.getBoundingClientRect(), b = tujuan.getBoundingClientRect();
        if (b.width && b.bottom > 0 && b.top < innerHeight) {
          var s = b.width / a.width;
          var dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
          pusat.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(' + s + ')';
        }
      }
      el.classList.add('tutup');
      setTimeout(function () { el.remove(); d.classList.remove('memuat'); }, hening ? 0 : 820);
    }, Math.max(0, MIN - (performance.now() - t0)));
  }
  // Jaring pengaman: jika layar gagal dimuat, lapisan tetap pergi.
  setTimeout(tutup, 15000);
  window.PembukaPusaka = { tutup: tutup };
})();
