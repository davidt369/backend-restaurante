import { Module } from '@nestjs/common';
import { TransaccionesService } from './transacciones.service';
import { TransaccionesController } from './transacciones.controller';
import { DrizzleModule } from '../../drizzle/drizzle.module';
import { CajaModule } from '../caja/caja.module';

@Module({
  imports: [DrizzleModule, CajaModule],
  controllers: [TransaccionesController],
  providers: [TransaccionesService],
  exports: [TransaccionesService],
})
export class TransaccionesModule {}
