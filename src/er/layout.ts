import type { Measure } from '../measure.ts';
import type { Theme } from '../theme.ts';
import type { Warning } from '../parser/ast.ts';
import type { ErAttribute, ErDiagram, ErEntity, ErRelationship } from './ast.ts';

export interface ErBox {
  entity: ErEntity;
  x: number;
  y: number;
  w: number;
  h: number;
  headerH: number;
  rowH: number;
}

export interface ErEdge {
  relationship: ErRelationship;
  points: [number, number][];
  labelX: number;
  labelY: number;
}

export interface ErScene {
  viewBox: { x: number; y: number; w: number; h: number };
  title?: { lines: string[]; y: number };
  entities: ErBox[];
  relationships: ErEdge[];
  warnings: Warning[];
}

const attributeText = (a: ErAttribute) => `${a.visibility ?? ''}${a.required ? '*' : ''}${a.name}`;

export function layoutEr(d: ErDiagram, th: Theme, measure: Measure): ErScene {
  const warnings: Warning[] = [];
  if (!d.entities.length) return {
    viewBox: { x: 0, y: 0, w: 300, h: 100 }, entities: [], relationships: [],
    warnings: [{ line: 1, message: 'nothing to draw' }],
  };

  const gapX = 70, gapY = 70, pad = 12, rowH = th.font.lineHeight + 5, headerH = th.font.lineHeight + 12;
  const dims = d.entities.map((entity) => {
    const attributeW = entity.attributes.reduce((max, a) => {
      const type = `${a.type ?? ''}${a.key ? ` ${a.key}` : ''}`;
      return Math.max(max, measure(attributeText(a)) + (type ? measure(type) + 28 : 0) + pad * 2);
    }, 0);
    return {
      w: Math.max(150, measure(entity.label, true) + pad * 2, attributeW),
      h: headerH + Math.max(1, entity.attributes.length) * rowH,
    };
  });
  const columns = Math.ceil(Math.sqrt(d.entities.length));
  const rows = Math.ceil(d.entities.length / columns);
  const colW = Array.from({ length: columns }, (_, c) => Math.max(...dims.filter((_, i) => i % columns === c).map((v) => v.w)));
  const rowHMax = Array.from({ length: rows }, (_, r) => Math.max(...dims.filter((_, i) => Math.floor(i / columns) === r).map((v) => v.h)));
  const colX: number[] = [], rowY: number[] = [];
  for (let c = 0, x = th.size.margin; c < columns; c++) { colX.push(x); x += colW[c]! + gapX; }
  for (let r = 0, y = th.size.margin + (d.title ? th.font.lineHeight + 18 : 0); r < rows; r++) { rowY.push(y); y += rowHMax[r]! + gapY; }

  const entities: ErBox[] = d.entities.map((entity, i) => ({
    entity, x: colX[i % columns]!, y: rowY[Math.floor(i / columns)]!,
    w: dims[i]!.w, h: dims[i]!.h, headerH, rowH,
  }));
  const byId = new Map(entities.map((box) => [box.entity.id, box]));
  const center = (box: ErBox): [number, number] => [box.x + box.w / 2, box.y + box.h / 2];
  const boundary = (box: ErBox, toward: [number, number]): [number, number] => {
    const [cx, cy] = center(box), dx = toward[0] - cx, dy = toward[1] - cy;
    const scale = Math.min(box.w / 2 / (Math.abs(dx) || 1), box.h / 2 / (Math.abs(dy) || 1));
    return [cx + dx * scale, cy + dy * scale];
  };

  const relationships = d.relationships.flatMap((relationship): ErEdge[] => {
    const from = byId.get(relationship.from), to = byId.get(relationship.to);
    if (!from || !to) {
      warnings.push({ line: relationship.line, message: 'relationship refers to a missing entity, skipped' });
      return [];
    }
    if (from === to) {
      const y1 = from.y + from.headerH / 2, y2 = y1 + Math.min(24, from.h / 3), x = from.x + from.w;
      return [{
        relationship, points: [[x, y1], [x + 34, y1], [x + 34, y2], [x, y2]],
        labelX: x + 40, labelY: (y1 + y2) / 2,
      }];
    }
    const a = center(from), b = center(to), p1 = boundary(from, b), p2 = boundary(to, a);
    return [{
      relationship, points: [p1, p2],
      labelX: (p1[0] + p2[0]) / 2, labelY: (p1[1] + p2[1]) / 2 - 7,
    }];
  });

  const right = Math.max(...entities.map((box) => box.x + box.w));
  const bottom = Math.max(...entities.map((box) => box.y + box.h));
  const selfExtra = d.relationships.some((r) => r.from === r.to) ? 90 : 0;
  return {
    viewBox: { x: 0, y: 0, w: right + th.size.margin + selfExtra, h: bottom + th.size.margin },
    ...(d.title ? { title: { lines: [d.title], y: th.size.margin } } : {}),
    entities, relationships, warnings,
  };
}
