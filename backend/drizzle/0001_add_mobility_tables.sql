-- Mobility tables for CVSS data (tensor_fluxo_vias, tensor_od, tensor_tempo_deslocamento, trajetos_comuns)

CREATE TABLE IF NOT EXISTS "mobility_flows" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "ecgi_origin" varchar(100) NOT NULL,
  "lat_origin" double precision NOT NULL,
  "lng_origin" double precision NOT NULL,
  "cluster_origin" varchar(200) NOT NULL,
  "municipality_origin" varchar(100) NOT NULL,
  "ecgi_destination" varchar(100) NOT NULL,
  "lat_destination" double precision NOT NULL,
  "lng_destination" double precision NOT NULL,
  "cluster_destination" varchar(200) NOT NULL,
  "municipality_destination" varchar(100) NOT NULL,
  "n_users" integer NOT NULL DEFAULT 0,
  "n_transitions" integer NOT NULL DEFAULT 0,
  "dist_km" real,
  "period_predominant" varchar(20),
  "pct_of_cluster_origin" real,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "mobility_flows_origin_idx" ON "mobility_flows" ("cluster_origin");
CREATE INDEX IF NOT EXISTS "mobility_flows_dest_idx" ON "mobility_flows" ("cluster_destination");

CREATE TABLE IF NOT EXISTS "mobility_od" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "cluster_origin" varchar(200) NOT NULL,
  "municipality_origin" varchar(100) NOT NULL,
  "lat_origin" double precision NOT NULL,
  "lng_origin" double precision NOT NULL,
  "cluster_destination" varchar(200) NOT NULL,
  "municipality_destination" varchar(100) NOT NULL,
  "lat_destination" double precision NOT NULL,
  "lng_destination" double precision NOT NULL,
  "mesmo_cluster" boolean NOT NULL DEFAULT false,
  "n_users" integer NOT NULL DEFAULT 0,
  "n_viagens" integer NOT NULL DEFAULT 0,
  "dist_media_km" real,
  "period_predominant" varchar(20),
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "mobility_od_origin_idx" ON "mobility_od" ("cluster_origin");
CREATE INDEX IF NOT EXISTS "mobility_od_dest_idx" ON "mobility_od" ("cluster_destination");

CREATE TABLE IF NOT EXISTS "travel_times" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "cluster_origin" varchar(200) NOT NULL,
  "cluster_destination" varchar(200) NOT NULL,
  "mesmo_cluster" boolean NOT NULL DEFAULT false,
  "n_observacoes" integer NOT NULL DEFAULT 0,
  "dist_media_km" real,
  "dist_p25_km" real,
  "dist_p75_km" real,
  "period_predominant" varchar(20),
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "travel_times_origin_idx" ON "travel_times" ("cluster_origin");

CREATE TABLE IF NOT EXISTS "mobility_routes" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "cluster_origin" varchar(200) NOT NULL,
  "municipality_origin" varchar(100) NOT NULL,
  "lat_origin" double precision NOT NULL,
  "lng_origin" double precision NOT NULL,
  "cluster_destination" varchar(200) NOT NULL,
  "municipality_destination" varchar(100) NOT NULL,
  "lat_destination" double precision NOT NULL,
  "lng_destination" double precision NOT NULL,
  "mesmo_cluster" boolean NOT NULL DEFAULT false,
  "n_users" integer NOT NULL DEFAULT 0,
  "n_viagens" integer NOT NULL DEFAULT 0,
  "dist_media_km" real,
  "period_predominant" varchar(20),
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "mobility_routes_origin_idx" ON "mobility_routes" ("cluster_origin");
CREATE INDEX IF NOT EXISTS "mobility_routes_dest_idx" ON "mobility_routes" ("cluster_destination");
