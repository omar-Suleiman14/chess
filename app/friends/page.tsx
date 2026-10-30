import { FriendsContent } from "@/components/friends/FriendsContent";
import { NeedsInternet } from "@/components/shell/NeedsInternet";

export default function FriendsPage() {
  return <>
    <div className="mx-auto max-w-xl px-4 pt-[max(12px,env(safe-area-inset-top))] empty:hidden"><NeedsInternet what="Friends and challenges" /></div>
    <FriendsContent />
  </>;
}
