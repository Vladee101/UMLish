import { describe, expect, it } from 'vitest';
import { layout } from './layout.ts';
import { estimateMeasure } from './measure.ts';
import { parse } from './parser/parse.ts';
import { renderSvg } from './render.ts';
import { classic, handDrawn, modern, withSkinparams, type Theme } from './theme.ts';

const draw = (theme: Theme) => {
  const diagram = parse('@startuml\nparticipant "Web App" as Web\nUser -> Web ++ : hello\nnote right of Web : reply\n@enduml');
  return renderSvg(layout(diagram, theme, estimateMeasure(theme.font.size)), theme);
};

describe('themes', () => {
  it('renders the modern palette and geometry', () => {
    const svg = draw(modern);
    expect(svg).toContain('fill="#F8FAFC"');
    expect(svg).toContain('stroke="#4F46E5"');
    expect(svg).toContain('rx="8"');
  });

  it('renders deterministic irregular paths for the hand-drawn theme', () => {
    const svg = draw(handDrawn);
    expect(svg).toContain('stroke-linecap="round"');
    expect(svg).toContain('stroke-linejoin="round"');
    expect(svg).toBe(draw(handDrawn));
    expect(svg).not.toBe(draw(classic));
  });

  it('applies skinparams without mutating the selected base theme', () => {
    const themed = withSkinparams(handDrawn, {
      participantbackgroundcolor: '#red',
      defaultfontsize: '16',
    });
    expect(themed.color.boxFill).toBe('red');
    expect(themed.font.size).toBe(16);
    expect(themed.lineStyle).toBe('sketch');
    expect(handDrawn.color.boxFill).toBe('#FFF1C2');
    expect(handDrawn.font.size).toBe(13);
  });
});
