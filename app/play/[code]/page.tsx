"use client";

import { use } from "react";
import { OnlineRoom } from "@/components/online/OnlineRoom";

/** Invite link / QR target: /play/123456. */
export default function PlayRoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  return <OnlineRoom key={code} code={code} />;
}
