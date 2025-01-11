SELECT 
  tc.table_schema as schema_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_schema as foreign_schema,
  ccu.table_name as foreign_table,
  ccu.column_name as foreign_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND (
  tc.table_schema = 'public' AND ccu.table_schema = 'auth'
  OR
  tc.table_schema = 'auth' AND ccu.table_schema = 'public'
); 