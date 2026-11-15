import { describe, it, expect } from 'vitest';
import { parse } from './parse.ts';
import type { Message, Fragment } from './ast.ts';

const wrap = (body: string) => `@startuml\n${body}\n@enduml`;
const msgs = (src: string) => parse(wrap(src)).events.filter((e): e is Message => e.type === 'message');

describe('participants', () => {
  it('handles aliases in both orders and kinds', () => {
    const d = parse(wrap('actor "Big User" as U #red\ndatabase DB as "Main DB"'));
    expect(d.participants).toMatchObject([
      { id: 'U', label: 'Big User', kind: 'actor', color: '#red', implicit: false },
      { id: 'DB', label: 'Main DB', kind: 'database' },
    ]);
  });
  it('creates implicit participants in order of appearance', () => {
    const d = parse(wrap('A -> B\nB -> C'));
    expect(d.participants.map((p) => p.id)).toEqual(['A', 'B', 'C']);
    expect(d.participants.every((p) => p.implicit)).toBe(true);
  });
  it('promotes an implicit participant when declared later', () => {
    const d = parse(wrap('A -> B\nactor A'));
    expect(d.participants[0]).toMatchObject({ id: 'A', kind: 'actor', implicit: false });
    expect(d.participants).toHaveLength(2);
  });
});

describe('arrows', () => {
  it('classifies common arrows', () => {
    const [a, b, c, d] = msgs('A -> B\nA --> B\nA ->> B\nA ->x B');
    expect(a).toMatchObject({ dashed: false, endHead: 'filled' });
    expect(b).toMatchObject({ dashed: true, endHead: 'filled' });
    expect(c).toMatchObject({ endHead: 'open' });
    expect(d).toMatchObject({ endHead: 'cross' });
  });
  it('normalises reversed arrows', () => {
    const [m] = msgs('A <- B : hi');
    expect(m).toMatchObject({ from: { id: 'B' }, to: { id: 'A' }, text: 'hi', endHead: 'filled' });
  });
  it('supports bidirectional, colored and edge arrows', () => {
    const [a, b, c, d] = msgs('A <-> B\nA -[#red]> B\n[-> A\nA ->]');
    expect(a).toMatchObject({ startHead: 'filled', endHead: 'filled' });
    expect(b).toMatchObject({ color: '#red', dashed: false });
    expect(c).toMatchObject({ from: { kind: 'edge', side: 'left' } });
    expect(d).toMatchObject({ to: { kind: 'edge', side: 'right' } });
  });
  it('parses self messages, no-space syntax, and ++ shorthand', () => {
    const [a, b, c] = msgs('A -> A : self\nA->B:tight\nA -> B ++ #gold : go');
    expect(a!.from).toEqual(a!.to);
    expect(b).toMatchObject({ text: 'tight' });
    expect(c).toMatchObject({ activation: { op: '++', color: '#gold' }, text: 'go' });
  });
  it('turns literal \\n into newlines', () => {
    expect(msgs('A -> B : one\\ntwo')[0]!.text).toBe('one\ntwo');
  });
});

describe('structure', () => {
  it('nests fragments and splits else sections', () => {
    const d = parse(wrap('alt ok\nA -> B\nloop 3 times\nB -> A\nend\nelse bad\nA -> C\nend'));
    const alt = d.events[0] as Fragment;
    expect(alt.kind).toBe('alt');
    expect(alt.sections.map((s) => s.label)).toEqual(['ok', 'bad']);
    expect((alt.sections[0]!.events[1] as Fragment).kind).toBe('loop');
    expect(d.warnings).toEqual([]);
  });
  it('parses single- and multi-line notes', () => {
    const d = parse(wrap('A -> B\nnote over A, B #pink : one\nnote right of B\nline1\nline2\nend note'));
    const notes = d.events.filter((e) => e.type === 'note');
    expect(notes[0]).toMatchObject({ position: 'over', targets: ['A', 'B'], color: '#pink', text: 'one' });
    expect(notes[1]).toMatchObject({ position: 'right', targets: ['B'], text: 'line1\nline2' });
  });
  it('parses activation, return, dividers, delays, spacing', () => {
    const d = parse(wrap('activate A\nreturn ok\n== Phase 2 ==\n... later ...\n||30||\ndeactivate A'));
    expect(d.events.map((e) => e.type)).toEqual(['activation', 'return', 'divider', 'delay', 'spacing', 'activation']);
  });
  it('parses autonumber variants', () => {
    const d = parse(wrap('autonumber 10 5 "<b>[000]"\nautonumber stop\nautonumber resume'));
    expect(d.events).toMatchObject([
      { action: 'start', start: 10, step: 5, format: '<b>[000]' }, { action: 'stop' }, { action: 'resume' },
    ]);
  });
  it('honours title, hide footbox, skinparam, boxes', () => {
    const d = parse(wrap('title Hello\nhide footbox\nskinparam sequence {\nArrowColor red\n}\nbox "Svc" #lightblue\nparticipant X\nend box\nparticipant Y'));
    expect(d.title).toBe('Hello');
    expect(d.options.hideFootbox).toBe(true);
    expect(d.skinparams['sequence.ArrowColor']).toBe('red');
    expect(d.boxes).toMatchObject([{ name: 'Svc', color: '#lightblue' }]);
    expect(d.participants.map((p) => p.box)).toEqual([0, undefined]);
  });
});

describe('tier 2 syntax', () => {
  it('parses parallel messages and page breaks', () => {
    const d = parse(wrap('A -> B : first\n& B -> A : second\nnewpage Next page\nA -> B : third'));
    expect(d.events).toMatchObject([
      { type: 'message', text: 'first' },
      { type: 'message', text: 'second', parallel: true },
      { type: 'newpage', title: 'Next page' },
      { type: 'message', text: 'third' },
    ]);
    expect(d.warnings).toEqual([]);
  });
});

describe('tolerance', () => {
  it('warns instead of failing on unsupported syntax', () => {
    const d = parse(wrap('!include foo.puml\nA -> B\nwat is this\n'));
    expect(d.events).toHaveLength(1);
    expect(d.warnings.map((w) => w.line)).toEqual([2, 4]);
  });
  it('closes unterminated blocks with a warning', () => {
    const d = parse(wrap('alt x\nA -> B'));
    expect(d.warnings).toHaveLength(1);
    expect((d.events[0] as Fragment).sections[0]!.events).toHaveLength(1);
  });
  it('ignores comments and works without @startuml', () => {
    const d = parse("' comment\n/' block\nA -> Z '/\nA -> B");
    expect(d.events).toHaveLength(1);
  });
});
