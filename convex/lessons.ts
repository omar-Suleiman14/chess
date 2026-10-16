import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { REVIEW_INTERVALS_DAYS, scheduleReview } from "../lib/chess/lessons/adaptive";
import { findStaticLesson } from "../lib/chess/lessons/curriculum";
import { fail, requireOwner } from "./model/auth";
import { updateStats } from "./model/fatma";
import { createCustomLesson, practiceFromGame } from "./model/lessons";
import { lessonStepValidator } from "./schema";

const DAY = 24 * 60 * 60 * 1000;

export const progress = query({
  args: {},
  handler: async (ctx) => {
    const owner = await requireOwner(ctx);
    return await ctx.db
      .query("lessonProgress")
      .withIndex("by_owner_and_lessonId", (q) => q.eq("owner", owner))
      .take(500);
  },
});

/** Records a finished step. Lessons are short: steps are the unit of progress. */
export const recordStep = mutation({
  args: {
    lessonId: v.string(),
    lessonVersion: v.number(),
    stepIndex: v.number(),
    totalSteps: v.number(),
    hintsUsed: v.number(),
    mistakes: v.number(),
  },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    const known = findStaticLesson(args.lessonId);
    if (!known) {
      const custom = await ctx.db
        .query("customLessons")
        .withIndex("by_owner_and_lessonId", (q) => q.eq("owner", owner).eq("lessonId", args.lessonId))
        .unique();
      if (!custom) fail("not_found", "Lesson not found.");
    }
    if (args.stepIndex < 0 || args.stepIndex >= args.totalSteps || args.totalSteps > 20) fail("bad_request", "Bad step.");
    const now = Date.now();
    const existing = await ctx.db
      .query("lessonProgress")
      .withIndex("by_owner_and_lessonId", (q) => q.eq("owner", owner).eq("lessonId", args.lessonId))
      .unique();
    const stepsDone = Math.max(existing?.stepsDone ?? 0, args.stepIndex + 1);
    const completed = stepsDone >= args.totalSteps;
    const justCompleted = completed && !existing?.completed;
    let box = existing?.box ?? 0;
    let dueAt = existing?.dueAt ?? now;
    if (completed && args.stepIndex === args.totalSteps - 1) {
      const outcome = args.mistakes > 0 ? "failed" : args.hintsUsed > 0 ? "hinted" : "clean";
      const next = scheduleReview({ box, dueAt, streak: 0, lapses: 0 }, outcome, now);
      box = next.box;
      dueAt = next.dueAt;
    }
    const doc = {
      owner,
      lessonId: args.lessonId,
      lessonVersion: args.lessonVersion,
      stepsDone,
      completed: completed || (existing?.completed ?? false),
      hintsUsed: (existing?.hintsUsed ?? 0) + args.hintsUsed,
      mistakes: (existing?.mistakes ?? 0) + args.mistakes,
      box,
      dueAt,
      updatedAt: now,
    };
    if (existing) await ctx.db.replace("lessonProgress", existing._id, doc);
    else await ctx.db.insert("lessonProgress", doc);
    if (justCompleted) await updateStats(ctx, owner, { lessons: 1 });
    return { completed: doc.completed, nextReviewInDays: Math.round((dueAt - now) / DAY) };
  },
});

export const createLesson = mutation({
  args: {
    lessonId: v.string(),
    title: v.string(),
    topic: v.string(),
    summary: v.string(),
    steps: v.array(lessonStepValidator),
  },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    const lesson = await createCustomLesson(ctx, owner, args, { createdBy: "user" }, "user");
    return { lessonId: lesson.lessonId };
  },
});

export const customLessons = query({
  args: {},
  handler: async (ctx) => {
    const owner = await requireOwner(ctx);
    return await ctx.db
      .query("customLessons")
      .withIndex("by_owner_and_createdAt", (q) => q.eq("owner", owner))
      .order("desc")
      .take(100);
  },
});

export const customLesson = query({
  args: { lessonId: v.string() },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    return await ctx.db
      .query("customLessons")
      .withIndex("by_owner_and_lessonId", (q) => q.eq("owner", owner).eq("lessonId", args.lessonId))
      .unique();
  },
});

export const deleteCustomLesson = mutation({
  args: { lessonId: v.string() },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    const lesson = await ctx.db
      .query("customLessons")
      .withIndex("by_owner_and_lessonId", (q) => q.eq("owner", owner).eq("lessonId", args.lessonId))
      .unique();
    if (lesson) await ctx.db.delete("customLessons", lesson._id);
    return null;
  },
});

export const practiceFrom = mutation({
  args: { gameKey: v.string() },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    return await practiceFromGame(ctx, owner, args.gameKey);
  },
});

/** Practice items due before `now` (the client passes the time; queries don't read clocks). */
export const duePractice = query({
  args: { now: v.number() },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    const due = await ctx.db
      .query("practiceItems")
      .withIndex("by_owner_and_dueAt", (q) => q.eq("owner", owner).lte("dueAt", args.now))
      .take(50);
    const upcoming = await ctx.db
      .query("practiceItems")
      .withIndex("by_owner_and_dueAt", (q) => q.eq("owner", owner).gt("dueAt", args.now))
      .take(50);
    return { due, upcoming };
  },
});

export const recordPractice = mutation({
  args: { itemKey: v.string(), outcome: v.union(v.literal("clean"), v.literal("hinted"), v.literal("failed")) },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    const item = await ctx.db
      .query("practiceItems")
      .withIndex("by_owner_and_itemKey", (q) => q.eq("owner", owner).eq("itemKey", args.itemKey))
      .unique();
    if (!item) fail("not_found", "Practice item not found.");
    const next = scheduleReview({ box: item.box, dueAt: item.dueAt, streak: item.streak, lapses: item.lapses }, args.outcome, Date.now());
    await ctx.db.patch("practiceItems", item._id, next);
    return { box: next.box, days: REVIEW_INTERVALS_DAYS[next.box] };
  },
});
