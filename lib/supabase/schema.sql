-- Direct Messages table
create table direct_message_channels (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Direct Message Participants (who is in each DM channel)
create table direct_message_participants (
  channel_id uuid references direct_message_channels(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (channel_id, user_id)
);

-- Messages in DM channels
create table direct_messages (
  id uuid default uuid_generate_v4() primary key,
  channel_id uuid references direct_message_channels(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete cascade,
  content text not null,
  file jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Direct Message Reactions
create table direct_message_reactions (
  id uuid default uuid_generate_v4() primary key,
  message_id uuid references direct_messages(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  emoji text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (message_id, user_id, emoji)
);

-- RLS Policies
alter table direct_message_channels enable row level security;
alter table direct_message_participants enable row level security;
alter table direct_messages enable row level security;
alter table direct_message_reactions enable row level security;

-- Policies for direct_message_channels
create policy "Users can view their DM channels"
  on direct_message_channels for select
  using (
    exists (
      select 1 from direct_message_participants
      where channel_id = direct_message_channels.id
      and user_id = auth.uid()
    )
  );

create policy "Users can create DM channels"
  on direct_message_channels for insert
  with check (true);

-- Policies for direct_message_participants
create policy "Users can view participants in their DM channels"
  on direct_message_participants for select
  using (
    exists (
      select 1 from direct_message_participants
      where channel_id = direct_message_participants.channel_id
      and user_id = auth.uid()
    )
  );

create policy "Users can add participants to DM channels they're in"
  on direct_message_participants for insert
  with check (
    exists (
      select 1 from direct_message_participants
      where channel_id = direct_message_participants.channel_id
      and user_id = auth.uid()
    )
  );

-- Policies for direct_messages
create policy "Users can view messages in their DM channels"
  on direct_messages for select
  using (
    exists (
      select 1 from direct_message_participants
      where channel_id = direct_messages.channel_id
      and user_id = auth.uid()
    )
  );

create policy "Users can send messages to their DM channels"
  on direct_messages for insert
  with check (
    sender_id = auth.uid() and
    exists (
      select 1 from direct_message_participants
      where channel_id = direct_messages.channel_id
      and user_id = auth.uid()
    )
  );

-- Policies for direct_message_reactions
create policy "Users can view reactions in their DM channels"
  on direct_message_reactions for select
  using (
    exists (
      select 1 from direct_message_participants dmp
      join direct_messages dm on dm.channel_id = dmp.channel_id
      where dm.id = direct_message_reactions.message_id
      and dmp.user_id = auth.uid()
    )
  );

create policy "Users can add reactions to messages in their DM channels"
  on direct_message_reactions for insert
  with check (
    user_id = auth.uid() and
    exists (
      select 1 from direct_message_participants dmp
      join direct_messages dm on dm.channel_id = dmp.channel_id
      where dm.id = direct_message_reactions.message_id
      and dmp.user_id = auth.uid()
    )
  );

create policy "Users can remove their own reactions"
  on direct_message_reactions for delete
  using (user_id = auth.uid()); 