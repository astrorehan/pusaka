/* JSON yang bisa membawa bigint: 123n ditulis {"$b":"123"}. Dipakai browser dan server (tanpa dependensi). */
export const ke = (nilai) => JSON.stringify(nilai, (_, v) => (typeof v === 'bigint' ? { $b: v.toString() } : v));

export const dari = (teks) =>
  JSON.parse(teks, (_, v) =>
    v && typeof v === 'object' && !Array.isArray(v) && typeof v.$b === 'string' && Object.keys(v).length === 1 ? BigInt(v.$b) : v);
