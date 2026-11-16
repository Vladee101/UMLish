import { describe, expect, it } from 'vitest';
import { CompletionContext } from '@codemirror/autocomplete';
import { EditorState } from '@codemirror/state';
import { plantumlCompletions } from './completion.ts';

const completions = (doc: string, pos = doc.length, explicit = true) =>
  plantumlCompletions(new CompletionContext(EditorState.create({ doc }), pos, explicit));

describe('PlantUML completions', () => {
  it('offers keywords at the current word', () => {
    const result = completions('par');
    expect(result?.from).toBe(0);
    expect(result?.options.some((o) => o.label === 'participant' && o.type === 'keyword')).toBe(true);
  });

  it('offers declared participant ids and labels', () => {
    const result = completions('participant "Web App" as Web\nWeb -> ');
    expect(result?.options[0]).toMatchObject({ label: 'Web', detail: 'Web App', type: 'variable' });
  });

  it('quotes participant ids containing spaces', () => {
    const result = completions('participant "Web App"\nWeb App -> ');
    expect(result?.options[0]?.apply).toBe('"Web App"');
  });

  it('offers ER entity names', () => {
    const result = completions('entity "Web Customer" as C\nC ||--o{ ');
    expect(result?.options[0]).toMatchObject({ label: 'C', detail: 'Web Customer', type: 'variable' });
  });

  it('does not open automatically without a word', () => {
    expect(completions('A -> B : ', 9, false)).toBeNull();
  });
});
