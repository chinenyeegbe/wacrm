"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MessageSquare,
  Zap,
  Gift,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTotalUnread } from "@/hooks/use-total-unread";

// Mobile-first bottom navigation. Africa is a mobile-first market, so the
// primary destinations live where a thumb can reach them — a fixed tab bar
// at the bottom of the screen, like the apps people already use (WhatsApp,
// banking apps). Hidden on lg+ where the sidebar takes over.
//
// We surface the 5 highest-traffic destinations; everything else lives
// behind "More" (the full sidebar drawer, opened via the header on mobile).
// Five is the upper bound for comfortable thumb targets across a phone.

interface Tab {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
}

const TABS: Tab[] = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/inbox", label: "Inbox", icon: MessageSquare },
  { href: "/automations", label: "Automate", icon: Zap },
  { href: "/partner", label: "Earn", icon: Gift },
];

export function MobileNav({ onOpenMore }: { onOpenMore?: () => void }) {
  const pathname = usePathname();
  const totalUnread = useTotalUnread();

  return (
    <nav
      aria-label="Primary"
      // `pb-[env(safe-area-inset-bottom)]` keeps the bar above the iOS home
      // indicator / Android gesture area. Hidden from lg+ (sidebar there).
      className="fixed inset-x-0 bottom-0 z-30 border-t border-sidebar-border bg-sidebar/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="flex items-stretch">
        {TABS.map((tab) => {
          const isActive =
            pathname === tab.href ||
            (tab.href !== "/dashboard" && pathname.startsWith(tab.href));
          const showDot =
            tab.href === "/inbox" && totalUnread > 0 && !isActive;
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                className={cn(
                  // Tall, full-width thumb target (≥56px).
                  "relative flex h-14 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-slate-400 active:text-white",
                )}
              >
                <span className="relative">
                  <tab.icon className="h-5 w-5" />
                  {showDot && (
                    <span className="absolute -right-1 -top-1 flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                    </span>
                  )}
                </span>
                {tab.label}
              </Link>
            </li>
          );
        })}
        <li className="flex-1">
          <button
            type="button"
            onClick={onOpenMore}
            aria-label="More"
            className="flex h-14 w-full flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-slate-400 transition-colors active:text-white"
          >
            <MoreHorizontal className="h-5 w-5" />
            More
          </button>
        </li>
      </ul>
    </nav>
  );
}
