// Convert generated app empty-state PNGs to web-ready WebP and remove the PNGs.
import sharp from 'sharp'
import { readdirSync, readFileSync, statSync, unlinkSync } from 'node:fs'

const DIR = 'public/images/app'
const WIDTH = 480

const pngs = readdirSync(DIR).filter((f) => f.endsWith('.png'))
for (const f of pngs) {
  const src = `${DIR}/${f}`
  const out = src.replace(/\.png$/, '.webp')
  await sharp(readFileSync(src)).resize({ width: WIDTH, withoutEnlargement: true }).webp({ quality: 82 }).toFile(out)
  const kb = (n) => Math.round(statSync(n).size / 1024)
  console.log(`${f}: ${kb(src)}KB -> ${kb(out)}KB`)
  unlinkSync(src)
}
console.log(`Done. ${pngs.length} converted.`)
