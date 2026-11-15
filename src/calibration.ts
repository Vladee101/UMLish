import './calibration.css';
import { download } from './export.ts';
import { loadFonts } from './fonts.ts';
import { fixtures } from './fixtures/corpus.ts';
import { layoutPages, type Scene } from './layout.ts';
import { canvasMeasure } from './measure.ts';
import { parse } from './parser/parse.ts';
import { renderSvg } from './render.ts';
import { plainInline } from './richText.ts';
import { classic, withSkinparams } from './theme.ts';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const select = $<HTMLSelectElement>('fixture');
const comparison = $('comparison');
const referenceFile = $<HTMLInputElement>('reference-file');
const referenceImage = $<HTMLImageElement>('reference-image');
const referenceEmpty = $('reference-empty');
const overlay = $<HTMLInputElement>('overlay');
const opacity = $<HTMLInputElement>('opacity');
const pageSelect = $<HTMLSelectElement>('page');
let referenceUrl: string | undefined;
let scenes: Scene[] = [], page = 0, pageTheme = classic;

for (const fixture of fixtures) select.append(new Option(fixture.name, fixture.slug));

const applyView = () => {
  comparison.classList.toggle('overlay', overlay.checked);
  opacity.disabled = !overlay.checked;
  referenceImage.style.opacity = overlay.checked ? String(opacity.valueAsNumber / 100) : '';
};

const clearReference = () => {
  referenceFile.value = '';
  referenceImage.hidden = true;
  referenceImage.removeAttribute('src');
  referenceEmpty.hidden = false;
  if (referenceUrl) URL.revokeObjectURL(referenceUrl);
  referenceUrl = undefined;
};

const showPage = () => {
  $('ours').innerHTML = renderSvg(scenes[page]!, pageTheme);
};

const showFixture = () => {
  const fixture = fixtures.find((f) => f.slug === select.value) ?? fixtures[0]!;
  const diagram = parse(fixture.source);
  pageTheme = withSkinparams(classic, diagram.skinparams);
  scenes = layoutPages(diagram, pageTheme, canvasMeasure(pageTheme.font.family, pageTheme.font.size));
  const warnings = [...diagram.warnings, ...scenes.flatMap((s) => s.warnings)];

  page = 0;
  pageSelect.hidden = scenes.length < 2;
  pageSelect.replaceChildren(...scenes.map((s, i) => new Option(s.title?.lines[0] ? plainInline(s.title.lines[0]) : `Page ${i + 1}`, String(i))));
  pageSelect.value = '0';
  showPage();
  $('source').textContent = fixture.source;
  $('status').textContent = warnings.length
    ? warnings.map((w) => `Line ${w.line}: ${w.message}`).join(' · ')
    : 'No parser or layout warnings';
  clearReference();
};

select.onchange = showFixture;
pageSelect.onchange = () => { page = Number(pageSelect.value); showPage(); clearReference(); };
$('download-source').onclick = () => {
  const fixture = fixtures.find((f) => f.slug === select.value) ?? fixtures[0]!;
  download(`${fixture.slug}.puml`, new Blob([fixture.source], { type: 'text/plain' }));
};
referenceFile.onchange = () => {
  const file = referenceFile.files?.[0];
  if (!file) return;
  if (referenceUrl) URL.revokeObjectURL(referenceUrl);
  referenceUrl = URL.createObjectURL(file);
  referenceImage.src = referenceUrl;
  referenceImage.hidden = false;
  referenceEmpty.hidden = true;
};
$('flip').onclick = () => {
  comparison.classList.toggle('flipped');
  applyView();
};
overlay.onchange = applyView;
opacity.oninput = applyView;

await loadFonts(classic.font.size);
showFixture();
applyView();
