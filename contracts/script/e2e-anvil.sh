#!/usr/bin/env bash
# Uji ujung ke ujung di blockchain lokal (anvil) dengan transaksi sungguhan:
#   deploy → pasang Pusaka di dompet pewaris lewat EIP-7702 → 2 saksi → masa sanggah → bagikan.
#
# Terminal 1:  anvil --hardfork prague
# Terminal 2:  bash script/e2e-anvil.sh      (dari folder contracts)
#
# Kasus demo: Rp300 jt, seluruhnya harta bersama, wakaf masjid 1/5, keluarga K01.
set -euo pipefail
cd "$(dirname "$0")/.."

RPC=${RPC:-http://127.0.0.1:8545}
# Akun bawaan anvil. Kuncinya publik dan hanya untuk blockchain lokal.
MN="test test test test test test test test test test test junk"
key() { cast wallet private-key --mnemonic "$MN" --mnemonic-index "$1" | tr -d '\r'; }
addr() { cast wallet address --private-key "$1" | tr -d '\r'; }
send() { cast send --rpc-url "$RPC" "$@" </dev/null >/dev/null; }
call() { cast call --rpc-url "$RPC" "$@" | tr -d '\r'; }

DEPLOYER_PK=$(key 0)
SAKSI1_PK=$(key 1)
SAKSI2_PK=$(key 2)
SAKSI1=$(addr "$SAKSI1_PK")
SAKSI2=$(addr "$SAKSI2_PK")
SAKSI3=$(addr "$(key 3)")

# Pewaris memakai dompet baru setiap kali skrip dijalankan, supaya skrip bisa diulang.
PEWARIS_PK=$(cast wallet new --json 2>/dev/null | grep -oE '"private_key":"0x[0-9a-fA-F]{64}"' | cut -d'"' -f4)
PEWARIS=$(addr "$PEWARIS_PK")

# Ahli waris dan masjid cukup punya alamat; mereka tidak perlu mengirim transaksi.
ISTRI=0x1000000000000000000000000000000000000001
ANAKLK1=0x1000000000000000000000000000000000000002
ANAKLK2=0x1000000000000000000000000000000000000003
ANAKPR=0x1000000000000000000000000000000000000004
AYAH=0x1000000000000000000000000000000000000005
IBU=0x1000000000000000000000000000000000000006
MASJID=0x1000000000000000000000000000000000000007

echo "1. Deploy kontrak"
OUT=$(forge script script/Deploy.s.sol --rpc-url "$RPC" --private-key "$DEPLOYER_PK" --broadcast 2>&1)
TOKEN=$(echo "$OUT" | grep -oE 'VITE_TOKEN=0x[0-9a-fA-F]{40}' | cut -d= -f2)
WALLET=$(echo "$OUT" | grep -oE 'VITE_WALLET=0x[0-9a-fA-F]{40}' | cut -d= -f2)
echo "   tIDR: $TOKEN · PusakaWallet: $WALLET"

echo "2. Dompet pewaris berisi gas dan Rp300 jt tIDR"
send "$PEWARIS" --value 1ether --private-key "$DEPLOYER_PK"
send "$TOKEN" 'faucet(address,uint256)' "$PEWARIS" 300000000ether --private-key "$DEPLOYER_PK"

echo "3. Pasang Pusaka di dompet pewaris: satu transaksi EIP-7702 dari dompet itu ke alamatnya sendiri"
SETUP='setup(address[],(address,uint8)[],address[],(address,(uint256,uint256))[],(bool,uint8,bool,bool,uint32,uint32,uint8,(uint256,uint256)))'
send "$PEWARIS" "$SETUP" \
  "[$TOKEN]" \
  "[($ISTRI,1),($ANAKLK1,2),($ANAKLK2,2),($ANAKPR,3),($AYAH,4),($IBU,5)]" \
  "[$SAKSI1,$SAKSI2,$SAKSI3]" \
  "[($MASJID,(1,5))]" \
  "(true,0,false,false,600,20,2,(1,1))" \
  --private-key "$PEWARIS_PK" --auth "$WALLET" --force # --force: lewati konfirmasi; khusus blockchain lokal
CODE=$(cast code "$PEWARIS" --rpc-url "$RPC" | tr -d '\r')
[ "$CODE" = "$(echo "0xef0100${WALLET#0x}" | tr 'A-F' 'a-f')" ] || { echo "   ✗ delegasi tidak terpasang (kode: $CODE)"; exit 1; }
echo "   kode dompet: $CODE  (0xef0100 + alamat PusakaWallet)"
echo "   tIDR masih di dompet pewaris: $(cast from-wei "$(call "$TOKEN" 'balanceOf(address)(uint256)' "$PEWARIS" | cut -d' ' -f1)")"

echo "4. Dua saksi mengonfirmasi wafat"
AKTA=$(cast keccak "akta-kematian.pdf" | tr -d '\r')
send "$PEWARIS" 'attestDeath(bytes32)' "$AKTA" --private-key "$SAKSI1_PK"
send "$PEWARIS" 'attestDeath(bytes32)' "$AKTA" --private-key "$SAKSI2_PK"
STATUS=$(call "$PEWARIS" 'status()(uint8)')
[ "$STATUS" = "2" ] || { echo "   ✗ status $STATUS, seharusnya 2 (DIPICU)"; exit 1; }
echo "   status: DIPICU"

echo "5. Masa sanggah 20 detik berlalu"
cast rpc evm_increaseTime 21 --rpc-url "$RPC" >/dev/null
cast rpc evm_mine --rpc-url "$RPC" >/dev/null

echo "6. Siapa pun menekan Bagikan"
send "$PEWARIS" 'finalize()' --private-key "$DEPLOYER_PK"

echo "7. Hasil:"
FAIL=0
expect() {
  local got want
  got=$(call "$TOKEN" 'balanceOf(address)(uint256)' "$2" | cut -d' ' -f1)
  want=$(cast to-wei "$3" | tr -d '\r')
  if [ "$got" = "$want" ]; then
    printf '   ✓ %-28s Rp%s jt\n' "$1" "$(( $3 / 1000000 ))"
  else
    printf '   ✗ %-28s dapat %s, seharusnya %s\n' "$1" "$(cast from-wei "$got")" "$3"
    FAIL=1
  fi
}
expect "Istri (150 bersama + 15)" "$ISTRI" 165000000
expect "Wakaf masjid" "$MASJID" 30000000
expect "Anak laki-laki 1" "$ANAKLK1" 26000000
expect "Anak laki-laki 2" "$ANAKLK2" 26000000
expect "Anak perempuan" "$ANAKPR" 13000000
expect "Ayah" "$AYAH" 20000000
expect "Ibu" "$IBU" 20000000
expect "Sisa di dompet pewaris" "$PEWARIS" 0

if [ "$FAIL" = 0 ]; then echo "LULUS"; else echo "GAGAL"; exit 1; fi
