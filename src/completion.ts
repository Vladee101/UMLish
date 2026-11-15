import type { Completion, CompletionContext } from '@codemirror/autocomplete';
import { parse } from './parser/parse.ts';

export const PLANTUML_KEYWORDS = (
  'participant actor boundary control entity database collections queue as order create destroy activate deactivate return ' +
  'alt else opt loop par par2 break critical group end note hnote rnote over left right of across ref box title header footer ' +
  'autonumber stop resume hide show footbox skinparam newpage legend'
).split(' ');

export function plantumlCompletions(context: CompletionContext) {
  const word = context.matchBefore(/[\p{L}\p{N}_@-]*$/u);
  if (!word || (word.from === word.to && !context.explicit)) return null;

  const keywords: Completion[] = [...PLANTUML_KEYWORDS, '@startuml', '@enduml']
    .map((label) => ({ label, type: 'keyword' }));
  const participants = parse(context.state.doc.toString()).participants.map((p): Completion => ({
    label: p.id,
    apply: /\s/.test(p.id) ? `"${p.id}"` : p.id,
    detail: p.label === p.id ? p.kind : p.label,
    type: 'variable',
    boost: 1,
  }));

  return { from: word.from, options: [...participants, ...keywords], validFor: /^[\p{L}\p{N}_@-]*$/u };
}
