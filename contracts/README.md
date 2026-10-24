# Pusaka · kontrak

Kontrak Solidity (Foundry, solc 0.8.30, EVM prague). Cara kerjanya dijelaskan di
[`../docs/arsitektur.md`](../docs/arsitektur.md); aturan faraid di [`../docs/faraid-spec.md`](../docs/faraid-spec.md).

| Kontrak | Isi |
|---|---|
| `FaraidLib`, `EstateLib` | Mesin faraid (pecahan eksak) dan urutan KHI: harta bersama → wasiat → faraid |
| `PusakaCore` | Aturan, saksi (`attestDeath`, `attestDeathFor`), bukti hidup (`heartbeat`, `checkIn`, aktivitas), pembagian, fungsi baca untuk layar |
| `PusakaWallet` | Dipasang di dompet pewaris lewat EIP-7702: `setup`, `execute` (transaksi biasa = bukti hidup), `cancelSetup`, ERC-1271 |
| `PusakaVault`, `PusakaFactory` | Model brankas (cadangan) dan kalkulator faraid on-chain |
| `MitraCair`, `RekeningVirtual` | Mitra pencairan: rekening virtual per rekening bank ahli waris (klon EIP-1167, CREATE2), penyapuan, pencairan amplop dengan izin EIP-2612, pencatatan transfer, pembakaran token |
| `MockIDR` | tIDR: rupiah mainan untuk testnet (ERC-20 + permit + burn + faucet) |

## Tes

```bash
forge build
forge test                  # semua tes
forge test --gas-report     # perkiraan gas per fungsi
```

Uji ujung ke ujung dengan transaksi sungguhan (EIP-7702, tanda tangan EIP-712, rekening virtual, pencairan):

```bash
anvil --network monad --block-time 1 --mixed-mining --code-size-limit 131072   # terminal 1
cd ../web && node scripts/e2e.mjs             # terminal 2 (RPC=http://127.0.0.1:8545 bawaan)
bash script/e2e-anvil.sh                      # alur model brankas dengan cast
```

## Deploy

Blockchain lokal (anvil), langsung menulis alamat ke `web/.env.local`:

```bash
cd ../web && node scripts/deploy-lokal.mjs     # RPC=… dan ENV_FILE=… bisa diganti
```

Monad testnet (dompet induk diimpor dulu dengan `cast wallet import <nama> --interactive`):

```bash
forge script script/Deploy.s.sol --rpc-url monad_testnet --account <nama> --broadcast --code-size-limit 131072   --gas-estimate-multiplier 120 --with-gas-price 110gwei --priority-gas-price 2gwei
```

Dengan `BRANKAS=false` (PowerShell: `$env:BRANKAS="false"`), skrip melewati `PusakaVault` + `PusakaFactory` dan
hanya men-deploy `MockIDR`, `PusakaWallet`, `MitraCair` (±12 jt gas, ±1,2 MON). Model dompet tidak membutuhkan
keduanya.

Skrip mencetak empat baris `VITE_TOKEN`, `VITE_FACTORY`, `VITE_WALLET`, `VITE_MITRA` untuk `web/.env.local`. Akun yang
men-deploy menjadi pemilik `MitraCair` (bisa menambah operator).
