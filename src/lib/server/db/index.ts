import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import Database from 'better-sqlite3';
import * as schema from './schema';
import { config } from '../config';

const client = new Database(config.database.url);

// SQLite defaults foreign key enforcement to OFF per-connection. Without
// this, `onDelete` actions declared in the schema (cascade / set null) never
// actually fire — deletes silently leave dangling references behind instead.
client.pragma('foreign_keys = ON');

export const db = drizzle(client, { schema });

migrate(db, { migrationsFolder: 'drizzle' });
