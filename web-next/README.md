# Pusaka · web-next

Versi Next.js (App Router) dari `web/`. Tampilan dan perilaku sama; bedanya kunci dompet induk hanya ada di server
(`app/api/induk/route.js` membungkus `relayer/inti.js`).

## Struktur

| Jalur | Isi |
|---|---|
| `app/<layar>/page.js` | Markup tiap layar (JSX hasil konversi dari `web/*.html`), tanpa logika |
| `lib/halaman/<layar>.js` | Skrip inline tiap layar, dipindah apa adanya; dijalankan `components/Halaman.js` setelah markup terpasang |
| `styles/<layar>.css` | `<style>` tiap layar. CSS bersama (`tokens`, `base`, `fonts`) diimpor langsung dari `web/assets` |
| `app/api/induk/route.js` | Relayer: GET `info()`, POST `tangani()` (lihat `docs/relayer-api.md`) |
| `lib/env.js` | Pengganti `web/src/env.js`: kunci `VITE_*` diisi dari `NEXT_PUBLIC_*` |
| `lib/web-loader.cjs` | Loader webpack: mengalihkan `web/src/env.js` ke `lib/env.js` |
| `public/` | Salinan `web/public` (`pembuka.js` sedikit berbeda: lapisan dipasang di `<html>`, bukan `<body>`, supaya hidrasi React tidak gagal) |

Kode bersama dipakai langsung, tidak disalin: `../web/src/*` (alias `@web`), `../web/assets/*`, `../relayer/*`.

Alamat kanonik tetap `*.html` (`/pewaris.html`, `/waris.html?id=...`) karena `web/src/demo.js` mencocokkan
`location.pathname` dengan `….html` (operator mitra) dan membuat tautan QR dengan `waris.html`. `/pewaris` dialihkan
ke `/pewaris.html`, dan `*.html` dipetakan ke route-nya (rewrite) di `next.config.mjs`. RPC anvil lewat `/rpc` (rewrite ke anvil).

## Menjalankan lokal (anvil)

```bash
anvil --network monad --block-time 1 --mixed-mining --code-size-limit 131072
cd web && node scripts/deploy-lokal.mjs      # menulis web/.env.local, dibaca juga oleh web-next
cd ../web-next && npm install && npm run dev  # http://localhost:5182
```

Produksi lokal: `npm run build && npm start`.

## Deploy ke Vercel

Project Vercel terpisah dari yang untuk `web/`:

- **Root Directory**: `web-next`. Nyalakan **Include source files outside of the Root Directory in the Build Step**
  (Settings > General > Root Directory), karena build memakai `../web/src`, `../web/assets` dan `../relayer`.
- Framework: Next.js (otomatis). Install: `npm install` (di `web-next`; `viem`, `gsap`, `qrcode-generator` cukup terpasang di sini).
- **Environment Variables**: lihat `.env.example`. Wajib: `INDUK_KEY`, `RPC_URL`, `CHAIN_ID=10143`, `TOKEN`, `WALLET`,
  `MITRA`, `NEXT_PUBLIC_PUBLIC_URL`. Opsional: `GAS_MON`, `GAS_AMPLOP`, `FACTORY`, `NEXT_PUBLIC_RPC`.
  `INDUK_KEY` jangan diberi awalan `NEXT_PUBLIC_`.
- Variabel diisi sebelum build: alamat kontrak dan `NEXT_PUBLIC_*` ditanam saat build.
