import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { layoutPages } from '../layout.ts';
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
    const scenes = layoutPages(diagram, classic, estimateMeasure(classic.font.size));

    expect(scenes.length).toBeGreaterThan(0);
    for (const scene of scenes) {
      expect(scene.viewBox.w).toBeGreaterThan(0);
      expect(scene.viewBox.h).toBeGreaterThan(0);
    }
    await expect(JSON.stringify(diagram, null, 2) + '\n').toMatchFileSnapshot(`${snapshotDir}/${slug}.ast.json`);
    for (let i = 0; i < scenes.length; i++) {
      const svg = renderSvg(scenes[i]!, classic);
      const suffix = i === 0 ? '' : `.page-${i + 1}`;
      await expect(svg + '\n').toMatchFileSnapshot(`${snapshotDir}/${slug}${suffix}.svg`);
    }
  });
});
