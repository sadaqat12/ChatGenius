SELECT json_agg(
  json_build_object(
    'table_name', tc.table_name,
    'column_name', kcu.column_name,
    'foreign_table_name', ccu.table_name,
    'foreign_column_name', ccu.column_name
  )
)
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_schema = 'public'; 