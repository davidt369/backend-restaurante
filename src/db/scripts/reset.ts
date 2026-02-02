import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

// ===============================
// Cargar variables de entorno
// ===============================
const dotenvPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: dotenvPath });

// ===============================
// Validar DATABASE_URL
// ===============================
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set');
}

// ===============================
// Conexión a la base de datos
// ===============================
const pool = new Pool({
  connectionString: databaseUrl,
});

const db = drizzle(pool);

// ===============================
// Script principal
// ===============================
async function main(): Promise<void> {
  console.log('⏳ Resetting database...');

  await db.execute(sql.raw('DROP SCHEMA IF EXISTS public CASCADE'));
  await db.execute(sql.raw('CREATE SCHEMA public'));
  await db.execute(sql.raw('GRANT ALL ON SCHEMA public TO public'));
  await db.execute(
    sql.raw("COMMENT ON SCHEMA public IS 'standard public schema'"),
  );

  console.log('✅ Database reset complete');
  await pool.end();
}

// ===============================
// Ejecución segura
// ===============================
main().catch((error: Error) => {
  console.error('❌ Error resetting database:', error.message);
  process.exit(1);
});
