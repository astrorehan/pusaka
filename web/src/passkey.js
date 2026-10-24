/* Passkey (WebAuthn, kurva P-256) untuk kabar hidup dengan sidik jari atau wajah.
   Kunci privatnya tidak pernah keluar dari HP atau laptop. Kontrak hanya menyimpan kunci publiknya (aturPasskey) dan
   memeriksa tanda tangannya (checkInPasskey); di Monad pemeriksaan itu memakai precompile P-256 sehingga murah. */
import { bytesToHex, hexToBytes } from 'viem';

const N = 0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551n;
const keB64url = (u8) => btoa(String.fromCharCode(...u8)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const dariB64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));

/* Browser ini bisa membuat passkey dengan sidik jari, wajah, atau PIN perangkat. */
export async function didukung() {
  try {
    return !!window.PublicKeyCredential && window.isSecureContext
      && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch { return false; }
}

/* Membuat passkey baru. Hasil: { id (base64url), x, y } dengan x, y kunci publik P-256 (hex 32 byte). */
export async function buat({ nama, pengenal }) {
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: 'Pusaka', id: location.hostname },
      user: { id: hexToBytes(pengenal).slice(0, 16), name: nama, displayName: nama },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }], // ES256 = P-256
      authenticatorSelection: { userVerification: 'required', residentKey: 'preferred' },
      attestation: 'none',
      timeout: 60_000,
    },
  });
  if (!cred) throw new Error('Pembuatan passkey dibatalkan.');
  // getPublicKey() memberi SubjectPublicKeyInfo (DER); untuk P-256, 65 byte terakhir = 0x04 || x || y.
  const spki = cred.response.getPublicKey ? new Uint8Array(cred.response.getPublicKey()) : null;
  if (!spki || spki.length < 65 || spki[spki.length - 65] !== 4) throw new Error('Kunci publik passkey tidak terbaca di browser ini.');
  const titik = spki.slice(-65);
  return { id: keB64url(new Uint8Array(cred.rawId)), x: bytesToHex(titik.slice(1, 33)), y: bytesToHex(titik.slice(33)) };
}

/* Tanda tangan WebAuthn berformat DER (SEQUENCE { INTEGER r, INTEGER s }) → r, s 32 byte. s dibuat rendah (n - s),
   karena kontrak menolak s tinggi. */
export function dariDer(der) {
  let i = der[1] & 0x80 ? 2 + (der[1] & 0x7f) : 2;
  const bilangan = () => {
    if (der[i] !== 0x02) throw new Error('Tanda tangan passkey tidak dikenali.');
    const n = der[i + 1];
    const v = der.slice(i + 2, i + 2 + n);
    i += 2 + n;
    return BigInt(bytesToHex(v));
  };
  const r = bilangan();
  let s = bilangan();
  if (s > N / 2n) s = N - s;
  const hex32 = (x) => '0x' + x.toString(16).padStart(64, '0');
  return { r: hex32(r), s: hex32(s) };
}

/* Menandatangani `challengeHex` (digest EIP-712 KabarHidup) dengan passkey `id`. Hasilnya langsung menjadi argumen
   `auth` untuk checkInPasskey(waktu, auth). */
export async function tandatangani(id, challengeHex) {
  const a = await navigator.credentials.get({
    publicKey: {
      challenge: hexToBytes(challengeHex),
      allowCredentials: [{ type: 'public-key', id: dariB64url(id) }],
      userVerification: 'required',
      rpId: location.hostname,
      timeout: 60_000,
    },
  });
  if (!a) throw new Error('Tanda tangan passkey dibatalkan.');
  const json = new TextDecoder().decode(a.response.clientDataJSON);
  const { r, s } = dariDer(new Uint8Array(a.response.signature));
  return {
    authenticatorData: bytesToHex(new Uint8Array(a.response.authenticatorData)),
    clientDataJSON: json,
    challengeIndex: BigInt(json.indexOf('"challenge":"')),
    typeIndex: BigInt(json.indexOf('"type":"webauthn.get"')),
    r,
    s,
  };
}
