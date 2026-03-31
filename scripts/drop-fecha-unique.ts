/**
 * Script de emergencia para eliminar la restricción única en caja_turno.fecha
 * Ejecutar: npx tsx scripts/drop-fecha-unique.ts
 */
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL no está definida en .env');
  process.exit(1);
}

const pool = new Pool({ connectionString });

async function main() {
  const client = await pool.connect();
  try {
    console.log('🔗 Conectando a la base de datos...');

    // Verificar si la constraint existe antes de eliminarla
    const checkResult = await client.query(`
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_name = 'caja_turno'
        AND constraint_type = 'UNIQUE'
        AND constraint_name = 'caja_turno_fecha_unique'
    `);

    if (checkResult.rows.length === 0) {
      console.log('✅ La constraint "caja_turno_fecha_unique" ya no existe. Nada que eliminar.');
      return;
    }

    console.log('⚠️  Encontrada constraint "caja_turno_fecha_unique". Eliminando...');
    await client.query(`
      ALTER TABLE "caja_turno" DROP CONSTRAINT "caja_turno_fecha_unique"
    `);

    console.log('✅ Constraint eliminada correctamente.');
    console.log('   Ahora se pueden abrir múltiples cajas por fecha.');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
