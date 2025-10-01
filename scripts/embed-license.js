/**
 * Embeds a short LSA-1.0 notice into image XMP using exiftool.
 * Non-destructive to pixel data; updates metadata only.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const LICENSE_URL = 'https://github.com/ShortTimeNoSee/liberty-sharealike/blob/v1.0/LICENSE';
const NOTICE = `Licensed under Liberty-ShareAlike 1.0 (LSA-1.0). If you distribute adaptations, license them under LSA-1.0 and include this full text or a stable link. No attribution required. ${LICENSE_URL}`;

const IMG_DIR = path.join(__dirname, '..', 'img');
if (!fs.existsSync(IMG_DIR)) process.exit(0);

const exts = new Set(['.jpg','.jpeg','.png','.webp','.gif']);
const files = fs.readdirSync(IMG_DIR).filter(f => exts.has(path.extname(f).toLowerCase()));

for (const f of files) {
  const full = path.join(IMG_DIR, f);
  try {
    execFileSync('exiftool', [
      '-overwrite_original',
      `-XMP-dc:Rights=${NOTICE}`,
      `-XMP-cc:license=${LICENSE_URL}`,
      full
    ], { stdio: 'ignore' });
    console.log('Embedded license into', f);
  } catch (e) {
    console.warn('Skipped (exiftool error):', f);
  }
}
