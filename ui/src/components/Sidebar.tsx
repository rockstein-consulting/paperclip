import {
  Inbox,
  CircleDot,
  Target,
  LayoutDashboard,
  DollarSign,
  History,
  Search,
  SquarePen,
  Network,
  Boxes,
  Repeat,
  GitBranch,
  Package,
  Settings,
  FolderOpen,
  PanelLeftClose,
  PanelLeftOpen,
  Pin,
  MessagesSquare,
  MessageCircle,
  Files,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { NavLink } from "@/lib/router";
import { SidebarSection } from "./SidebarSection";
import { SidebarNavItem } from "./SidebarNavItem";
import { SidebarAgents } from "./SidebarAgents";
import { SidebarProjects } from "./SidebarProjects";
import { useDialogActions } from "../context/DialogContext";
import { useCompany } from "../context/CompanyContext";
import { useSidebar } from "../context/SidebarContext";
import { heartbeatsApi } from "../api/heartbeats";
import { instanceSettingsApi } from "../api/instanceSettings";
import { accessApi } from "../api/access";
import { queryKeys } from "../lib/queryKeys";
import { useInboxBadge } from "../hooks/useInboxBadge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn, SIDEBAR_RAIL_HIDDEN_LABEL } from "../lib/utils";
import { PluginSlotOutlet } from "@/plugins/slots";
import { PluginLauncherOutlet } from "@/plugins/launchers";
import { SidebarCompanyMenu } from "./SidebarCompanyMenu";

function useIsAdmin(companyId: string | null): boolean {
  const { data: membersData } = useQuery({
    queryKey: ["company-members", companyId],
    queryFn: () => accessApi.listMembers(companyId!),
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
  });

  const role = membersData?.access?.currentUserRole ?? null;
  return role === "owner" || role === "admin";
}

export function Sidebar() {
  const { openNewIssue } = useDialogActions();
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { isMobile, collapsed, collapseLocked, peeking, toggleCollapsed, setCollapsed } = useSidebar();
  const rail = collapsed && !peeking;
  const inboxBadge = useInboxBadge(selectedCompanyId);
  const isAdmin = useIsAdmin(selectedCompanyId);

  const { data: experimentalSettings } = useQuery({
    queryKey: queryKeys.instance.experimentalSettings,
    queryFn: () => instanceSettingsApi.getExperimental(),
  });
  const { data: liveRuns } = useQuery({
    queryKey: queryKeys.liveRuns(selectedCompanyId!),
    queryFn: () => heartbeatsApi.liveRunsForCompany(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 10_000,
  });
  const liveRunCount = liveRuns?.length ?? 0;
  const showWorkspacesLink = experimentalSettings?.enableIsolatedWorkspaces === true;
  const streamlined = experimentalSettings?.enableStreamlinedLeftNavigation !== false;
  const conferenceRoomChatEnabled = experimentalSettings?.enableConferenceRoomChat === true;

  const pluginContext = {
    companyId: selectedCompanyId,
    companyPrefix: selectedCompany?.issuePrefix ?? null,
  };

  return (
    <aside className="w-full h-full min-h-0 border-r border-border bg-background flex flex-col">
      <div className="flex items-center gap-1 px-3 h-12 shrink-0">
        <SidebarCompanyMenu />
        {!rail ? (
          <>
            <Button
              asChild
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground shrink-0"
              aria-label="Suche öffnen"
              title="Suche öffnen"
            >
              <NavLink to="/search">
                <Search className="h-4 w-4" />
              </NavLink>
            </Button>
            {!isMobile && !collapseLocked ? (
              peeking ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground shrink-0"
                  aria-label="Sidebar fixieren"
                  title="Sidebar fixieren"
                  onClick={() => setCollapsed(false)}
                >
                  <Pin className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground shrink-0"
                  aria-expanded={!collapsed}
                  aria-label={collapsed ? "Sidebar ausklappen" : "Sidebar einklappen"}
                  title={collapsed ? "Sidebar ausklappen" : "Sidebar einklappen"}
                  onClick={() => toggleCollapsed()}
                >
                  {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                </Button>
              )
            ) : null}
          </>
        ) : null}
      </div>

      <nav className="flex-1 min-h-0 overflow-y-auto scrollbar-auto-hide flex flex-col gap-4 pointer-coarse:gap-3 px-3 py-2">
        <div className="flex flex-col gap-0.5">
          {/* Sophie Chat — primary entry point */}
          <SidebarNavItem to="/sophie" label="Chat mit Sophie" icon={MessageCircle} />
          <SidebarNavItem to="/files" label="Dateien" icon={Files} />

          {/* Admin-only: Dashboard */}
          {isAdmin && (
            <SidebarNavItem to="/dashboard" label="Dashboard" icon={LayoutDashboard} liveCount={liveRunCount} />
          )}

          <SidebarNavItem
            to="/inbox"
            label="Posteingang"
            icon={Inbox}
            badge={inboxBadge.inbox}
            badgeLabel="ungelesen"
            badgeTone={inboxBadge.failedRuns > 0 ? "danger" : "default"}
            alert={inboxBadge.failedRuns > 0}
          />
          {conferenceRoomChatEnabled ? (
            <SidebarNavItem to="/board-chat" label="Konferenzraum" icon={MessagesSquare} />
          ) : null}
        </div>

        <SidebarSection label="Arbeit">
          <SidebarNavItem to="/issues" label="Aufgaben" icon={CircleDot} />
          <SidebarNavItem to="/projects" label="Projekte" icon={FolderOpen} />
          {isAdmin && (
            <>
              <SidebarNavItem to="/routines" label="Routinen" icon={Repeat} />
              <SidebarNavItem to="/goals" label="Ziele" icon={Target} />
              <SidebarNavItem to="/artifacts" label="Artefakte" icon={Package} />
              {showWorkspacesLink ? (
                <SidebarNavItem to="/workspaces" label="Arbeitsbereiche" icon={GitBranch} />
              ) : null}
            </>
          )}
          <PluginSlotOutlet
            slotTypes={["sidebar"]}
            context={pluginContext}
            className="flex flex-col gap-0.5"
            itemClassName="text-[13px] font-medium"
            missingBehavior="placeholder"
          />
          <PluginLauncherOutlet
            placementZones={["sidebar"]}
            context={pluginContext}
            className="flex flex-col gap-0.5"
            itemClassName="text-[13px] font-medium"
          />
        </SidebarSection>

        {/* Classic mode: per-project collapsible */}
        {!streamlined && isAdmin ? <SidebarProjects /> : null}

        {/* Agents section — admin only */}
        {isAdmin && <SidebarAgents streamlined={streamlined} />}

        {/* Company section — admin only */}
        {isAdmin && (
          <SidebarSection label="Unternehmen">
            <SidebarNavItem to="/org" label="Organigramm" icon={Network} />
            <SidebarNavItem to="/skills" label="Skills" icon={Boxes} />
            <SidebarNavItem to="/costs" label="Kosten" icon={DollarSign} />
            <SidebarNavItem to="/activity" label="Aktivität" icon={History} />
            <SidebarNavItem to="/company/settings" label="Einstellungen" icon={Settings} />
          </SidebarSection>
        )}

        <PluginSlotOutlet
          slotTypes={["sidebarPanel"]}
          context={pluginContext}
          className="flex flex-col gap-3"
          itemClassName="rounded-lg border border-border p-3"
          missingBehavior="placeholder"
        />
      </nav>
    </aside>
  );
}
