import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import logo from "@/assets/logo.svg";
import { supabase } from "@/integrations/supabase/client";
import { readIdentity, type MemberIdentity } from "@/lib/member-identity";

export const Route = createFileRoute("/members/clubhouse")({
  head: () => ({
    meta: [
      { title: "Clubhouse — GPF Members" },
      { name: "description", content: "The members' private feed, posts, and chat." },
      { property: "og:title", content: "Clubhouse — GPF Members" },
      { property: "og:description", content: "A private feed, posts, and chat for members." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Clubhouse,
});

// -------- Feed (still local, unchanged shape) --------
type Post = {
  id: string;
  author: string;
  handle: string;
  time: string;
  body: string;
  likes: number;
  comments: number;
  tag?: string;
};

const seedPosts: Post[] = [
  { id: "p1", author: "Ana Costa", handle: "ana", time: "12m", body: "Broke 80 for the first time this morning. Two birdies on the back. Whiskey on me at 6.", likes: 24, comments: 7, tag: "Round" },
  { id: "p2", author: "Kenji Ito", handle: "kenji", time: "1h", body: "Hole 7 pin is tucked behind the front bunker today. Play it long.", likes: 12, comments: 3, tag: "Course" },
  { id: "p3", author: "Marcus McKay", handle: "mmck", time: "3h", body: "Founder's Cup pairings just went up. Good draw — playing with Ito and Costa.", likes: 18, comments: 5, tag: "Event" },
];

// -------- Chat types --------
type Conversation = { id: string; kind: "group" | "dm"; name: string | null };
type Member = { id: string; display_name: string };
type Message = { id: string; conversation_id: string; member_id: string; body: string; created_at: string };
type Read = { message_id: string; member_id: string; read_at: string };

function initials(name: string) {
  return name.split(/\s+/).map((s) => s[0]).slice(0, 2).join("").toUpperCase();
}

function timeShort(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function Clubhouse() {
  const [identity, setIdentity] = useState<MemberIdentity | null>(null);
  useEffect(() => { setIdentity(readIdentity()); }, []);

  const [posts, setPosts] = useState<Post[]>(seedPosts);
  const [composer, setComposer] = useState("");

  function submitPost(e: React.FormEvent) {
    e.preventDefault();
    if (!composer.trim() || !identity) return;
    setPosts([
      { id: `p${Date.now()}`, author: identity.displayName, handle: identity.displayName.toLowerCase().replace(/\s+/g, ""), time: "now", body: composer.trim(), likes: 0, comments: 0 },
      ...posts,
    ]);
    setComposer("");
  }

  return (
    <section className="mx-auto max-w-6xl px-6 pt-10 pb-24">
      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div>
          <form onSubmit={submitPost} className="rounded-3xl border border-border/60 bg-card p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-[13px] font-semibold text-primary-foreground">
                {identity ? initials(identity.displayName) : "Y"}
              </div>
              <div className="flex-1">
                <textarea
                  value={composer}
                  onChange={(e) => setComposer(e.target.value)}
                  rows={2}
                  placeholder="Share your round, ask about the course, propose a match…"
                  className="w-full resize-none rounded-xl bg-transparent px-2 py-2 text-[14px] outline-none placeholder:text-muted-foreground"
                />
                <div className="mt-2 flex items-center justify-end">
                  <button
                    type="submit"
                    disabled={!composer.trim()}
                    className="rounded-full bg-primary px-4 py-1.5 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
                  >
                    Post
                  </button>
                </div>
              </div>
            </div>
          </form>

          <ul className="mt-6 space-y-4">
            {posts.map((p) => (
              <li key={p.id} className="rounded-3xl border border-border/60 bg-card p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-[13px] font-semibold">
                    {initials(p.author)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[14px] font-medium">{p.author}</span>
                      <span className="text-[12px] text-muted-foreground">@{p.handle}</span>
                      <span className="text-[12px] text-muted-foreground">· {p.time}</span>
                      {p.tag && <span className="ml-auto rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">{p.tag}</span>}
                    </div>
                    <p className="mt-2 text-[14px] leading-relaxed text-foreground/90">{p.body}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <ChatPanel identity={identity} />
      </div>
    </section>
  );
}

// -------- Chat panel --------
function ChatPanel({ identity }: { identity: MemberIdentity | null }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showNewDm, setShowNewDm] = useState(false);

  // Load conversations current member belongs to + all members (for DM picker)
  const refreshConversations = useCallback(async () => {
    if (!identity) return;
    const { data: cm } = await supabase
      .from("conversation_members")
      .select("conversation_id")
      .eq("member_id", identity.id);
    const ids = (cm ?? []).map((r) => r.conversation_id);
    if (ids.length === 0) { setConversations([]); return; }
    const { data: convs } = await supabase
      .from("conversations")
      .select("id, kind, name")
      .in("id", ids);
    setConversations((convs ?? []) as Conversation[]);
    setActiveId((prev) => prev ?? (convs && convs[0] ? convs[0].id : null));
  }, [identity]);

  useEffect(() => { refreshConversations(); }, [refreshConversations]);

  useEffect(() => {
    supabase.from("members").select("id, display_name").then(({ data }) => setMembers((data ?? []) as Member[]));
  }, [identity]);

  // Realtime: refresh conversation list when this member is added to a new one
  useEffect(() => {
    if (!identity) return;
    const ch = supabase
      .channel(`cm-${identity.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "conversation_members", filter: `member_id=eq.${identity.id}` }, refreshConversations)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [identity, refreshConversations]);

  async function startDm(otherId: string) {
    if (!identity) return;
    // find existing dm
    const { data: mine } = await supabase.from("conversation_members").select("conversation_id").eq("member_id", identity.id);
    const { data: theirs } = await supabase.from("conversation_members").select("conversation_id").eq("member_id", otherId);
    const shared = (mine ?? []).map((r) => r.conversation_id).filter((id) => (theirs ?? []).some((r) => r.conversation_id === id));
    if (shared.length) {
      const { data: existing } = await supabase.from("conversations").select("id, kind").in("id", shared).eq("kind", "dm").limit(1);
      if (existing && existing[0]) { setActiveId(existing[0].id); setShowNewDm(false); return; }
    }
    const { data: created, error } = await supabase.from("conversations").insert({ kind: "dm", name: null }).select("id").single();
    if (error || !created) return;
    await supabase.from("conversation_members").insert([
      { conversation_id: created.id, member_id: identity.id },
      { conversation_id: created.id, member_id: otherId },
    ]);
    await refreshConversations();
    setActiveId(created.id);
    setShowNewDm(false);
  }

  const active = conversations.find((c) => c.id === activeId) ?? null;

  return (
    <aside className="flex h-[70vh] min-h-[520px] flex-col rounded-3xl border border-border/60 bg-card">
      <div className="flex items-center justify-between border-b border-border/60 p-4">
        <div className="flex items-center gap-2">
          <img src={logo} alt="" aria-hidden className="h-4 w-4 opacity-80" />
          <div className="text-[12px] font-semibold uppercase tracking-widest text-muted-foreground">Chat</div>
        </div>
        <button
          onClick={() => setShowNewDm((v) => !v)}
          className="text-[18px] leading-none text-muted-foreground hover:text-foreground"
          aria-label="Start direct message"
        >＋</button>
      </div>

      {showNewDm && identity && (
        <div className="border-b border-border/60 p-3">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Start a DM</div>
          <ul className="max-h-40 space-y-1 overflow-y-auto">
            {members.filter((m) => m.id !== identity.id).map((m) => (
              <li key={m.id}>
                <button
                  onClick={() => startDm(m.id)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-secondary/60"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold">{initials(m.display_name)}</span>
                  {m.display_name}
                </button>
              </li>
            ))}
            {members.filter((m) => m.id !== identity.id).length === 0 && (
              <li className="px-2 py-1 text-[12px] text-muted-foreground">No other members yet.</li>
            )}
          </ul>
        </div>
      )}

      <ConversationList
        conversations={conversations}
        members={members}
        identity={identity}
        activeId={activeId}
        onSelect={setActiveId}
      />

      <div className="flex min-h-0 flex-1 flex-col border-t border-border/60">
        {identity && active ? (
          <Thread key={active.id} identity={identity} conversation={active} members={members} />
        ) : (
          <div className="flex flex-1 items-center justify-center p-6 text-center text-[13px] text-muted-foreground">
            {identity ? "Select a chat to get started." : "Sign in to open chat."}
          </div>
        )}
      </div>
    </aside>
  );
}

function ConversationList({
  conversations, members, identity, activeId, onSelect,
}: {
  conversations: Conversation[]; members: Member[]; identity: MemberIdentity | null;
  activeId: string | null; onSelect: (id: string) => void;
}) {
  const [lasts, setLasts] = useState<Record<string, { body: string; created_at: string } | null>>({});
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [dmNames, setDmNames] = useState<Record<string, string>>({});

  const loadMeta = useCallback(async () => {
    if (!identity || conversations.length === 0) return;
    const ids = conversations.map((c) => c.id);

    // Last message per conversation (fetch recent 200, reduce)
    const { data: recent } = await supabase
      .from("messages")
      .select("conversation_id, body, created_at, id, member_id")
      .in("conversation_id", ids)
      .order("created_at", { ascending: false })
      .limit(300);
    const lastMap: Record<string, { body: string; created_at: string } | null> = {};
    for (const m of recent ?? []) if (!lastMap[m.conversation_id]) lastMap[m.conversation_id] = { body: m.body, created_at: m.created_at };
    setLasts(lastMap);

    // Unread: messages in these convs not authored by me and no read row from me
    const { data: msgs } = await supabase
      .from("messages")
      .select("id, conversation_id, member_id")
      .in("conversation_id", ids)
      .neq("member_id", identity.id);
    const msgIds = (msgs ?? []).map((m) => m.id);
    let readIds = new Set<string>();
    if (msgIds.length) {
      const { data: reads } = await supabase
        .from("message_reads")
        .select("message_id")
        .eq("member_id", identity.id)
        .in("message_id", msgIds);
      readIds = new Set((reads ?? []).map((r) => r.message_id));
    }
    const unreadMap: Record<string, number> = {};
    for (const m of msgs ?? []) if (!readIds.has(m.id)) unreadMap[m.conversation_id] = (unreadMap[m.conversation_id] ?? 0) + 1;
    setUnread(unreadMap);

    // DM names: for each dm conversation, look up other member's name
    const dmIds = conversations.filter((c) => c.kind === "dm").map((c) => c.id);
    if (dmIds.length) {
      const { data: rows } = await supabase
        .from("conversation_members")
        .select("conversation_id, member_id")
        .in("conversation_id", dmIds);
      const nameMap: Record<string, string> = {};
      for (const r of rows ?? []) {
        if (r.member_id === identity.id) continue;
        const m = members.find((x) => x.id === r.member_id);
        if (m) nameMap[r.conversation_id] = m.display_name;
      }
      setDmNames(nameMap);
    }
  }, [conversations, identity, members]);

  useEffect(() => { loadMeta(); }, [loadMeta]);

  // Live refresh on any new message / read for these conversations
  useEffect(() => {
    if (!identity || conversations.length === 0) return;
    const ch = supabase
      .channel(`chat-meta-${identity.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, loadMeta)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "message_reads", filter: `member_id=eq.${identity.id}` }, loadMeta)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [identity, conversations, loadMeta]);

  function label(c: Conversation) {
    if (c.kind === "group") return c.name ?? "Group";
    return dmNames[c.id] ?? "Direct message";
  }

  return (
    <ul className="max-h-[220px] divide-y divide-border/60 overflow-y-auto">
      {conversations.map((c) => {
        const name = label(c);
        const last = lasts[c.id];
        const count = unread[c.id] ?? 0;
        return (
          <li key={c.id}>
            <button
              onClick={() => onSelect(c.id)}
              className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/60 ${activeId === c.id ? "bg-secondary/70" : ""}`}
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-[12px] font-semibold">
                {initials(name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <div className="truncate text-[13px] font-medium">{name}</div>
                  {count > 0 && (
                    <span className="ml-2 shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">{count}</span>
                  )}
                </div>
                <div className="truncate text-[12px] text-muted-foreground">
                  {last ? last.body : "No messages yet"}
                </div>
              </div>
            </button>
          </li>
        );
      })}
      {conversations.length === 0 && (
        <li className="px-4 py-6 text-center text-[12px] text-muted-foreground">No chats yet.</li>
      )}
    </ul>
  );
}

function Thread({
  identity, conversation, members,
}: { identity: MemberIdentity; conversation: Conversation; members: Member[] }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [reads, setReads] = useState<Read[]>([]);
  const [participants, setParticipants] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const memberName = useCallback(
    (id: string) => members.find((m) => m.id === id)?.display_name ?? "Member",
    [members],
  );

  // Initial load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: msgs }, { data: cm }] = await Promise.all([
        supabase.from("messages").select("*").eq("conversation_id", conversation.id).order("created_at", { ascending: true }),
        supabase.from("conversation_members").select("member_id").eq("conversation_id", conversation.id),
      ]);
      if (cancelled) return;
      setMessages((msgs ?? []) as Message[]);
      setParticipants((cm ?? []).map((r) => r.member_id));
      const ids = (msgs ?? []).map((m) => m.id);
      if (ids.length) {
        const { data: rd } = await supabase.from("message_reads").select("*").in("message_id", ids);
        if (!cancelled) setReads((rd ?? []) as Read[]);
      } else {
        setReads([]);
      }
    })();
    return () => { cancelled = true; };
  }, [conversation.id]);

  // Realtime for this conversation
  useEffect(() => {
    const ch = supabase
      .channel(`conv-${conversation.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversation.id}` },
        (payload) => {
          const m = payload.new as Message;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "message_reads" },
        (payload) => {
          const r = payload.new as Read;
          setReads((prev) => (prev.some((x) => x.message_id === r.message_id && x.member_id === r.member_id) ? prev : [...prev, r]));
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [conversation.id]);

  // Auto-scroll on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  // Mark unread messages as read when viewing
  useEffect(() => {
    const unread = messages.filter(
      (m) => m.member_id !== identity.id && !reads.some((r) => r.message_id === m.id && r.member_id === identity.id),
    );
    if (unread.length === 0) return;
    supabase.from("message_reads").upsert(
      unread.map((m) => ({ message_id: m.id, member_id: identity.id })),
      { onConflict: "message_id,member_id", ignoreDuplicates: true },
    );
  }, [messages, reads, identity.id]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = input.trim();
    if (!body) return;
    setInput("");
    const { error } = await supabase.from("messages").insert({ conversation_id: conversation.id, member_id: identity.id, body });
    if (error) setInput(body);
  }

  const otherParticipants = participants.filter((id) => id !== identity.id);

  const title = conversation.kind === "group"
    ? conversation.name ?? "Group"
    : memberName(otherParticipants[0] ?? "");

  return (
    <>
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <div>
          <div className="text-[13px] font-semibold">{title}</div>
          <div className="text-[11px] text-muted-foreground">
            {conversation.kind === "group" ? `${participants.length} members` : "Direct message"}
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((m) => {
          const mine = m.member_id === identity.id;
          const readers = reads
            .filter((r) => r.message_id === m.id && r.member_id !== m.member_id)
            .map((r) => r.member_id);
          const readByOthers = readers.filter((id) => otherParticipants.includes(id));
          const allRead = otherParticipants.length > 0 && otherParticipants.every((id) => readByOthers.includes(id));
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[80%]">
                {!mine && (
                  <div className="mb-0.5 pl-1 text-[10px] text-muted-foreground">{memberName(m.member_id)}</div>
                )}
                <div className={`rounded-2xl px-3 py-2 text-[13px] ${mine ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}>
                  {m.body}
                </div>
                <div className={`mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground ${mine ? "justify-end pr-1" : "pl-1"}`}>
                  <span>{timeShort(m.created_at)}</span>
                  {mine && (
                    <span title={readByOthers.map(memberName).join(", ") || "Sent"}>
                      {readByOthers.length === 0 ? "· Sent" : allRead ? "· Read ✓✓" : `· Read by ${readByOthers.length}`}
                    </span>
                  )}
                </div>
                {mine && readByOthers.length > 0 && conversation.kind === "group" && (
                  <div className="mt-1 flex justify-end gap-1">
                    {readByOthers.slice(0, 5).map((id) => (
                      <span
                        key={id}
                        title={memberName(id)}
                        className="flex h-4 w-4 items-center justify-center rounded-full bg-secondary text-[8px] font-semibold text-foreground/80 ring-1 ring-background"
                      >
                        {initials(memberName(id))}
                      </span>
                    ))}
                    {readByOthers.length > 5 && (
                      <span className="text-[10px] text-muted-foreground">+{readByOthers.length - 5}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {messages.length === 0 && (
          <div className="pt-8 text-center text-[12px] text-muted-foreground">Say hello 👋</div>
        )}
      </div>

      <form onSubmit={send} className="flex gap-2 border-t border-border/60 p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message"
          className="flex-1 rounded-full border border-border bg-background px-4 py-2 text-[13px] outline-none focus:border-foreground/40"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="rounded-full bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </>
  );
}
