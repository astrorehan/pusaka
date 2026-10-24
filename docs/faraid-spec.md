# Spesifikasi Mesin Faraid Pusaka

> Dokumen ini adalah spesifikasi teknis untuk `FaraidLib`, bagian kontrak yang menghitung pembagian waris.
> **Bukan fatwa dan bukan nasihat hukum.** Semua aturan dan kasus uji di sini wajib divalidasi ahli faraid
> sebelum dipakai untuk harta sungguhan (daftar pertanyaan ada di [bagian 9](#9-daftar-pertanyaan-untuk-ahli)).

Dokumen induk: [`PRD.md`](PRD.md)

---

## 1. Dasar hukum dan pendekatan

Rujukan utama adalah **Kompilasi Hukum Islam (KHI)** Buku II tentang Kewarisan (Inpres No. 1 Tahun 1991), yang dipakai
Pengadilan Agama. Ada dua titik di mana KHI ditafsirkan berbeda-beda. Untuk keduanya Pusaka mengambil keputusan
yang tertulis jelas:

| Topik | Masalahnya | Keputusan Pusaka |
|---|---|---|
| **Bagian ayah jika tidak ada anak** (Pasal 177) | Bunyi pasal: ayah 1/3 jika pewaris tidak meninggalkan anak. SEMA No. 2 Tahun 1994 mempersempitnya: 1/3 hanya jika pewaris meninggalkan suami dan ibu. Fikih jumhur (mayoritas ulama): ayah menerima **sisa** (*'ashabah*). | Ikut jumhur: ayah = *'ashabah* jika tidak ada anak. Untuk kasus suami + ayah + ibu, hasilnya sama persis dengan SEMA 2/1994 (lihat K08). |
| **Radd untuk suami/istri** (Pasal 193) | Bunyi pasal tidak mengecualikan suami/istri. Jumhur ulama mengecualikan. Putusan pengadilan berbeda-beda. | Dua mode lewat konfigurasi `raddToSpouse` (bagian 6). Default: **jumhur** (`false`). |

Pasal yang dipakai (ringkasan; cocokkan dengan naskah resmi):

| Pasal | Isi ringkas | Dipakai di |
|---|---|---|
| 174 ayat (2) | Jika semua ahli waris ada, yang mewarisi hanya anak, ayah, ibu, dan janda/duda | Cakupan MVP |
| 176 | Anak perempuan: 1/2 (seorang), 2/3 (dua atau lebih); bersama anak laki-laki 2 : 1 | Langkah 3 dan 6 |
| 177 + SEMA 2/1994 | Bagian ayah | Langkah 3 dan 6 |
| 178 | Ibu: 1/6 jika ada anak atau ≥ 2 saudara; 1/3 jika tidak; 1/3 dari sisa setelah bagian janda/duda bila bersama ayah | Langkah 3 |
| 179 | Duda (suami): 1/2; 1/4 jika ada anak | Langkah 3 |
| 180 | Janda (istri): 1/4; 1/8 jika ada anak. Jika istri lebih dari satu, bagian dibagi rata (fikih) | Langkah 3 dan 7 |
| 192 | *'Aul* | Langkah 5 |
| 193 | *Radd* | Langkah 6 |
| 96 ayat (1) | Separuh harta bersama untuk pasangan yang hidup lebih lama, dipisah sebelum waris | P1 (di luar MVP) |
| 195 | Wasiat di hadapan 2 saksi atau notaris; maksimal 1/3 kecuali semua ahli waris setuju | P1 |
| 183 | Perdamaian ahli waris (teks perlu dicek) | P2 |
| 185 | Ahli waris pengganti, mis. cucu dari anak yang wafat lebih dulu (teks perlu dicek) | Di luar cakupan |

---

## 2. Cakupan MVP

**Didukung sebagai penerima:** suami (maks. 1), istri (maks. 4), anak laki-laki, anak perempuan, ayah, ibu.
Ini persis "ahli waris inti" di Pasal 174 ayat (2).

**Saudara** tidak menerima bagian di MVP, tetapi jumlahnya tetap dimasukkan karena:
- ≥ 2 saudara mengurangi bagian ibu dari 1/3 menjadi 1/6, bahkan jika saudara itu sendiri terhalang ayah (K10);
- jika tidak ada anak laki-laki dan tidak ada ayah, saudara ikut mewarisi → kasus **ditolak** (belum didukung).

**Ditolak, `UnsupportedCase(kode)`:**

| Kode | Kondisi | Alasan |
|---|---|---|
| 1 | Masih ada sisa, tidak ada anak laki-laki, tidak ada ayah, dan ada saudara | Saudara ikut mewarisi |
| 2 | Hanya suami/istri, mode jumhur | Sisa seharusnya ke baitul mal |
| 3 | `otherRelatives = true` | Ada kerabat lain yang mungkin ikut mewarisi (cucu dari anak yang wafat lebih dulu, kakek/nenek jika ayah/ibu sudah wafat, dll.) |
| 4 | Tidak ada suami/istri, anak, ayah, maupun ibu | Tidak ada ahli waris inti |

**Tidak valid, `InvalidFamily(kode)`:**

| Kode | Kondisi |
|---|---|
| 1 | Pewaris laki-laki tetapi ada suami |
| 2 | Pewaris perempuan tetapi ada istri |
| 3 | Suami lebih dari 1 |
| 4 | Istri lebih dari 4 |

**Asumsi MVP:** semua ahli waris Muslim dan tidak terhalang (Pasal 172–173); tidak ada utang, wasiat, atau harta
bersama yang perlu dipisah; harta warisan = seluruh saldo brankas saat dibagikan.

---

## 3. Istilah singkat

| Istilah | Arti | Contoh |
|---|---|---|
| *Ashabul furud* | Ahli waris dengan bagian pasti: 1/2, 1/4, 1/8, 2/3, 1/3, 1/6 | Istri 1/8 jika ada anak |
| *'Ashabah* | Penerima **sisa** setelah bagian pasti diambil | Anak laki-laki; ayah jika tidak ada anak laki-laki |
| *Hajb* | Penghalang atau pengurang bagian | Adanya anak menurunkan bagian istri dari 1/4 ke 1/8 |
| *'Aul* | Total bagian pasti > 1 → semua bagian dikurangi secara proporsional | K04, K05 |
| *Radd* | Total < 1 dan tidak ada *'ashabah* → sisa dikembalikan proporsional | K06, K07 |
| *Gharrawain* / *'Umariyyatain* | Suami/istri + ayah + ibu tanpa anak → ibu mendapat 1/3 **dari sisa** setelah bagian pasangan | K08, K09 |

---

## 4. Input dan output

**Input** (struct `Family` + satu pengaturan):

| Field | Tipe | Arti |
|---|---|---|
| `deceasedMale` | bool | Jenis kelamin pewaris (menentukan suami atau istri) |
| `husband` | uint8 (0–1) | Jumlah suami |
| `wives` | uint8 (0–4) | Jumlah istri |
| `sons` | uint8 | Jumlah anak laki-laki |
| `daughters` | uint8 | Jumlah anak perempuan |
| `father` | bool | Ayah masih hidup |
| `mother` | bool | Ibu masih hidup |
| `siblings` | uint8 | Jumlah saudara yang masih hidup (semua jenis) |
| `otherRelatives` | bool | Ada kerabat lain yang mungkin ikut mewarisi |
| `raddToSpouse` | bool | Mode radd (bagian 6) |

**Output** (struct `Result`): bagian per orang untuk setiap peran, sebagai pecahan eksak `{num, den}`:
`husband`, `wifeEach`, `sonEach`, `daughterEach`, `father`, `mother`, plus `flags`:

| Bit | Nilai | Arti (untuk penjelasan di UI) |
|---|---|---|
| 0 | 1 | `AUL` |
| 1 | 2 | `RADD` |
| 2 | 4 | `RADD_KE_PASANGAN` |
| 3 | 8 | `GHARRAWAIN` |
| 4 | 16 | `AYAH_ASHABAH` (ayah menerima sisa) |

---

## 5. Algoritma

Kode semu, ditulis agar mudah dipindah ke Solidity. Semua angka adalah **pecahan eksak**.

```text
1. VALIDASI
   jika deceasedMale dan husband > 0         → InvalidFamily(1)
   jika tidak deceasedMale dan wives > 0     → InvalidFamily(2)
   jika husband > 1                          → InvalidFamily(3)
   jika wives > 4                            → InvalidFamily(4)
   jika otherRelatives                       → UnsupportedCase(3)
   jika tidak ada suami/istri/anak/ayah/ibu  → UnsupportedCase(4)

2. adaAnak = (sons + daughters) > 0

3. BAGIAN PASTI (furud)
   pasangan =  husband ? (adaAnak ? 1/4 : 1/2)
             : wives   ? (adaAnak ? 1/8 : 1/4)
             : 0
   ibu      =  tidak mother                      ? 0
             : adaAnak atau siblings >= 2        ? 1/6
             : father dan pasangan > 0           ? (1 − pasangan) × 1/3     ← gharrawain
             : 1/3
   ayahPasti   = father dan adaAnak ? 1/6 : 0
   ayahAshabah = father dan sons == 0             ← ayah ikut menerima sisa
   anakPrPasti = sons == 0 dan daughters == 1 ? 1/2
               : sons == 0 dan daughters >= 2 ? 2/3
               : 0

4. total = pasangan + ibu + ayahPasti + anakPrPasti

5. 'AUL
   jika total > 1:
       setiap bagian pasti = bagian pasti ÷ total ;  sisa = 0      (flag AUL)
   selain itu:
       sisa = 1 − total

6. SISA (jika sisa > 0), cek berurutan:
   a. sons > 0      → unit = sisa ÷ (2 × sons + daughters)
                       anak laki-laki masing-masing 2 unit, anak perempuan masing-masing 1 unit
   b. ayahAshabah   → ayah += sisa                                    (flag AYAH_ASHABAH)
   c. siblings > 0  → UnsupportedCase(1)                              ← saudara ikut mewarisi
   d. RADD:
        penerima = {ibu, ayah, anak perempuan} yang bagiannya > 0
        jika raddToSpouse dan pasangan > 0: tambahkan pasangan ke penerima
        jika penerima kosong → UnsupportedCase(2)
        setiap penerima += sisa × (bagiannya ÷ jumlah bagian semua penerima)   (flag RADD / RADD_KE_PASANGAN)

7. PER ORANG
   wifeEach     = pasangan ÷ wives                 (jika wives > 0)
   daughterEach = anakPrPasti ÷ daughters          (jika sons == 0)
   sonEach, daughterEach dari langkah 6a           (jika sons > 0)

8. INVARIAN (wajib dites)
   husband + wives × wifeEach + sons × sonEach + daughters × daughterEach + father + mother == 1
```

Catatan urutan:
- Ayah pada langkah 3 bisa punya bagian pasti 1/6 **dan** tetap menjadi *'ashabah* (jika hanya ada anak perempuan).
  Dalam kasus *'aul*, sisanya 0 sehingga ayah hanya mendapat 1/6 yang sudah dikurangi (K04, K05).
- Pada kasus *'aul* atau total tepat 1, saudara tidak mendapat apa-apa, jadi kasus itu **tidak** ditolak.

---

## 6. Mode radd

| Mode | `raddToSpouse` | Perilaku | Kasus contoh |
|---|---|---|---|
| **Jumhur** (default) | `false` | Sisa hanya dikembalikan ke ahli waris nasab (ibu, ayah, anak perempuan). Jika ahli waris hanya pasangan → ditolak (sisa ke baitul mal). | K07a, K12a, X1 |
| **KHI harfiah** | `true` | Sisa dikembalikan ke semua *ashabul furud*, termasuk suami/istri | K07b, K12b, K16 |

Pilihan ini disimpan di konfigurasi brankas saat dibuat, dan ditampilkan ke ahli waris agar transparan.

---

## 7. Representasi angka di kontrak

- Pecahan disimpan sebagai `{num, den}` (`uint256`). Setiap penjumlahan, perkalian, dan pembagian langsung disederhanakan
  dengan FPB (*gcd*). Penyebut di cakupan MVP kecil (paling besar ratusan), jadi aman dari *overflow*.
- Jumlah token per orang = `mulDiv(saldo, num, den)` (dibulatkan ke bawah). Sisa pembulatan (paling banyak beberapa
  *wei*) diberikan ke ahli waris pertama di daftar.
- **Jangan pakai desimal/persentase** untuk menghitung bagian. Contoh: 1/3 dalam basis poin = 3333, dan setelah dijumlah
  totalnya tidak lagi tepat 1.

---

## 8. Kasus uji

Semua angka di bawah dihitung ulang dengan skrip referensi berbasis pecahan eksak. Kolom "Rupiah" memakai contoh harta
yang dipilih agar hasilnya bulat. Notasi "×2" berarti ada dua orang, masing-masing menerima bagian yang tertulis.

### 8.1 Kasus yang harus berhasil

| ID | Pewaris | Ahli waris | Bagian per orang | Contoh harta | Rupiah per orang | Catatan |
|---|---|---|---|---|---|---|
| **K01** | Lk | istri, 2 anak lk, 1 anak pr, ayah, ibu | istri 1/8 · anak lk 13/60 ×2 · anak pr 13/120 · ayah 1/6 · ibu 1/6 | Rp120 jt | 15 jt · 26 jt ×2 · 13 jt · 20 jt · 20 jt | **Kasus demo** |
| K02 | Lk | 1 anak lk, 2 anak pr | anak lk 1/2 · anak pr 1/4 ×2 | Rp120 jt | 60 jt · 30 jt ×2 | Anak lk : pr = 2 : 1 |
| K03 | Lk | 1 anak pr, ayah, ibu | anak pr 1/2 · ayah 1/3 · ibu 1/6 | Rp120 jt | 60 jt · 40 jt · 20 jt | Ayah 1/6 + sisa |
| K04 | Pr | suami, 2 anak pr, ayah, ibu | suami 1/5 · anak pr 4/15 ×2 · ayah 2/15 · ibu 2/15 | Rp120 jt | 24 jt · 32 jt ×2 · 16 jt · 16 jt | *'Aul* 12 → 15 |
| K05 | Lk | istri, 2 anak pr, ayah, ibu | istri 1/9 · anak pr 8/27 ×2 · ayah 4/27 · ibu 4/27 | Rp135 jt | 15 jt · 40 jt ×2 · 20 jt · 20 jt | *'Aul* 24 → 27 (*Minbariyyah*) |
| K06 | Lk | 1 anak pr, ibu | anak pr 3/4 · ibu 1/4 | Rp120 jt | 90 jt · 30 jt | *Radd* |
| K07a | Lk | istri, 1 anak pr, ibu | istri 1/8 · anak pr 21/32 · ibu 7/32 | Rp128 jt | 16 jt · 84 jt · 28 jt | *Radd*, mode jumhur |
| K07b | Lk | sama dengan K07a | istri 3/19 · anak pr 12/19 · ibu 4/19 | Rp190 jt | 30 jt · 120 jt · 40 jt | *Radd*, mode KHI harfiah |
| K08 | Pr | suami, ayah, ibu | suami 1/2 · ayah 1/3 · ibu 1/6 | Rp120 jt | 60 jt · 40 jt · 20 jt | *Gharrawain*; sama dengan SEMA 2/1994 |
| K09 | Lk | istri, ayah, ibu | istri 1/4 · ayah 1/2 · ibu 1/4 | Rp120 jt | 30 jt · 60 jt · 30 jt | *Gharrawain* |
| K10 | Lk | ayah, ibu, 2 saudara | ayah 5/6 · ibu 1/6 | Rp120 jt | 100 jt · 20 jt | Saudara terhalang ayah, tetapi tetap mengurangi bagian ibu |
| K11 | Lk | ayah, ibu | ayah 2/3 · ibu 1/3 | Rp120 jt | 80 jt · 40 jt | Ayah *'ashabah* |
| K12a | Pr | suami, ibu | suami 1/2 · ibu 1/2 | Rp120 jt | 60 jt · 60 jt | *Radd* hanya ke ibu (jumhur) |
| K12b | Pr | suami, ibu | suami 3/5 · ibu 2/5 | Rp120 jt | 72 jt · 48 jt | *Radd* termasuk suami (KHI harfiah) |
| K13 | Lk | 2 istri, 1 anak lk | istri 1/16 ×2 · anak lk 7/8 | Rp160 jt | 10 jt ×2 · 140 jt | Dua istri berbagi 1/8 |
| K14 | Lk | ibu | ibu 1 | Rp120 jt | 120 jt | 1/3 + *radd* |
| K15 | Lk | 2 anak pr | anak pr 1/2 ×2 | Rp120 jt | 60 jt ×2 | 2/3 + *radd* |
| K16 | Lk | istri (mode KHI harfiah) | istri 1 | Rp120 jt | 120 jt | *Radd* ke pasangan |

Semua kasus dengan mode jumhur kecuali yang ditandai "KHI harfiah" (`raddToSpouse = true`).

### 8.2 Kasus yang harus ditolak

| ID | Pewaris | Input | Hasil yang diharapkan |
|---|---|---|---|
| X1 | Lk | istri saja, mode jumhur | `UnsupportedCase(2)` (sisa ke baitul mal) |
| X2 | Lk | istri + 1 saudara, tanpa anak/ayah | `UnsupportedCase(1)` (saudara ikut mewarisi) |
| X3 | Lk | suami + 1 anak lk | `InvalidFamily(1)` |
| X4 | Lk | 5 istri + 1 anak lk | `InvalidFamily(4)` |
| X5 | Lk | istri + 1 anak lk, `otherRelatives = true` | `UnsupportedCase(3)` |
| X6 | Lk | hanya 2 saudara | `UnsupportedCase(4)` (tidak ada ahli waris inti) |

Total: **24 kasus uji** (18 berhasil + 6 ditolak).

---

## 9. Daftar pertanyaan untuk ahli

Bawa tabel kasus uji di atas ke ahli faraid (misalnya dosen Fakultas Syariah dan Hukum UIN Sunan Kalijaga, atau ustaz yang
mengajar faraid), lalu tanyakan:

1. Apakah hasil K01–K16 benar menurut KHI dan praktik Pengadilan Agama?
2. Mode radd mana yang sebaiknya menjadi default: jumhur atau KHI harfiah?
3. Untuk ayah tanpa anak, apakah pendekatan *'ashabah* (jumhur, sejalan dengan SEMA 2/1994) sudah tepat?
4. Apakah ≥ 2 saudara tetap mengurangi bagian ibu meski saudara itu terhalang ayah (K10)?
5. Jika istri lebih dari satu, apakah bagian 1/8 atau 1/4 dibagi rata (K13)?
6. Apakah aset kripto di dompet pribadi perlu dipisah dulu sebagai harta bersama (Pasal 96)? Bagaimana cara menandainya?
7. Apakah konfirmasi 2 saksi + hash akta kematian + masa sanggah cukup sebagai pemicu pembagian, atau perlu penetapan ahli
   waris (dari Pengadilan Agama atau kelurahan)?
8. Kalimat disclaimer apa yang tepat untuk aplikasi seperti ini?

---

## 10. Sumber

- Hukumonline, "'Aul dan Rad": https://www.hukumonline.com/klinik/a/aul-dan-rad-lt59658753e1272
- Jurnal Islam Futura (UIN Ar-Raniry), "Ahli Waris Penerima Radd menurut KHI Pasal 193": https://jurnal.ar-raniry.ac.id/index.php/islamfutura/article/view/334
- Repositori UIN Antasari, kajian Pasal 177 KHI dan SEMA No. 2 Tahun 1994: https://idr.uin-antasari.ac.id/24871/3/ABSTRAK.pdf
- Hukumonline, pembagian waris Islam dan harta bersama (Pasal 96): https://www.hukumonline.com/klinik/a/pembagian-sesuai-waris-islam-lt5ed617dc73dec/
- Hukumonline, surat wasiat (Pasal 195): https://www.hukumonline.com/klinik/a/surat-wasiat-lt5de49ddbe7eae/
- Naskah resmi KHI (Inpres No. 1 Tahun 1991): gunakan salinan resmi untuk memeriksa bunyi pasal 174–193.
