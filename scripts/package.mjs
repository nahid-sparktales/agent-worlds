import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { sha256, verifyPackage } from './packaging.mjs';

// Standard ZIP "stored" entries: assets already use gzip/JPEG/WebP. Fixed metadata,
// sorted filenames and no extra fields make the candidate artifact reproducible.
const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  return crc >>> 0;
});
export function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}
export function zipStored(entries) {
  const local = [], central = []; let offset = 0;
  for (const { name, bytes } of entries) {
    const filename = Buffer.from(name, 'utf8'); const crc = crc32(bytes);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4); header.writeUInt16LE(0x800, 6);
    header.writeUInt16LE(33, 12); header.writeUInt32LE(crc, 14); header.writeUInt32LE(bytes.length, 18); header.writeUInt32LE(bytes.length, 22); header.writeUInt16LE(filename.length, 26);
    local.push(header, filename, bytes);
    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50); directory.writeUInt16LE(20, 4); directory.writeUInt16LE(20, 6); directory.writeUInt16LE(0x800, 8);
    directory.writeUInt16LE(33, 14); directory.writeUInt32LE(crc, 16); directory.writeUInt32LE(bytes.length, 20); directory.writeUInt32LE(bytes.length, 24); directory.writeUInt16LE(filename.length, 28); directory.writeUInt32LE(offset, 42);
    central.push(directory, filename); offset += header.length + filename.length + bytes.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}
export async function packageCandidate(root) {
  const output = path.join(root, 'dist/plugin');
  const files = await verifyPackage(output);
  const stored = [];
  for (const item of files) stored.push({ name: item.path, bytes: await readFile(path.join(output, item.path)) });
  const zip = zipStored(stored); const name = 'agent-worlds-0.2.0.zip';
  const release = path.join(root, 'release'); await mkdir(release, { recursive: true });
  await writeFile(path.join(release, name), zip);
  const checksum = sha256(zip);
  await writeFile(path.join(release, `${name}.sha256`), `${checksum}  ${name}\n`);
  await writeFile(path.join(release, 'asset-manifest.json'), JSON.stringify({ schemaVersion: 1, product: 'Agent Worlds', version: '0.2.0', sdkVersion: 1, bridgeVersion: 2, preferencesSchema: 2, world: 'local-line', sha256: checksum, publicationStatus: 'local-candidate-unpublished', assetRights: 'unverified-see-NOTICE', files }, null, 2) + '\n');
  console.log(`Local candidate ${name}: ${checksum}. No publication performed.`);
  return checksum;
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await packageCandidate(root);
