// Convert the generated landing PNGs to web-ready WebP (resize + compress).
// Source PNGs stay on disk; the app references the .webp versions.
import sharp from 'sharp'
import { readFileSync, statSync } from 'node:fs'

const DIR = 'public/images/landing'
const JOBS = [
  { name: 'hero-community', width: 760 },
  { name: 'hero-peer', width: 540 },
  { name: 'hero-selfcare', width: 540 },
  { name: 'hero-avatar', width: 360 },
]

for (const { name, width } of JOBS) {
  const src = `${DIR}/${name}.png`
  const out = `${DIR}/${name}.webp`
  await sharp(readFileSync(src))
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(out)
  const kb = (n) => Math.round(statSync(n).size / 1024)
  console.log(`${name}: ${kb(src)}KB png -> ${kb(out)}KB webp (w${width})`)
}
console.log('Done.')
