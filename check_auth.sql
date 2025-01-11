-- Check permissions on auth schema
SELECT *
FROM information_schema.role_table_grants 
WHERE table_schema = 'auth'
AND grantee IN ('anon', 'authenticated');

-- Check policies on auth schema
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'auth';

-- Check if auth schema is in search_path
SHOW search_path; 