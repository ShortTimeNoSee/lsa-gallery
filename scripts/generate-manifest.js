/**
 * Scans ./img and writes ./data/images.json with metadata.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const imageSize = require('image-size');

const IMG_DIR = path.join(__dirname, '..', 'img');
const OUT_FILE = path.join(__dirname, '..', 'data', 'images.json');

let existing = {};
if (fs.existsSync(OUT_FILE)) {
  try {
    existing = JSON.parse(fs.readFileSync(OUT_FILE, 'utf8'))
      .reduce((acc, e) => { acc[e.file] = e; return acc; }, {});
  } catch { existing = {}; }
}

const exts = new Set(['.jpg','.jpeg','.png','.webp','.avif','.gif']);
const files = fs.readdirSync(IMG_DIR).filter(f => exts.has(path.extname(f).toLowerCase()));

const out = [];

for (const file of files) {
  const p = path.join(IMG_DIR, file);
  const buf = fs.readFileSync(p);
  const { width, height, type } = safeSize(buf) || {};
  const stat = fs.statSync(p);
  const hash = crypto.createHash('sha256').update(buf).digest('hex');
  const prev = existing[file] || {};

  out.push({
    file,
    src: `img/${encodeURIComponent(file)}`,
    title: prev.title || titleFromName(file),
    description: prev.description || '',
    alt: prev.alt || '',
    width: width || null,
    height: height || null,
    bytes: stat.size,
    mime: mimeFromType(type),
    tags: prev.tags || [],
    added: prev.added || Math.floor(stat.mtimeMs || Date.now()),
    sha256: hash
  });
}

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 2));
console.log(`Wrote ${out.length} records to data/images.json`);

function safeSize(buf) {
  try { return imageSize(buf); }
  catch { return null; }
}
function titleFromName(n) {
  return path.basename(n, path.extname(n)).replace(/[_\-]+/g,' ').replace(/\s+/g,' ').trim();
}
function mimeFromType(t) {
  if (!t) return '';
  return {
    jpg: 'image/jpeg', jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    avif: 'image/avif'
  }[t] || '';
}
