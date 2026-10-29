// Build a guest-only local QA artifact, run a command, then restore real auth.
// The fixture is never committed or used by a deployment build.
import { readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";

const port = process.env.QA_PORT ?? "3100";
// These are public browser configuration values, never deployment/admin secrets.
const publicConfig = JSON.parse(await readFile("scripts/qa-public-config.json", "utf8"));
let localConfig = "";
try { localConfig = await readFile(".env.local", "utf8"); } catch { /* CI uses public defaults. */ }
for (const [key, value] of Object.entries(publicConfig)) {
  const local = localConfig.split("\n").find((line) => line.startsWith(`${key}=`))?.slice(key.length + 1).trim().replace(/^["']|["']$/g, "");
  if (!process.env[key]) process.env[key] = local || value;
}
const original = await readFile("proxy.ts", "utf8");
let server;
const run = (cmd, args) => new Promise((resolve, reject) => {
  const child = spawn(cmd, args, { stdio: "inherit", env: process.env });
  child.on("error", reject);
  child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`)));
});
const restore = () => writeFile("proxy.ts", original);
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, async () => { server?.kill(); await restore(); process.exit(1); });
try {
  await writeFile("proxy.ts", 'import { NextResponse } from "next/server";\nexport default function proxy(request) { const headers = new Headers(request.headers); headers.set("x-clerk-auth-status", "signed-out"); return NextResponse.next({ request: { headers } }); }\n');
  // The temporary fixture is JS-compatible but the project uses strict TypeScript.
  await writeFile("proxy.ts", (await readFile("proxy.ts", "utf8")).replace("import { NextResponse }", "import { NextResponse, type NextRequest }").replace("proxy(request)", "proxy(request: NextRequest)"));
  await run("npm", ["run", "build"]);
  await restore();
  server = spawn("node", ["node_modules/next/dist/bin/next", "start", "-p", port, "-H", "127.0.0.1"], { stdio: "inherit" });
  for (let attempt = 0; attempt < 100; attempt++) {
    try { const response = await fetch(`http://127.0.0.1:${port}`); if (response.ok) break; } catch { /* Starting. */ }
    if (attempt === 99) throw new Error("QA server did not become ready");
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  const separator = process.argv.indexOf("--");
  if (separator < 0) throw new Error("Pass a QA command after --");
  await run(process.argv[separator + 1], process.argv.slice(separator + 2));
} finally {
  server?.kill();
  await restore();
}
