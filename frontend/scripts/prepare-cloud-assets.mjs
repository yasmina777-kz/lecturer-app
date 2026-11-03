// Restore assets omitted from the Vercel upload; never use a moving Git branch.
import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(await readFile(new URL('./cloud-assets.json', import.meta.url), 'utf8'));
if (!/^[a-f0-9]{40}$/.test(manifest.revision)) throw new Error('Invalid source revision');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
let cursor = 0, restored = 0;
async function worker() {
  while (cursor < manifest.files.length) {
    const entry = manifest.files[cursor++];
    if (!entry.path.startsWith('frontend/public/') || entry.path.includes('..')) throw new Error('Invalid asset path');
    const target = path.join(root, entry.path.slice('frontend/'.length));
    try { if (digest(await readFile(target)) === entry.sha256) continue; } catch {}
    const url = `https://raw.githubusercontent.com/yasmina777-kz/lecturer-app/${manifest.revision}/${entry.path.split('/').map(encodeURIComponent).join('/')}`;
    let failure;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const bytes = Buffer.from(await response.arrayBuffer());
        if (bytes.length !== entry.size || digest(bytes) !== entry.sha256) throw new Error('Asset checksum mismatch');
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target + '.part', bytes);
        await rename(target + '.part', target);
        restored++;
        failure = null;
        break;
      } catch (error) {
        failure = error;
        await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
      }
    }
    if (failure) throw new Error(`${entry.path}: ${failure.message}`);
  }
}
await Promise.all(Array.from({ length: 8 }, worker));
console.log(`Verified ${manifest.files.length} cloud assets; restored ${restored}.`);
