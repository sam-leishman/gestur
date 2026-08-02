import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import Database from 'better-sqlite3';
import * as schema from './schema';
import { config } from '../config';

const client = new Database(config.database.url);

export const db = drizzle(client, { schema });

migrate(db, { migrationsFolder: 'drizzle' });
