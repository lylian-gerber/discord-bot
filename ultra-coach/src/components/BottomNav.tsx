"use client";

import { CalendarDays, Home, LineChart, MessageCircle, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Aujourd'hui", icon: Home },
  { href: "/plan", label: "Plan", icon: CalendarDays },
  { href: "/log", label: "Ajouter", icon: Plus, primary: true },
  { href: "/coach", label: "Coach", icon: MessageCircle },
  { href: "/progress", label: "Progrès", icon: LineChart },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg">
      <ul className="mx-auto flex max-w-lg items-center justify-around px-2 py-1.5">
        {ITEMS.map(({ href, label, icon: Icon, primary }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <li key={href}>
              <Link href={href} aria-label={label} className="flex min-w-14 flex-col items-center gap-0.5 py-1">
                {primary ? (
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-accent-ink">
                    <Icon size={22} strokeWidth={2.5} />
                  </span>
                ) : (
                  <>
                    <Icon size={22} className={active ? "text-fg" : "text-faint"} strokeWidth={active ? 2.4 : 2} />
                    <span className={`text-[10px] ${active ? "text-fg" : "text-faint"}`}>{label}</span>
                  </>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
