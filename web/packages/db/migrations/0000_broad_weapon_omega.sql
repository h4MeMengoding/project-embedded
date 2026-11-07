CREATE TABLE IF NOT EXISTS "app_config" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bmkg_forecasts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"adm4" text NOT NULL,
	"analysis_date" timestamp with time zone NOT NULL,
	"utc_datetime" timestamp with time zone NOT NULL,
	"local_datetime" text,
	"t" double precision,
	"hu" double precision,
	"weather_code" integer,
	"weather_desc" text,
	"tcc" double precision,
	"ws" double precision,
	"wd" text,
	"raw" jsonb,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "devices" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone,
	"last_rssi" integer,
	"fw_version" text,
	"last_uptime_s" integer,
	"last_heap_free" integer,
	"last_backlog" integer,
	"last_buffer_full" boolean
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "evaluation_slots" (
	"id" serial PRIMARY KEY NOT NULL,
	"slot_start" timestamp with time zone NOT NULL,
	"slot_end" timestamp with time zone NOT NULL,
	"device_id" text NOT NULL,
	"wet_minutes" integer,
	"data_minutes" integer,
	"actual_rain" boolean,
	"fuzzy_prediction_id" bigint,
	"fuzzy_predict_rain" boolean,
	"fuzzy_probability" double precision,
	"bmkg_forecast_id" bigint,
	"bmkg_weather_desc" text,
	"bmkg_predict_rain" boolean,
	"fuzzy_correct" boolean,
	"bmkg_correct" boolean
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "fuzzy_predictions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"device_id" text NOT NULL,
	"ts" timestamp with time zone NOT NULL,
	"config_version" text NOT NULL,
	"delta_p3h" double precision,
	"rh" double precision,
	"dew_point" double precision,
	"dpd" double precision,
	"memberships" jsonb,
	"rule_strengths" jsonb,
	"probability" double precision,
	"category" text,
	"predict_rain" boolean,
	"status" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rain_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"device_id" text NOT NULL,
	"ts" timestamp with time zone NOT NULL,
	"state" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_backfill" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "readings_minute" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"device_id" text NOT NULL,
	"ts" timestamp with time zone NOT NULL,
	"temp_dht" double precision,
	"hum_dht" double precision,
	"temp_bmp" double precision,
	"pressure_hpa" double precision,
	"lux" double precision,
	"rain_analog_avg" double precision,
	"rain_wet_seconds" integer,
	"samples" integer,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_backfill" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "bmkg_forecasts_uq" ON "bmkg_forecasts" USING btree ("adm4","analysis_date","utc_datetime");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "evaluation_slots_device_start_uq" ON "evaluation_slots" USING btree ("device_id","slot_start");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "fuzzy_predictions_device_ts_uq" ON "fuzzy_predictions" USING btree ("device_id","ts");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "rain_events_device_ts_state_uq" ON "rain_events" USING btree ("device_id","ts","state");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "readings_minute_device_ts_uq" ON "readings_minute" USING btree ("device_id","ts");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "readings_minute_ts_idx" ON "readings_minute" USING btree ("ts");