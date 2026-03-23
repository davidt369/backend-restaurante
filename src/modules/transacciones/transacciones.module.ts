import { Module } from '@nestjs/common';
import { TransaccionesService } from './transacciones.service';
import { TransaccionesController } from './transacciones.controller';
import { CocinaGateway } from './cocina.gateway';
import { DrizzleModule } from '../../drizzle/drizzle.module';
import { CajaModule } from '../caja/caja.module';

// Servicios especializados
import { TransaccionesCoreService } from './services/transacciones-core.service';
import { ItemsService } from './services/items.service';
import { ExtrasService } from './services/extras.service';
import { PagosService } from './services/pagos.service';
import { CalculosFinancierosService } from './services/calculos-financieros.service';
import { EstadosTransaccionService } from './services/estados-transaccion.service';
import { CocinaIntegrationService } from './services/cocina-integration.service';
import { StockService } from './services/stock.service';
import { CajaReportesService } from './services/caja-reportes.service';

@Module({
  imports: [DrizzleModule, CajaModule],
  controllers: [TransaccionesController],
  providers: [
    TransaccionesService,
    CocinaGateway,
    // Servicios especializados
    TransaccionesCoreService,
    ItemsService,
    ExtrasService,
    PagosService,
    CalculosFinancierosService,
    EstadosTransaccionService,
    CocinaIntegrationService,
    StockService,
    CajaReportesService,
  ],
  exports: [TransaccionesService],
})
export class TransaccionesModule {}
