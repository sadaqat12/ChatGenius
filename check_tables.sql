SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name IN (
  'message_reactions',
  'team_members',
  'channel_members',
  'direct_message_participants',
  'direct_message_reactions'
)
ORDER BY table_name, column_name; 