import './style.css';
import { parse } from './parser/parse.ts';
import { layoutPages, type Scene } from './layout.ts';
import { renderSvg } from './render.ts';
import { classic, themes, withSkinparams, type Theme, type ThemeName } from './theme.ts';
import { canvasMeasure } from './measure.ts';
import { fontCss, loadFonts } from './fonts.ts';
import { createEditor } from './editor.ts';
import { createViewport } from './viewport.ts';
import { encodeDoc, decodeDoc } from './share.ts';
import { download, pngBlob, svgBlob } from './export.ts';
import { plainInline } from './richText.ts';
import { openDiagram, saveDiagram, type DiagramFileHandle } from './files.ts';
import type { Warning } from './parser/ast.ts';

const SAMPLE = `@startuml
title Login flow
autonumber
actor User
participant "Web App" as Web
database DB

User -> Web : open page
Web -> DB ++ : SELECT user
DB --> Web -- : row
alt valid credentials
  Web -> User : welcome
else invalid
  Web -[#red]>x User : denied
end
note right of Web : cached for 5 min
@enduml`;

const KEY = 'seqdiagram:doc';
const THEME_KEY = 'seqdiagram:theme';
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const stage = $('stage'), view = $('view'), status = $('status');
const debounce = <A extends unknown[]>(fn: (...a: A) => void, ms: number) => {
  let t: number | undefined;
  return (...a: A) => { clearTimeout(t); t = window.setTimeout(() => fn(...a), ms); };
};
const store = {
  get: (key = KEY) => { try { return localStorage.getItem(key); } catch { return null; } },
  set: (v: string, key = KEY) => { try { localStorage.setItem(key, v); } catch { /* private mode etc. */ } },
};

async function main() {
  await loadFonts(classic.font.size);
  const vp = createViewport(view, stage);
  const pageSelect = $<HTMLSelectElement>('page'), themeSelect = $<HTMLSelectElement>('theme');
  const savedTheme = store.get(THEME_KEY);
  let themeName: ThemeName = savedTheme && Object.hasOwn(themes, savedTheme) ? savedTheme as ThemeName : 'classic';
  themeSelect.value = themeName;
  let scene: Scene | undefined, scenes: Scene[] = [], theme: Theme = themes[themeName], title = 'diagram', first = true;
  let page = 0, fileHandle: DiagramFileHandle | undefined, fileName = 'diagram.puml';
  const warningsPanel = $('warnings'), warningList = $('warning-list');

  const showWarnings = (warnings: Warning[]) => {
    warningsPanel.hidden = warnings.length === 0;
    $('warnings-title').textContent = `Warnings (${warnings.length})`;
    warningList.replaceChildren(...warnings.map((warning) => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.dataset.line = String(warning.line);
      const line = document.createElement('span');
      line.className = 'warning-line';
      line.textContent = `Line ${warning.line}`;
      const message = document.createElement('span');
      message.textContent = warning.message;
      button.append(line, message);
      item.append(button);
      return item;
    }));
  };

  const showPage = () => {
    scene = scenes[page]!;
    title = (scene.title?.lines[0] ?? 'diagram').replace(/[^\w\- ]+/g, '').trim() || 'diagram';
    stage.innerHTML = renderSvg(scene, theme);
    if (first) { vp.fit(scene.viewBox.w, scene.viewBox.h); first = false; }
  };

  const render = (text: string) => {
    const d = parse(text);
    theme = withSkinparams(themes[themeName], d.skinparams);
    scenes = layoutPages(d, theme, canvasMeasure(theme.font.family, theme.font.size));
    if (page >= scenes.length) page = 0;
    pageSelect.hidden = scenes.length < 2;
    pageSelect.replaceChildren(...scenes.map((s, i) => new Option(s.title?.lines[0] ? plainInline(s.title.lines[0]) : `Page ${i + 1}`, String(i))));
    pageSelect.value = String(page);
    showPage();
    const warnings = [...d.warnings, ...scenes.flatMap((s) => s.warnings)];
    editor.setWarnings(warnings);
    showWarnings(warnings);
    status.textContent = warnings.length ? `${warnings.length} warning${warnings.length > 1 ? 's' : ''}` : '';
  };

  const syncHash = debounce(async (text: string) => {
    history.replaceState(null, '', '#' + (await encodeDoc(text)));
  }, 500);
  const onChange = (text: string) => { store.set(text); syncHash(text); renderSoon(text); };
  const renderSoon = debounce(render, 120);

  const fromHash = await decodeDoc(location.hash);
  const editor = createEditor($('editor'), fromHash ?? store.get() ?? SAMPLE, onChange);
  render(editor.getDoc());

  addEventListener('hashchange', async () => {
    const t = await decodeDoc(location.hash);
    if (t !== undefined && t !== editor.getDoc()) editor.setDoc(t);
  });

  stage.addEventListener('click', (e) => {
    const el = (e.target as Element).closest('[data-line]');
    const n = Number(el?.getAttribute('data-line'));
    if (n) editor.goToLine(n);
  });
  warningList.addEventListener('click', (e) => {
    const button = (e.target as Element).closest('[data-line]');
    const n = Number(button?.getAttribute('data-line'));
    if (n) editor.goToLine(n);
  });

  const svgText = () => scene && renderSvg(scene, theme, { fontCss });
  themeSelect.onchange = () => {
    themeName = themeSelect.value as ThemeName;
    store.set(themeName, THEME_KEY);
    render(editor.getDoc());
    if (scene) vp.fit(scene.viewBox.w, scene.viewBox.h);
  };
  pageSelect.onchange = () => {
    page = Number(pageSelect.value);
    showPage();
    if (scene) vp.fit(scene.viewBox.w, scene.viewBox.h);
  };
  $('open').onclick = async () => {
    try {
      const file = await openDiagram($<HTMLInputElement>('file-input'));
      if (!file) return;
      fileHandle = 'handle' in file ? file.handle : undefined;
      fileName = file.name;
      editor.setDoc(file.text);
      status.textContent = `Opened ${file.name}`;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      status.textContent = 'Could not open file';
    }
  };
  $('save').onclick = async () => {
    try {
      fileHandle = await saveDiagram(fileName, editor.getDoc(), fileHandle);
      if (fileHandle) fileName = fileHandle.name;
      status.textContent = `Saved ${fileName}`;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      status.textContent = 'Could not save file';
    }
  };
  $('fit').onclick = () => scene && vp.fit(scene.viewBox.w, scene.viewBox.h);
  $('svg').onclick = () => { const s = svgText(); if (s) download(`${title}.svg`, svgBlob(s)); };
  $('png').onclick = async () => { const s = svgText(); if (s) download(`${title}.png`, await pngBlob(s, 2)); };
  $('print').onclick = () => print();
  $('link').onclick = async () => {
    history.replaceState(null, '', '#' + (await encodeDoc(editor.getDoc())));
    try { await navigator.clipboard.writeText(location.href); status.textContent = 'Link copied'; }
    catch { status.textContent = 'Copy the address bar to share'; }
    setTimeout(() => render(editor.getDoc()), 2000);
  };
}
main();
