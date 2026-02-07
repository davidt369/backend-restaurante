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
CREATE TABLE transacciones (
    id SERIAL PRIMARY KEY,
    nro_reg INTEGER NOT NULL,
    fecha DATE DEFAULT CURRENT_DATE,
    hora VARCHAR(10) DEFAULT TO_CHAR(CURRENT_TIME, 'HH24:MI'),

    tipo VARCHAR(30) DEFAULT 'venta',
    concepto TEXT NOT NULL,

    monto NUMERIC(10,2) NOT NULL CHECK (monto >= 0),

    mesa VARCHAR(50), -- o tambien puede poner si es para llavar o auto 
    cliente VARCHAR(100),

    estado_cocina VARCHAR(20) DEFAULT 'abierto'
        CHECK (estado_cocina IN ('pendiente', 'abierto', 'cerrado')),

    pagado BOOLEAN DEFAULT FALSE,

    caja_id INTEGER REFERENCES caja_turno(id),
    usuario_id TEXT REFERENCES usuarios(id),

    creado TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    modificado TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE detalle_items (
    id SERIAL PRIMARY KEY,
    transaccion_id INTEGER NOT NULL
        REFERENCES transacciones(id) ON DELETE CASCADE,

    producto_id TEXT REFERENCES productos(id),
    plato_id TEXT REFERENCES platos(id),

    ingrediente_extra TEXT REFERENCES ingredientes(id),
    precio_ingrediente_extra NUMERIC(10,2) DEFAULT 0,

    cantidad NUMERIC(10,2) NOT NULL CHECK (cantidad > 0),
    precio_unitario NUMERIC(10,2) NOT NULL CHECK (precio_unitario >= 0),
    subtotal NUMERIC(10,2) NOT NULL CHECK (subtotal >= 0),

    CHECK (
        (producto_id IS NOT NULL AND plato_id IS NULL)
        OR
        (producto_id IS NULL AND plato_id IS NOT NULL)
    )
);
CREATE TABLE pagos (
    id SERIAL PRIMARY KEY,
    transaccion_id INTEGER NOT NULL
        REFERENCES transacciones(id) ON DELETE CASCADE,

    metodo_pago VARCHAR(20) NOT NULL
        CHECK (metodo_pago IN ('efectivo', 'qr')),

    monto NUMERIC(10,2) NOT NULL CHECK (monto > 0),

    creado TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
