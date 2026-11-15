import type { ArrowHead } from './parser/ast.ts';
import type { Scene, Shape } from './layout.ts';
import { css, type Theme } from './theme.ts';
import { inlineSpans } from './richText.ts';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const r1 = (n: number) => Math.round(n * 100) / 100;

export function renderSvg(scene: Scene, th: Theme, opts: { fontCss?: string } = {}): string {
  const { color: C, stroke: W, size: S, font: F } = th;
  const base = F.lineHeight / 2 + F.size * 0.35; // baseline offset within a text row
  const out: string[] = [];

  const text = (ls: string[], x: number, top: number, o: { anchor?: string; bold?: boolean; prefix?: string; cls?: string } = {}) => {
    ls.forEach((l, k) => {
      const pre = k === 0 && o.prefix ? `<tspan font-weight="bold">${esc(o.prefix)}</tspan> ` : '';
      const content = inlineSpans(l).map((s) => {
        if (!s.bold && !s.italic && !s.color) return esc(s.text);
        const attrs = `${s.bold ? ' font-weight="bold"' : ''}${s.italic ? ' font-style="italic"' : ''}${s.color ? ` fill="${esc(s.color)}"` : ''}`;
        return `<tspan${attrs}>${esc(s.text)}</tspan>`;
      }).join('');
      out.push(`<text x="${r1(x)}" y="${r1(top + k * F.lineHeight + base)}"${o.anchor ? ` text-anchor="${o.anchor}"` : ''}${o.bold ? ' font-weight="bold"' : ''} xml:space="preserve">${pre}${content}</text>`);
    });
    if (o.prefix && !ls.length) out.push(`<text x="${r1(x)}" y="${r1(top + base)}" font-weight="bold">${esc(o.prefix)}</text>`);
  };
  const line = (x1: number, y1: number, x2: number, y2: number, stroke: string, w: number, dash?: string) =>
    out.push(`<line x1="${r1(x1)}" y1="${r1(y1)}" x2="${r1(x2)}" y2="${r1(y2)}" stroke="${stroke}" stroke-width="${w}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`);

  const head = (h: ArrowHead, x: number, y: number, d: number, c: string) => {
    const p = (pts: [number, number][]) => pts.map(([a, b]) => `${r1(a)},${r1(b)}`).join(' ');
    switch (h) {
      case 'filled': out.push(`<polygon points="${p([[x - 10 * d, y - 4], [x, y], [x - 10 * d, y + 4], [x - 6 * d, y]])}" fill="${c}" stroke="${c}" stroke-width="1"/>`); break;
      case 'open': out.push(`<polyline points="${p([[x - 10 * d, y - 4], [x, y], [x - 10 * d, y + 4]])}" fill="none" stroke="${c}" stroke-width="1"/>`); break;
      case 'half-filled': out.push(`<polygon points="${p([[x - 10 * d, y - 4], [x, y], [x - 6 * d, y]])}" fill="${c}" stroke="${c}" stroke-width="1"/>`); break;
      case 'half-open': out.push(`<polyline points="${p([[x - 10 * d, y - 4], [x, y]])}" fill="none" stroke="${c}" stroke-width="1"/>`); break;
      case 'cross': line(x - 8 * d, y - 4, x, y + 4, c, 1.5); line(x - 8 * d, y + 4, x, y - 4, c, 1.5); break;
      case 'circle': out.push(`<circle cx="${r1(x - 4 * d)}" cy="${r1(y)}" r="4" fill="none" stroke="${c}"/>`); break;
      case 'none': break;
    }
  };

  const icon = (s: Extract<Shape, { t: 'participant' }>) => {
    const cx = s.x + s.w / 2, y = s.y, fill = s.p.color ? css(s.p.color) : C.boxFill;
    const sk = `fill="${fill}" stroke="${C.boxStroke}" stroke-width="${W.box}"`;
    const nf = `fill="none" stroke="${C.boxStroke}" stroke-width="${W.box}"`;
    switch (s.p.kind) {
      case 'actor':
        out.push(`<circle cx="${r1(cx)}" cy="${y + 9}" r="8" ${sk}/>`);
        line(cx, y + 17, cx, y + 30, C.boxStroke, W.box); line(cx - 13, y + 22, cx + 13, y + 22, C.boxStroke, W.box);
        line(cx, y + 30, cx - 13, y + 38, C.boxStroke, W.box); line(cx, y + 30, cx + 13, y + 38, C.boxStroke, W.box);
        break;
      case 'database':
        out.push(`<path d="M${r1(cx - 15)},${y + 6} a15,6 0 0 1 30,0 v24 a15,6 0 0 1 -30,0 z" ${sk}/>`);
        out.push(`<path d="M${r1(cx - 15)},${y + 6} a15,6 0 0 0 30,0" ${nf}/>`);
        break;
      case 'boundary':
        out.push(`<circle cx="${r1(cx + 4)}" cy="${y + 17}" r="11" ${sk}/>`);
        line(cx - 14, y + 6, cx - 14, y + 28, C.boxStroke, W.box); line(cx - 14, y + 17, cx - 7, y + 17, C.boxStroke, W.box);
        break;
      case 'control':
        out.push(`<circle cx="${r1(cx)}" cy="${y + 19}" r="11" ${sk}/>`);
        out.push(`<polygon points="${r1(cx - 3)},${y + 4} ${r1(cx + 3)},${y + 8} ${r1(cx - 3)},${y + 12}" fill="${C.boxStroke}"/>`);
        break;
      case 'entity':
        out.push(`<circle cx="${r1(cx)}" cy="${y + 16}" r="11" ${sk}/>`);
        line(cx - 11, y + 30, cx + 11, y + 30, C.boxStroke, W.box);
        break;
    }
    text(s.lines, cx, y + S.iconH + 4, { anchor: 'middle' });
  };

  const shape = (s: Shape) => {
    const d = ` data-line="${'line' in s ? s.line : ''}"`;
    switch (s.t) {
      case 'group':
        out.push(`<g><rect x="${r1(s.x)}" y="${r1(s.y)}" width="${r1(s.w)}" height="${r1(s.h)}" fill="${s.color ? css(s.color) : C.groupFill}" stroke="#000" stroke-width="1"/>`);
        text([s.name], s.x + s.w / 2, s.y + 1, { anchor: 'middle', bold: true });
        out.push('</g>');
        break;
      case 'lifeline': line(s.x, s.y1, s.x, s.y2, C.lifeline, W.lifeline, s.dotted ? '1,3' : '5,5'); break;
      case 'activation':
        out.push(`<rect x="${r1(s.x)}" y="${r1(s.y1)}" width="${S.actW}" height="${r1(s.y2 - s.y1)}" fill="${s.color ? css(s.color) : C.barFill}" stroke="${C.barStroke}" stroke-width="${W.line}"/>`);
        break;
      case 'destroy':
        line(s.x - 9, s.y - 9, s.x + 9, s.y + 9, C.line, 2); line(s.x - 9, s.y + 9, s.x + 9, s.y - 9, C.line, 2);
        break;
      case 'participant': {
        out.push(`<g${d}>`);
        if (['participant', 'collections', 'queue'].includes(s.p.kind)) {
          const fill = s.p.color ? css(s.p.color) : C.boxFill;
          const rx = s.p.kind === 'queue' ? s.h / 2 : S.boxRadius;
          if (s.p.kind === 'collections') out.push(`<rect x="${r1(s.x + 3)}" y="${r1(s.y - 3)}" width="${r1(s.w)}" height="${r1(s.h)}" rx="${rx}" fill="${fill}" stroke="${C.boxStroke}" stroke-width="${W.box}"/>`);
          out.push(`<rect x="${r1(s.x)}" y="${r1(s.y)}" width="${r1(s.w)}" height="${r1(s.h)}" rx="${rx}" fill="${fill}" stroke="${C.boxStroke}" stroke-width="${W.box}"/>`);
          text(s.lines, s.x + s.w / 2, s.y + S.boxPadY, { anchor: 'middle' });
        } else icon(s);
        out.push('</g>');
        break;
      }
      case 'message': {
        const c = s.color ? css(s.color) : C.line, dash = s.dashed ? '2,2' : undefined;
        out.push(`<g${d}>`);
        const labelTop = s.y - S.labelGap - Math.max(1, s.lines.length) * F.lineHeight;
        if (s.self) {
          out.push(`<path d="M${r1(s.x1)},${r1(s.y)} h${S.selfW} v${S.selfH} h${-S.selfW}" fill="none" stroke="${c}" stroke-width="${W.line}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`);
          head(s.endHead, s.x1, s.y + S.selfH, -1, c);
          text(s.lines, s.x1 + 7, labelTop, { ...(s.prefix ? { prefix: s.prefix } : {}) });
        } else {
          const dir = s.x2 >= s.x1 ? 1 : -1;
          line(s.x1, s.y, s.x2, s.y, c, W.line, dash);
          head(s.endHead, s.x2, s.y, dir, c);
          head(s.startHead, s.x1, s.y, -dir, c);
          text(s.lines, Math.min(s.x1, s.x2) + 7, labelTop, { ...(s.prefix ? { prefix: s.prefix } : {}) });
        }
        out.push('</g>');
        break;
      }
      case 'note': {
        const x = s.x, y = s.y, w = s.w, h = s.h, f = S.noteFold, fill = s.color ? css(s.color) : C.noteFill;
        const st = `fill="${fill}" stroke="${C.noteStroke}" stroke-width="1"`;
        out.push(`<g${d}>`);
        if (s.shape === 'hnote') out.push(`<polygon points="${r1(x + 8)},${y} ${r1(x + w - 8)},${y} ${r1(x + w)},${r1(y + h / 2)} ${r1(x + w - 8)},${r1(y + h)} ${r1(x + 8)},${r1(y + h)} ${r1(x)},${r1(y + h / 2)}" ${st}/>`);
        else if (s.shape === 'rnote') out.push(`<rect x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}" ${st}/>`);
        else {
          out.push(`<polygon points="${r1(x)},${y} ${r1(x + w - f)},${y} ${r1(x + w)},${r1(y + f)} ${r1(x + w)},${r1(y + h)} ${r1(x)},${r1(y + h)}" ${st}/>`);
          out.push(`<path d="M${r1(x + w - f)},${y} v${f} h${f}" fill="none" stroke="${C.noteStroke}" stroke-width="1"/>`);
        }
        text(s.lines, x + S.notePadX, y + S.notePadY);
        out.push('</g>');
        break;
      }
      case 'ref': {
        out.push(`<g${d}><rect x="${r1(s.x)}" y="${r1(s.y)}" width="${r1(s.w)}" height="${r1(s.h)}" fill="none" stroke="${C.fragStroke}" stroke-width="${W.frag}"/>`);
        out.push(`<polygon points="${r1(s.x)},${r1(s.y)} ${r1(s.x + 30)},${r1(s.y)} ${r1(s.x + 30)},${r1(s.y + 11)} ${r1(s.x + 24)},${r1(s.y + 17)} ${r1(s.x)},${r1(s.y + 17)}" fill="${C.tabFill}" stroke="${C.fragStroke}" stroke-width="1"/>`);
        text(['ref'], s.x + 6, s.y + 1, { bold: true });
        text(s.lines, s.x + s.w / 2, s.y + 12, { anchor: 'middle' });
        out.push('</g>');
        break;
      }
      case 'fragment': {
        const th_ = S.tabH - 4;
        out.push(`<g${d}><rect x="${r1(s.x)}" y="${r1(s.y)}" width="${r1(s.w)}" height="${r1(s.h)}" fill="none" stroke="${C.fragStroke}" stroke-width="${W.frag}"/>`);
        out.push(`<polygon points="${r1(s.x)},${r1(s.y)} ${r1(s.x + s.tabW)},${r1(s.y)} ${r1(s.x + s.tabW)},${r1(s.y + th_ - 6)} ${r1(s.x + s.tabW - 6)},${r1(s.y + th_)} ${r1(s.x)},${r1(s.y + th_)}" fill="${C.tabFill}" stroke="${C.fragStroke}" stroke-width="1"/>`);
        text([s.kind], s.x + 8, s.y + (th_ - F.lineHeight) / 2, { bold: true });
        if (s.label) text([`[${s.label}]`], s.x + s.tabW + 8, s.y + (th_ - F.lineHeight) / 2, { bold: true });
        for (const dv of s.dividers) {
          line(s.x, dv.y, s.x + s.w, dv.y, C.fragStroke, 1, '2,2');
          if (dv.label) text([`[${dv.label}]`], s.x + 8, dv.y + 2, { bold: true });
        }
        out.push('</g>');
        break;
      }
      case 'divider': {
        const cy = s.y + s.h / 2, cxm = (s.x1 + s.x2) / 2;
        out.push(`<g${d}>`);
        line(s.x1, cy - 2, s.x2, cy - 2, '#000', 1); line(s.x1, cy + 2, s.x2, cy + 2, '#000', 1);
        out.push(`<rect x="${r1(cxm - s.w / 2)}" y="${r1(s.y + 4)}" width="${r1(s.w)}" height="${s.h - 8}" fill="${C.tabFill}" stroke="#000" stroke-width="1.5"/>`);
        text([s.text], cxm, s.y + (s.h - F.lineHeight) / 2, { anchor: 'middle', bold: true });
        out.push('</g>');
        break;
      }
      case 'delay':
        if (s.text) {
          out.push(`<rect x="${r1(s.x - s.w / 2)}" y="${r1(s.y + (s.h - F.lineHeight) / 2)}" width="${r1(s.w)}" height="${F.lineHeight}" fill="${C.bg}"/>`);
          text([s.text], s.x, s.y + (s.h - F.lineHeight) / 2, { anchor: 'middle' });
        }
        break;
    }
  };

  const vb = scene.viewBox, cxm = vb.x + vb.w / 2;
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${r1(vb.x)} ${r1(vb.y)} ${r1(vb.w)} ${r1(vb.h)}" width="${r1(vb.w)}" height="${r1(vb.h)}" font-family="${esc(F.family)}" font-size="${F.size}" fill="${C.text}">`);
  if (opts.fontCss) out.push(`<defs><style>${opts.fontCss}</style></defs>`);
  out.push(`<rect x="${r1(vb.x)}" y="0" width="${r1(vb.w)}" height="${r1(vb.h)}" fill="${C.bg}"/>`);
  if (scene.title) text(scene.title.lines, cxm, scene.title.y, { anchor: 'middle', bold: true });
  if (scene.header) text(scene.header.lines, vb.x + vb.w - th.size.margin, scene.header.y, { anchor: 'end' });
  for (const s of scene.shapes) shape(s);
  if (scene.footer) text(scene.footer.lines, cxm, scene.footer.y, { anchor: 'middle' });
  out.push('</svg>');
  return out.join('\n');
}
