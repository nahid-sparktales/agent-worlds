import { build } from 'esbuild';
import { cp, copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { verifySourceAssets, verifyPackage } from './packaging.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'dist/plugin');
await verifySourceAssets(root);
// Only generated output is removed. Authored models never live in this tree.
await rm(output, { recursive: true, force: true });
await mkdir(path.join(output, 'ui/static'), { recursive: true });
for (const folder of ['.codex-plugin', 'assets', 'licenses']) await cp(path.join(root, 'plugin', folder), path.join(output, folder), { recursive: true, errorOnExist: true });
for (const file of ['LICENSE', 'NOTICE']) await copyFile(path.join(root, file), path.join(output, file));
await copyFile(path.join(root, 'plugin/README.md'), path.join(output, 'README.md'));
await copyFile(path.join(root, 'plugin/presentations.json'), path.join(output, 'ui/presentations.json'));
const assets = path.join(root, 'packages/local-line/assets');
await cp(path.join(assets, 'themes'), path.join(output, 'ui/themes'), { recursive: true });
await cp(path.join(assets, 'assets'), path.join(output, 'ui/assets'), { recursive: true });
await copyFile(path.join(root, 'plugin/assets/icon.svg'), path.join(output, 'ui/assets/icon.svg'));
await copyFile(path.join(assets, 'presentation/captain-deck-preview.webp'), path.join(output, 'ui/static/captain-deck.webp'));
for (const island of ['elbaf','marineford','water-seven','wano','drum']) await copyFile(path.join(assets, `presentation/quarters-${island}.webp`), path.join(output, `ui/static/quarters-${island}.webp`));
await copyFile(path.join(root, 'packages/local-line/world.json'), path.join(output, 'ui/world.json'));
await copyFile(path.join(root, 'packages/local-line/index.html'), path.join(output, 'ui/index.html'));
await copyFile(path.join(root, 'packages/local-line/src/style.css'), path.join(output, 'ui/static/world.css'));
const result = await build({ absWorkingDir: root, entryPoints: [path.join(root, 'plugin/src/main.ts')], outfile: path.join(output, 'ui/static/world.js'), bundle: true, format: 'iife', platform: 'browser', target: 'safari17', minify: true, legalComments: 'external', metafile: true });
for (const input of Object.keys(result.metafile.inputs)) {
  const absolute = path.resolve(root, input);
  if (!absolute.startsWith(root + path.sep) || /(?:^|\/)(?:dev|tests|outpost)(?:\/|$)|(?:^|\/)(?:pandas|people|outpostPalette)\.ts$/i.test(input)) throw new Error(`Forbidden production dependency: ${input}`);
}
if (Object.values(result.metafile.outputs).some(item => item.imports.some(dependency => dependency.external))) throw new Error('Production bundle has an external import');
await writeFile(path.join(root, 'dist/build-meta.json'), JSON.stringify(result.metafile, null, 2) + '\n');
// A development harness is deliberately a separate output and never packaged.
await mkdir(path.join(root, 'dist/dev'), { recursive: true });
try {
  await build({ entryPoints: [path.join(root, 'dev/main.ts')], outfile: path.join(root, 'dist/dev/main.js'), bundle: true, format: 'iife', platform: 'browser', target: 'safari17', minify: true, legalComments: 'external' });
} catch (error) { if (error.errors?.some(e => e.text.includes('Could not resolve') && e.text.includes('dev/main.ts'))) throw new Error('Explicit mock host entrypoint dev/main.ts is required'); throw error; }
const entries = await verifyPackage(output);
await writeFile(path.join(root, 'dist/asset-manifest.json'), JSON.stringify({ schemaVersion: 1, product: 'Agent Worlds', version: '0.2.0', sdkVersion: 1, bridgeVersion: 2, preferencesSchema: 2, world: 'local-line', files: entries }, null, 2) + '\n');
console.log(`Built Agent Worlds 0.2.0: ${entries.length} files, ${entries.reduce((n, f) => n + f.bytes, 0)} bytes.`);
