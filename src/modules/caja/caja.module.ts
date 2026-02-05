import { Module } from '@nestjs/common';

import { CajaController } from './caja.controller';
import { DrizzleModule } from '../../drizzle/drizzle.module';
import { CajaService } from './caja.service';

@Module({
  imports: [DrizzleModule],
  controllers: [CajaController],
  providers: [CajaService],
  exports: [CajaService],
})
export class CajaModule {}
