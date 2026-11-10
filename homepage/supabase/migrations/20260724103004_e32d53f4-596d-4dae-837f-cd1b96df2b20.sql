
-- 1) Private schema for the membership helper
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated;

-- 2) Drop policies that depend on the public helper
DROP POLICY IF EXISTS "cm deletable self only" ON public.conversation_members;
DROP POLICY IF EXISTS "cm insertable by self or existing member" ON public.conversation_members;
DROP POLICY IF EXISTS "cm readable to conversation members" ON public.conversation_members;
DROP POLICY IF EXISTS "conversations insertable by authenticated" ON public.conversations;
DROP POLICY IF EXISTS "conversations readable by members" ON public.conversations;
DROP POLICY IF EXISTS "reads insertable by self" ON public.message_reads;
DROP POLICY IF EXISTS "reads readable by conversation members" ON public.message_reads;
DROP POLICY IF EXISTS "messages insertable by conversation members" ON public.messages;
DROP POLICY IF EXISTS "messages readable by conversation members" ON public.messages;
DROP POLICY IF EXISTS "members readable by authenticated" ON public.members;

-- 3) Recreate helper in private schema; drop the public one
DROP FUNCTION IF EXISTS public.is_conversation_member(uuid, uuid);

CREATE OR REPLACE FUNCTION private.is_conversation_member(_conversation_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = _conversation_id AND member_id = _user_id
  )
$$;

REVOKE ALL ON FUNCTION private.is_conversation_member(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_conversation_member(uuid, uuid) TO authenticated;

-- 4) Add creator + public flag to conversations
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

-- Seed group conversations are public joinable groups
UPDATE public.conversations
SET is_public = true
WHERE id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333'
);

-- 5) Policies: conversations
CREATE POLICY "conversations readable by members"
ON public.conversations FOR SELECT TO authenticated
USING (private.is_conversation_member(id, auth.uid()));

CREATE POLICY "conversations insertable by creator"
ON public.conversations FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());

-- 6) Policies: conversation_members
CREATE POLICY "cm readable to conversation members"
ON public.conversation_members FOR SELECT TO authenticated
USING (member_id = auth.uid() OR private.is_conversation_member(conversation_id, auth.uid()));

CREATE POLICY "cm insertable by invite, creator, or public group"
ON public.conversation_members FOR INSERT TO authenticated
WITH CHECK (
  -- Existing member can add anyone (invite)
  private.is_conversation_member(conversation_id, auth.uid())
  -- Conversation creator can add anyone
  OR EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id AND c.created_by = auth.uid()
  )
  -- Self-join into a public group conversation
  OR (
    member_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND c.is_public = true
    )
  )
);

CREATE POLICY "cm deletable self only"
ON public.conversation_members FOR DELETE TO authenticated
USING (member_id = auth.uid());

-- 7) Policies: messages
CREATE POLICY "messages readable by conversation members"
ON public.messages FOR SELECT TO authenticated
USING (private.is_conversation_member(conversation_id, auth.uid()));

CREATE POLICY "messages insertable by conversation members"
ON public.messages FOR INSERT TO authenticated
WITH CHECK (
  member_id = auth.uid()
  AND private.is_conversation_member(conversation_id, auth.uid())
);

-- 8) Policies: message_reads
CREATE POLICY "reads readable by conversation members"
ON public.message_reads FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.messages m
  WHERE m.id = message_id
    AND private.is_conversation_member(m.conversation_id, auth.uid())
));

CREATE POLICY "reads insertable by self"
ON public.message_reads FOR INSERT TO authenticated
WITH CHECK (
  member_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = message_id
      AND private.is_conversation_member(m.conversation_id, auth.uid())
  )
);

-- 9) Members: only visible to yourself and people sharing a conversation
CREATE POLICY "members readable when sharing a conversation"
ON public.members FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.conversation_members cm_self
    JOIN public.conversation_members cm_other
      ON cm_self.conversation_id = cm_other.conversation_id
    WHERE cm_self.member_id = auth.uid()
      AND cm_other.member_id = public.members.id
  )
);
