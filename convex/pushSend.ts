"use node";

import { v } from "convex/values";
import webpush from "web-push";
import { internalAction, env } from "./_generated/server";
import { internal } from "./_generated/api";

/** Sends one notification to each of a player's subscribed browsers. */
export const send = internalAction({
  args: { owner: v.string(), title: v.string(), body: v.string(), url: v.string(), tag: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const publicKey = env.VAPID_PUBLIC_KEY;
    const privateKey = env.VAPID_PRIVATE_KEY;
    if (!publicKey || !privateKey) return null;
    webpush.setVapidDetails(env.VAPID_SUBJECT ?? "mailto:support@chess.chaos.fail", publicKey, privateKey);
    const devices: Array<{ endpoint: string; p256dh: string; auth: string }> = await ctx.runQuery(internal.push.devicesFor, { owner: args.owner });
    const payload = JSON.stringify({ title: args.title, body: args.body, url: args.url, tag: args.tag });
    const gone: string[] = [];
    await Promise.all(
      devices.map(async (d) => {
        try {
          await webpush.sendNotification({ endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } }, payload, { TTL: 60 * 60, urgency: "high" });
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) gone.push(d.endpoint);
        }
      }),
    );
    if (gone.length) await ctx.runMutation(internal.push.forget, { endpoints: gone });
    return null;
  },
});
