-- Phase 289 — лимит воспроизведения загруженного audio/video в инструкции задания.
-- В приложении задания теста хранятся в таблице `questions`.

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS media_play_limit integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.questions.media_play_limit IS
  'Макс. число воспроизведений native audio/video в HTML-инструкции. 0 = безлимит. iframe (YouTube и т.д.) не ограничивается.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'questions_media_play_limit_non_negative_chk'
      AND conrelid = 'public.questions'::regclass
  ) THEN
    ALTER TABLE public.questions
      ADD CONSTRAINT questions_media_play_limit_non_negative_chk
      CHECK (media_play_limit >= 0);
  END IF;
END
$$;
