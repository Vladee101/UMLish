import type { Measure } from './measure.ts';
import { css } from './theme.ts';

export interface InlineSpan {
  text: string;
  bold?: boolean;
  italic?: boolean;
  color?: string;
}

const validColor = (value: string) => /^(?:#[0-9a-f]{3,8}|[a-z]+)$/i.test(value);

export function inlineSpans(text: string): InlineSpan[] {
  const spans: InlineSpan[] = [];
  const colors: string[] = [];
  let bold = false, italic = false, buf = '';

  const push = () => {
    if (!buf) return;
    const color = colors[colors.length - 1];
    spans.push({ text: buf, ...(bold ? { bold } : {}), ...(italic ? { italic } : {}), ...(color ? { color: css(color) } : {}) });
    buf = '';
  };

  for (let i = 0; i < text.length;) {
    if (text.startsWith('**', i) && (bold || text.includes('**', i + 2))) {
      push(); bold = !bold; i += 2; continue;
    }
    if (text.startsWith('//', i) && (italic || text.includes('//', i + 2))) {
      push(); italic = !italic; i += 2; continue;
    }
    if (text.startsWith('</color>', i) && colors.length) {
      push(); colors.pop(); i += 8; continue;
    }
    if (text.startsWith('<color:', i)) {
      const end = text.indexOf('>', i + 7);
      const color = text.slice(i + 7, end);
      if (end > 0 && validColor(color) && text.includes('</color>', end + 1)) {
        push(); colors.push(color); i = end + 1; continue;
      }
    }
    buf += text[i]!;
    i++;
  }
  push();
  return spans;
}

export const plainInline = (text: string) => inlineSpans(text).map((span) => span.text).join('');

export function measureInline(text: string, measure: Measure, bold = false): number {
  return inlineSpans(text).reduce((width, span) => width + measure(span.text, bold || span.bold, span.italic), 0);
}
