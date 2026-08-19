CREATE TYPE "public"."test_scope" AS ENUM (
    'library',
    'inline'
);

ALTER TYPE "public"."test_scope" OWNER TO "postgres";

ALTER TABLE "public"."tests"
    ADD COLUMN "scope" "public"."test_scope" NOT NULL DEFAULT 'library'::"public"."test_scope",
    ADD COLUMN "lesson_block_id" "uuid" REFERENCES "public"."lesson_blocks"("id") ON DELETE CASCADE;

ALTER TABLE "public"."tests"
    ADD CONSTRAINT "tests_scope_lesson_block_chk" CHECK (
        (("scope" = 'library'::"public"."test_scope") AND ("lesson_block_id" IS NULL)) OR
        (("scope" = 'inline'::"public"."test_scope") AND ("lesson_block_id" IS NOT NULL))
    );
