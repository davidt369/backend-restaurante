"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const drizzle_kit_1 = require("drizzle-kit");
const connection = process.env.DATABASE_URL;
if (!connection) {
    throw new Error('DATABASE_URL no está definida. Exporta la variable antes de ejecutar drizzle-kit.');
}
exports.default = (0, drizzle_kit_1.defineConfig)({
    schema: './src/db/schema.ts',
    out: './drizzle',
    dialect: 'postgresql',
    dbCredentials: { url: connection },
});
//# sourceMappingURL=drizzle.config.js.map