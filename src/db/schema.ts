import { pgTable, text, varchar, timestamp } from 'drizzle-orm/pg-core';

export const usuarios = pgTable('usuarios', {
  id: text('id').primaryKey(),
  nombre: varchar('nombre', { length: 60 }).notNull(),
  nombre_usuario: varchar('nombre_usuario', { length: 30 }).notNull(),
  contrasena: varchar('contrasena', { length: 255 }).notNull(),
  rol: varchar('rol', { length: 20 }).notNull().default('cajero'),
  creado_en: timestamp('creado_en', { withTimezone: true })
    .defaultNow()
    .notNull(),
  actualizado_en: timestamp('actualizado_en', { withTimezone: true })
    .defaultNow()
    .notNull(),
  borrado_en: timestamp('borrado_en', { withTimezone: true }),
});

export default { usuarios };
