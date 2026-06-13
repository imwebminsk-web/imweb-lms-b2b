-- Расширение bucket test-attachments: видео mp4/webm/ogg, лимит 50 МБ
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'test-attachments',
  'test-attachments',
  true,
  52428800,
  ARRAY[
    'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave',
    'video/mp4', 'video/webm', 'video/ogg'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
