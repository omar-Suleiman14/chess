import { readFile, readdir, access } from "node:fs/promises";
import path from "node:path";

const files = ["README.md", ...(await readdir("docs")).filter((name) => name.endsWith(".md")).map((name) => `docs/${name}`)];
const failures = [];
for (const file of files) {
  const text = await readFile(file, "utf8");
  for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = match[1].split("#")[0];
    if (!target || /^https?:|^mailto:|^\//.test(target)) continue;
    try { await access(path.resolve(path.dirname(file), decodeURIComponent(target))); }
    catch { failures.push(`${file}: missing ${target}`); }
  }
}
if (failures.length) { console.error(failures.join("\n")); process.exitCode = 1; }
else console.log(`${files.length} documentation files: local links resolve.`);
