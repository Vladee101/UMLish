import { describe, it, expect } from 'vitest';
import { parse } from './parser/parse.ts';
import { layout, type Shape } from './layout.ts';
import { renderSvg } from './render.ts';
import { classic } from './theme.ts';
import { estimateMeasure } from './measure.ts';

const run = (body: string) => {
  const d = parse(`@startuml\n${body}\n@enduml`);
  const scene = layout(d, classic, estimateMeasure(classic.font.size));
  return { d, scene, msgs: scene.shapes.filter((s): s is Extract<Shape, { t: 'message' }> => s.t === 'message') };
};

describe('layout', () => {
  it('stacks messages top to bottom', () => {
    const { msgs } = run('A -> B\nB --> A\nA -> A');
    expect(msgs.map((m) => m.y)).toEqual([...msgs.map((m) => m.y)].sort((a, b) => a - b));
    expect(new Set(msgs.map((m) => m.y)).size).toBe(3);
  });
  it('widens columns so long labels fit between lifelines', () => {
    const short = run('A -> B : hi').msgs[0]!, long = run('A -> B : a rather long message label here').msgs[0]!;
    expect(Math.abs(long.x2 - long.x1)).toBeGreaterThan(Math.abs(short.x2 - short.x1));
  });
  it('return goes back to the original caller, not the last activated participant', () => {
    const { msgs, scene } = run('A -> B ++ : call\nB -> C ++ : inner\nreturn r1\nreturn r2');
    expect(scene.warnings).toEqual([]);
    const [, , r1, r2] = msgs;
    expect(r1!.x2).toBeLessThan(r1!.x1); // C -> B (leftwards)
    expect(r2!.x2).toBeLessThan(r2!.x1); // B -> A
    expect(r2!.dashed).toBe(true);
  });
  it('produces well-formed SVG with data-line attributes', () => {
    const { scene } = run('A -> B : <&> "q"');
    const svg = renderSvg(scene, classic);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('data-line="2"');
    expect(svg).toContain('&lt;&amp;&gt; &quot;q&quot;');
  });
});
