import {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { agentsApi } from "../api/agents";
import { issuesApi } from "../api/issues";
import { queryKeys } from "../lib/queryKeys";
import { MarkdownBody } from "../components/MarkdownBody";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowDown, MessageSquarePlus } from "lucide-react";
import { ChatComposer, type ChatComposerHandle } from "../components/ChatComposer";
import { AgentBubbleActionRow, agentBubbleDateLabel } from "../components/AgentBubbleActionRow";
import { AgentIcon } from "../components/AgentIconPicker";
import { cn, formatDateTime } from "../lib/utils";
import type { FeedbackVoteValue } from "@paperclipai/shared";

const SOPHIE_CHAT_MARKDOWN_CLASS =
  "max-w-full overflow-visible [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto";

const chatBubbleShell =
  "min-w-0 max-w-[85%] break-words px-3 py-2 text-sm overflow-x-auto overflow-y-visible";

function agentInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase()) || "S";
}

function AgentBubbleHeader({ name, icon }: { name: string; icon: string | null }) {
  return (
    <div className="mb-1 flex items-center gap-1.5 pl-1">
      <Avatar size="sm" className="shrink-0">
        <AvatarFallback>
          {icon ? (
            <AgentIcon icon={icon} className="h-3.5 w-3.5" />
          ) : (
            agentInitials(name)
          )}
        </AvatarFallback>
      </Avatar>
      <span className="text-sm font-medium text-foreground">{name}</span>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex justify-start">
      <div
        className={cn(
          chatBubbleShell,
          "bg-card border border-border text-foreground [border-radius:14px_14px_14px_4px]",
        )}
      >
        <span className="typing-dots" aria-label="typing">
          <span />
          <span />
          <span />
        </span>
      </div>
    </div>
  );
}

export function SophieChat() {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();

  useEffect(() => {
    setBreadcrumbs([{ label: "Chat mit Sophie" }]);
  }, [setBreadcrumbs]);

  const [input, setInput] = useState("");
  const loadedDraftCompanyRef = useRef<string | null>(null);
  const [sending, setSending] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [statusText, setStatusText] = useState("");
  const [errorText, setErrorText] = useState("");
  const [chatIssueId, setChatIssueId] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [optimisticMessage, setOptimisticMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<ChatComposerHandle>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [hasNewBelow, setHasNewBelow] = useState(false);
  const wasNearBottomRef = useRef(true);
  const [welcomeRevealed, setWelcomeRevealed] = useState(false);
  const [chipsRevealed, setChipsRevealed] = useState(false);
  const prevCompanyRef = useRef(selectedCompanyId);

  // Reset when company changes
  useEffect(() => {
    if (prevCompanyRef.current !== selectedCompanyId) {
      if (chatIssueId) {
        queryClient.removeQueries({ queryKey: queryKeys.issues.comments(chatIssueId) });
      }
      setChatIssueId(null);
      setStreamingText("");
      setStatusText("");
      setSending(false);
      setOptimisticMessage(null);
      prevCompanyRef.current = selectedCompanyId;
    }
  }, [selectedCompanyId, chatIssueId, queryClient]);

  // Load draft from sessionStorage
  useEffect(() => {
    if (!selectedCompanyId) return;
    if (loadedDraftCompanyRef.current === selectedCompanyId) return;
    try {
      const saved = sessionStorage.getItem(`rockstein.sophieChat.draft.${selectedCompanyId}`);
      setInput(saved ?? "");
    } catch {
      setInput("");
    }
    loadedDraftCompanyRef.current = selectedCompanyId;
  }, [selectedCompanyId]);

  // Persist draft
  useEffect(() => {
    if (!selectedCompanyId) return;
    if (loadedDraftCompanyRef.current !== selectedCompanyId) return;
    try {
      const key = `rockstein.sophieChat.draft.${selectedCompanyId}`;
      if (input) {
        sessionStorage.setItem(key, input);
      } else {
        sessionStorage.removeItem(key);
      }
    } catch { /* sessionStorage unavailable */ }
  }, [input, selectedCompanyId]);

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  // Find Sophie agent; fall back to CEO agent for chat routing
  const sophieAgent = useMemo(
    () => agents?.find((a) => a.urlKey === "sophie" || a.name?.toLowerCase() === "sophie"),
    [agents],
  );
  const ceoAgent = useMemo(
    () => agents?.find((a) => a.role === "ceo" && a.status !== "terminated"),
    [agents],
  );
  const chatAgent = sophieAgent ?? ceoAgent ?? null;

  const { data: comments = [] } = useQuery({
    queryKey: queryKeys.issues.comments(chatIssueId ?? ""),
    queryFn: () => issuesApi.listComments(chatIssueId!),
    enabled: !!chatIssueId,
  });

  const { data: feedbackVotes = [] } = useQuery({
    queryKey: queryKeys.issues.feedbackVotes(chatIssueId ?? ""),
    queryFn: () => issuesApi.listFeedbackVotes(chatIssueId!),
    enabled: !!chatIssueId,
  });

  const voteByComment = useMemo(
    () => new Map(feedbackVotes.map((v) => [v.commentId, v.vote as FeedbackVoteValue])),
    [feedbackVotes],
  );

  const agentMap = useMemo(
    () => new Map((agents ?? []).map((a) => [a.id, a])),
    [agents],
  );

  const sortedComments = useMemo(
    () => [...comments].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [comments],
  );

  const scrollToLatest = useCallback((behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior, block: "end" });
    wasNearBottomRef.current = true;
    setHasNewBelow(false);
  }, []);

  // Welcome animation
  useEffect(() => {
    if (welcomeRevealed || !selectedCompanyId) return;
    const t1 = setTimeout(() => setWelcomeRevealed(true), 900);
    const t2 = setTimeout(() => setChipsRevealed(true), 1600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [welcomeRevealed, selectedCompanyId]);

  useEffect(() => {
    if (!welcomeRevealed) return;
    if (wasNearBottomRef.current) {
      scrollToLatest("instant");
    }
  }, [welcomeRevealed, scrollToLatest]);

  // Auto-scroll on new content
  useEffect(() => {
    if (sortedComments.length === 0 && !streamingText) return;
    if (wasNearBottomRef.current) {
      scrollToLatest("smooth");
    } else {
      setHasNewBelow(true);
    }
  }, [sortedComments.length, streamingText, scrollToLatest]);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    wasNearBottomRef.current = nearBottom;
    if (nearBottom) setHasNewBelow(false);
  }, []);

  const handleCommentVote = useCallback(
    async (commentId: string, vote: FeedbackVoteValue, _options: { reason?: string }) => {
      if (!chatIssueId) return;
      await issuesApi.upsertFeedbackVote(chatIssueId, { targetType: "issue_comment" as const, targetId: commentId, vote });
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.feedbackVotes(chatIssueId) });
    },
    [chatIssueId, queryClient],
  );

  const handleSend = useCallback(async () => {
    if (sending || !selectedCompanyId) return;
    const trimmed = input.trim();
    if (!trimmed) return;

    setInput("");
    setOptimisticMessage(trimmed);
    setSending(true);
    setStreamingText("");
    setStatusText("Verbinde…");
    setErrorText("");
    setElapsedSec(0);

    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    const startTime = Date.now();
    elapsedTimerRef.current = setInterval(() => {
      setElapsedSec((Date.now() - startTime) / 1000);
    }, 250);

    scrollToLatest("smooth");

    const controller = new AbortController();
    const fetchTimeout = setTimeout(() => controller.abort(), 30_000);

    try {
      const res = await fetch("/api/board/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: selectedCompanyId,
          message: trimmed,
          taskId: chatIssueId ?? undefined,
        }),
        signal: controller.signal,
      });
      clearTimeout(fetchTimeout);

      if (!res.ok || !res.body) {
        throw new Error("Chat-Verbindung nicht verfügbar");
      }

      setStatusText("Denkt nach…");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (!data || data === "[DONE]") continue;
          try {
            const event = JSON.parse(data) as {
              type: string;
              text?: string;
              issueId?: string;
              message?: string;
            };
            if (event.type === "chunk" && event.text) {
              accumulated += event.text;
              setStreamingText(accumulated);
            } else if (event.type === "status" && event.text) {
              setStatusText(event.text);
            } else if (event.type === "start" && event.issueId) {
              setChatIssueId(event.issueId);
            } else if (event.type === "done") {
              if (event.issueId) {
                queryClient.invalidateQueries({ queryKey: queryKeys.issues.comments(event.issueId) });
              }
            } else if (event.type === "error") {
              setErrorText(event.message ?? "Fehler aufgetreten");
            }
          } catch { /* skip malformed event */ }
        }
      }
    } catch (err) {
      clearTimeout(fetchTimeout);
      if ((err as Error).name !== "AbortError") {
        setErrorText("Verbindung fehlgeschlagen. Bitte erneut versuchen.");
      }
    } finally {
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
      setSending(false);
      setStreamingText("");
      setStatusText("");
      setOptimisticMessage(null);
      if (chatIssueId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.issues.comments(chatIssueId) });
      }
      composerRef.current?.focus();
    }
  }, [sending, selectedCompanyId, input, chatIssueId, queryClient, scrollToLatest]);

  if (!selectedCompanyId) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold">Kein Unternehmen ausgewählt</h2>
          <p className="mt-1 text-sm text-muted-foreground">Bitte wählen Sie ein Unternehmen aus.</p>
        </div>
      </div>
    );
  }

  const sophieName = sophieAgent?.name ?? "Sophie";
  const sophieIcon = sophieAgent?.icon ?? chatAgent?.icon ?? null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold" style={{ color: "#C9A962" }}>
            Sophie
          </span>
          <span className="text-xs text-muted-foreground">
            — {selectedCompany?.name}
          </span>
        </div>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="text-muted-foreground"
          aria-label="Neues Gespräch"
          title="Neues Gespräch"
          onClick={() => {
            if (chatIssueId) {
              queryClient.removeQueries({ queryKey: queryKeys.issues.comments(chatIssueId) });
            }
            setChatIssueId(null);
            setStreamingText("");
            setStatusText("");
            setSending(false);
            setOptimisticMessage(null);
            setWelcomeRevealed(false);
            setChipsRevealed(false);
            setTimeout(() => {
              setWelcomeRevealed(true);
              setTimeout(() => setChipsRevealed(true), 700);
            }, 900);
            composerRef.current?.focus();
          }}
        >
          <MessageSquarePlus className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="scrollbar-auto-hide absolute inset-0 overflow-y-auto overflow-x-hidden"
        >
          <div className="flex flex-col gap-4 px-6 pt-3 pb-32 max-w-3xl mx-auto">
            {/* Welcome animation */}
            {!welcomeRevealed && <TypingBubble />}

            {welcomeRevealed && (() => {
              const userHasReplied = sortedComments.some(
                (c) => !c.authorAgentId && c.authorUserId !== "board-concierge",
              );
              const welcomeBody =
                `Hallo! Ich bin **Sophie**, deine KI-Assistentin bei **${selectedCompany?.name ?? "Rockstein"}**.\n\n` +
                `Ich unterstütze dich bei Aufgaben, Projekten, Recherchen und allen Fragen rund um dein Unternehmen. Was kann ich für dich tun?`;

              const chips: Array<{ label: string; prompt: string }> = [
                {
                  label: "Aufgaben zusammenfassen",
                  prompt: "Fasse meine aktuellen offenen Aufgaben zusammen und priorisiere sie.",
                },
                {
                  label: "Wochenbericht erstellen",
                  prompt: "Erstelle einen Wochenbericht über die wichtigsten Aktivitäten und Fortschritte.",
                },
                {
                  label: "Nächste Schritte planen",
                  prompt: "Was sind die nächsten strategischen Schritte für unser Unternehmen?",
                },
                {
                  label: "Status abfragen",
                  prompt: "Wie ist der aktuelle Status aller laufenden Projekte?",
                },
              ];

              return (
                <>
                  <div className="flex flex-col items-start">
                    <AgentBubbleHeader name={sophieName} icon={sophieIcon} />
                    <div
                      className={cn(
                        chatBubbleShell,
                        "bg-card border border-border text-foreground [border-radius:14px_14px_14px_4px]",
                      )}
                    >
                      <MarkdownBody className={SOPHIE_CHAT_MARKDOWN_CLASS}>{welcomeBody}</MarkdownBody>
                    </div>
                  </div>
                  {!userHasReplied && chipsRevealed && (
                    <div className="flex flex-wrap gap-2 pl-1">
                      {chips.map((chip) => (
                        <button
                          key={chip.label}
                          type="button"
                          onClick={() => {
                            setInput(chip.prompt);
                            composerRef.current?.focus();
                          }}
                          className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground"
                          style={{ borderColor: "#C9A96240" }}
                        >
                          {chip.label}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}

            {sortedComments.map((comment) => {
              const isUser = !comment.authorAgentId && comment.authorUserId !== "board-concierge";
              if (isUser) {
                return (
                  <div key={comment.id} className="flex justify-end">
                    <div
                      className={cn(
                        chatBubbleShell,
                        "text-white [border-radius:14px_14px_4px_14px]",
                      )}
                      style={{ background: "#C9A962", color: "#0A0A0F" }}
                    >
                      {comment.body ?? ""}
                    </div>
                  </div>
                );
              }
              const agent = comment.authorAgentId
                ? agentMap.get(comment.authorAgentId) ?? null
                : chatAgent ?? null;
              const agentName = agent?.name ?? sophieName;
              const agentIconValue = agent?.icon ?? sophieIcon;
              return (
                <div key={comment.id} className="flex flex-col items-start">
                  <AgentBubbleHeader name={agentName} icon={agentIconValue} />
                  <div
                    className={cn(
                      chatBubbleShell,
                      "bg-card border border-border text-foreground [border-radius:14px_14px_14px_4px]",
                    )}
                  >
                    <MarkdownBody className={SOPHIE_CHAT_MARKDOWN_CLASS}>
                      {comment.body ?? ""}
                    </MarkdownBody>
                  </div>
                  <AgentBubbleActionRow
                    copyText={comment.body ?? ""}
                    dateLabel={agentBubbleDateLabel(comment.createdAt)}
                    dateTitle={formatDateTime(comment.createdAt)}
                    anchorHref={`#comment-${comment.id}`}
                    feedback={
                      chatIssueId
                        ? {
                            activeVote: voteByComment.get(comment.id) ?? null,
                            sharingPreference: "prompt",
                            termsUrl: null,
                            onVote: (vote, options) =>
                              handleCommentVote(comment.id, vote, options ?? {}),
                          }
                        : null
                    }
                  />
                </div>
              );
            })}

            {/* Optimistic user message */}
            {optimisticMessage && (
              <div className="flex justify-end">
                <div
                  className={cn(chatBubbleShell, "[border-radius:14px_14px_4px_14px]")}
                  style={{ background: "#C9A962", color: "#0A0A0F" }}
                >
                  {optimisticMessage}
                </div>
              </div>
            )}

            {/* Streaming response */}
            {streamingText && (
              <div className="flex flex-col items-start">
                <AgentBubbleHeader name={sophieName} icon={sophieIcon} />
                <div
                  className={cn(
                    chatBubbleShell,
                    "bg-card border border-border text-foreground [border-radius:14px_14px_14px_4px]",
                  )}
                >
                  <MarkdownBody className={SOPHIE_CHAT_MARKDOWN_CLASS}>{streamingText}</MarkdownBody>
                </div>
              </div>
            )}

            {sending && !streamingText && <TypingBubble />}

            {sending && (
              <div className="flex items-center gap-2 pl-1 text-xs text-muted-foreground">
                <span>{statusText || "Denkt nach…"}</span>
                {elapsedSec > 0 && (
                  <span className="opacity-50">{elapsedSec.toFixed(1)}s</span>
                )}
              </div>
            )}

            {errorText && !sending && (
              <div role="alert" className="flex justify-start">
                <div
                  className={cn(
                    chatBubbleShell,
                    "bg-destructive/10 border border-destructive/30 text-destructive [border-radius:14px_14px_14px_4px]",
                  )}
                >
                  {errorText}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* Jump to latest */}
      {hasNewBelow && (
        <button
          type="button"
          onClick={() => scrollToLatest("smooth")}
          aria-label="Zum neuesten Inhalt springen"
          className="absolute bottom-24 left-1/2 z-20 grid h-8 w-8 -translate-x-1/2 place-items-center rounded-full border border-border bg-card text-foreground shadow-md transition-colors duration-150 hover:bg-accent"
        >
          <ArrowDown className="h-4 w-4" />
        </button>
      )}

      {/* Composer */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-background via-background/95 to-background/0 px-6 pt-6 pb-5">
        <div className="max-w-3xl mx-auto">
          <ChatComposer
            ref={composerRef}
            value={input}
            onChange={setInput}
            onSubmit={handleSend}
            placeholder="Frag Sophie etwas…"
            submitKey="enter"
            surface="translucent"
            submitting={sending}
            disabled={sending}
            sendLabel="Nachricht senden"
            className="pointer-events-auto"
          />
        </div>
      </div>
    </div>
  );
}
