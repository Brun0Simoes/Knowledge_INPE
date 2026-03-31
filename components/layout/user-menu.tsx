"use client";

import { BellRing, LogOut, ShieldCheck } from "lucide-react";
import { signOut } from "next-auth/react";

import { useUiSettings } from "@/components/providers/ui-settings-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getClientRedirectUrl } from "@/lib/utils";

type UserMenuProps = {
  name: string;
  email: string;
  image?: string | null;
  role: "USER" | "ADMIN";
  notificationOptIn: boolean;
};

export function UserMenu({
  name,
  email,
  image,
  role,
  notificationOptIn,
}: UserMenuProps) {
  const { messages } = useUiSettings();
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="inline-flex items-center gap-3 rounded-full border border-white/16 bg-white/10 px-3 py-2 shadow-sm backdrop-blur transition hover:border-white/24 hover:bg-white/14">
          <Avatar className="h-9 w-9">
            {image ? <AvatarImage alt={name} src={image} /> : null}
            <AvatarFallback>{initials || "IN"}</AvatarFallback>
          </Avatar>
          <div className="hidden text-left md:block">
            <p className="text-sm font-semibold text-white">{name}</p>
            <p className="text-xs text-white/62">
              {role === "ADMIN" ? messages.layout.adminRole : messages.layout.readerRole}
            </p>
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          <div className="space-y-1">
            <p className="text-sm font-semibold tracking-normal text-zinc-900">{name}</p>
            <p className="normal-case text-xs tracking-normal text-zinc-500">{email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <ShieldCheck className="mr-2 h-4 w-4 text-teal-600" />
          {role === "ADMIN" ? messages.layout.adminAccess : messages.layout.authenticatedAccount}
        </DropdownMenuItem>
        <DropdownMenuItem>
          <BellRing className="mr-2 h-4 w-4 text-teal-600" />
          {notificationOptIn ? messages.layout.emailsEnabled : messages.layout.emailsDisabled}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async (event) => {
            event.preventDefault();
            const result = await signOut({ callbackUrl: "/login", redirect: false });
            window.location.href = getClientRedirectUrl(result?.url, "/login");
          }}
        >
          <LogOut className="mr-2 h-4 w-4 text-rose-600" />
          {messages.layout.signOut}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
