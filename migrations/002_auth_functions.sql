-- Create function to ensure a user exists in auth.users
create or replace function public.ensure_user_exists(user_id uuid)
returns void as $$
begin
  if not exists (select 1 from auth.users where id = user_id) then
    insert into auth.users (id, email, created_at, updated_at)
    values (user_id, 'placeholder@example.com', now(), now());
  end if;
end;
$$ language plpgsql security definer;

-- Create function to create a user entry in auth.users
create or replace function public.create_user_entry(user_id uuid, email text)
returns void as $$
begin
  if not exists (select 1 from auth.users where id = user_id) then
    insert into auth.users (id, email, created_at, updated_at)
    values (user_id, email, now(), now());
  end if;
end;
$$ language plpgsql security definer;

-- Grant execute permissions
grant execute on function public.ensure_user_exists(uuid) to service_role;
grant execute on function public.create_user_entry(uuid, text) to service_role; 