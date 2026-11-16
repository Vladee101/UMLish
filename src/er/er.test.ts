import { describe, expect, it } from 'vitest';
import { estimateMeasure } from '../measure.ts';
import { classic, handDrawn } from '../theme.ts';
import { isErDiagram, parseEr } from './parse.ts';
import { layoutEr } from './layout.ts';
import { renderErSvg } from './render.ts';

describe('ER parser', () => {
  it('detects ER syntax without matching sequence messages', () => {
    expect(isErDiagram('@startuml\nentity User {\n}\n@enduml')).toBe(true);
    expect(isErDiagram('@startuml\nUser --> Web : hello\n@enduml')).toBe(false);
    expect(isErDiagram('@startuml\nentity User\nUser -> Web : hello\n@enduml')).toBe(false);
  });

  it('parses aliases, attributes, keys, and relationships', () => {
    const d = parseEr(`@startuml
entity "Web Customer" as C {
  * id : INT <<PK>>
  + email : VARCHAR <<UK>>
}
C ||--o{ Order : places
@enduml`);
    expect(d.entities[0]).toMatchObject({ id: 'C', label: 'Web Customer' });
    expect(d.entities[0]!.attributes).toMatchObject([
      { name: 'id', type: 'INT', key: 'PK', required: true },
      { name: 'email', type: 'VARCHAR', key: 'UK', visibility: '+' },
    ]);
    expect(d.relationships[0]).toMatchObject({ from: 'C', to: 'Order', fromCardinality: '||', toCardinality: 'o{', label: 'places' });
    expect(d.warnings).toEqual([]);
  });

  it('creates implicit relationship entities', () => {
    const d = parseEr('A ||--|| B');
    expect(d.entities.map((e) => e.id)).toEqual(['A', 'B']);
  });

  it('warns about unclosed entities', () => {
    const d = parseEr('entity Broken {\n id : INT');
    expect(d.warnings[0]).toMatchObject({ line: 1, message: "'Broken' entity is never closed" });
  });
});

describe('ER layout and rendering', () => {
  const source = '@startuml\nentity A {\n * id : INT <<PK>>\n}\nentity B\nA ||--o{ B : includes\n@enduml';

  it('positions separate entities and connects their borders', () => {
    const d = parseEr(source);
    const scene = layoutEr(d, classic, estimateMeasure(classic.font.size));
    expect(scene.entities).toHaveLength(2);
    expect(scene.entities[0]!.x + scene.entities[0]!.w).toBeLessThan(scene.entities[1]!.x);
    expect(scene.relationships[0]!.points[0]![0]).toBe(scene.entities[0]!.x + scene.entities[0]!.w);
    expect(scene.relationships[0]!.points[1]![0]).toBe(scene.entities[1]!.x);
  });

  it('renders labels, keys, and crow-foot markers with escaping', () => {
    const d = parseEr(source);
    const svg = renderErSvg(layoutEr(d, classic, estimateMeasure(classic.font.size)), classic);
    expect(svg).toContain('includes');
    expect(svg).toContain('INT PK');
    expect(svg).toContain('<circle');
    expect(svg).toContain('data-line="6"');
  });

  it('supports deterministic hand-drawn ER rendering', () => {
    const d = parseEr(source);
    const draw = () => renderErSvg(layoutEr(d, handDrawn, estimateMeasure(handDrawn.font.size)), handDrawn);
    expect(draw()).toBe(draw());
    expect(draw()).toContain('<path');
  });
});
