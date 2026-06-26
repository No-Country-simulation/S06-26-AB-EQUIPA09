import {
    pgTable,
    uuid,
    varchar,
    numeric,
} from "drizzle-orm/pg-core";

export const regions = pgTable("regions", {
    id: uuid("id").primaryKey(),

    nome: varchar("nome", {
        length: 255,
    }).notNull(),

    pais: varchar("pais", {
        length: 100,
    }).notNull(),

    lat: numeric("lat").notNull(),

    lng: numeric("lng").notNull(),
});