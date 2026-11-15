import regular from './fonts/LiberationSans-Regular.woff?inline';
import bold from './fonts/LiberationSans-Bold.woff?inline';

const face = (weight: number, url: string) =>
  `@font-face{font-family:'Liberation Sans';font-weight:${weight};src:url(${url}) format('woff');}`;

/** Same CSS is used by the page and embedded in exported SVGs (an <img>-rendered SVG can't see page fonts). */
export const fontCss = face(400, regular) + face(700, bold);

/** Install the fonts in the page and wait until they are usable, so text measuring is accurate. */
export async function loadFonts(size: number): Promise<void> {
  const el = document.createElement('style');
  el.textContent = fontCss;
  document.head.appendChild(el);
  await Promise.all([
    document.fonts.load(`${size}px "Liberation Sans"`),
    document.fonts.load(`bold ${size}px "Liberation Sans"`),
  ]);
}
