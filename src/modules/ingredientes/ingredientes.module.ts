import { Module } from '@nestjs/common';
import { IngredientesService } from './ingredientes.service';
import { IngredientesController } from './ingredientes.controller';
import { DrizzleModule } from '../../drizzle/drizzle.module';

@Module({
  imports: [DrizzleModule],
  controllers: [IngredientesController],
  providers: [IngredientesService],
  exports: [IngredientesService],
})
export class IngredientesModule {}
