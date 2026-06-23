import { useMemo } from "react";
import { NavLink, useLocation } from "@/lib/router";
import {
  MessageCircle,
  Files,
  FolderOpen,
  CircleDot,
  Settings,
} from "lucide-react";
import { useCompany } from "../context/CompanyContext";
import { SIDEBAR_SCROLL_RESET_STATE } from "../lib/navigation-scroll";
import { cn } from "../lib/utils";

interface MobileBottomNavProps {
  visible: boolean;
}

interface MobileNavLinkItem {
  type: "link";
  to: string;
  label: string;
  icon: typeof MessageCircle;
  badge?: number;
}

type MobileNavItem = MobileNavLinkItem;

export function MobileBottomNav({ visible }: MobileBottomNavProps) {
  const { selectedCompanyId } = useCompany();

  const items = useMemo<MobileNavItem[]>(
    () => [
      { type: "link", to: "/sophie", label: "Chat", icon: MessageCircle },
      { type: "link", to: "/files", label: "Dateien", icon: Files },
      { type: "link", to: "/projects", label: "Projekte", icon: FolderOpen },
      { type: "link", to: "/issues", label: "Aufgaben", icon: CircleDot },
      { type: "link", to: "/company/settings", label: "Einstellungen", icon: Settings },
    ],
    [selectedCompanyId],
  );

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85 transition-transform duration-200 ease-out md:hidden pb-[env(safe-area-inset-bottom)]",
        visible ? "translate-y-0" : "translate-y-full",
      )}
      aria-label="Mobile-Navigation"
    >
      <div className="grid h-16 grid-cols-5 px-1">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.label}
              to={item.to}
              state={SIDEBAR_SCROLL_RESET_STATE}
              className={({ isActive }) =>
                cn(
                  "relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-md text-[10px] font-medium transition-colors",
                  isActive
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span className="relative">
                    <Icon
                      className={cn("h-[18px] w-[18px]", isActive && "stroke-[2.3]")}
                      style={isActive ? { color: "#C9A962" } : undefined}
                    />
                    {item.badge != null && item.badge > 0 && (
                      <span className="absolute -right-2 -top-2 rounded-full px-1.5 py-0.5 text-[10px] leading-none" style={{ background: "#C9A962", color: "#0A0A0F" }}>
                        {item.badge > 99 ? "99+" : item.badge}
                      </span>
                    )}
                  </span>
                  <span className="truncate" style={isActive ? { color: "#C9A962" } : undefined}>
                    {item.label}
                  </span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
