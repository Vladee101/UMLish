/** Share links live in the URL hash, which browsers never send to a server. */
async function pipe(data: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const res = new Response(new Blob([data as BlobPart]).stream().pipeThrough(stream as ReadableWritablePair<Uint8Array, Uint8Array>));
  return new Uint8Array(await res.arrayBuffer());
}
const toB64u = (u: Uint8Array) => {
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64u = (s: string) => {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};

export async function encodeDoc(text: string): Promise<string> {
  return 'd=' + toB64u(await pipe(new TextEncoder().encode(text), new CompressionStream('deflate-raw')));
}

/** Returns undefined if the hash isn't ours or is corrupt. */
export async function decodeDoc(hash: string): Promise<string | undefined> {
  const m = /^#?d=([\w-]+)$/.exec(hash);
  if (!m) return undefined;
  try {
    return new TextDecoder().decode(await pipe(fromB64u(m[1]!), new DecompressionStream('deflate-raw')));
  } catch { return undefined; }
}
