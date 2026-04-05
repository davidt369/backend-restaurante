import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DrizzleModule } from './drizzle/drizzle.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsuariosModule } from './modules/usuarios/usuarios.module';
import { CajaModule } from './modules/caja/caja.module';
import { ProductosModule } from './modules/productos/productos.module';
import { IngredientesModule } from './modules/ingredientes/ingredientes.module';
import { PlatosModule } from './modules/platos/platos.module';
import { TransaccionesModule } from './modules/transacciones/transacciones.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DrizzleModule,
    AuthModule,
    UsuariosModule,
    CajaModule,
    ProductosModule,
    IngredientesModule,
    PlatosModule,
    TransaccionesModule,
    DashboardModule,
  ],
})
export class AppModule { }
