import type { ArrowHead, Diagram, Endpoint, Event, Message, Participant, Warning } from './parser/ast.ts';
import type { Theme } from './theme.ts';
import type { Measure } from './measure.ts';

export type Shape =
  | { t: 'participant'; p: Participant; x: number; y: number; w: number; h: number; lines: string[]; line: number }
  | { t: 'lifeline'; x: number; y1: number; y2: number }
  | { t: 'activation'; x: number; y1: number; y2: number; color?: string }
  | { t: 'message'; line: number; x1: number; x2: number; y: number; lines: string[]; prefix?: string;
      dashed: boolean; color?: string; startHead: ArrowHead; endHead: ArrowHead; self: boolean }
  | { t: 'note'; line: number; shape: 'note' | 'hnote' | 'rnote'; x: number; y: number; w: number; h: number; lines: string[]; color?: string }
  | { t: 'ref'; line: number; x: number; y: number; w: number; h: number; lines: string[] }
  | { t: 'fragment'; line: number; x: number; y: number; w: number; h: number; kind: string; label: string;
      tabW: number; dividers: { y: number; label: string }[] }
  | { t: 'divider'; line: number; y: number; h: number; x1: number; x2: number; text: string; w: number }
  | { t: 'delay'; line: number; y: number; h: number; x: number; text: string; w: number }
  | { t: 'destroy'; x: number; y: number }
  | { t: 'group'; x: number; y: number; w: number; h: number; name: string; color?: string };

export interface Scene {
  viewBox: { x: number; y: number; w: number; h: number };
  shapes: Shape[];
  title?: { lines: string[]; y: number };
  header?: { lines: string[]; y: number };
  footer?: { lines: string[]; y: number };
  warnings: Warning[];
}

const ICON_KINDS = new Set(['actor', 'boundary', 'control', 'entity', 'database']);
const lines = (s: string | undefined) => (s ? s.split('\n') : []);

export function layout(d: Diagram, th: Theme, measure: Measure): Scene {
  const S = th.size, lineH = th.font.lineHeight;
  const P = d.participants, n = P.length;
  const warnings: Warning[] = [];
  const idx = new Map(P.map((p, i) => [p.id, i]));
  const tw = (ls: string[], bold = false) => ls.reduce((m, l) => Math.max(m, measure(l, bold)), 0);
  const pid = (e: Endpoint) => (e.kind === 'participant' ? e.id : undefined);
  const pidx = (e: Endpoint) => { const id = pid(e); return id === undefined ? undefined : idx.get(id); };

  if (n === 0) {
    return { viewBox: { x: 0, y: 0, w: 120, h: 40 }, shapes: [], warnings: [{ line: 1, message: 'nothing to draw' }] };
  }

  // ---- pre-pass: autonumber prefixes, created participants -------------------
  const prefix = new WeakMap<object, string>();
  const created = new Set<string>(P.filter((p) => p.created).map((p) => p.id));
  const an = { on: false, n: 1, step: 1, fmt: '' };
  const fmtNum = (k: number) => {
    const f = an.fmt.replace(/<[^>]+>/g, '');
    return /0/.test(f) ? f.replace(/0+/, (m) => String(k).padStart(m.length, '0')) : String(k);
  };
  const walk = (evs: Event[], fn: (e: Event) => void) => {
    for (const e of evs) { fn(e); if (e.type === 'fragment') for (const s of e.sections) walk(s.events, fn); }
  };
  walk(d.events, (e) => {
    if (e.type === 'autonumber') {
      if (e.action === 'stop') an.on = false;
      else {
        an.on = true;
        if (e.action === 'start') { an.n = e.start ?? 1; an.step = e.step ?? 1; an.fmt = e.format ?? ''; }
        else { if (e.step !== undefined) an.step = e.step; if (e.format !== undefined) an.fmt = e.format; }
      }
    } else if ((e.type === 'message' || e.type === 'return') && an.on) {
      prefix.set(e, fmtNum(an.n)); an.n += an.step;
    }
    if (e.type === 'activation' && e.op === 'create') created.add(e.target);
    if (e.type === 'message' && e.activation?.op === '**' && e.to.kind === 'participant') created.add(e.to.id);
  });

  // ---- participant boxes ---------------------------------------------------
  const dims = P.map((p) => {
    const ls = lines(p.label), w0 = tw(ls);
    return ICON_KINDS.has(p.kind)
      ? { ls, w: Math.max(S.iconW, w0 + 10), h: S.iconH + 4 + ls.length * lineH + 2 }
      : { ls, w: Math.max(S.minBox, w0 + 2 * S.boxPadX), h: ls.length * lineH + 2 * S.boxPadY };
  });

  // ---- column spacing: relax constraints, shortest span first --------------
  const lw = (text: string, pre?: string) => {
    const ls = lines(text);
    return ls.reduce((m, l, k) => Math.max(m, measure(l) + (k === 0 && pre ? measure(pre, true) + 4 : 0)), pre && !ls.length ? measure(pre, true) : 0);
  };
  const noteSize = (text: string) => {
    const ls = lines(text);
    return { ls, w: Math.max(30, tw(ls) + 2 * S.notePadX), h: Math.max(1, ls.length) * lineH + 2 * S.notePadY };
  };
  const tIdx = (ids: string[]) => ids.map((id) => idx.get(id)).filter((v): v is number => v !== undefined);

  const need: { i: number; j: number; v: number }[] = [];
  const addN = (a: number, b: number, v: number) => {
    const i = Math.min(a, b), j = Math.max(a, b);
    if (i >= 0 && j < n && i < j) need.push({ i, j, v });
  };
  const overNeed = (t: number[], w: number) => {
    if (t.length === 1) { addN(t[0]! - 1, t[0]!, w / 2 + 8); addN(t[0]!, t[0]! + 1, w / 2 + 8); }
    else if (t.length > 1) addN(Math.min(...t), Math.max(...t), w - 20);
  };
  walk(d.events, (e) => {
    if (e.type === 'message') {
      const a = pidx(e.from), b = pidx(e.to), L = lw(e.text, prefix.get(e));
      if (a !== undefined && b !== undefined) a === b ? addN(a, a + 1, S.selfW + L + 14) : addN(a, b, L + 20);
    } else if (e.type === 'note') {
      const z = noteSize(e.text), t = tIdx(e.targets);
      if (e.position === 'left' && t[0] !== undefined) addN(t[0] - 1, t[0], z.w + 14);
      else if (e.position === 'right' && t[0] !== undefined) addN(t[0], t[0] + 1, z.w + 14);
      else if (e.position === 'over') overNeed(t, z.w);
      else if (e.position === 'across') addN(0, n - 1, z.w - 20);
    } else if (e.type === 'ref') overNeed(tIdx(e.targets), noteSize(e.text).w);
  });
  const gap = Array.from({ length: n - 1 }, (_, i) => Math.max(S.minGap, (dims[i]!.w + dims[i + 1]!.w) / 2 + S.boxGap));
  need.sort((a, b) => a.j - a.i - (b.j - b.i));
  for (const c of need) {
    let sum = 0;
    for (let k = c.i; k < c.j; k++) sum += gap[k]!;
    if (sum < c.v) for (let k = c.i; k < c.j; k++) gap[k]! += (c.v - sum) / (c.j - c.i);
  }
  const cx: number[] = [];
  { let acc = 0; for (let i = 0; i < n; i++) { cx.push(acc); acc += gap[i] ?? 0; } }
  const X = (i: number) => cx[i]!;

  // ---- geometry helpers shared by the extent pass and the vertical pass ----
  const endX = (ep: Endpoint, other: number | undefined, L: number) => {
    if (ep.kind === 'participant') return X(idx.get(ep.id)!);
    const o = other ?? 0;
    return ep.side === 'left'
      ? X(0) - Math.max(S.edgeLen, L + 16 - (X(o) - X(0)))
      : X(n - 1) + Math.max(S.edgeLen, L + 16 - (X(n - 1) - X(o)));
  };
  const rectFor = (position: string, targets: string[], text: string) => {
    const z = noteSize(text), t = tIdx(targets);
    let x: number, w = z.w;
    if (position === 'across') { w = Math.max(z.w, X(n - 1) - X(0) + 20); x = (X(0) + X(n - 1)) / 2 - w / 2; }
    else if (t.length === 0) return undefined;
    else if (position === 'left') x = X(t[0]!) - z.w - 6;
    else if (position === 'right') x = X(t[0]!) + 6;
    else if (t.length === 1) x = X(t[0]!) - w / 2;
    else { const lo = X(Math.min(...t)), hi = X(Math.max(...t)); w = Math.max(z.w, hi - lo + 20); x = (lo + hi) / 2 - w / 2; }
    return { x, w, h: z.h, ls: z.ls };
  };
  const ext = (evs: Event[]): [number, number] | undefined => {
    let lo = Infinity, hi = -Infinity;
    const u = (a: number, b: number) => { lo = Math.min(lo, a); hi = Math.max(hi, b); };
    for (const e of evs) {
      if (e.type === 'message') {
        const a = pidx(e.from), b = pidx(e.to), L = lw(e.text, prefix.get(e));
        const x1 = endX(e.from, b, L), x2 = endX(e.to, a, L);
        if (a !== undefined && a === b) u(x1 - 6, x1 + S.selfW + L + 10);
        else u(Math.min(x1, x2) - 6, Math.max(x1, x2) + 6);
      } else if (e.type === 'note' || e.type === 'ref') {
        const r = e.type === 'note' ? rectFor(e.position, e.targets, e.text) : rectFor('over', e.targets, e.text);
        if (r) u(r.x, r.x + r.w);
      } else if (e.type === 'fragment') {
        const sub = ext(e.sections.flatMap((s) => s.events)) ?? [X(0), X(n - 1)];
        const tabW = measure(e.kind, true) + 26;
        const w = Math.max(sub[1] - sub[0] + 2 * S.fragPad, tabW + measure(`[${e.sections[0]!.label}]`, true) + 20);
        u(sub[0] - S.fragPad, sub[0] - S.fragPad + w);
      }
    }
    return lo <= hi ? [lo, hi] : undefined;
  };

  // ---- vertical pass ---------------------------------------------------------
  let minX = Infinity, maxX = -Infinity;
  const tr = (a: number, b: number) => { minX = Math.min(minX, a, b); maxX = Math.max(maxX, a, b); };
  const life: Shape[] = [], bars: Shape[] = [], fg: Shape[] = [];
  const stacks = new Map<string, { y: number; color?: string }[]>();
  const stackOf = (id: string) => { let s = stacks.get(id); if (!s) stacks.set(id, (s = [])); return s; };
  const createY = new Map<string, number>(), destroyY = new Map<string, number>();
  const calls: { caller: string; callee: string }[] = [];
  let lastY: number | undefined;
  let y = S.margin;

  const titleLines = lines(d.title), headerLines = lines(d.header), footerLines = lines(d.footer);
  let header: Scene['header'], title: Scene['title'];
  if (headerLines.length) { header = { lines: headerLines, y }; y += headerLines.length * lineH + 6; }
  if (title === undefined && titleLines.length) { title = { lines: titleLines, y }; y += titleLines.length * lineH + 14; }

  const hasGroups = d.boxes.length > 0;
  if (hasGroups) y += lineH + 4;
  const topY = y;
  const topRowH = Math.max(0, ...P.map((p, i) => (created.has(p.id) ? 0 : dims[i]!.h)));
  y = topY + topRowH + S.afterBoxes;

  /** x of the activation-bar edge on a given side (lifeline centre if no bar). */
  const side = (id: string, s: 'left' | 'right') => {
    const i = idx.get(id)!, depth = stackOf(id).length;
    if (!depth) return X(i);
    return s === 'left' ? X(i) - S.actW / 2 : X(i) + S.actW / 2 + (depth - 1) * S.actShift;
  };
  const closeBar = (id: string, yEnd: number) => {
    const st = stackOf(id), b = st.pop();
    if (!b) return;
    bars.push({ t: 'activation', x: X(idx.get(id)!) - S.actW / 2 + st.length * S.actShift, y1: b.y, y2: Math.max(yEnd, b.y + 2), ...(b.color ? { color: b.color } : {}) });
  };

  const doMessage = (m: Message, pre: string | undefined, eff?: { op: string; color?: string }) => {
    const ls = lines(m.text), L = lw(m.text, pre);
    const fromId = pid(m.from), toId = pid(m.to), fi = pidx(m.from), ti = pidx(m.to);
    const self = fi !== undefined && fi === ti;
    let ay = y + (ls.length || pre ? Math.max(1, ls.length) * lineH : 0) + S.labelGap;
    const creating = toId !== undefined && created.has(toId) && !createY.has(toId);
    if (creating) { const h = dims[ti!]!.h; ay = Math.max(ay, y + h / 2 + 2); createY.set(toId!, ay - h / 2); }
    const op = eff?.op ?? m.activation?.op, color = eff?.color ?? m.activation?.color;
    if (op === '++' && toId) {
      stackOf(toId).push({ y: ay, ...(color ? { color } : {}) });
      if (fromId) calls.push({ caller: fromId, callee: toId });
    }
    let x1: number, x2: number;
    if (self) { x1 = side(fromId!, 'right'); x2 = x1; }
    else {
      const rawF = endX(m.from, ti, L), rawT = endX(m.to, fi, L), right = rawT > rawF;
      x1 = fromId ? side(fromId, right ? 'right' : 'left') : rawF;
      x2 = !toId ? rawT : creating ? (right ? X(ti!) - dims[ti!]!.w / 2 : X(ti!) + dims[ti!]!.w / 2) : side(toId, right ? 'left' : 'right');
    }
    fg.push({
      t: 'message', line: m.line, x1, x2, y: ay, lines: ls, ...(pre ? { prefix: pre } : {}),
      dashed: m.dashed, ...(m.color ? { color: m.color } : {}), startHead: m.startHead, endHead: m.endHead, self,
    });
    tr(Math.min(x1, x2), self ? x1 + S.selfW + L + 10 : Math.max(x1, x2));
    if (op === '--' && fromId) {
      closeBar(fromId, ay);
      if (!eff) { const ci = calls.map((c) => c.callee).lastIndexOf(fromId); if (ci >= 0) calls.splice(ci, 1); }
    }
    if (op === '!!' && toId) { destroyY.set(toId, ay); fg.push({ t: 'destroy', x: X(ti!), y: ay }); }
    lastY = ay;
    y = ay + (self ? S.selfH : 0) + S.rowGap;
    if (creating) y = Math.max(y, createY.get(toId!)! + dims[ti!]!.h + S.rowGap);
  };

  const run = (evs: Event[]) => {
    for (let k = 0; k < evs.length; k++) {
      const e = evs[k]!;
      switch (e.type) {
        case 'message': {
          const nx = evs[k + 1];
          let eff: { op: string; color?: string } | undefined;
          if (nx?.type === 'activation' && nx.op === 'activate' && e.to.kind === 'participant' && nx.target === e.to.id) {
            eff = { op: '++', ...(nx.color ? { color: nx.color } : {}) }; k++;
          }
          doMessage(e, prefix.get(e), eff);
          break;
        }
        case 'return': {
          const c = calls.pop();
          if (!c) { warnings.push({ line: e.line, message: 'return without an active call' }); break; }
          doMessage({ type: 'message', line: e.line, from: { kind: 'participant', id: c.callee }, to: { kind: 'participant', id: c.caller },
            text: e.text, dashed: true, startHead: 'none', endHead: 'filled' }, prefix.get(e), { op: '--' });
          break;
        }
        case 'activation': {
          const at = lastY ?? y;
          if (e.op === 'activate') stackOf(e.target).push({ y: at, ...(e.color ? { color: e.color } : {}) });
          else if (e.op === 'deactivate') {
            closeBar(e.target, at);
            const ci = calls.map((c) => c.callee).lastIndexOf(e.target);
            if (ci >= 0) calls.splice(ci, 1);
          } else if (e.op === 'destroy') {
            destroyY.set(e.target, at);
            const i = idx.get(e.target); if (i !== undefined) fg.push({ t: 'destroy', x: X(i), y: at });
          }
          break;
        }
        case 'note': case 'ref': {
          const r = e.type === 'note' ? rectFor(e.position, e.targets, e.text) : rectFor('over', e.targets, e.text);
          if (!r) { warnings.push({ line: e.line, message: 'note has no target, skipped' }); break; }
          const h = e.type === 'ref' ? r.h + 12 : r.h;
          fg.push(e.type === 'note'
            ? { t: 'note', line: e.line, shape: e.shape, x: r.x, y, w: r.w, h, lines: r.ls, ...(e.color ? { color: e.color } : {}) }
            : { t: 'ref', line: e.line, x: r.x, y, w: r.w, h, lines: r.ls });
          tr(r.x, r.x + r.w);
          y += h + S.rowGap;
          break;
        }
        case 'fragment': {
          const sub = ext(e.sections.flatMap((s) => s.events)) ?? [X(0), X(n - 1)];
          const tabW = measure(e.kind, true) + 26, condW = measure(`[${e.sections[0]!.label}]`, true);
          const w = Math.max(sub[1] - sub[0] + 2 * S.fragPad, tabW + condW + 20);
          const fs: Extract<Shape, { t: 'fragment' }> = {
            t: 'fragment', line: e.line, x: sub[0] - S.fragPad, y, w, h: 0, kind: e.kind,
            label: e.sections[0]!.label, tabW, dividers: [],
          };
          tr(fs.x, fs.x + w);
          fg.push(fs);
          const top = y;
          y += S.tabH + 6;
          e.sections.forEach((s, si) => {
            if (si > 0) {
              y += 4;
              fs.dividers.push({ y, label: s.label });
              y += s.label ? lineH + 4 : 6;
            }
            run(s.events);
          });
          y += 2;
          fs.h = y - top;
          y += S.rowGap - 4;
          break;
        }
        case 'divider': {
          const h = S.dividerH, w = measure(e.text, true) + 24;
          fg.push({ t: 'divider', line: e.line, y: y + 4, h, x1: 0, x2: 0, text: e.text, w });
          y += h + 12;
          break;
        }
        case 'delay': {
          const w = e.text ? measure(e.text) + 10 : 0;
          fg.push({ t: 'delay', line: e.line, y, h: S.delayH, x: 0, text: e.text, w });
          y += S.delayH;
          break;
        }
        case 'spacing': y += e.height ?? 20; break;
        case 'autonumber': break;
      }
    }
  };
  run(d.events);

  // ---- close out: lifelines, remaining bars, participant boxes ---------------
  y += S.lifeTail;
  const lifeEnd = y;
  for (const [id, st] of stacks) while (st.length) closeBar(id, lifeEnd);
  const footY = lifeEnd;
  let bottom = footY;
  P.forEach((p, i) => {
    const dm = dims[i]!, x = X(i) - dm.w / 2;
    const top = created.has(p.id) ? createY.get(p.id) ?? lastY ?? topY : topY;
    fg.push({ t: 'participant', p, x, y: top, w: dm.w, h: dm.h, lines: dm.ls, line: p.line });
    tr(x, x + dm.w);
    const end = destroyY.get(p.id) ?? lifeEnd;
    life.push({ t: 'lifeline', x: X(i), y1: top + dm.h, y2: end });
    if (!d.options.hideFootbox && !destroyY.has(p.id)) {
      fg.push({ t: 'participant', p, x, y: footY, w: dm.w, h: dm.h, lines: dm.ls, line: p.line });
      bottom = Math.max(bottom, footY + dm.h);
    }
  });
  const groups: Shape[] = [];
  d.boxes.forEach((b, bi) => {
    const ms = P.map((p, i) => ({ p, i })).filter(({ p }) => p.box === bi);
    if (!ms.length) return;
    const x1 = Math.min(...ms.map(({ i }) => X(i) - dims[i]!.w / 2)) - 6;
    const x2 = Math.max(...ms.map(({ i }) => X(i) + dims[i]!.w / 2)) + 6;
    groups.push({ t: 'group', x: x1, y: topY - lineH - 4, w: x2 - x1, h: bottom - topY + lineH + 10, name: b.name, ...(b.color ? { color: b.color } : {}) });
    tr(x1, x2);
  });
  y = bottom + 6;

  let footer: Scene['footer'];
  if (footerLines.length) { footer = { lines: footerLines, y: y + 4 }; y += footerLines.length * lineH + 10; }

  // widen for title/header/footer, then give full-width items their span
  const spanW = () => maxX - minX;
  for (const blk of [title, header, footer]) {
    if (!blk) continue;
    const extra = tw(blk.lines, true) - spanW();
    if (extra > 0) { minX -= extra / 2; maxX += extra / 2; }
  }
  const mid = (minX + maxX) / 2;
  for (const s of fg) {
    if (s.t === 'divider') { s.x1 = minX; s.x2 = maxX; }
    if (s.t === 'delay') s.x = mid;
  }

  return {
    viewBox: { x: minX - S.margin, y: 0, w: spanW() + 2 * S.margin, h: y + S.margin },
    shapes: [...groups, ...life, ...bars, ...fg],
    ...(title ? { title } : {}), ...(header ? { header } : {}), ...(footer ? { footer } : {}),
    warnings,
  };
}
