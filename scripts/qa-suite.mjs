import { spawnSync } from "node:child_process";
for (const [script, ...args] of [
  ["verify-experience.mjs"],
  ["verify-hints.mjs"],
  ["verify-languages.mjs"],
  ["verify-offline.mjs"],
  ["benchmark-ui.mjs", "--label", "current", "--runs", "5", "--background", "all"],
  ["check-performance.mjs"],
  ["lighthouse-ui.mjs"],
]) {
  const result = spawnSync(process.execPath, [`scripts/${script}`, ...args], { stdio: "inherit", env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
