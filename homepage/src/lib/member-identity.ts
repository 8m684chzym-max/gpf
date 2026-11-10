import { supabase } from "@/integrations/supabase/client";

export const GROUP_CONVERSATIONS = [
  "11111111-1111-1111-1111-111111111111",
  "22222222-2222-2222-2222-222222222222",
  "33333333-3333-3333-3333-333333333333",
];

export type MemberIdentity = { id: string; displayName: string };

// Legacy sync reader kept for existing callers; returns null until hydrated.
let cached: MemberIdentity | null = null;
export function readIdentity(): MemberIdentity | null {
  return cached;
}

export async function loadIdentity(): Promise<MemberIdentity | null> {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) {
    cached = null;
    return null;
  }
  const displayName =
    (user.user_metadata?.display_name as string | undefined)?.trim() ||
    (user.email ? user.email.split("@")[0] : "Member");
  cached = { id: user.id, displayName };
  return cached;
}

export async function signInMember(
  email: string,
  password: string,
  displayName: string,
): Promise<MemberIdentity> {
  const name = displayName.trim() || (email ? email.split("@")[0] : "Member");

  // Try sign-in first, fall back to sign-up.
  const signIn = await supabase.auth.signInWithPassword({ email, password });
  let user = signIn.data.user;
  if (signIn.error || !user) {
    const up = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: name } },
    });
    if (up.error) throw up.error;
    user = up.data.user;
    if (!up.data.session) {
      const retry = await supabase.auth.signInWithPassword({ email, password });
      if (retry.error) throw retry.error;
      user = retry.data.user;
    }
  }

  if (!user) throw new Error("No user session");

  // Persist display-name change if different.
  const existingName = (user.user_metadata?.display_name as string | undefined) ?? "";
  if (existingName !== name) {
    await supabase.auth.updateUser({ data: { display_name: name } });
  }

  await supabase.from("members").upsert({ id: user.id, display_name: name });
  await supabase
    .from("conversation_members")
    .upsert(
      GROUP_CONVERSATIONS.map((cid) => ({ conversation_id: cid, member_id: user.id })),
      { onConflict: "conversation_id,member_id", ignoreDuplicates: true },
    );

  cached = { id: user.id, displayName: name };
  return cached;
}

export async function clearIdentity() {
  cached = null;
  await supabase.auth.signOut();
}
