import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DrizzleModule } from './drizzle/drizzle.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsuariosModule } from './modules/usuarios/usuarios.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // 👈 importante
    }),
    DrizzleModule,
    AuthModule,
    UsuariosModule,
  ],
  // providers: [drizzleProvider],
  // exports: [drizzleProvider],
})
export class AppModule {}
