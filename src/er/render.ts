import { css, type Theme } from '../theme.ts';
import type { ErScene } from './layout.ts';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const r1 = (n: number) => Math.round(n * 100) / 100;

export function renderErSvg(scene: ErScene, th: Theme, opts: { fontCss?: string } = {}): string {
  const { color: C, font: F, stroke: W } = th;
  const out: string[] = [];
  let seed = 0;
  const roughPath = (points: [number, number][], closed = false) => {
    const current = ++seed;
    const noise = (n: number) => {
      const v = Math.sin((current * 97 + n) * 12.9898) * 43758.5453;
      return (v - Math.floor(v) - 0.5) * 1.4;
    };
    const result: [number, number][] = [];
    const count = closed ? points.length : points.length - 1;
    for (let i = 0; i < count; i++) {
      const a = points[i]!, b = points[(i + 1) % points.length]!;
      const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
      const steps = Math.max(1, Math.ceil(length / 28));
      for (let j = 0; j < steps; j++) {
        const t = j / steps, offset = noise(i * 100 + j);
        result.push([a[0] + dx * t - dy / (length || 1) * offset, a[1] + dy * t + dx / (length || 1) * offset]);
      }
    }
    if (!closed) result.push(points[points.length - 1]!);
    return result.map(([x, y], i) => `${i ? 'L' : 'M'}${r1(x)},${r1(y)}`).join(' ') + (closed ? ' Z' : '');
  };
  const path = (points: [number, number][], attrs: string, closed = false) =>
    th.lineStyle === 'sketch'
      ? `<path d="${roughPath(points, closed)}" ${attrs}/>`
      : closed
        ? `<polygon points="${points.map(([x, y]) => `${r1(x)},${r1(y)}`).join(' ')}" ${attrs}/>`
        : `<polyline points="${points.map(([x, y]) => `${r1(x)},${r1(y)}`).join(' ')}" ${attrs}/>`;
  const line = (x1: number, y1: number, x2: number, y2: number, color = C.line, width = W.line) =>
    path([[x1, y1], [x2, y2]], `fill="none" stroke="${color}" stroke-width="${width}"`);
  const text = (value: string, x: number, y: number, options: { anchor?: string; bold?: boolean } = {}) =>
    out.push(`<text x="${r1(x)}" y="${r1(y)}"${options.anchor ? ` text-anchor="${options.anchor}"` : ''}${options.bold ? ' font-weight="bold"' : ''}>${esc(value)}</text>`);

  const marker = (cardinality: string, point: [number, number], next: [number, number]) => {
    const dx = next[0] - point[0], dy = next[1] - point[1], length = Math.hypot(dx, dy) || 1;
    const ux = dx / length, uy = dy / length, px = -uy, py = ux;
    const at = (distance: number, side = 0): [number, number] => [point[0] + ux * distance + px * side, point[1] + uy * distance + py * side];
    const bar = (distance: number) => {
      const a = at(distance, -6), b = at(distance, 6);
      out.push(line(a[0], a[1], b[0], b[1]));
    };
    if (cardinality === '||') { bar(7); bar(13); }
    else {
      if (cardinality.includes('|')) bar(cardinality.includes('{') || cardinality.includes('}') ? 13 : 7);
      if (cardinality.includes('o')) {
        const c = at(12);
        out.push(`<circle cx="${r1(c[0])}" cy="${r1(c[1])}" r="4" fill="${C.bg}" stroke="${C.line}" stroke-width="${W.line}"/>`);
      }
      if (cardinality.includes('{') || cardinality.includes('}')) {
        const tip = at(0), a = at(10, -6), b = at(10), c = at(10, 6);
        out.push(line(tip[0], tip[1], a[0], a[1]));
        out.push(line(tip[0], tip[1], b[0], b[1]));
        out.push(line(tip[0], tip[1], c[0], c[1]));
      }
    }
  };

  const vb = scene.viewBox;
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${r1(vb.x)} ${r1(vb.y)} ${r1(vb.w)} ${r1(vb.h)}" width="${r1(vb.w)}" height="${r1(vb.h)}" font-family="${esc(F.family)}" font-size="${F.size}" fill="${C.text}">`);
  if (opts.fontCss) out.push(`<defs><style>${opts.fontCss}</style></defs>`);
  out.push(`<rect x="${r1(vb.x)}" y="0" width="${r1(vb.w)}" height="${r1(vb.h)}" fill="${C.bg}"/>`);
  if (scene.title) text(scene.title.lines[0]!, vb.x + vb.w / 2, scene.title.y + F.lineHeight, { anchor: 'middle', bold: true });

  for (const edge of scene.relationships) {
    const r = edge.relationship, points = edge.points;
    out.push(`<g data-line="${r.line}">`);
    out.push(path(points, `fill="none" stroke="${C.line}" stroke-width="${W.line}"${r.dashed ? ' stroke-dasharray="5,4"' : ''}`));
    marker(r.fromCardinality, points[0]!, points[1]!);
    marker(r.toCardinality, points[points.length - 1]!, points[points.length - 2]!);
    if (r.label) {
      const width = r.label.length * F.size * 0.58 + 8;
      out.push(`<rect x="${r1(edge.labelX - width / 2)}" y="${r1(edge.labelY - F.lineHeight + 3)}" width="${r1(width)}" height="${F.lineHeight}" fill="${C.bg}"/>`);
      text(r.label, edge.labelX, edge.labelY, { anchor: 'middle' });
    }
    out.push('</g>');
  }

  for (const box of scene.entities) {
    const e = box.entity, fill = e.color ? css(e.color) : C.boxFill;
    out.push(`<g data-line="${e.line}">`);
    out.push(path([[box.x, box.y], [box.x + box.w, box.y], [box.x + box.w, box.y + box.h], [box.x, box.y + box.h]], `fill="${fill}" stroke="${C.boxStroke}" stroke-width="${W.box}"`, true));
    out.push(path([[box.x, box.y], [box.x + box.w, box.y], [box.x + box.w, box.y + box.headerH], [box.x, box.y + box.headerH]], `fill="${C.tabFill}" stroke="${C.boxStroke}" stroke-width="${W.box}"`, true));
    text(`${e.kind === 'enum' ? '«enum» ' : ''}${e.label}`, box.x + box.w / 2, box.y + (box.headerH + F.lineHeight) / 2 - 3, { anchor: 'middle', bold: true });
    e.attributes.forEach((a, i) => {
      const y = box.y + box.headerH + i * box.rowH + F.lineHeight;
      text(`${a.visibility ?? ''}${a.required ? '*' : ''}${a.name}`, box.x + 12, y);
      const type = `${a.type ?? ''}${a.key ? ` ${a.key}` : ''}`;
      if (type) text(type, box.x + box.w - 12, y, { anchor: 'end' });
    });
    out.push('</g>');
  }
  out.push('</svg>');
  return out.join('\n');
}
