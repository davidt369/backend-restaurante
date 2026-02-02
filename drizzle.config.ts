/// <reference types="node" />
import { defineConfig } from 'drizzle-kit';

const connection = process.env.DATABASE_URL;
if (!connection) {
  throw new Error(
    'DATABASE_URL no está definida. Exporta la variable antes de ejecutar drizzle-kit.',
  );
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: connection },
});
