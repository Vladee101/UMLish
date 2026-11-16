import type { ErAttribute, ErDiagram, ErEntity } from './ast.ts';

const NAME = '"[^"]+"|[A-Za-z_][\\w-]*';
const DECL = new RegExp(`^(entity|enum)\\s+(${NAME})(?:\\s+as\\s+(${NAME}))?(?:\\s+(#\\w+))?\\s*(\\{)?$`, 'i');
const REL = new RegExp(`^(${NAME})\\s*([|}{o]{2})\\s*(--|\\.\\.)\\s*([|}{o]{2})\\s*(${NAME})(?:\\s*:\\s*(.*))?$`, 'i');
const unq = (s: string) => s.replace(/^"(.*)"$/, '$1');

export function isErDiagram(source: string) {
  return /^\s*entity\s+(?:"[^"]+"|[A-Za-z_]\w*)(?:\s+as\s+(?:"[^"]+"|[A-Za-z_]\w*))?(?:\s+#\w+)?\s*\{/im.test(source) ||
    /^\s*enum\s+(?:"[^"]+"|[A-Za-z_]\w*)/im.test(source) ||
    /^\s*(?:"[^"]+"|[A-Za-z_]\w*)\s*[|}{o]{2}\s*(?:--|\.\.)\s*[|}{o]{2}\s*(?:"[^"]+"|[A-Za-z_]\w*)/im.test(source);
}

export function parseEr(source: string): ErDiagram {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const d: ErDiagram = { entities: [], relationships: [], skinparams: {}, warnings: [] };
  const entities = new Map<string, ErEntity>();
  let current: ErEntity | undefined;
  let skinPrefix: string | undefined;
  let inComment = false;
  let ln = 0;
  const warn = (message: string, line = ln) => d.warnings.push({ line, message });

  const ensure = (name: string, line = ln) => {
    const id = unq(name);
    let entity = entities.get(id);
    if (!entity) {
      entity = { id, label: id, kind: 'entity', attributes: [], line };
      entities.set(id, entity);
      d.entities.push(entity);
    }
    return entity;
  };

  const startIdx = lines.findIndex((line) => /^\s*@startuml\b/i.test(line));
  for (let i = startIdx + 1; i < lines.length; i++) {
    ln = i + 1;
    const t = lines[i]!.trim();
    if (inComment) { if (t.includes("'/")) inComment = false; continue; }
    if (!t || t.startsWith("'")) continue;
    if (t.startsWith("/'")) { if (!t.includes("'/", 2)) inComment = true; continue; }
    if (/^@enduml\b/i.test(t)) break;

    if (current) {
      if (t === '}') { current = undefined; continue; }
      if (/^(?:--|\.\.)$/.test(t)) continue;
      const m = t.match(/^([+\-#~])?\s*(\*)?\s*([^:]+?)(?:\s*:\s*(.*))?$/);
      if (!m) { warn(`unsupported attribute, skipped: ${t}`); continue; }
      let type = m[4]?.trim();
      const key = type?.match(/<<\s*(PK|FK|UK)\s*>>/i)?.[1]?.toUpperCase() as ErAttribute['key'] | undefined;
      if (key) type = type!.replace(/<<\s*(?:PK|FK|UK)\s*>>/i, '').trim();
      const attribute: ErAttribute = {
        name: m[3]!.trim(), required: m[2] !== undefined, line: ln,
        ...(m[1] ? { visibility: m[1] as ErAttribute['visibility'] } : {}),
        ...(type ? { type } : {}), ...(key ? { key } : {}),
      };
      current.attributes.push(attribute);
      continue;
    }

    if (skinPrefix !== undefined) {
      if (t === '}') skinPrefix = undefined;
      else { const [k, ...v] = t.split(/\s+/); if (k) d.skinparams[`${skinPrefix}.${k}`] = v.join(' '); }
      continue;
    }
    let m: RegExpMatchArray | null;
    if ((m = t.match(/^skinparam\s+(\w+)\s*\{$/i))) { skinPrefix = m[1]!; continue; }
    if ((m = t.match(/^skinparam\s+(\w+)\s+(.+)$/i))) { d.skinparams[m[1]!] = m[2]!.trim(); continue; }
    if ((m = t.match(/^title\s+(.+)$/i))) { d.title = m[1]!.trim(); continue; }
    if ((m = t.match(DECL))) {
      const a = m[2]!, b = m[3];
      const id = b === undefined ? unq(a) : a.startsWith('"') ? unq(b) : b.startsWith('"') ? unq(a) : unq(b);
      const label = b === undefined ? unq(a) : a.startsWith('"') ? unq(a) : b.startsWith('"') ? unq(b) : a;
      const entity = ensure(id);
      entity.label = label;
      entity.kind = m[1]!.toLowerCase() as ErEntity['kind'];
      entity.line = ln;
      if (m[4]) entity.color = m[4];
      if (m[5]) current = entity;
      continue;
    }
    if ((m = t.match(REL))) {
      const from = ensure(m[1]!), to = ensure(m[5]!);
      d.relationships.push({
        from: from.id, to: to.id, fromCardinality: m[2]!, toCardinality: m[4]!,
        label: m[6]?.trim() ?? '', dashed: m[3] === '..', line: ln,
      });
      continue;
    }
    if (t === '}') { warn("'}' without an open entity, skipped"); continue; }
    warn(`unsupported ER syntax, skipped: ${t.length > 50 ? t.slice(0, 50) + '…' : t}`);
  }
  if (current) warn(`'${current.label}' entity is never closed`, current.line);
  return d;
}
