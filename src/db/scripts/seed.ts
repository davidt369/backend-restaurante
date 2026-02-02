import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../schema';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

async function main() {
  console.log('⏳ Seeding database...');

  // Inserta usuarios de ejemplo (ajusta los campos según tu esquema real)
  await db
    .insert(schema.usuarios)
    .values([
      {
        id: 'admin-id-0001',
        nombre_usuario: 'admin',
        nombre: 'Administrador',
        contrasena: 'adminpasswordhash',
        rol: 'admin',
        creado_en: new Date(),
        actualizado_en: new Date(),
      },
      {
        id: 'cajero-id-0001',
        nombre_usuario: 'cajero1',
        nombre: 'Cajero Uno',
        contrasena: 'cajeropasswordhash',
        rol: 'cajero',
        creado_en: new Date(),
        actualizado_en: new Date(),
      },
    ])
    .onConflictDoNothing();

  console.log('✅ Seeding complete');
  await pool.end();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
