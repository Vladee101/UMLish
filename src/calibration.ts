import './calibration.css';
import { download } from './export.ts';
import { loadFonts } from './fonts.ts';
import { fixtures } from './fixtures/corpus.ts';
import { layout } from './layout.ts';
import { canvasMeasure } from './measure.ts';
import { parse } from './parser/parse.ts';
import { renderSvg } from './render.ts';
import { classic, withSkinparams } from './theme.ts';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const select = $<HTMLSelectElement>('fixture');
const comparison = $('comparison');
const referenceFile = $<HTMLInputElement>('reference-file');
const referenceImage = $<HTMLImageElement>('reference-image');
const referenceEmpty = $('reference-empty');
const overlay = $<HTMLInputElement>('overlay');
const opacity = $<HTMLInputElement>('opacity');
let referenceUrl: string | undefined;

for (const fixture of fixtures) select.append(new Option(fixture.name, fixture.slug));

const applyView = () => {
  comparison.classList.toggle('overlay', overlay.checked);
  opacity.disabled = !overlay.checked;
  referenceImage.style.opacity = overlay.checked ? String(opacity.valueAsNumber / 100) : '';
};

const showFixture = () => {
  const fixture = fixtures.find((f) => f.slug === select.value) ?? fixtures[0]!;
  const diagram = parse(fixture.source);
  const theme = withSkinparams(classic, diagram.skinparams);
  const scene = layout(diagram, theme, canvasMeasure(theme.font.family, theme.font.size));
  const warnings = [...diagram.warnings, ...scene.warnings];

  $('ours').innerHTML = renderSvg(scene, theme);
  $('source').textContent = fixture.source;
  $('status').textContent = warnings.length
    ? warnings.map((w) => `Line ${w.line}: ${w.message}`).join(' · ')
    : 'No parser or layout warnings';

  referenceFile.value = '';
  referenceImage.hidden = true;
  referenceImage.removeAttribute('src');
  referenceEmpty.hidden = false;
  if (referenceUrl) URL.revokeObjectURL(referenceUrl);
  referenceUrl = undefined;
};

select.onchange = showFixture;
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
