import Image from "next/image";
import type { ClientUser } from "@/lib/auth/client-identity";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export default function UserAvatar({ user, size = 32 }: { user: ClientUser; size?: number }) {
  if (user.avatarUrl) {
    return (
      <Image
        src={user.avatarUrl}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-[10px] object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-[10px] bg-primary-100 text-xs font-semibold text-primary-800"
      style={{ width: size, height: size }}
    >
      {initials(user.name)}
    </span>
  );
}
