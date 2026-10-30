import { engineService } from "@/lib/engine/service";

// The cloud engine on this deployment. Off unless ENGINE_SERVER=on: on
// Vercel Hobby, going over the monthly CPU allowance pauses the whole site,
// so this should only be turned on together with ENGINE_DAILY_SECONDS.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

function visitorOf(request: Request): string {
  return request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function POST(request: Request): Promise<Response> {
  if (process.env.ENGINE_SERVER !== "on") return Response.json({ error: "The cloud engine is off on this server." }, { status: 404 });
  // Only this site's own pages may use it.
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (origin && new URL(origin).host !== host) return Response.json({ error: "Forbidden." }, { status: 403 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid engine request." }, { status: 400 });
  }
  const reply = await engineService().handle(body, visitorOf(request), request.signal);
  return Response.json(reply.body, { status: reply.status, headers: { "Cache-Control": "no-store", ...reply.headers } });
}
