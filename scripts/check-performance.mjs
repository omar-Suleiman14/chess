import { readFile } from "node:fs/promises";
const current = JSON.parse(await readFile(".cache/performance/current/summary.json", "utf8"));
const failures = [];
for (const row of current.summary) {
  if (row.errors.length) failures.push(`${row.preset}: browser errors`);
  if (row.moveP95Ms === null || row.moveP95Ms > 50) failures.push(`${row.preset}, eval=${row.evaluation}: move p95 ${row.moveP95Ms}ms exceeds 50ms`);
  if (row.clsMedian > 0.05) failures.push(`${row.preset}: CLS ${row.clsMedian} exceeds .05`);
}
console.log(failures.length ? failures.join("\n") : "All theme/evaluation cohorts pass measured move and layout budgets.");
if (failures.length) process.exitCode = 1;
