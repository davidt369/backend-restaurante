import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DrizzleModule } from './drizzle/drizzle.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // 👈 importante
    }),
    DrizzleModule,
  ],
  // providers: [drizzleProvider],
  // exports: [drizzleProvider],
})
export class AppModule {}
