/** Everything visual lives here as data. Layout and renderer read only from a Theme. */
export interface Theme {
  font: { family: string; size: number; lineHeight: number };
  color: {
    bg: string; text: string; line: string; lifeline: string;
    boxFill: string; boxStroke: string; noteFill: string; noteStroke: string;
    barFill: string; barStroke: string; fragStroke: string; tabFill: string; groupFill: string;
  };
  stroke: { box: number; line: number; lifeline: number; frag: number };
  size: {
    margin: number; minBox: number; boxPadX: number; boxPadY: number; boxRadius: number;
    iconW: number; iconH: number; minGap: number; boxGap: number; afterBoxes: number;
    labelGap: number; rowGap: number; selfW: number; selfH: number; edgeLen: number;
    actW: number; actShift: number; notePadX: number; notePadY: number; noteFold: number;
    fragPad: number; tabH: number; lifeTail: number; dividerH: number; delayH: number;
  };
}

export const classic: Theme = {
  font: { family: "'Liberation Sans', Arimo, Helvetica, Arial, sans-serif", size: 13, lineHeight: 16 },
  color: {
    bg: '#FFFFFF', text: '#000000', line: '#A80036', lifeline: '#A80036',
    boxFill: '#FEFECE', boxStroke: '#A80036', noteFill: '#FBFB77', noteStroke: '#A80036',
    barFill: '#FFFFFF', barStroke: '#A80036', fragStroke: '#000000', tabFill: '#EEEEEE', groupFill: '#EEEEEE',
  },
  stroke: { box: 1.5, line: 1, lifeline: 0.5, frag: 1.5 },
  size: {
    margin: 10, minBox: 30, boxPadX: 7, boxPadY: 4, boxRadius: 2.5,
    iconW: 32, iconH: 38, minGap: 40, boxGap: 14, afterBoxes: 6,
    labelGap: 4, rowGap: 14, selfW: 24, selfH: 14, edgeLen: 30,
    actW: 10, actShift: 5, notePadX: 8, notePadY: 5, noteFold: 10,
    fragPad: 10, tabH: 20, lifeTail: 14, dividerH: 28, delayH: 30,
  },
};

/** CSS accepts `red` but not `#red`; PlantUML uses both spellings. */
export const css = (c: string) => (/^#([0-9a-f]{3,8})$/i.test(c) ? c : c.replace(/^#/, ''));

const SKIN: Record<string, (t: Theme, v: string) => void> = {
  arrowcolor: (t, v) => { t.color.line = css(v); },
  lifelinebordercolor: (t, v) => { t.color.lifeline = css(v); },
  participantbackgroundcolor: (t, v) => { t.color.boxFill = css(v); },
  participantbordercolor: (t, v) => { t.color.boxStroke = css(v); },
  notebackgroundcolor: (t, v) => { t.color.noteFill = css(v); },
  notebordercolor: (t, v) => { t.color.noteStroke = css(v); },
  backgroundcolor: (t, v) => { t.color.bg = css(v); },
  defaultfontname: (t, v) => { t.font.family = `'${v}', ${t.font.family}`; },
  defaultfontsize: (t, v) => { const n = Number(v); if (n > 0) { t.font.size = n; t.font.lineHeight = Math.round(n * 1.23); } },
};

export function withSkinparams(base: Theme, skin: Record<string, string>): Theme {
  const t: Theme = structuredClone(base);
  for (const [k, v] of Object.entries(skin)) {
    const key = k.toLowerCase().replace(/^sequence\.?/, '').replace(/^\./, '');
    SKIN[key]?.(t, v);
  }
  return t;
}
