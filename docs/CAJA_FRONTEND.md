# 🎨 Frontend - Guía de Integración del Módulo Caja

## 📦 Servicio API (axios)

```typescript
// src/modules/caja/services/caja.service.ts
import { api } from '@/lib/axios';

export interface AbrirCajaDto {
  b200?: number;
  b100?: number;
  b50?: number;
  b20?: number;
  b10?: number;
  b5?: number;
  m2?: number;
  m1?: number;
  m050?: number;
  m020?: number;
}

export interface CerrarCajaDto {
  b200: number;
  b100: number;
  b50: number;
  b20: number;
  b10: number;
  b5: number;
  m2: number;
  m1: number;
  m050: number;
  m020: number;
  cierre_obs?: string;
}

export interface RegistrarGastoDto {
  descripcion: string;
  metodo_pago: 'efectivo' | 'qr';
  monto: number;
}

export const cajaService = {
  // 🟢 Abrir caja
  abrirCaja: async (data: AbrirCajaDto) => {
    const response = await api.post('/caja/abrir', data);
    return response.data;
  },

  // 📊 Obtener caja actual
  obtenerCajaActual: async () => {
    const response = await api.get('/caja/actual');
    return response.data;
  },

  // 💰 Registrar gasto
  registrarGasto: async (data: RegistrarGastoDto) => {
    const response = await api.post('/caja/gastos', data);
    return response.data;
  },

  // 📋 Obtener resumen para cierre
  obtenerResumen: async () => {
    const response = await api.get('/caja/resumen');
    return response.data;
  },

  // 🔴 Cerrar caja
  cerrarCaja: async (data: CerrarCajaDto) => {
    const response = await api.post('/caja/cerrar', data);
    return response.data;
  },

  // 📜 Obtener historial
  obtenerHistorial: async (limit = 10) => {
    const response = await api.get('/caja/historial', {
      params: { limit },
    });
    return response.data;
  },
};
```

---

## 🧩 Componente: Abrir Caja

```tsx
// src/modules/caja/components/AbrirCajaForm.tsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { cajaService } from '../services/caja.service';
import { toast } from 'sonner';

export function AbrirCajaForm() {
  const { register, watch, handleSubmit } = useForm({
    defaultValues: {
      b200: 0, b100: 0, b50: 0, b20: 0, b10: 0,
      b5: 0, m2: 0, m1: 0, m050: 0, m020: 0,
    },
  });

  // Calcular total en tiempo real
  const values = watch();
  const total =
    values.b200 * 200 +
    values.b100 * 100 +
    values.b50 * 50 +
    values.b20 * 20 +
    values.b10 * 10 +
    values.b5 * 5 +
    values.m2 * 2 +
    values.m1 * 1 +
    values.m050 * 0.5 +
    values.m020 * 0.2;

  const onSubmit = async (data: any) => {
    try {
      await cajaService.abrirCaja(data);
      toast.success('Caja abierta exitosamente');
    } catch (error) {
      toast.error('Error al abrir caja');
    }
  };

  return (
    <Card className="p-6">
      <h2 className="text-2xl font-bold mb-4">🟢 Abrir Caja</h2>
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Billetes */}
        <div className="border p-4 rounded">
          <h3 className="font-semibold mb-2">💵 Billetes</h3>
          <div className="grid grid-cols-2 gap-4">
            <DenominacionInput label="200 Bs" {...register('b200', { valueAsNumber: true })} />
            <DenominacionInput label="100 Bs" {...register('b100', { valueAsNumber: true })} />
            <DenominacionInput label="50 Bs" {...register('b50', { valueAsNumber: true })} />
            <DenominacionInput label="20 Bs" {...register('b20', { valueAsNumber: true })} />
            <DenominacionInput label="10 Bs" {...register('b10', { valueAsNumber: true })} />
            <DenominacionInput label="5 Bs" {...register('b5', { valueAsNumber: true })} />
          </div>
        </div>

        {/* Monedas */}
        <div className="border p-4 rounded">
          <h3 className="font-semibold mb-2">🪙 Monedas</h3>
          <div className="grid grid-cols-2 gap-4">
            <DenominacionInput label="2 Bs" {...register('m2', { valueAsNumber: true })} />
            <DenominacionInput label="1 Bs" {...register('m1', { valueAsNumber: true })} />
            <DenominacionInput label="0.50 Bs" {...register('m050', { valueAsNumber: true })} />
            <DenominacionInput label="0.20 Bs" {...register('m020', { valueAsNumber: true })} />
          </div>
        </div>

        {/* Total */}
        <div className="bg-green-100 p-4 rounded text-center">
          <p className="text-sm text-gray-600">Total Efectivo Inicial</p>
          <p className="text-3xl font-bold text-green-700">{total.toFixed(2)} Bs</p>
        </div>

        <Button type="submit" className="w-full">
          Abrir Caja
        </Button>
      </form>
    </Card>
  );
}

function DenominacionInput({ label, ...props }: any) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <Input type="number" min="0" {...props} />
    </div>
  );
}
```

---

## 🧩 Componente: Cerrar Caja

```tsx
// src/modules/caja/components/CerrarCajaForm.tsx
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { cajaService } from '../services/caja.service';
import { toast } from 'sonner';

export function CerrarCajaForm() {
  const [resumen, setResumen] = useState<any>(null);
  const { register, watch, handleSubmit } = useForm();

  useEffect(() => {
    cargarResumen();
  }, []);

  const cargarResumen = async () => {
    try {
      const data = await cajaService.obtenerResumen();
      setResumen(data);
    } catch (error) {
      toast.error('Error al cargar resumen');
    }
  };

  const values = watch();
  const montoContado =
    (values.b200 || 0) * 200 +
    (values.b100 || 0) * 100 +
    (values.b50 || 0) * 50 +
    (values.b20 || 0) * 20 +
    (values.b10 || 0) * 10 +
    (values.b5 || 0) * 5 +
    (values.m2 || 0) * 2 +
    (values.m1 || 0) * 1 +
    (values.m050 || 0) * 0.5 +
    (values.m020 || 0) * 0.2;

  const diferencia = montoContado - (resumen?.resumen.efectivo_esperado || 0);

  const onSubmit = async (data: any) => {
    try {
      await cajaService.cerrarCaja(data);
      toast.success('Caja cerrada exitosamente');
    } catch (error) {
      toast.error('Error al cerrar caja');
    }
  };

  if (!resumen) return <div>Cargando...</div>;

  return (
    <div className="space-y-6">
      {/* Resumen del día */}
      <Card className="p-6 bg-blue-50">
        <h3 className="font-bold mb-4">📊 Resumen del Día</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Monto Inicial</p>
            <p className="font-bold">{resumen.resumen.monto_inicial} Bs</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Ventas Efectivo</p>
            <p className="font-bold text-green-600">
              +{resumen.resumen.ventas_efectivo} Bs
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Ventas QR</p>
            <p className="font-bold text-blue-600">
              {resumen.resumen.ventas_qr} Bs
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Gastos Efectivo</p>
            <p className="font-bold text-red-600">
              -{resumen.resumen.gastos_efectivo} Bs
            </p>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t">
          <p className="text-sm text-gray-600">Efectivo Esperado</p>
          <p className="text-2xl font-bold text-purple-600">
            {resumen.resumen.efectivo_esperado.toFixed(2)} Bs
          </p>
        </div>
      </Card>

      {/* Formulario de conteo */}
      <Card className="p-6">
        <h3 className="font-bold mb-4">🔢 Contar Efectivo</h3>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Similar al formulario de apertura */}
          {/* ... inputs de denominaciones ... */}

          {/* Comparación */}
          <div className={`p-4 rounded ${
            diferencia === 0 ? 'bg-green-100' :
            diferencia > 0 ? 'bg-yellow-100' : 'bg-red-100'
          }`}>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-sm">Esperado</p>
                <p className="text-xl font-bold">
                  {resumen.resumen.efectivo_esperado.toFixed(2)} Bs
                </p>
              </div>
              <div>
                <p className="text-sm">Contado</p>
                <p className="text-xl font-bold">{montoContado.toFixed(2)} Bs</p>
              </div>
            </div>
            <div className="mt-4 text-center">
              <p className="text-sm">Diferencia</p>
              <p className={`text-2xl font-bold ${
                diferencia === 0 ? 'text-green-700' :
                diferencia > 0 ? 'text-yellow-700' : 'text-red-700'
              }`}>
                {diferencia > 0 ? '+' : ''}{diferencia.toFixed(2)} Bs
              </p>
              <p className="text-sm mt-1">
                {diferencia === 0 ? '✅ Exacto' :
                 diferencia > 0 ? '⚠️ Sobrante' : '❌ Faltante'}
              </p>
            </div>
          </div>

          <Button type="submit" className="w-full">
            Cerrar Caja
          </Button>
        </form>
      </Card>
    </div>
  );
}
```

---

## 🧩 Página Principal

```tsx
// src/modules/caja/pages/CajaPage.tsx
import { useState, useEffect } from 'react';
import { cajaService } from '../services/caja.service';
import { AbrirCajaForm } from '../components/AbrirCajaForm';
import { CerrarCajaForm } from '../components/CerrarCajaForm';
import { Button } from '@/components/ui/button';

export function CajaPage() {
  const [cajaActual, setCajaActual] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarCajaActual();
  }, []);

  const cargarCajaActual = async () => {
    try {
      const data = await cajaService.obtenerCajaActual();
      setCajaActual(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Cargando...</div>;

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">💰 Gestión de Caja</h1>

      {!cajaActual ? (
        <AbrirCajaForm />
      ) : (
        <div className="space-y-6">
          {/* Estado de la caja */}
          <Card className="p-6 bg-green-50">
            <h2 className="text-xl font-bold mb-2">
              ✅ Caja Abierta - {cajaActual.fecha}
            </h2>
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div>
                <p className="text-sm text-gray-600">Efectivo</p>
                <p className="text-lg font-bold">
                  {cajaActual.ventas_efectivo} Bs
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">QR</p>
                <p className="text-lg font-bold">{cajaActual.ventas_qr} Bs</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Gastos</p>
                <p className="text-lg font-bold text-red-600">
                  -{cajaActual.total_salidas} Bs
                </p>
              </div>
            </div>
          </Card>

          {/* Botón para ir al cierre */}
          <Button onClick={() => navigate('/caja/cerrar')}>
            Cerrar Caja del Día
          </Button>
        </div>
      )}
    </div>
  );
}
```

---

## 🎯 Rutas

```tsx
// src/App.tsx (o router)
import { CajaPage } from './modules/caja/pages/CajaPage';
import { CerrarCajaPage } from './modules/caja/pages/CerrarCajaPage';

<Route path="/caja" element={<CajaPage />} />
<Route path="/caja/cerrar" element={<CerrarCajaPage />} />
```

---

## ✅ Checklist de Implementación

- [ ] Crear servicio de API
- [ ] Formulario de apertura con cálculo en tiempo real
- [ ] Vista de caja actual con resumen
- [ ] Formulario de cierre con comparación
- [ ] Página de historial
- [ ] Notificaciones (toast) en cada acción
- [ ] Validación de permisos por rol
- [ ] Manejo de errores

---

**🎨 Tips de UX:**
- Usa colores: verde (apertura), azul (info), rojo (cierre/diferencias)
- Muestra cálculos en tiempo real
- Destaca las diferencias en el cierre
- Bloquea el formulario mientras se procesa
