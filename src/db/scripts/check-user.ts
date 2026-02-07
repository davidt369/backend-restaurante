import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as schema from '../schema';
import { eq } from 'drizzle-orm';

const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
}

const pool = new Pool({
    connectionString: databaseUrl,
});

const db = drizzle(pool, { schema });

async function main() {
    console.log('🔍 Checking for admin user...');
    const users = await db
        .select()
        .from(schema.usuarios)
        .where(eq(schema.usuarios.nombre_usuario, 'admin'))
        .limit(1);

    if (users.length > 0) {
        console.log('✅ Admin user found:', users[0].nombre_usuario);
    } else {
        console.log('❌ Admin user NOT found');
    }
    await pool.end();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
