import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, symlink, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { crc32, zipStored } from '../../scripts/package.mjs';
import { safeRelative, filesBelow, inspectGLB, verifySourceAssets, sha256 } from '../../scripts/packaging.mjs';

test('rejects filesystem escapes and protocol paths', () => {
  for (const value of ['', '../x', '/x', 'a/../x', 'a\\x', 'a/%2e%2e/x', 'https://x', 'a//b']) assert.equal(safeRelative(value), false);
  assert.equal(safeRelative('themes/grand-line/assets/ship.glb.gz'), true);
});
test('package enumeration rejects linked directories', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'worlds-package-'));
  try { await mkdir(path.join(root, 'inside')); await symlink(os.tmpdir(), path.join(root, 'inside/escape')); await assert.rejects(filesBelow(root), /Unsafe/); }
  finally { await rm(root, { recursive: true, force: true }); }
});
test('ZIP uses the standard CRC, fixed metadata and deterministic bytes', () => {
  assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926);
  const entries = [{ name: '.codex-plugin/plugin.json', bytes: Buffer.from('{}') }];
  const zip = zipStored(entries);
  assert.deepEqual(zip, zipStored(entries));
  assert.equal(zip.readUInt32LE(0), 0x04034b50);
  assert.equal(zip.readUInt32LE(zip.length - 22), 0x06054b50);
  assert.equal(zip.readUInt16LE(zip.length - 14), 1);
});
test('GLB rejects invalid lengths and remote resources', () => {
  assert.throws(() => inspectGLB(Buffer.from('broken'), 'model.glb'), /Invalid GLB/);
  const json = Buffer.from(JSON.stringify({ asset: { version: '2.0' }, images: [{ uri: 'https://example.com/texture.png' }] }));
  const bytes = Buffer.alloc(20 + json.length); bytes.write('glTF'); bytes.writeUInt32LE(2,4); bytes.writeUInt32LE(bytes.length,8); bytes.writeUInt32LE(json.length,12); bytes.writeUInt32LE(0x4e4f534a,16); json.copy(bytes,20);
  assert.throws(() => inspectGLB(bytes, 'model.glb'), /External GLB/);
});
test('source assets require reviewed hashes and an exact allowlist', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'worlds-source-'));
  try {
    const asset = 'packages/local-line/assets/model.glb';
    await mkdir(path.join(root, 'packages/local-line/assets'), { recursive: true });
    await mkdir(path.join(root, 'docs'));
    await writeFile(path.join(root, asset), 'model');
    await writeFile(path.join(root, 'docs/asset-manifest.json'), JSON.stringify({ files: [{ path: asset, bytes: 5, sha256: sha256(Buffer.from('model')) }] }));
    await verifySourceAssets(root);
    await writeFile(path.join(root, asset), 'other');
    await assert.rejects(verifySourceAssets(root), /Source asset changed/);
    await writeFile(path.join(root, asset), 'model');
    await writeFile(path.join(root, 'packages/local-line/assets/unreviewed.bin'), 'extra');
    await assert.rejects(verifySourceAssets(root), /allowlist/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
