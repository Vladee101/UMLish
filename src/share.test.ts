import { describe, it, expect } from 'vitest';
import { encodeDoc, decodeDoc } from './share.ts';

describe('share', () => {
  it('round-trips text, including unicode and large input', async () => {
    const text = '@startuml\nA -> B : héllo → 世界\n' + 'x'.repeat(200_000) + '\n@enduml';
    const enc = await encodeDoc(text);
    expect(enc.startsWith('d=')).toBe(true);
    expect(await decodeDoc('#' + enc)).toBe(text);
  });
  it('rejects foreign or corrupt hashes', async () => {
    expect(await decodeDoc('#section-2')).toBe(undefined);
    expect(await decodeDoc('#d=!!!')).toBe(undefined);
    expect(await decodeDoc('#d=AAAA')).toBe(undefined);
  });
});
