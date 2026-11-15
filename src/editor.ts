import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { StreamLanguage, HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { lintGutter, setDiagnostics, type Diagnostic } from '@codemirror/lint';
import { tags } from '@lezer/highlight';
import type { Warning } from './parser/ast.ts';

const KEYWORDS = new Set((
  'participant actor boundary control entity database collections queue as order create destroy activate deactivate return ' +
  'alt else opt loop par par2 break critical group end note hnote rnote over left right of across ref box title header footer ' +
  'autonumber stop resume hide show footbox skinparam newpage legend'
).split(' '));

const plantuml = StreamLanguage.define<{ label: boolean }>({
  startState: () => ({ label: false }),
  token(stream, st) {
    if (stream.sol()) st.label = false;
    if (stream.eatSpace()) return null;
    if (stream.sol() || stream.string.slice(0, stream.pos).trim() === '') {
      if (stream.match(/'.*/)) return 'comment';
      if (stream.match(/@\w+/) || stream.match(/![\w.]+/)) return 'meta';
    }
    if (st.label) { stream.skipToEnd(); return 'string'; }
    if (stream.match(/"[^"]*"/)) return 'string';
    if (stream.match(/#\w+/)) return 'atom';
    if ((stream.peek() === '-' || stream.peek() === '<') && stream.match(/[<\\/]*-+(?:\[[^\]]*\])?-*[>\\/]*[ox]?/)) return 'operator';
    if (stream.eat(':')) { st.label = true; return 'punctuation'; }
    if (stream.match(/[A-Za-z_]\w*/)) return KEYWORDS.has((stream.current()).toLowerCase()) ? 'keyword' : null;
    stream.next();
    return null;
  },
});

const highlight = HighlightStyle.define([
  { tag: tags.keyword, color: '#8b1a3a', fontWeight: '600' },
  { tag: tags.comment, color: '#7a8b7a', fontStyle: 'italic' },
  { tag: tags.string, color: '#1f5f8b' },
  { tag: tags.operator, color: '#a80036' },
  { tag: tags.atom, color: '#7c4dbd' },
  { tag: tags.meta, color: '#b45309' },
]);

export interface Editor {
  getDoc(): string;
  setDoc(text: string): void;
  setWarnings(w: Warning[]): void;
  goToLine(n: number): void;
}

export function createEditor(parent: HTMLElement, doc: string, onChange: (text: string) => void): Editor {
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc,
      extensions: [
        lineNumbers(), lintGutter(), history(), drawSelection(), highlightActiveLine(),
        plantuml, syntaxHighlighting(highlight),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        EditorView.updateListener.of((u) => { if (u.docChanged) onChange(u.state.doc.toString()); }),
        EditorView.theme({ '&': { height: '100%' }, '.cm-scroller': { fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: '13px' } }),
      ],
    }),
  });
  return {
    getDoc: () => view.state.doc.toString(),
    setDoc: (text) => view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } }),
    setWarnings(ws) {
      const diags: Diagnostic[] = ws
        .filter((w) => w.line >= 1 && w.line <= view.state.doc.lines)
        .map((w) => { const l = view.state.doc.line(w.line); return { from: l.from, to: l.to, severity: 'warning', message: w.message }; });
      view.dispatch(setDiagnostics(view.state, diags));
    },
    goToLine(n) {
      if (n < 1 || n > view.state.doc.lines) return;
      const l = view.state.doc.line(n);
      view.dispatch({ selection: { anchor: l.from, head: l.to }, scrollIntoView: true });
      view.focus();
    },
  };
}
