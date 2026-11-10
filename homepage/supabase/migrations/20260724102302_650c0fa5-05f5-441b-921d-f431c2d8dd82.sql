
-- Security-definer helper to avoid recursive RLS on conversation_members
CREATE OR REPLACE FUNCTION public.is_conversation_member(_conversation_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = _conversation_id AND member_id = _user_id
  )
$$;

REVOKE ALL ON FUNCTION public.is_conversation_member(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.is_conversation_member(uuid, uuid) TO authenticated;

-- =============== members ===============
DROP POLICY IF EXISTS "members insertable by all" ON public.members;
DROP POLICY IF EXISTS "members readable by all" ON public.members;
DROP POLICY IF EXISTS "members updatable by all" ON public.members;

CREATE POLICY "members self insert" ON public.members
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "members self update" ON public.members
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "members readable by authenticated" ON public.members
  FOR SELECT TO authenticated
  USING (true);

-- =============== conversations ===============
DROP POLICY IF EXISTS "conversations insertable" ON public.conversations;
DROP POLICY IF EXISTS "conversations readable" ON public.conversations;

CREATE POLICY "conversations readable by members" ON public.conversations
  FOR SELECT TO authenticated
  USING (public.is_conversation_member(id, auth.uid()));

CREATE POLICY "conversations insertable by authenticated" ON public.conversations
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- =============== conversation_members ===============
DROP POLICY IF EXISTS "cm deletable" ON public.conversation_members;
DROP POLICY IF EXISTS "cm insertable" ON public.conversation_members;
DROP POLICY IF EXISTS "cm readable" ON public.conversation_members;

CREATE POLICY "cm readable to conversation members" ON public.conversation_members
  FOR SELECT TO authenticated
  USING (
    member_id = auth.uid()
    OR public.is_conversation_member(conversation_id, auth.uid())
  );

-- Allow inserting self, or (when already a member of that conversation) adding another member.
-- Also allow adding self/other when the conversation has no members yet (initial creation).
CREATE POLICY "cm insertable by self or existing member" ON public.conversation_members
  FOR INSERT TO authenticated
  WITH CHECK (
    member_id = auth.uid()
    OR public.is_conversation_member(conversation_id, auth.uid())
    OR NOT EXISTS (
      SELECT 1 FROM public.conversation_members cm
      WHERE cm.conversation_id = conversation_members.conversation_id
    )
  );

CREATE POLICY "cm deletable self only" ON public.conversation_members
  FOR DELETE TO authenticated
  USING (member_id = auth.uid());

-- =============== messages ===============
DROP POLICY IF EXISTS "messages insertable" ON public.messages;
DROP POLICY IF EXISTS "messages readable" ON public.messages;

CREATE POLICY "messages readable by conversation members" ON public.messages
  FOR SELECT TO authenticated
  USING (public.is_conversation_member(conversation_id, auth.uid()));

CREATE POLICY "messages insertable by conversation members" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    member_id = auth.uid()
    AND public.is_conversation_member(conversation_id, auth.uid())
  );

-- =============== message_reads ===============
DROP POLICY IF EXISTS "reads insertable" ON public.message_reads;
DROP POLICY IF EXISTS "reads readable" ON public.message_reads;

CREATE POLICY "reads readable by conversation members" ON public.message_reads
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_reads.message_id
        AND public.is_conversation_member(m.conversation_id, auth.uid())
    )
  );

CREATE POLICY "reads insertable by self" ON public.message_reads
  FOR INSERT TO authenticated
  WITH CHECK (
    member_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_reads.message_id
        AND public.is_conversation_member(m.conversation_id, auth.uid())
    )
  );

-- Revoke anon access — clubhouse tables are members-only.
REVOKE ALL ON public.members FROM anon;
REVOKE ALL ON public.conversations FROM anon;
REVOKE ALL ON public.conversation_members FROM anon;
REVOKE ALL ON public.messages FROM anon;
REVOKE ALL ON public.message_reads FROM anon;
