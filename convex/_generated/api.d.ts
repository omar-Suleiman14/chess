/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as analysis from "../analysis.js";
import type * as fatma from "../fatma.js";
import type * as games from "../games.js";
import type * as lessons from "../lessons.js";
import type * as mcp from "../mcp.js";
import type * as model_auth from "../model/auth.js";
import type * as model_fatma from "../model/fatma.js";
import type * as model_games from "../model/games.js";
import type * as model_lessons from "../model/lessons.js";
import type * as model_ratings from "../model/ratings.js";
import type * as profiles from "../profiles.js";
import type * as progress from "../progress.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  analysis: typeof analysis;
  fatma: typeof fatma;
  games: typeof games;
  lessons: typeof lessons;
  mcp: typeof mcp;
  "model/auth": typeof model_auth;
  "model/fatma": typeof model_fatma;
  "model/games": typeof model_games;
  "model/lessons": typeof model_lessons;
  "model/ratings": typeof model_ratings;
  profiles: typeof profiles;
  progress: typeof progress;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
};
