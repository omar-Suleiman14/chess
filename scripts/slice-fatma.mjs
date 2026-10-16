// Slices the supplied Fatma sprite sheet into a uniform atlas.
// Usage: node scripts/slice-fatma.mjs <source.webp|png>
// Output: public/fatma/fatma-atlas.png + public/fatma/atlas.json
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";

const CELL_W = 160;
const CELL_H = 192;
const COLS = 12;

// [bandTop, bandBottom, [[x0, x1], ...]] measured from the source sheet
// (alpha projection; see probe in the P11 PR notes).
const BANDS = [
  [88, 252, [[30, 124], [164, 257], [292, 387], [420, 515], [542, 636], [698, 805], [836, 937], [966, 1068], [1099, 1198], [1228, 1329], [1359, 1457], [1489, 1585], [1617, 1716]]],
  [367, 551, [[37, 133], [150, 241], [263, 350], [407, 502], [598, 684], [706, 792], [801, 886], [955, 1052], [1070, 1164], [1180, 1274], [1363, 1463], [1493, 1585]]],
  [672, 839, [[36, 132], [153, 265], [326, 479], [503, 624], [649, 776], [802, 904], [932, 1030], [1050, 1149], [1165, 1267], [1372, 1493], [1507, 1597]]],
];

const NAMES = [
  ...Array.from({ length: 5 }, (_, i) => `idle-${i}`),
  ...Array.from({ length: 8 }, (_, i) => `run-${i}`),
  ...Array.from({ length: 3 }, (_, i) => `duck-${i}`),
  "jumpStart-0",
  ...Array.from({ length: 3 }, (_, i) => `jumpUp-${i}`),
  ...Array.from({ length: 3 }, (_, i) => `falling-${i}`),
  ...Array.from({ length: 2 }, (_, i) => `landing-${i}`),
  ...Array.from({ length: 2 }, (_, i) => `hurt-${i}`),
  ...Array.from({ length: 3 }, (_, i) => `dead-${i}`),
  ...Array.from({ length: 4 }, (_, i) => `writing-${i}`),
  ...Array.from({ length: 2 }, (_, i) => `kissing-${i}`),
];

const src = process.argv[2];
if (!src) throw new Error("Pass the source sprite sheet path.");

const frames = [];
for (const [top, bottom, segs] of BANDS) {
  for (const [x0, x1] of segs) frames.push({ top, bottom, x0, x1 });
}
if (frames.length !== NAMES.length) throw new Error("Frame count mismatch");

const rows = Math.ceil(frames.length / COLS);
const composites = [];
for (let i = 0; i < frames.length; i++) {
  const f = frames[i];
  const w = f.x1 - f.x0 + 1;
  const h = f.bottom - f.top + 1;
  if (w > CELL_W || h > CELL_H) throw new Error(`Frame ${NAMES[i]} too big`);
  const input = await sharp(src)
    .extract({ left: f.x0, top: f.top, width: w, height: h })
    .png()
    .toBuffer();
  composites.push({
    input,
    left: (i % COLS) * CELL_W + Math.floor((CELL_W - w) / 2),
    top: Math.floor(i / COLS) * CELL_H + (CELL_H - h),
  });
}

await mkdir("public/fatma", { recursive: true });
await sharp({
  create: {
    width: COLS * CELL_W,
    height: rows * CELL_H,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite(composites)
  .png({ compressionLevel: 9, palette: true })
  .toFile("public/fatma/fatma-atlas.png");

const animations = {};
NAMES.forEach((name, index) => {
  const [anim] = name.split("-");
  (animations[anim] ??= []).push(index);
});
await writeFile(
  "public/fatma/atlas.json",
  JSON.stringify(
    { version: 1, cellWidth: CELL_W, cellHeight: CELL_H, columns: COLS, rows, animations },
    null,
    2,
  ) + "\n",
);
console.log(`Wrote ${frames.length} frames`);
