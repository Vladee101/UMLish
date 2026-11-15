export function download(name: string, blob: Blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export const svgBlob = (svg: string) => new Blob([svg], { type: 'image/svg+xml' });

/** Rasterise an SVG string (which must embed its fonts) at `scale`x. Everything stays in the browser. */
export async function pngBlob(svg: string, scale = 2): Promise<Blob> {
  const m = /viewBox="[-\d.]+ [-\d.]+ ([\d.]+) ([\d.]+)"/.exec(svg);
  if (!m) throw new Error('SVG has no viewBox');
  const w = Math.ceil(Number(m[1]) * scale), h = Math.ceil(Number(m[2]) * scale);
  const url = URL.createObjectURL(svgBlob(svg));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d')!.drawImage(img, 0, 0, w, h);
    return await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('PNG encode failed'))), 'image/png'));
  } finally { URL.revokeObjectURL(url); }
}
