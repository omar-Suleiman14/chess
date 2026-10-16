"use client";

import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
  useQuery,
} from "convex/react";
import { SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { api } from "@/convex/_generated/api";

export default function Home() {
  return (
    <>
      <header className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-800">
        <Link href="/" className="font-semibold">
          Chess
        </Link>
        <UserButton />
      </header>
      <main className="mx-auto flex max-w-lg flex-col gap-8 px-6 py-16">
        <h1 className="text-4xl font-bold">Your chess account</h1>
        <AuthLoading>
          <p role="status">Loading your account...</p>
        </AuthLoading>
        <Unauthenticated>
          <p>Sign in or create an account to get started.</p>
          <div className="flex gap-3">
            <SignInButton mode="modal">
              <button className="rounded-md bg-foreground px-4 py-2 text-background">
                Sign in
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="rounded-md border border-current px-4 py-2">
                Create account
              </button>
            </SignUpButton>
          </div>
        </Unauthenticated>
        <Authenticated>
          <Account />
        </Authenticated>
      </main>
    </>
  );
}

function Account() {
  const user = useQuery(api.users.current);
  if (user === undefined) {
    return <p role="status">Loading your profile...</p>;
  }
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-slate-200 p-6 dark:border-slate-800">
      <h2 className="text-2xl font-semibold">
        Welcome{user.name ? `, ${user.name}` : ""}!
      </h2>
      {user.email && <p>{user.email}</p>}
      <p>
        You are signed in. Manage your profile or sign out using your account
        menu above.
      </p>
      <Link href="/server" className="underline">
        View your account on the server
      </Link>
    </section>
  );
}
