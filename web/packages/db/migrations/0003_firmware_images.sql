CREATE TABLE IF NOT EXISTS "firmware_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"version" text NOT NULL,
	"size" integer NOT NULL,
	"md5" text NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"data" "bytea" NOT NULL
);

ALTER TABLE "firmware_images" ENABLE ROW LEVEL SECURITY;
