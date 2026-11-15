export type Measure = (text: string, bold?: boolean) => number;

/** Browser measurer. Use the same family/size the SVG will use. */
export function canvasMeasure(family: string, size: number): Measure {
  const ctx = document.createElement('canvas').getContext('2d')!;
  return (text, bold = false) => {
    ctx.font = `${bold ? 'bold ' : ''}${size}px ${family}`;
    return ctx.measureText(text).width;
  };
}

/** Deterministic Helvetica-ish estimate for Node/tests where there is no canvas. */
export function estimateMeasure(size: number): Measure {
  return (text, bold = false) => {
    let w = 0;
    for (const ch of text) {
      w += /[ijl.,;:'|!\[\]()\s]/.test(ch) ? 0.28 : /[mwMW@]/.test(ch) ? 0.86 : /[A-Z0-9]/.test(ch) ? 0.68 : 0.54;
    }
    return w * size * (bold ? 1.06 : 1);
  };
}
