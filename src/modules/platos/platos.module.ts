import { Module } from '@nestjs/common';
import { PlatosService } from './platos.service';
import { PlatosController } from './platos.controller';
import { DrizzleModule } from '../../drizzle/drizzle.module';

@Module({
  imports: [DrizzleModule],
  controllers: [PlatosController],
  providers: [PlatosService],
  exports: [PlatosService],
})
export class PlatosModule {}
