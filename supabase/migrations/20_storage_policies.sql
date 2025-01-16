-- Create storage policies for avatars bucket
create policy "Allow users to upload their own avatar"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Allow public to view avatars"
on storage.objects for select
to public
using (bucket_id = 'avatars');

create policy "Allow users to update their own avatar"
on storage.objects for update
to authenticated
using (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

create policy "Allow users to delete their own avatar"
on storage.objects for delete
to authenticated
using (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text); 