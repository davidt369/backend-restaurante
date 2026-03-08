import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './db/schema';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
  console.error('❌ Error inesperado en el pool de PostgreSQL:', err);
  process.exit(1);
});

export const db = drizzle(pool, { schema });

export async function closeDb() {
  await pool.end();
  console.log('✔ Conexión a PostgreSQL cerrada');
}
