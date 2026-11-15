import { download } from './export.ts';

interface WritableFile {
  write(data: Blob): Promise<void>;
  close(): Promise<void>;
}

export interface DiagramFileHandle {
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<WritableFile>;
}

interface FilePickerOptions {
  multiple?: boolean;
  suggestedName?: string;
  types?: { description: string; accept: Record<string, string[]> }[];
}

type OpenPicker = (options: FilePickerOptions) => Promise<DiagramFileHandle[]>;
type SavePicker = (options: FilePickerOptions) => Promise<DiagramFileHandle>;

const pickerOptions = {
  types: [{ description: 'PlantUML diagrams', accept: { 'text/plain': ['.puml', '.txt'] } }],
};

const diagramBlob = (text: string) => new Blob([text], { type: 'text/plain;charset=utf-8' });

export async function openDiagram(input: HTMLInputElement) {
  const pickerWindow = window as unknown as { showOpenFilePicker?: OpenPicker };
  if (pickerWindow.showOpenFilePicker) {
    const [handle] = await pickerWindow.showOpenFilePicker({ ...pickerOptions, multiple: false });
    if (!handle) return undefined;
    const file = await handle.getFile();
    return { name: handle.name, text: await file.text(), handle };
  }

  return new Promise<{ name: string; text: string } | undefined>((resolve, reject) => {
    input.value = '';
    input.oncancel = () => resolve(undefined);
    input.onchange = async () => {
      try {
        const file = input.files?.[0];
        resolve(file ? { name: file.name, text: await file.text() } : undefined);
      } catch (error) { reject(error); }
    };
    input.click();
  });
}

export async function saveDiagram(name: string, text: string, handle?: DiagramFileHandle) {
  const pickerWindow = window as unknown as { showSaveFilePicker?: SavePicker };
  if (pickerWindow.showSaveFilePicker) {
    const target = handle ?? await pickerWindow.showSaveFilePicker({ ...pickerOptions, suggestedName: name });
    const writable = await target.createWritable();
    try { await writable.write(diagramBlob(text)); }
    finally { await writable.close(); }
    return target;
  }

  download(name, diagramBlob(text));
  return undefined;
}
