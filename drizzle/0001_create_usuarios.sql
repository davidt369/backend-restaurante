-- Primera migración: crear tabla usuarios
CREATE TABLE IF NOT EXISTS usuarios (
  id TEXT PRIMARY KEY,
  nombre VARCHAR(60) NOT NULL,
  nombre_usuario VARCHAR(30) NOT NULL UNIQUE,
  contrasena VARCHAR(255) NOT NULL,
  rol VARCHAR(20) NOT NULL DEFAULT 'cajero',
  creado_en TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  actualizado_en TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  borrado_en TIMESTAMPTZ
);

-- Opcional: asegurar valores permitidos en rol
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'usuarios_rol_check'
  ) THEN
    ALTER TABLE usuarios
      ADD CONSTRAINT usuarios_rol_check CHECK (rol IN ('cajero','admin'));
  END IF;
END$$;
