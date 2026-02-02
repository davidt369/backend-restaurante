import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DrizzleModule } from './drizzle/drizzle.module';
import { AuthModule } from './modules/auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // 👈 importante
    }),
    DrizzleModule,
    AuthModule,
  ],
  // providers: [drizzleProvider],
  // exports: [drizzleProvider],
})
export class AppModule {}
