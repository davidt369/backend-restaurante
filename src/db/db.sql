CREATE TABLE usuarios (
    id TEXT PRIMARY KEY,
    nombre VARCHAR(60) NOT NULL,
    correo VARCHAR(100) NOT NULL UNIQUE,
    nombre_usuario VARCHAR(30) NOT NULL UNIQUE,
    contrasena VARCHAR(255) NOT NULL,
    rol VARCHAR(20) NOT NULL DEFAULT 'usuario',
    creado_en TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    actualizado_en TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    borrado_en TIMESTAMPTZ
);
CREATE TABLE caja_turno (
    id SERIAL PRIMARY KEY,
    fecha DATE NOT NULL UNIQUE,
    hora_apertura TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    hora_cierre TIMESTAMPTZ,

    usuario_id TEXT REFERENCES usuarios(id),

    monto_inicial NUMERIC(10,2) DEFAULT 0,

    -- Conteo físico
    b200 INTEGER DEFAULT 0, b100 INTEGER DEFAULT 0, b50 INTEGER DEFAULT 0,
    b20 INTEGER DEFAULT 0, b10 INTEGER DEFAULT 0, b5 INTEGER DEFAULT 0,
    m2 INTEGER DEFAULT 0, m1 INTEGER DEFAULT 0,
    m050 INTEGER DEFAULT 0, m020 INTEGER DEFAULT 0,

    ventas_efectivo NUMERIC(10,2) DEFAULT 0,
    ventas_qr NUMERIC(10,2) DEFAULT 0,
   

    total_salidas NUMERIC(10,2) DEFAULT 0,

    cerrada BOOLEAN DEFAULT FALSE,
    cierre_obs TEXT
);
CREATE TABLE gastos_caja (
    id SERIAL PRIMARY KEY,

    caja_id INTEGER NOT NULL
        REFERENCES caja_turno(id) ON DELETE CASCADE,

    usuario_id TEXT REFERENCES usuarios(id),

    descripcion TEXT NOT NULL,

    metodo_pago VARCHAR(20) NOT NULL
        CHECK (metodo_pago IN ('efectivo', 'qr')),

    monto NUMERIC(10,2) NOT NULL CHECK (monto > 0),

     creado_en TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ DEFAULT NOW(),
    borrado_en TIMESTAMPTZ

);

CREATE TABLE productos (
    id TEXT PRIMARY KEY,
    nombre VARCHAR(60) NOT NULL,
    precio NUMERIC(10,2) NOT NULL CHECK (precio >= 0),
    stock INTEGER NOT NULL CHECK (stock >= 0),
    unidad VARCHAR(20) NOT NULL,
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ DEFAULT NOW(),
    borrado_en TIMESTAMPTZ
);
CREATE TABLE platos (
    id TEXT PRIMARY KEY,
    nombre VARCHAR(60) NOT NULL,
    precio NUMERIC(10,2) NOT NULL CHECK (precio >= 0),
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ DEFAULT NOW(),
    borrado_en TIMESTAMPTZ
);
CREATE TABLE ingredientes (
    id TEXT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    unidad VARCHAR(20) NOT NULL,
    cantidad DOUBLE PRECISION DEFAULT 0 CHECK (cantidad >= 0),
    cantidad_minima DOUBLE PRECISION DEFAULT 0 CHECK (cantidad_minima >= 0),
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ DEFAULT NOW(),
    borrado_en TIMESTAMPTZ
);
CREATE TABLE plato_ingredientes (
    plato_id TEXT NOT NULL REFERENCES platos(id) ON DELETE CASCADE,
    ingrediente_id TEXT NOT NULL REFERENCES ingredientes(id),
    cantidad DOUBLE PRECISION NOT NULL CHECK (cantidad > 0),
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ DEFAULT NOW(),
    borrado_en TIMESTAMPTZ,
    PRIMARY KEY (plato_id, ingrediente_id)
);
-- ===============================================
-- 8. TABLA TRANSACCIONES (PEDIDOS)
-- ===============================================
CREATE TABLE transacciones (
    id SERIAL PRIMARY KEY,
    nro_reg INTEGER NOT NULL,
    fecha DATE DEFAULT CURRENT_DATE,
    hora TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    tipo VARCHAR(30) DEFAULT 'venta',
    concepto TEXT NOT NULL,
    
    -- Montos
    monto_total NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (monto_total >= 0),
    monto_pagado NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (monto_pagado >= 0),
    monto_pendiente NUMERIC(10,2) GENERATED ALWAYS AS (monto_total - monto_pagado) STORED,
    
    -- Ubicación/tipo de servicio
    mesa VARCHAR(50), -- "Mesa 5", "Para llevar", "Delivery", "Auto"
    cliente VARCHAR(100),
    
    -- ESTADO ÚNICO (solo 3 estados)
    estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'abierto', 'cerrado')),
    
    -- Referencias
    caja_id INTEGER REFERENCES caja_turno(id),
    usuario_id TEXT REFERENCES usuarios(id),
    
    -- Auditoría
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ DEFAULT NOW(),
    borrado_en TIMESTAMPTZ
);

-- ===============================================
-- 9. TABLA DETALLE_ITEMS
-- ===============================================
CREATE TABLE detalle_items (
    id SERIAL PRIMARY KEY,
    transaccion_id INTEGER NOT NULL REFERENCES transacciones(id) ON DELETE CASCADE,
    
    -- Producto O Plato (excluyente)
    producto_id TEXT REFERENCES productos(id),
    plato_id TEXT REFERENCES platos(id),
     descripcion TEXT, -- "Extra queso", "Porción doble carne"
    -- Cantidades y precios
    cantidad NUMERIC(10,2) NOT NULL CHECK (cantidad > 0),
    precio_unitario NUMERIC(10,2) NOT NULL CHECK (precio_unitario >= 0),
    subtotal NUMERIC(10,2) NOT NULL CHECK (subtotal >= 0),
    
    -- Notas del cliente para este item
    notas TEXT, -- "Sin cebolla", "Punto medio", "Extra picante"
    
    -- Auditoría
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ DEFAULT NOW(),
    borrado_en TIMESTAMPTZ,
    
    -- Solo puede ser producto O plato, no ambos
    CHECK (
        (producto_id IS NOT NULL AND plato_id IS NULL) OR
        (producto_id IS NULL AND plato_id IS NOT NULL)
    )
);

-- ===============================================
-- 10. TABLA EXTRAS DE ITEMS
-- ===============================================
CREATE TABLE detalle_item_extras (
    id SERIAL PRIMARY KEY,
    detalle_item_id INTEGER NOT NULL REFERENCES detalle_items(id) ON DELETE CASCADE,
    
    -- Puede ser ingrediente conocido O descripción libre
    ingrediente_id TEXT REFERENCES ingredientes(id),
   
    
    precio NUMERIC(10,2) NOT NULL CHECK (precio >= 0),
    cantidad NUMERIC(10,2) DEFAULT 1 CHECK (cantidad > 0),
    
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ DEFAULT NOW(),
    borrado_en TIMESTAMPTZ,
    
    -- Debe tener ingrediente O descripción
    CHECK (
        (ingrediente_id IS NOT NULL) OR 
        (descripcion IS NOT NULL AND descripcion != '')
    )
);

-- ===============================================
-- 11. TABLA PAGOS
-- ===============================================
CREATE TABLE pagos (
    id SERIAL PRIMARY KEY,
    transaccion_id INTEGER NOT NULL REFERENCES transacciones(id) ON DELETE CASCADE,
    
    -- Método de pago
    metodo_pago VARCHAR(20) NOT NULL CHECK (metodo_pago IN ('efectivo', 'qr')),
    
    -- Montos
    monto NUMERIC(10,2) NOT NULL CHECK (monto > 0),
    monto_recibido NUMERIC(10,2), -- Solo para efectivo (ej: paga con 100)
    cambio NUMERIC(10,2) GENERATED ALWAYS AS (
        CASE 
            WHEN metodo_pago = 'efectivo' AND monto_recibido IS NOT NULL 
            THEN monto_recibido - monto
            ELSE 0
        END
    ) STORED,
    
    -- Referencia para QR
    referencia_qr VARCHAR(100), -- Código de transacción QR
    
    -- Usuario que registró el pago
    usuario_id TEXT REFERENCES usuarios(id),
    
    -- Auditoría
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ DEFAULT NOW(),
    borrado_en TIMESTAMPTZ,
    
    -- Validación: si es efectivo, debe tener monto_recibido
    CHECK (
        (metodo_pago = 'efectivo' AND monto_recibido >= monto) OR
        (metodo_pago = 'qr')
    )
);
