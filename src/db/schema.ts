import {
  pgTable,
  text,
  varchar,
  timestamp,
  serial,
  date,
  integer,
  numeric,
  boolean,
} from 'drizzle-orm/pg-core';

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

export const caja_turno = pgTable('caja_turno', {
  id: serial('id').primaryKey(),
  fecha: date('fecha').notNull().unique(),
  hora_apertura: timestamp('hora_apertura', {
    withTimezone: true,
  }).defaultNow(),
  hora_cierre: timestamp('hora_cierre', { withTimezone: true }),
  usuario_id: text('usuario_id').references(() => usuarios.id),

  monto_inicial: numeric('monto_inicial', { precision: 10, scale: 2 }).default(
    '0',
  ),

  // Conteo físico de billetes y monedas
  b200: integer('b200').default(0),
  b100: integer('b100').default(0),
  b50: integer('b50').default(0),
  b20: integer('b20').default(0),
  b10: integer('b10').default(0),
  b5: integer('b5').default(0),
  m2: integer('m2').default(0),
  m1: integer('m1').default(0),
  m050: integer('m050').default(0),
  m020: integer('m020').default(0),
  m010: integer('m010').default(0),
  ventas_efectivo: numeric('ventas_efectivo', {
    precision: 10,
    scale: 2,
  }).default('0'),
  ventas_qr: numeric('ventas_qr', { precision: 10, scale: 2 }).default('0'),
  total_salidas: numeric('total_salidas', { precision: 10, scale: 2 }).default(
    '0',
  ),

  cerrada: boolean('cerrada').default(false),
  cierre_obs: text('cierre_obs'),
});

export const gastos_caja = pgTable('gastos_caja', {
  id: serial('id').primaryKey(),
  caja_id: integer('caja_id')
    .notNull()
    .references(() => caja_turno.id, { onDelete: 'cascade' }),
  usuario_id: text('usuario_id').references(() => usuarios.id),

  descripcion: text('descripcion').notNull(),
  metodo_pago: varchar('metodo_pago', { length: 20 }).notNull(),
  monto: numeric('monto', { precision: 10, scale: 2 }).notNull(),

  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow(),
  actualizado_en: timestamp('actualizado_en', {
    withTimezone: true,
  }).defaultNow(),
  borrado_en: timestamp('borrado_en', { withTimezone: true }),
});

export default { usuarios, caja_turno, gastos_caja };
