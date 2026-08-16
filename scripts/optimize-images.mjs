// One-off resize+convert pass: assets/prod/*.png (source renders, multi-MB
// each) -> public/img/*.webp (shipped assets). Re-run whenever assets/prod
// changes; nothing here needs to run as part of `pnpm check`.
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const srcDir = join(root, "assets", "prod");
const outDir = join(root, "public", "img");

// [source filename, output name, max width, quality]
// Widths are sized to the largest actual on-page display size (with 2x-DPR
// headroom), not to the source render's resolution -- see index.astro/
// BlackHoleOption.astro for where each lands.
const jobs = [
  ["fa4c6e49-961d-4688-9194-1f3f52190e50.png", "blackhole-split", 1920, 78],
  ["651d3c64-78c1-4aaa-bb64-4bb8d70ab319.png", "blackhole-split-earth", 1920, 78],
  ["651d3c64-78c1-4aaa-bb64-4bb8d70ab319.png", "blackhole-split-earth-sm", 900, 76],
  ["e6d2c966-741d-457b-82cb-abbcc02f80de.png", "blackhole-split-wave", 720, 68],
  ["acf4292f-f54e-453e-9f48-84c81f938563.png", "blackhole-split-astronaut", 720, 68],
  ["05118fe5-b961-4a41-a4b4-f1f736ee7c28.png", "blackhole-stellar", 420, 80],
  ["5633875f-9698-49a8-a856-dc073128d5b2.png", "blackhole-supermassive", 420, 80],
  ["b142481d-2dd9-4de0-bdfb-954c724829c8.png", "astronaut-glove", 260, 82],
  ["c104a632-87f5-49e4-88d5-96ddaa62f299.png", "astronaut-reach-warm", 320, 82],
  ["d96233d7-a4fa-49d3-a2dd-3c66a18adc3c.png", "astronaut-spaghetti", 320, 82],
  ["a486ab40-038b-4c9f-8af7-7f17eda740a0.png", "astronaut-reach-cool", 320, 82],
];

await mkdir(outDir, { recursive: true });

for (const [src, name, maxWidth, quality] of jobs) {
  const inPath = join(srcDir, src);
  const outPath = join(outDir, `${name}.webp`);
  await sharp(inPath)
    .resize({ width: maxWidth, withoutEnlargement: true })
    .webp({ quality })
    .toFile(outPath);
  console.log(`${src} -> img/${name}.webp`);
}
