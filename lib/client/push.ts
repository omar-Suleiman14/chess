"use client";

// Opt-in Web Push for friend challenges and requests.
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { api } from "@/convex/_generated/api";
import { useBackendFeatures } from "./backendFeatures";

export type PushState = "unsupported" | "unavailable" | "signed-out" | "denied" | "off" | "on" | "working";

function supported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function keyBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function currentSubscription(): Promise<PushSubscription | null> {
  if (!supported()) return null;
  const registration = await navigator.serviceWorker.getRegistration();
  return (await registration?.pushManager.getSubscription()) ?? null;
}

export function usePushNotifications() {
  const { isAuthenticated } = useConvexAuth();
  const pushOnServer = useBackendFeatures()?.push === true;
  const publicKey = useQuery(api.push.publicKey, pushOnServer ? {} : "skip");
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Feature checks differ between server and browser; decide after hydration.
  const isSupported = useSyncExternalStore(() => () => {}, supported, () => false);
  const hydrated = useSyncExternalStore(() => () => {}, () => true, () => false);
  const status = useQuery(api.push.status, isAuthenticated && pushOnServer ? { endpoint } : "skip");
  const save = useMutation(api.push.subscribe);
  const remove = useMutation(api.push.unsubscribe);

  useEffect(() => {
    let cancelled = false;
    void currentSubscription().then((sub) => { if (!cancelled) setEndpoint(sub?.endpoint ?? null); });
    return () => { cancelled = true; };
  }, []);

  let state: PushState;
  if (!hydrated || !pushOnServer) state = "unavailable";
  else if (!isSupported) state = "unsupported";
  else if (publicKey === null) state = "unavailable";
  else if (!isAuthenticated) state = "signed-out";
  else if (busy || publicKey === undefined) state = "working";
  else if (Notification.permission === "denied") state = "denied";
  else state = status?.subscribed ? "on" : "off";

  const enable = useCallback(async () => {
    if (!publicKey) return;
    setBusy(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;
      const registration = await navigator.serviceWorker.ready;
      const sub = (await registration.pushManager.getSubscription()) ?? (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));
      const json = sub.toJSON();
      await save({ endpoint: sub.endpoint, p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" });
      setEndpoint(sub.endpoint);
    } catch {
      setError("Couldn't turn on notifications in this browser.");
    } finally {
      setBusy(false);
    }
  }, [publicKey, save]);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      const sub = await currentSubscription();
      if (sub) {
        await remove({ endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setEndpoint(null);
    } finally {
      setBusy(false);
    }
  }, [remove]);

  return { state, enable, disable, error };
}
