import { readdir, readFile, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export function safeRelative(value) {
  return typeof value === 'string' && value.length > 0 && !value.startsWith('/') && !value.includes('\\') && !value.includes(':') && !value.includes('%') && value.split('/').every(p => p && p !== '.' && p !== '..');
}
export async function filesBelow(root, prefix = '') {
  const files = [];
  for (const entry of (await readdir(path.join(root, prefix))).sort()) {
    const relative = prefix ? `${prefix}/${entry}` : entry;
    const stat = await lstat(path.join(root, relative));
    if (stat.isSymbolicLink() || (!stat.isFile() && !stat.isDirectory())) throw new Error(`Unsafe package object: ${relative}`);
    if (stat.isDirectory()) files.push(...await filesBelow(root, relative)); else files.push(relative);
  }
  return files;
}
export async function inventory(root) {
  const result = [];
  for (const file of await filesBelow(root)) {
    if (!safeRelative(file)) throw new Error(`Unsafe package path: ${file}`);
    const bytes = await readFile(path.join(root, file));
    result.push({ path: file, bytes: bytes.length, sha256: sha256(bytes) });
  }
  return result;
}
export async function verifySourceAssets(root) {
  const manifest = JSON.parse(await readFile(path.join(root, 'docs/asset-manifest.json'), 'utf8'));
  const assetPrefix = 'packages/local-line/assets/';
  const actual = (await filesBelow(path.join(root, assetPrefix))).map(file => assetPrefix + file);
  const declared = manifest.files.map(item => item.path).sort();
  if (new Set(declared).size !== declared.length || JSON.stringify(actual) !== JSON.stringify(declared)) throw new Error('Source assets differ from the reviewed allowlist');
  for (const item of manifest.files) {
    if (!safeRelative(item.path) || !item.path.startsWith(assetPrefix)) throw new Error(`Unsafe source path ${item.path}`);
    const stat = await lstat(path.join(root, item.path));
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Unsafe source asset ${item.path}`);
    const bytes = await readFile(path.join(root, item.path));
    if (bytes.length !== item.bytes || sha256(bytes) !== item.sha256) throw new Error(`Source asset changed: ${item.path}; review provenance before updating its manifest`);
  }
  return manifest;
}
export function inspectGLB(bytes, filename) {
  const data = filename.endsWith('.gz') ? gunzipSync(bytes, { maxOutputLength: 64 * 1024 * 1024 }) : bytes;
  if (data.length < 20 || data.toString('ascii', 0, 4) !== 'glTF' || data.readUInt32LE(4) !== 2 || data.readUInt32LE(8) !== data.length || data.readUInt32LE(16) !== 0x4e4f534a) throw new Error(`Invalid GLB: ${filename}`);
  const end = 20 + data.readUInt32LE(12);
  if (end > data.length) throw new Error(`Truncated GLB: ${filename}`);
  const gltf = JSON.parse(data.toString('utf8', 20, end));
  if ([...(gltf.buffers || []), ...(gltf.images || [])].some(item => item.uri && !item.uri.startsWith('data:'))) throw new Error(`External GLB reference: ${filename}`);
  if ((gltf.extensionsRequired || []).some(value => ['KHR_draco_mesh_compression', 'KHR_texture_basisu', 'EXT_meshopt_compression'].includes(value))) throw new Error(`External decoder required: ${filename}`);
  return gltf;
}
export async function verifyPackage(root) {
  const entries = await inventory(root);
  if (entries.length > 5000 || entries.reduce((n, f) => n + f.bytes, 0) > 250 * 1024 * 1024) throw new Error('Package exceeds Locus installation limits');
  if (entries.some(f => /outpost|\.git(?:\/|$)|node_modules|\.map$|archive|recovery|\.bundle$/i.test(f.path))) throw new Error('Forbidden source/archive content in package');
  const plugin = JSON.parse(await readFile(path.join(root, '.codex-plugin/plugin.json'), 'utf8'));
  const screen = plugin.locus?.screens?.[0];
  if (plugin.name !== 'agent-world' || plugin.version !== '0.2.0' || plugin.locus.screens.length !== 1 || screen.id !== 'agent-world' || screen.version !== 2 || screen.entrypoint !== 'ui/index.html') throw new Error('Unexpected installation identity or protocol');
  if (JSON.stringify([...screen.capabilities].sort()) !== JSON.stringify(['agents.interact','agents.read','world.preferences'])) throw new Error('Unexpected requested capability');
  for (const file of entries) {
    if (/\.glb(?:\.gz)?$/.test(file.path)) inspectGLB(await readFile(path.join(root, file.path)), file.path);
    if (/\.(?:js|css|html)$/.test(file.path) && /outpost|resident_botanist|resident_engineer|resident_explorer/i.test(await readFile(path.join(root, file.path), 'utf8'))) throw new Error(`Removed world reference: ${file.path}`);
  }
  const world = JSON.parse(await readFile(path.join(root, 'ui/world.json'), 'utf8'));
  if (world.id !== 'local-line') throw new Error('Only Local Line may ship');
  const presentations = JSON.parse(await readFile(path.join(root, 'ui/presentations.json'), 'utf8'));
  for (const presentation of Object.values(presentations.presentations)) {
    if (!safeRelative(presentation.backgroundAsset)) throw new Error('Unsafe presentation asset');
    await readFile(path.join(root, 'ui', presentation.backgroundAsset));
  }
  for (const group of ['themes/grand-line', 'assets']) {
    const dir = path.join(root, 'ui', group);
    const ledger = JSON.parse(await readFile(path.join(dir, 'provenance.json'), 'utf8'));
    for (const item of [...Object.values(ledger.assets), ...Object.values(ledger.references || {}), ...(ledger.reference ? [ledger.reference] : [])]) {
      if (!safeRelative(item.path)) throw new Error('Unsafe provenance path');
      const bytes = await readFile(path.join(dir, item.path));
      if (sha256(bytes) !== item.sha256) throw new Error(`Provenance mismatch: ${group}/${item.path}`);
    }
  }
  return entries;
}
