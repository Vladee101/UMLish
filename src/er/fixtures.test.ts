import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { estimateMeasure } from '../measure.ts';
import { classic, handDrawn, modern } from '../theme.ts';
import { erFixtures } from './fixtures.ts';
import { layoutEr } from './layout.ts';
import { parseEr } from './parse.ts';
import { renderErSvg } from './render.ts';

const snapshotDir = fileURLToPath(new URL('./snapshots/', import.meta.url));
mkdirSync(snapshotDir, { recursive: true });

describe('ER fixture corpus', () => {
  it.each(erFixtures)('$name', async ({ slug, source }) => {
    const diagram = parseEr(source);
    await expect(JSON.stringify(diagram, null, 2) + '\n').toMatchFileSnapshot(`${snapshotDir}/${slug}.ast.json`);
    for (const theme of [classic, modern, handDrawn]) {
      const scene = layoutEr(diagram, theme, estimateMeasure(theme.font.size));
      const svg = renderErSvg(scene, theme);
      expect(scene.viewBox.w).toBeGreaterThan(0);
      expect(scene.viewBox.h).toBeGreaterThan(0);
      if (theme === classic) await expect(svg + '\n').toMatchFileSnapshot(`${snapshotDir}/${slug}.svg`);
    }
  });
});
