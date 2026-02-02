import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as bcrypt from 'bcrypt';

import * as schema from '../schema';

// ===============================
// Cargar variables de entorno
// ===============================
const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });

// ===============================
// Validar DATABASE_URL
// ===============================
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set');
}

// ===============================
// Conexión DB
// ===============================
const pool = new Pool({
  connectionString: databaseUrl,
});

const db = drizzle(pool, { schema });

// ===============================
// Seed
// ===============================
async function main(): Promise<void> {
  console.log('⏳ Seeding database...');

  // Hash de contraseñas
  const adminPassword = await bcrypt.hash('Admin123!', 10);
  const cajeroPassword = await bcrypt.hash('Cajero123!', 10);

  await db
    .insert(schema.usuarios)
    .values([
      {
        id: 'admin-id-0001',
        nombre_usuario: 'admin',
        nombre: 'Administrador',
        contrasena: adminPassword,
        rol: 'admin',
        creado_en: new Date(),
        actualizado_en: new Date(),
      },
      {
        id: 'cajero-id-0001',
        nombre_usuario: 'cajero1',
        nombre: 'Cajero Uno',
        contrasena: cajeroPassword,
        rol: 'cajero',
        creado_en: new Date(),
        actualizado_en: new Date(),
      },
    ])
    .onConflictDoNothing();

  console.log('✅ Seeding complete');
  console.log('📝 Usuarios creados:');
  console.log('   👤 admin / Admin123!');
  console.log('   👤 cajero1 / Cajero123!');
  await pool.end();
}

// ===============================
// Ejecución segura
// ===============================
main().catch((error: Error) => {
  console.error('❌ Seed error:', error.message);
  process.exit(1);
});
