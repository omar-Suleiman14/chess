import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { useRouter } from "next/navigation";

const push = vi.fn();
const router = { push } as unknown as ReturnType<typeof useRouter>;
beforeEach(() => { vi.resetModules(); push.mockReset(); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("card navigation transitions", () => {
  it("honours reduced motion chosen inside the app", async () => {
    const start = vi.fn();
    vi.stubGlobal("document", { documentElement: { dataset: { motion: "reduced" } }, startViewTransition: start });
    vi.stubGlobal("window", { matchMedia: () => ({ matches: false }) });
    const { navigateWithTransition, inViewTransition } = await import("./viewTransition");
    await navigateWithTransition(router, "/u/player");
    expect(start).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/u/player");
    expect(inViewTransition()).toBe(false);
  });

  it("falls back when the browser cannot start a transition", async () => {
    vi.stubGlobal("document", { documentElement: { dataset: { motion: "full" } }, startViewTransition: () => { throw new Error("unsupported state"); } });
    vi.stubGlobal("window", { matchMedia: () => ({ matches: false }), location: { href: "https://chess.chaos.fail/u" } });
    const { navigateWithTransition, inViewTransition } = await import("./viewTransition");
    await navigateWithTransition(router, "/u/player");
    expect(push).toHaveBeenCalledOnce();
    expect(inViewTransition()).toBe(false);
  });

  it("finishes after the route commits and releases the transition state", async () => {
    let pathname = "/u";
    const location = { href: "https://chess.chaos.fail/u", get pathname() { return pathname; } };
    push.mockImplementation(() => { pathname = "/u/player"; });
    vi.stubGlobal("window", { location, matchMedia: () => ({ matches: false }) });
    vi.stubGlobal("document", {
      documentElement: { dataset: { motion: "full" } }, querySelector: () => ({}),
      startViewTransition: (update: () => Promise<void>) => {
        const finished = update();
        return { finished, ready: Promise.resolve(), updateCallbackDone: finished };
      },
    });
    const { navigateWithTransition, inViewTransition } = await import("./viewTransition");
    await navigateWithTransition(router, "/u/player");
    expect(push).toHaveBeenCalledWith("/u/player");
    expect(inViewTransition()).toBe(false);
  });
});
