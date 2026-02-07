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
  doublePrecision,
  primaryKey,
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

export const productos = pgTable('productos', {
  id: text('id').primaryKey(),
  nombre: varchar('nombre', { length: 60 }).notNull(),
  precio: numeric('precio', { precision: 10, scale: 2 }).notNull(),
  stock: integer('stock').notNull().default(0),
  unidad: varchar('unidad', { length: 20 }).notNull(),
  creado_en: timestamp('creado_en', { withTimezone: true })
    .defaultNow()
    .notNull(),
  actualizado_en: timestamp('actualizado_en', { withTimezone: true })
    .defaultNow()
    .notNull(),
  borrado_en: timestamp('borrado_en', { withTimezone: true }),
});

export const ingredientes = pgTable('ingredientes', {
  id: text('id').primaryKey(),
  nombre: varchar('nombre', { length: 100 }).notNull(),
  unidad: varchar('unidad', { length: 20 }).notNull(),
  cantidad: doublePrecision('cantidad').default(0).notNull(),
  cantidad_minima: doublePrecision('cantidad_minima').default(0).notNull(),
  creado_en: timestamp('creado_en', { withTimezone: true })
    .defaultNow()
    .notNull(),
  actualizado_en: timestamp('actualizado_en', { withTimezone: true })
    .defaultNow()
    .notNull(),
  borrado_en: timestamp('borrado_en', { withTimezone: true }),
});

export const platos = pgTable('platos', {
  id: text('id').primaryKey(),
  nombre: varchar('nombre', { length: 60 }).notNull(),
  precio: numeric('precio', { precision: 10, scale: 2 }).notNull(),
  creado_en: timestamp('creado_en', { withTimezone: true })
    .defaultNow()
    .notNull(),
  actualizado_en: timestamp('actualizado_en', { withTimezone: true })
    .defaultNow()
    .notNull(),
  borrado_en: timestamp('borrado_en', { withTimezone: true }),
});

export const plato_ingredientes = pgTable(
  'plato_ingredientes',
  {
    plato_id: text('plato_id')
      .notNull()
      .references(() => platos.id, { onDelete: 'cascade' }),
    ingrediente_id: text('ingrediente_id')
      .notNull()
      .references(() => ingredientes.id),
    cantidad: doublePrecision('cantidad').notNull(),
    creado_en: timestamp('creado_en', { withTimezone: true })
      .defaultNow()
      .notNull(),
    actualizado_en: timestamp('actualizado_en', { withTimezone: true })
      .defaultNow()
      .notNull(),
    borrado_en: timestamp('borrado_en', { withTimezone: true }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.plato_id, table.ingrediente_id] }),
  }),
);

export const transacciones = pgTable('transacciones', {
  id: serial('id').primaryKey(),
  nro_reg: integer('nro_reg').notNull(),
  fecha: date('fecha').defaultNow(),
  hora: timestamp('hora', { withTimezone: true }).defaultNow(),
  tipo: varchar('tipo', { length: 30 }).default('venta'),
  concepto: text('concepto').notNull(),

  // Montos
  monto_total: numeric('monto_total', { precision: 10, scale: 2 })
    .notNull()
    .default('0'),
  monto_pagado: numeric('monto_pagado', { precision: 10, scale: 2 })
    .notNull()
    .default('0'),
  // monto_pendiente se calcula: monto_total - monto_pagado

  // Ubicación/tipo de servicio
  mesa: varchar('mesa', { length: 50 }), // "Mesa 5", "Para llevar", "Delivery", "Auto"
  cliente: varchar('cliente', { length: 100 }),

  // Estado: pendiente, abierto, cerrado
  estado: varchar('estado', { length: 20 }).default('pendiente'),

  // Estado de Cocina: pendiente, terminado
  estado_cocina: varchar('estado_cocina', { length: 20 }).default('pendiente'),

  // Referencias
  caja_id: integer('caja_id').references(() => caja_turno.id),
  usuario_id: text('usuario_id').references(() => usuarios.id),

  // Auditoría
  creado_en: timestamp('creado_en', { withTimezone: true })
    .defaultNow()
    .notNull(),
  actualizado_en: timestamp('actualizado_en', { withTimezone: true })
    .defaultNow()
    .notNull(),
  borrado_en: timestamp('borrado_en', { withTimezone: true }),
});

export const detalle_items = pgTable('detalle_items', {
  id: serial('id').primaryKey(),
  transaccion_id: integer('transaccion_id')
    .notNull()
    .references(() => transacciones.id, { onDelete: 'cascade' }),

  // Producto O Plato (excluyente)
  producto_id: text('producto_id').references(() => productos.id),
  plato_id: text('plato_id').references(() => platos.id),

  // Cantidades y precios
  cantidad: numeric('cantidad', { precision: 10, scale: 2 }).notNull(),
  precio_unitario: numeric('precio_unitario', {
    precision: 10,
    scale: 2,
  }).notNull(),
  subtotal: numeric('subtotal', { precision: 10, scale: 2 }).notNull(),

  // Notas del cliente para este item
  notas: text('notas'), // "Sin cebolla", "Punto medio", "Extra picante"

  // Auditoría
  creado_en: timestamp('creado_en', { withTimezone: true })
    .defaultNow()
    .notNull(),
  actualizado_en: timestamp('actualizado_en', { withTimezone: true })
    .defaultNow()
    .notNull(),
  borrado_en: timestamp('borrado_en', { withTimezone: true }),
});

export const detalle_item_extras = pgTable('detalle_item_extras', {
  id: serial('id').primaryKey(),
  detalle_item_id: integer('detalle_item_id')
    .notNull()
    .references(() => detalle_items.id, { onDelete: 'cascade' }),

  // Puede ser ingrediente conocido O descripción libre
  ingrediente_id: text('ingrediente_id').references(() => ingredientes.id),
  descripcion: text('descripcion'), // "Extra queso", "Porción doble carne"

  precio: numeric('precio', { precision: 10, scale: 2 }).notNull(),
  cantidad: numeric('cantidad', { precision: 10, scale: 2 }).default('1'),

  creado_en: timestamp('creado_en', { withTimezone: true })
    .defaultNow()
    .notNull(),
  actualizado_en: timestamp('actualizado_en', { withTimezone: true })
    .defaultNow()
    .notNull(),
  borrado_en: timestamp('borrado_en', { withTimezone: true }),
});

export const pagos = pgTable('pagos', {
  id: serial('id').primaryKey(),
  transaccion_id: integer('transaccion_id')
    .notNull()
    .references(() => transacciones.id, { onDelete: 'cascade' }),

  // Método de pago: efectivo, qr
  metodo_pago: varchar('metodo_pago', { length: 20 }).notNull(),

  // Montos
  monto: numeric('monto', { precision: 10, scale: 2 }).notNull(),
  monto_recibido: numeric('monto_recibido', { precision: 10, scale: 2 }), // Solo para efectivo
  // cambio se calcula: monto_recibido - monto (cuando es efectivo)

  // Referencia para QR
  referencia_qr: varchar('referencia_qr', { length: 100 }),

  // Usuario que registró el pago
  usuario_id: text('usuario_id').references(() => usuarios.id),

  // Auditoría
  creado_en: timestamp('creado_en', { withTimezone: true })
    .defaultNow()
    .notNull(),
  actualizado_en: timestamp('actualizado_en', { withTimezone: true })
    .defaultNow()
    .notNull(),
  borrado_en: timestamp('borrado_en', { withTimezone: true }),
});

export default {
  usuarios,
  caja_turno,
  gastos_caja,
  productos,
  ingredientes,
  platos,
  plato_ingredientes,
  transacciones,
  detalle_items,
  detalle_item_extras,
  pagos,
};
