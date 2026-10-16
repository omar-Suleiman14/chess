"use client";

import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
  usePreloadedQuery,
} from "convex/react";
import type { Preloaded } from "convex/react";
import { SignInButton } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";

export default function Account({
  preloaded,
}: {
  preloaded: Preloaded<typeof api.users.current>;
}) {
  return (
    <>
      <AuthLoading>
        <p role="status">Loading your account...</p>
      </AuthLoading>
      <Unauthenticated>
        <SignInButton mode="modal" />
      </Unauthenticated>
      <Authenticated>
        <Profile preloaded={preloaded} />
      </Authenticated>
    </>
  );
}

function Profile({
  preloaded,
}: {
  preloaded: Preloaded<typeof api.users.current>;
}) {
  const user = usePreloadedQuery(preloaded);
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-slate-200 p-6 dark:border-slate-800">
      <h2 className="text-xl font-semibold">{user.name ?? "Your profile"}</h2>
      {user.email && <p>{user.email}</p>}
      <p>
        Your account was authenticated on the server and stays up to date here.
      </p>
    </section>
  );
}
