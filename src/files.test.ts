import { afterEach, describe, expect, it, vi } from 'vitest';
import { openDiagram, saveDiagram, type DiagramFileHandle } from './files.ts';

const sourceFile = (text: string) => ({ name: 'flow.puml', text: async () => text }) as File;

const writableHandle = () => {
  const write = vi.fn(async (_data: Blob) => {});
  const close = vi.fn(async () => {});
  const handle: DiagramFileHandle = {
    name: 'flow.puml',
    getFile: async () => sourceFile('A -> B'),
    createWritable: async () => ({ write, close }),
  };
  return { handle, write, close };
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('diagram files', () => {
  it('opens a file through the File System Access API', async () => {
    const { handle } = writableHandle();
    const showOpenFilePicker = vi.fn(async () => [handle]);
    vi.stubGlobal('window', { showOpenFilePicker });

    await expect(openDiagram({} as HTMLInputElement)).resolves.toEqual({
      name: 'flow.puml', text: 'A -> B', handle,
    });
    expect(showOpenFilePicker).toHaveBeenCalledOnce();
  });

  it('saves back to an existing file handle', async () => {
    const { handle, write, close } = writableHandle();
    const showSaveFilePicker = vi.fn();
    vi.stubGlobal('window', { showSaveFilePicker });

    await expect(saveDiagram('flow.puml', 'A -> C', handle)).resolves.toBe(handle);
    expect(showSaveFilePicker).not.toHaveBeenCalled();
    expect(write).toHaveBeenCalledOnce();
    expect(await write.mock.calls[0]![0].text()).toBe('A -> C');
    expect(close).toHaveBeenCalledOnce();
  });

  it('downloads the source when file pickers are unavailable', async () => {
    vi.useFakeTimers();
    const anchor = { click: vi.fn(), href: '', download: '' };
    vi.stubGlobal('window', {});
    vi.stubGlobal('document', { createElement: () => anchor });
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:diagram', revokeObjectURL: vi.fn() });

    await expect(saveDiagram('flow.puml', 'A -> B')).resolves.toBeUndefined();
    expect(anchor.download).toBe('flow.puml');
    expect(anchor.click).toHaveBeenCalledOnce();
  });

  it('reads a selected file through the input fallback', async () => {
    vi.stubGlobal('window', {});
    const input = {
      value: 'old', files: [sourceFile('A -> B')], onchange: null, oncancel: null,
      click() { queueMicrotask(() => input.onchange?.(new Event('change'))); },
    } as unknown as HTMLInputElement;

    await expect(openDiagram(input)).resolves.toEqual({ name: 'flow.puml', text: 'A -> B' });
  });
});
