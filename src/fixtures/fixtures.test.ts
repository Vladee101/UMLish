import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { layout } from '../layout.ts';
import { estimateMeasure } from '../measure.ts';
import { parse } from '../parser/parse.ts';
import { renderSvg } from '../render.ts';
import { classic } from '../theme.ts';
import { fixtures } from './corpus.ts';

const snapshotDir = fileURLToPath(new URL('./snapshots/', import.meta.url));
mkdirSync(snapshotDir, { recursive: true });

describe('fixture corpus', () => {
  it('uses unique fixture slugs', () => {
    expect(new Set(fixtures.map((f) => f.slug)).size).toBe(fixtures.length);
  });

  it.each(fixtures)('$name', async ({ slug, source }) => {
    const diagram = parse(source);
    const scene = layout(diagram, classic, estimateMeasure(classic.font.size));
    const svg = renderSvg(scene, classic);

    expect(scene.viewBox.w).toBeGreaterThan(0);
    expect(scene.viewBox.h).toBeGreaterThan(0);
    await expect(JSON.stringify(diagram, null, 2) + '\n').toMatchFileSnapshot(`${snapshotDir}/${slug}.ast.json`);
    await expect(svg + '\n').toMatchFileSnapshot(`${snapshotDir}/${slug}.svg`);
  });
});
