"use client";

import { useRef, type ComponentProps } from "react";
import { useInView } from "motion/react";
import Link from "@/components/navigation/PrefetchLink";
import { CardQueryPrefetch } from "@/lib/client/socialCache";

/** Prefetch route code and live, authorized card data for visible friend rows. */
export function CardProfileLink({ alias, children, ...props }: Omit<ComponentProps<typeof Link>, "href" | "ref"> & { alias: string }) {
  const ref = useRef<HTMLAnchorElement>(null);
  const visible = useInView(ref, { margin: "120px" });
  return <Link {...props} ref={ref} href={`/u/${alias}`}>
    {children}<CardQueryPrefetch alias={alias} enabled={visible} />
  </Link>;
}
