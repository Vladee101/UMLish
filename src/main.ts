import './style.css';
import { parse } from './parser/parse.ts';
import { layoutPages, type Scene } from './layout.ts';
import { renderSvg } from './render.ts';
import { classic, withSkinparams, type Theme } from './theme.ts';
import { canvasMeasure } from './measure.ts';
import { fontCss, loadFonts } from './fonts.ts';
import { createEditor } from './editor.ts';
import { createViewport } from './viewport.ts';
import { encodeDoc, decodeDoc } from './share.ts';
import { download, pngBlob, svgBlob } from './export.ts';
import { plainInline } from './richText.ts';

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
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const stage = $('stage'), view = $('view'), status = $('status');
const debounce = <A extends unknown[]>(fn: (...a: A) => void, ms: number) => {
  let t: number | undefined;
  return (...a: A) => { clearTimeout(t); t = window.setTimeout(() => fn(...a), ms); };
};
const store = {
  get: () => { try { return localStorage.getItem(KEY); } catch { return null; } },
  set: (v: string) => { try { localStorage.setItem(KEY, v); } catch { /* private mode etc. */ } },
};

async function main() {
  await loadFonts(classic.font.size);
  const vp = createViewport(view, stage);
  const pageSelect = $<HTMLSelectElement>('page');
  let scene: Scene | undefined, scenes: Scene[] = [], theme: Theme = classic, title = 'diagram', first = true;
  let page = 0;

  const showPage = () => {
    scene = scenes[page]!;
    title = (scene.title?.lines[0] ?? 'diagram').replace(/[^\w\- ]+/g, '').trim() || 'diagram';
    stage.innerHTML = renderSvg(scene, theme);
    if (first) { vp.fit(scene.viewBox.w, scene.viewBox.h); first = false; }
  };

  const render = (text: string) => {
    const d = parse(text);
    theme = withSkinparams(classic, d.skinparams);
    scenes = layoutPages(d, theme, canvasMeasure(theme.font.family, theme.font.size));
    if (page >= scenes.length) page = 0;
    pageSelect.hidden = scenes.length < 2;
    pageSelect.replaceChildren(...scenes.map((s, i) => new Option(s.title?.lines[0] ? plainInline(s.title.lines[0]) : `Page ${i + 1}`, String(i))));
    pageSelect.value = String(page);
    showPage();
    const warnings = [...d.warnings, ...scenes.flatMap((s) => s.warnings)];
    editor.setWarnings(warnings);
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

  const svgText = () => scene && renderSvg(scene, theme, { fontCss });
  pageSelect.onchange = () => {
    page = Number(pageSelect.value);
    showPage();
    if (scene) vp.fit(scene.viewBox.w, scene.viewBox.h);
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
