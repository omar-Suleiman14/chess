"use client";

import { ReactNode, useEffect, useState } from "react";
import { Authenticated, ConvexReactClient, useMutation } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { useAuth, useUser } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export default function ConvexClientProvider({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      <Authenticated>
        <SyncUser />
      </Authenticated>
      {children}
    </ConvexProviderWithClerk>
  );
}

function SyncUser() {
  const syncUser = useMutation(api.users.sync);
  const { user } = useUser();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const userId = user?.id;
  const updatedAt = user?.updatedAt?.getTime();

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void syncUser({}).then(
      () => {
        if (!cancelled) setFailed(false);
      },
      () => {
        if (!cancelled) setFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [syncUser, userId, updatedAt, attempt]);

  if (!failed) return null;
  return (
    <div role="alert" className="p-4 text-center">
      Your profile could not be saved.{" "}
      <button
        className="underline"
        onClick={() => setAttempt((value) => value + 1)}
      >
        Try again
      </button>
    </div>
  );
}
