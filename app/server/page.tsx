import { auth } from "@clerk/nextjs/server";
import { preloadQuery } from "convex/nextjs";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import Account from "./inner";

export default async function ServerPage() {
  const { getToken, redirectToSignIn, userId } = await auth();
  if (!userId) return redirectToSignIn();

  const token = await getToken({ template: "convex" });
  if (!token) {
    throw new Error(
      "Clerk did not issue a Convex token. Enable the Convex integration in Clerk.",
    );
  }
  const preloaded = await preloadQuery(api.users.current, {}, { token });

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-6 px-6 py-16">
      <h1 className="text-3xl font-bold">Your account</h1>
      <Account preloaded={preloaded} />
      <Link href="/" className="underline">
        Back to home
      </Link>
    </main>
  );
}
