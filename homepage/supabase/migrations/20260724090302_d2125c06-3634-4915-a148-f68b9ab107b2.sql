
-- Members (mock identity; client-generated ids stored in localStorage)
CREATE TABLE public.members (
  id UUID PRIMARY KEY,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.members TO anon, authenticated;
GRANT ALL ON public.members TO service_role;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members readable by all" ON public.members FOR SELECT USING (true);
CREATE POLICY "members insertable by all" ON public.members FOR INSERT WITH CHECK (true);
CREATE POLICY "members updatable by all" ON public.members FOR UPDATE USING (true) WITH CHECK (true);

-- Conversations
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('group','dm')),
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.conversations TO anon, authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conversations readable" ON public.conversations FOR SELECT USING (true);
CREATE POLICY "conversations insertable" ON public.conversations FOR INSERT WITH CHECK (true);

-- Conversation members
CREATE TABLE public.conversation_members (
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, member_id)
);
GRANT SELECT, INSERT, DELETE ON public.conversation_members TO anon, authenticated;
GRANT ALL ON public.conversation_members TO service_role;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cm readable" ON public.conversation_members FOR SELECT USING (true);
CREATE POLICY "cm insertable" ON public.conversation_members FOR INSERT WITH CHECK (true);
CREATE POLICY "cm deletable" ON public.conversation_members FOR DELETE USING (true);

-- Messages
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX messages_conversation_created_idx ON public.messages(conversation_id, created_at);
GRANT SELECT, INSERT ON public.messages TO anon, authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages readable" ON public.messages FOR SELECT USING (true);
CREATE POLICY "messages insertable" ON public.messages FOR INSERT WITH CHECK (true);

-- Read receipts (one per member per message)
CREATE TABLE public.message_reads (
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, member_id)
);
CREATE INDEX message_reads_member_idx ON public.message_reads(member_id);
GRANT SELECT, INSERT ON public.message_reads TO anon, authenticated;
GRANT ALL ON public.message_reads TO service_role;
ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reads readable" ON public.message_reads FOR SELECT USING (true);
CREATE POLICY "reads insertable" ON public.message_reads FOR INSERT WITH CHECK (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;

-- Seed group conversations
INSERT INTO public.conversations (id, kind, name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'group', 'Saturday Fourball'),
  ('22222222-2222-2222-2222-222222222222', 'group', 'Founder''s Cup'),
  ('33333333-3333-3333-3333-333333333333', 'group', 'Range Rats');
