import type {
  ArrowHead, Diagram, Endpoint, Event, Fragment, FragmentKind,
  Message, Participant, ParticipantKind,
} from './ast.ts';

/**
 * Tolerant, line-oriented parser for PlantUML sequence diagrams.
 * Never throws: anything it doesn't understand becomes a warning and is skipped.
 */

const KINDS: ParticipantKind[] = [
  'participant', 'actor', 'boundary', 'control', 'entity', 'database', 'collections', 'queue',
];
const NAME = '"[^"]+"|[^\\s#]+';
const DECL = new RegExp(
  `^(${KINDS.join('|')})\\s+(${NAME})(?:\\s+as\\s+(${NAME}))?(?:\\s*<<.*?>>)?(?:\\s+order\\s+(\\d+))?(?:\\s+(#\\S+))?\\s*$`,
  'i',
);

// from, arrow chunk, to, optional ++/--/**/!! (+ color), optional label
const MSG =
  /^("[^"]+"|[^\s<>\-\[\]:"]+|[[\]])?\s*((?:[ox](?=[<\\\/-]))?[<\\\/]*-+(?:\[[^\]]*\])?-*[>\\\/]*(?:[ox](?=\s|$))?)\s*("[^"]+"|[[\]]|[^\s:[\]"+*!]+)\s*(?:(\+\+|--|\*\*|!!)(?:\s+(#\w+))?)?\s*(?::\s*(.*))?$/;
const ARROW = /^([ox<\\\/]*)(-+)(?:\[([^\]]*)\])?(-*)([>\\\/ox]*)$/;

const NOTE_BARE = /^(note|hnote|rnote)\s+(left|right)(?:\s+(#\w+))?(?:\s*:\s*(.*))?$/i;
const NOTE = /^(note|hnote|rnote)\s+(left|right|over)(?:\s+of)?\s+(.+?)(?:\s+(#\w+))?(?:\s*:\s*(.*))?$/i;
const NOTE_ACROSS = /^(note|hnote|rnote)\s+across(?:\s+(#\w+))?(?:\s*:\s*(.*))?$/i;
const REF = /^ref\s+over\s+(.+?)(?:\s*:\s*(.*))?$/i;
const FRAGMENT = /^(alt|opt|loop|par2|par|break|critical|group)\b\s*(.*)$/i;

const unq = (s: string) => s.trim().replace(/^"(.*)"$/, '$1');
const txt = (s?: string) => (s ?? '').replace(/\\n/g, '\n').trim();

function head(s: string): ArrowHead {
  if (!s) return 'none';
  if (s.includes('x')) return 'cross';
  if (s.includes('o')) return 'circle';
  if (s === '>>' || s === '<<') return 'open';
  if (s === '\\\\' || s === '//') return 'half-open';
  if (s === '\\' || s === '/') return 'half-filled';
  return 'filled';
}

interface Block {
  endRe: RegExp;
  buf: string[];
  done: (text: string) => void;
}

export function parse(source: string): Diagram {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const d: Diagram = {
    participants: [], boxes: [], events: [],
    options: { hideFootbox: false }, skinparams: {}, warnings: [],
  };
  const pmap = new Map<string, Participant>();
  const stack: Fragment[] = [];
  let currentBox: number | undefined;
  let block: Block | undefined;
  let blockLine = 0;
  let inComment = false;
  let skinPrefix: string | undefined;
  let lastTarget: string | undefined;
  let ln = 0;

  const warn = (message: string, line = ln) => d.warnings.push({ line, message });
  const cur = (): Event[] => {
    const f = stack[stack.length - 1];
    return f ? f.sections[f.sections.length - 1]!.events : d.events;
  };

  const addParticipant = (p: Participant) => {
    if (currentBox !== undefined) p.box = currentBox;
    pmap.set(p.id, p);
    d.participants.push(p);
    return p;
  };
  const ensure = (name: string): string => {
    const id = unq(name);
    if (!pmap.has(id)) addParticipant({ id, label: id, kind: 'participant', implicit: true, line: ln });
    return id;
  };
  const ensureAll = (csv: string) => csv.split(',').map((s) => s.trim()).filter(Boolean).map(ensure);

  /** Handles `participant "Long Name" as L`, `participant L as "Long Name"`, etc. */
  const declare = (m: RegExpMatchArray): string => {
    const kind = m[1]!.toLowerCase() as ParticipantKind;
    const a = m[2]!, b = m[3];
    let id: string, label: string;
    if (b === undefined) id = label = unq(a);
    else if (a.startsWith('"')) { label = unq(a); id = unq(b); }
    else if (b.startsWith('"')) { id = a; label = unq(b); }
    else { label = a; id = b; }
    const existing = pmap.get(id);
    if (existing) {
      Object.assign(existing, { kind, label, implicit: false });
      if (m[5]) existing.color = m[5];
      if (m[4]) existing.order = Number(m[4]);
      return id;
    }
    const p = addParticipant({ id, label, kind, implicit: false, line: ln });
    if (m[5]) p.color = m[5];
    if (m[4]) p.order = Number(m[4]);
    return id;
  };

  const endpoint = (tok: string | undefined): Endpoint => {
    if (tok === undefined || tok === '[') return { kind: 'edge', side: 'left' };
    if (tok === ']') return { kind: 'edge', side: 'right' };
    return { kind: 'participant', id: ensure(tok) };
  };

  const message = (m: RegExpMatchArray, parallel = false) => {
    const a = ARROW.exec(m[2]!);
    if (!a) return warn(`could not read arrow "${m[2]}"`);
    const from = endpoint(m[1]);
    const to = endpoint(m[3]);
    const lh = head(a[1]!), rh = head(a[5]!);
    const style = (a[3] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    const color = style.find((s) => s.startsWith('#'));
    const dashed = a[2]!.length >= 2 || style.some((s) => /^(dashed|dotted)$/i.test(s));
    const reversed = lh !== 'none' && rh === 'none';
    const msg: Message = {
      type: 'message', line: ln,
      from: reversed ? to : from,
      to: reversed ? from : to,
      text: txt(m[6]), dashed,
      startHead: lh !== 'none' && rh !== 'none' ? lh : 'none',
      endHead: reversed ? lh : rh,
    };
    if (color) msg.color = color;
    if (m[4]) msg.activation = { op: m[4] as '++' | '--' | '**' | '!!', ...(m[5] ? { color: m[5] } : {}) };
    if (parallel) msg.parallel = true;
    cur().push(msg);
    lastTarget = to.kind === 'participant' ? to.id : from.kind === 'participant' ? from.id : lastTarget;
  };

  const startBlock = (endRe: RegExp, done: (t: string) => void) => {
    block = { endRe, buf: [], done };
    blockLine = ln;
  };

  // Start after the first @startuml, if there is one.
  const startIdx = lines.findIndex((l) => /^\s*@startuml\b/i.test(l));
  for (let i = startIdx + 1; i < lines.length; i++) {
    ln = i + 1;
    const t = lines[i]!.trim();

    if (block) {
      if (block.endRe.test(t)) { const b = block; block = undefined; b.done(txt(b.buf.join('\n'))); }
      else block.buf.push(t);
      continue;
    }
    if (inComment) { if (t.includes("'/")) inComment = false; continue; }
    if (!t || (t.startsWith("'") )) continue;
    if (t.startsWith("/'")) { if (!t.includes("'/", 2)) inComment = true; continue; }
    if (/^@enduml\b/i.test(t)) break;

    if (skinPrefix !== undefined) {
      if (t === '}') skinPrefix = undefined;
      else { const [k, ...v] = t.split(/\s+/); if (k) d.skinparams[`${skinPrefix}.${k}`] = v.join(' '); }
      continue;
    }

    let m: RegExpMatchArray | null;

    if (t.startsWith('!')) { warn(`preprocessor directive not supported, skipped: ${t.split(/\s+/)[0]}`); continue; }

    // ---- directives -------------------------------------------------------
    if ((m = t.match(/^title(?:\s+(.*))?$/i))) {
      if (m[1]) d.title = txt(m[1]); else startBlock(/^end\s*title$/i, (x) => { d.title = x; });
      continue;
    }
    if ((m = t.match(/^(?:(?:left|right|center)\s+)?(header|footer)(?:\s+(.*))?$/i))) {
      const key = m[1]!.toLowerCase() as 'header' | 'footer';
      if (m[2]) d[key] = txt(m[2]); else startBlock(new RegExp(`^end\\s*${key}$`, 'i'), (x) => { d[key] = x; });
      continue;
    }
    if ((m = t.match(/^(hide|show)\s+footbox$/i))) { d.options.hideFootbox = m[1]!.toLowerCase() === 'hide'; continue; }
    if ((m = t.match(/^skinparam\s+(\w+)\s*\{$/i))) { skinPrefix = m[1]!; continue; }
    if ((m = t.match(/^skinparam\s+(\w+)\s+(.+)$/i))) { d.skinparams[m[1]!] = m[2]!.trim(); continue; }
    if (/^legend\b/i.test(t)) { warn('legend not supported, skipped'); startBlock(/^end\s*legend$/i, () => {}); continue; }
    if ((m = t.match(/^newpage\b\s*(.*)$/i))) {
      if (stack.length) warn('newpage inside a fragment is not supported, skipped');
      else cur().push({ type: 'newpage', line: ln, title: txt(m[1]) });
      continue;
    }

    if ((m = t.match(/^autonumber(?:\s+(.*))?$/i))) {
      const rest = m[1] ?? '';
      const fmt = rest.match(/"([^"]*)"/)?.[1];
      const words = rest.replace(/"[^"]*"/, '').trim().split(/\s+/).filter(Boolean);
      const w0 = words[0]?.toLowerCase();
      if (w0 === 'inc') { warn('autonumber inc not supported, skipped'); continue; }
      const nums = words.filter((w) => /^\d+$/.test(w)).map(Number);
      const ev: Event = {
        type: 'autonumber', line: ln,
        action: w0 === 'stop' ? 'stop' : w0 === 'resume' ? 'resume' : 'start',
      };
      if (ev.action === 'resume') { if (nums[0] !== undefined) ev.step = nums[0]; }
      else if (ev.action === 'start') { if (nums[0] !== undefined) ev.start = nums[0]; if (nums[1] !== undefined) ev.step = nums[1]; }
      if (fmt !== undefined) ev.format = fmt;
      cur().push(ev);
      continue;
    }

    // ---- layout helpers ---------------------------------------------------
    if ((m = t.match(/^==\s*(.*?)\s*==$/))) { cur().push({ type: 'divider', line: ln, text: txt(m[1]) }); continue; }
    if (t.startsWith('...')) { cur().push({ type: 'delay', line: ln, text: txt(t.replace(/^\.\.\.\s*/, '').replace(/\s*\.\.\.$/, '')) }); continue; }
    if ((m = t.match(/^\|\|(?:(\d+)\|\||\|)$/))) {
      cur().push({ type: 'spacing', line: ln, ...(m[1] ? { height: Number(m[1]) } : {}) });
      continue;
    }

    // ---- notes & refs -----------------------------------------------------
    const noteLine = ln;
    const pushNote = (shape: string, position: 'left' | 'right' | 'over' | 'across', targets: string[], color: string | undefined, inline: string | undefined) => {
      const make = (text: string) =>
        cur().push({ type: 'note', line: noteLine, shape: shape.toLowerCase() as 'note', position, targets, text, ...(color ? { color } : {}) });
      if (inline !== undefined) make(txt(inline));
      else startBlock(/^end\s*(h|r)?note$/i, make);
    };
    if ((m = t.match(NOTE_ACROSS))) { pushNote(m[1]!, 'across', [], m[2], m[3]); continue; }
    if ((m = t.match(NOTE_BARE))) {
      const target = lastTarget ?? d.participants[0]?.id;
      pushNote(m[1]!, m[2]!.toLowerCase() as 'left' | 'right', target ? [target] : [], m[3], m[4]);
      continue;
    }
    if ((m = t.match(NOTE))) {
      pushNote(m[1]!, m[2]!.toLowerCase() as 'left' | 'right' | 'over', ensureAll(m[3]!), m[4], m[5]);
      continue;
    }
    if ((m = t.match(REF))) {
      const targets = ensureAll(m[1]!);
      const refLine = ln;
      if (m[2] !== undefined) cur().push({ type: 'ref', line: ln, targets, text: txt(m[2]) });
      else startBlock(/^end\s*ref$/i, (x) => cur().push({ type: 'ref', line: refLine, targets, text: x }));
      continue;
    }

    // ---- participants -----------------------------------------------------
    if ((m = t.match(DECL))) { declare(m); continue; }
    if ((m = t.match(/^create\s+(.+)$/i))) {
      const dm = m[1]!.match(DECL) ?? `participant ${m[1]}`.match(DECL);
      const id = dm ? declare(dm) : ensure(m[1]!);
      const p = pmap.get(id); if (p) p.created = true;
      cur().push({ type: 'activation', line: ln, op: 'create', target: id });
      continue;
    }
    if ((m = t.match(/^(activate|deactivate|destroy)\s+("[^"]+"|\S+)(?:\s+(#\S+))?$/i))) {
      cur().push({
        type: 'activation', line: ln, op: m[1]!.toLowerCase() as 'activate',
        target: ensure(m[2]!), ...(m[3] ? { color: m[3] } : {}),
      });
      continue;
    }
    if ((m = t.match(/^return\b\s*(.*)$/i))) { cur().push({ type: 'return', line: ln, text: txt(m[1]) }); continue; }

    if ((m = t.match(/^box(?:\s+("[^"]*"|[^#\s][^#]*?))?(?:\s*(#\w+))?\s*$/i))) {
      d.boxes.push({ name: m[1] ? unq(m[1]) : '', line: ln, ...(m[2] ? { color: m[2] } : {}) });
      currentBox = d.boxes.length - 1;
      continue;
    }
    if (/^end\s*box$/i.test(t)) { currentBox = undefined; continue; }

    // ---- fragments --------------------------------------------------------
    if ((m = t.match(FRAGMENT)) && !/^[<\-\[]/.test(m[2]!)) {
      const f: Fragment = {
        type: 'fragment', kind: m[1]!.toLowerCase() as FragmentKind,
        line: ln, endLine: ln, sections: [{ label: txt(m[2]), line: ln, events: [] }],
      };
      cur().push(f);
      stack.push(f);
      continue;
    }
    if ((m = t.match(/^else\b\s*(.*)$/i))) {
      const f = stack[stack.length - 1];
      if (f) f.sections.push({ label: txt(m[1]), line: ln, events: [] });
      else warn("'else' outside of a block, skipped");
      continue;
    }
    if (/^end$/i.test(t)) {
      const f = stack.pop();
      if (f) f.endLine = ln; else warn("'end' without a matching block, skipped");
      continue;
    }

    // ---- messages ---------------------------------------------------------
    const parallel = /^&\s*/.test(t);
    if ((m = t.replace(/^&\s*/, '').match(MSG))) { message(m, parallel); continue; }

    warn(`unsupported syntax, skipped: ${t.length > 40 ? t.slice(0, 40) + '…' : t}`);
  }

  // ---- end of input: close anything left open -----------------------------
  if (block) { const b = block; block = undefined; warn('block is never closed', blockLine); b.done(txt(b.buf.join('\n'))); }
  for (const f of stack) { warn(`'${f.kind}' block is never closed`, f.line); f.endLine = lines.length; }
  if (currentBox !== undefined) warn("'box' is never closed", d.boxes[currentBox]!.line);

  // Honour `order N`; participants without one keep their natural position.
  if (d.participants.some((p) => p.order !== undefined)) {
    const key = new Map(d.participants.map((p, i) => [p, p.order ?? i]));
    d.participants.sort((a, b) => key.get(a)! - key.get(b)!);
  }
  return d;
}
