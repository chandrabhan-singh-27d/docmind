import { sql } from 'drizzle-orm';
import {
  pgTable,
  text,
  timestamp,
  integer,
  uuid,
  vector,
  index,
  jsonb,
  check,
} from 'drizzle-orm/pg-core';

export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  filename: text('filename').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  contentHash: text('content_hash').notNull().unique(),
  totalChunks: integer('total_chunks').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const chunks = pgTable(
  'chunks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    chunkIndex: integer('chunk_index').notNull(),
    tokenCount: integer('token_count').notNull(),
    contentHash: text('content_hash').notNull(),
    embedding: vector('embedding', { dimensions: 384 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('chunks_document_id_idx').on(table.documentId),
    index('chunks_embedding_idx').using(
      'hnsw',
      table.embedding.op('vector_cosine_ops'),
    ),
  ],
);

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type Chunk = typeof chunks.$inferSelect;
export type NewChunk = typeof chunks.$inferInsert;

export const errorEvents = pgTable(
  'error_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    level: text('level').notNull(),
    source: text('source').notNull(),
    message: text('message').notNull(),
    stack: text('stack'),
    route: text('route'),
    requestId: text('request_id'),
    userAgent: text('user_agent'),
    url: text('url'),
    releaseId: text('release_id'),
    context: jsonb('context').notNull().default({}),
  },
  (table) => [
    check('error_events_level_check', sql`${table.level} IN ('error', 'warn', 'info')`),
    check('error_events_source_check', sql`${table.source} IN ('frontend', 'backend')`),
    index('error_events_created_at_idx').on(table.createdAt.desc()),
    index('error_events_level_source_idx').on(table.level, table.source),
    // Partial: most frontend errors have null route. Indexing nulls just
    // wastes space, and we never query `WHERE route IS NULL`.
    index('error_events_route_idx')
      .on(table.route)
      .where(sql`${table.route} IS NOT NULL`),
  ],
);

export type ErrorEvent = typeof errorEvents.$inferSelect;
export type NewErrorEvent = typeof errorEvents.$inferInsert;
