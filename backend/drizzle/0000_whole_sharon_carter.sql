CREATE TABLE IF NOT EXISTS "activity_log" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"actor_id" uuid,
	"actor_staff_id" uuid,
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" uuid NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"ip_address" "inet",
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "alert_configs" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid NOT NULL,
	"indicator_id" uuid NOT NULL,
	"region_id" uuid,
	"critical_threshold" real NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"channel" varchar(20) DEFAULT 'email' NOT NULL,
	"last_checked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "alert_logs" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"config_id" uuid NOT NULL,
	"region_id" uuid NOT NULL,
	"indicator_id" uuid NOT NULL,
	"current_value" real NOT NULL,
	"critical_threshold" real NOT NULL,
	"period" varchar(20) NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"channel" varchar(20) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "base_stations" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"station_id" varchar(100) NOT NULL,
	"region_id" uuid NOT NULL,
	"technology" varchar(10) NOT NULL,
	"carrier" varchar(100),
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"power_dbm" real,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cdrview_records" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"region_id" uuid NOT NULL,
	"station_id" uuid,
	"period" timestamp NOT NULL,
	"hour_of_day" integer NOT NULL,
	"day_of_week" integer NOT NULL,
	"people_count" integer DEFAULT 0 NOT NULL,
	"network_technology" varchar(10),
	"signal_strength" real,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "data_sources" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"slug" varchar(100) NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"url" text,
	"type" varchar(50) DEFAULT 'csv' NOT NULL,
	"country" varchar(10) DEFAULT 'BR' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_ingested_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "indicator_data" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"region_id" uuid NOT NULL,
	"indicator_id" uuid NOT NULL,
	"source_id" uuid,
	"period" varchar(20) NOT NULL,
	"value" real NOT NULL,
	"normalized_value" real,
	"quality" varchar(20) DEFAULT 'estimated',
	"notes" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "indicators" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"slug" varchar(100) NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"category" varchar(50) NOT NULL,
	"unit" varchar(50) NOT NULL,
	"direction" varchar(20) DEFAULT 'higher_is_better' NOT NULL,
	"critical_thresholds" jsonb DEFAULT '{}'::jsonb,
	"source_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"recipient_id" uuid NOT NULL,
	"type" varchar(100) NOT NULL,
	"priority" varchar(20) DEFAULT 'normal',
	"title" varchar(255) NOT NULL,
	"message" text,
	"action_url" text,
	"data" jsonb,
	"related_type" varchar(50),
	"related_id" uuid,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "programs" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"region_id" uuid,
	"name" varchar(200) NOT NULL,
	"description" text,
	"category" varchar(50) NOT NULL,
	"organization" varchar(200),
	"municipality" varchar(100),
	"state" varchar(100),
	"url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"starts_at" timestamp,
	"ends_at" timestamp,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "query_logs" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid,
	"query" text NOT NULL,
	"filters" jsonb DEFAULT '{}'::jsonb,
	"generated_sql" text,
	"sql_valid" boolean,
	"ai_response" text,
	"rows_returned" integer DEFAULT 0 NOT NULL,
	"latency_ms" integer NOT NULL,
	"groq_model" varchar(100) NOT NULL,
	"tokens_used" integer,
	"error" text,
	"ip_address" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "region_coverage" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"region_id" uuid NOT NULL,
	"period" varchar(20) NOT NULL,
	"network_coverage_score" real DEFAULT 0 NOT NULL,
	"max_concentration" integer DEFAULT 0 NOT NULL,
	"min_concentration" integer DEFAULT 0 NOT NULL,
	"avg_daytime_concentration" real,
	"avg_nighttime_concentration" real,
	"dominant_technology" varchar(10),
	"no_4g_or_5g_coverage" boolean DEFAULT false NOT NULL,
	"total_records" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "regions" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"zone_id" varchar(100) NOT NULL,
	"name" varchar(200) NOT NULL,
	"municipality" varchar(100) NOT NULL,
	"state" varchar(100) NOT NULL,
	"country" varchar(10) DEFAULT 'BR' NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"estimated_population" integer,
	"area_km2" double precision,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"refresh_token" text,
	"user_agent" text,
	"ip_address" text,
	"device_type" varchar(30),
	"is_active" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp,
	CONSTRAINT "sessions_token_unique" UNIQUE("token"),
	CONSTRAINT "sessions_refresh_token_unique" UNIQUE("refresh_token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "staff_sessions" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"staff_id" uuid NOT NULL,
	"token" text NOT NULL,
	"refresh_token" text,
	"user_agent" text,
	"ip_address" text,
	"device_type" varchar(30),
	"is_active" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp,
	CONSTRAINT "staff_sessions_token_unique" UNIQUE("token"),
	CONSTRAINT "staff_sessions_refresh_token_unique" UNIQUE("refresh_token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "staff_users" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"email" text NOT NULL,
	"email_hash" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"avatar" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"email" text NOT NULL,
	"email_hash" text NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"password_hash" text,
	"google_id" text,
	"avatar" text,
	"timezone" varchar(100),
	"locale" varchar(10) DEFAULT 'pt',
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_actor_staff_id_staff_users_id_fk" FOREIGN KEY ("actor_staff_id") REFERENCES "public"."staff_users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "alert_configs" ADD CONSTRAINT "alert_configs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "alert_configs" ADD CONSTRAINT "alert_configs_indicator_id_indicators_id_fk" FOREIGN KEY ("indicator_id") REFERENCES "public"."indicators"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "alert_configs" ADD CONSTRAINT "alert_configs_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "alert_logs" ADD CONSTRAINT "alert_logs_config_id_alert_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "public"."alert_configs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "alert_logs" ADD CONSTRAINT "alert_logs_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "alert_logs" ADD CONSTRAINT "alert_logs_indicator_id_indicators_id_fk" FOREIGN KEY ("indicator_id") REFERENCES "public"."indicators"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "base_stations" ADD CONSTRAINT "base_stations_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cdrview_records" ADD CONSTRAINT "cdrview_records_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cdrview_records" ADD CONSTRAINT "cdrview_records_station_id_base_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."base_stations"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "indicator_data" ADD CONSTRAINT "indicator_data_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "indicator_data" ADD CONSTRAINT "indicator_data_indicator_id_indicators_id_fk" FOREIGN KEY ("indicator_id") REFERENCES "public"."indicators"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "indicator_data" ADD CONSTRAINT "indicator_data_source_id_data_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."data_sources"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "indicators" ADD CONSTRAINT "indicators_source_id_data_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."data_sources"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "programs" ADD CONSTRAINT "programs_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "query_logs" ADD CONSTRAINT "query_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "region_coverage" ADD CONSTRAINT "region_coverage_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "staff_sessions" ADD CONSTRAINT "staff_sessions_staff_id_staff_users_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff_users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activity_entity_idx" ON "activity_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activity_actor_idx" ON "activity_log" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activity_staff_idx" ON "activity_log" USING btree ("actor_staff_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activity_created_idx" ON "activity_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "alert_configs_user_idx" ON "alert_configs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "alert_configs_indicator_idx" ON "alert_configs" USING btree ("indicator_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "alert_configs_active_idx" ON "alert_configs" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "alert_logs_config_idx" ON "alert_logs" USING btree ("config_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "alert_logs_region_idx" ON "alert_logs" USING btree ("region_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "alert_logs_sent_idx" ON "alert_logs" USING btree ("sent_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "base_stations_station_id_idx" ON "base_stations" USING btree ("station_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "base_stations_region_idx" ON "base_stations" USING btree ("region_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "base_stations_technology_idx" ON "base_stations" USING btree ("technology");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cdrview_records_region_idx" ON "cdrview_records" USING btree ("region_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cdrview_records_period_idx" ON "cdrview_records" USING btree ("period");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cdrview_records_hour_idx" ON "cdrview_records" USING btree ("hour_of_day");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cdrview_records_region_period_idx" ON "cdrview_records" USING btree ("region_id","period");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "data_sources_slug_idx" ON "data_sources" USING btree ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "data_sources_country_idx" ON "data_sources" USING btree ("country");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "indicator_data_unique_idx" ON "indicator_data" USING btree ("region_id","indicator_id","period");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "indicator_data_region_idx" ON "indicator_data" USING btree ("region_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "indicator_data_indicator_idx" ON "indicator_data" USING btree ("indicator_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "indicator_data_period_idx" ON "indicator_data" USING btree ("period");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "indicators_slug_idx" ON "indicators" USING btree ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "indicators_category_idx" ON "indicators" USING btree ("category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_recipient_idx" ON "notifications" USING btree ("recipient_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_unread_idx" ON "notifications" USING btree ("recipient_id","is_read");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "programs_region_idx" ON "programs" USING btree ("region_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "programs_category_idx" ON "programs" USING btree ("category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "programs_state_idx" ON "programs" USING btree ("state");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "programs_active_idx" ON "programs" USING btree ("is_active","category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "query_logs_user_idx" ON "query_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "query_logs_created_idx" ON "query_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "query_logs_error_idx" ON "query_logs" USING btree ("error");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "region_coverage_region_period_idx" ON "region_coverage" USING btree ("region_id","period");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "region_coverage_region_idx" ON "region_coverage" USING btree ("region_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "region_coverage_period_idx" ON "region_coverage" USING btree ("period");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "region_coverage_critical_idx" ON "region_coverage" USING btree ("no_4g_or_5g_coverage");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "regions_zone_id_idx" ON "regions" USING btree ("zone_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "regions_state_idx" ON "regions" USING btree ("state");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "regions_municipality_idx" ON "regions" USING btree ("municipality","state");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "regions_coords_idx" ON "regions" USING btree ("lat","lng");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_token_idx" ON "sessions" USING btree ("token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_refresh_token_idx" ON "sessions" USING btree ("refresh_token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "staff_sessions_staff_idx" ON "staff_sessions" USING btree ("staff_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "staff_sessions_token_idx" ON "staff_sessions" USING btree ("token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "staff_sessions_refresh_token_idx" ON "staff_sessions" USING btree ("refresh_token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "staff_sessions_expires_at_idx" ON "staff_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "staff_email_hash_idx" ON "staff_users" USING btree ("email_hash");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_hash_idx" ON "users" USING btree ("email_hash");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_google_id_idx" ON "users" USING btree ("google_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_status_idx" ON "users" USING btree ("status");