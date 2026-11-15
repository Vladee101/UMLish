import { describe, expect, it } from 'vitest';
import { estimateMeasure } from './measure.ts';
import { inlineSpans, measureInline } from './richText.ts';

describe('Creole inline markup', () => {
  it('parses nested bold, italic, and color spans', () => {
    expect(inlineSpans('plain **bold //both//** <color:red>red</color>')).toEqual([
      { text: 'plain ' },
      { text: 'bold ', bold: true },
      { text: 'both', bold: true, italic: true },
      { text: ' ' },
      { text: 'red', color: 'red' },
    ]);
  });

  it('leaves unmatched markup and invalid colors literal', () => {
    expect(inlineSpans('**open //text <color:bad-value>x</color>')).toEqual([
      { text: '**open //text <color:bad-value>x</color>' },
    ]);
  });

  it('measures visible text with bold and italic styles', () => {
    const measure = estimateMeasure(13);
    expect(measureInline('**bold** //italic// <color:red>red</color>', measure)).toBeGreaterThan(measureInline('bold italic red', measure));
    expect(measureInline('<color:#FF0000>red</color>', measure)).toBe(measureInline('red', measure));
  });
});
