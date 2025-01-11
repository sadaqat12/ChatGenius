SELECT json_agg(
  json_build_object(
    'schema_name', table_schema,
    'table_name', tables.table_name,
    'columns', (
      SELECT json_agg(
        json_build_object(
          'column_name', columns.column_name,
          'data_type', columns.data_type,
          'is_nullable', columns.is_nullable,
          'column_default', columns.column_default,
          'foreign_keys', (
            SELECT json_agg(
              json_build_object(
                'foreign_schema', ccu.table_schema,
                'foreign_table', ccu.table_name,
                'foreign_column', ccu.column_name
              )
            )
            FROM information_schema.constraint_column_usage ccu
            JOIN information_schema.table_constraints tc 
              ON tc.constraint_name = ccu.constraint_name
            WHERE tc.table_schema = tables.table_schema
            AND tc.table_name = tables.table_name
            AND tc.constraint_type = 'FOREIGN KEY'
            AND kcu.column_name = columns.column_name
          )
        )
      )
      FROM information_schema.columns
      LEFT JOIN information_schema.key_column_usage kcu 
        ON kcu.table_schema = tables.table_schema
        AND kcu.table_name = tables.table_name 
        AND kcu.column_name = columns.column_name
      WHERE columns.table_schema = tables.table_schema
      AND columns.table_name = tables.table_name
    ),
    'views', (
      SELECT json_agg(
        json_build_object(
          'view_name', views.table_name,
          'view_definition', views.view_definition
        )
      )
      FROM information_schema.views
      WHERE views.table_schema = tables.table_schema
    )
  )
)
FROM information_schema.tables
WHERE table_schema IN ('public', 'auth')
AND table_type = 'BASE TABLE'; 