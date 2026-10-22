import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

export const maps = sqliteTable('maps', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  layout: text('layout').notNull().default('right'),
  shareToken: text('share_token').unique(),
  updatedAt: integer('updated_at').notNull(),
}, table => [index('maps_owner_updated_idx').on(table.ownerId, table.updatedAt)]);
