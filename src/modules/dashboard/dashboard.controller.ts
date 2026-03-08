import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
    ApiTags,
    ApiBearerAuth,
    ApiOperation,
    ApiResponse,
} from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard('jwt'))
@Controller('dashboard')
export class DashboardController {
    constructor(private readonly dashboardService: DashboardService) { }

    @Get('stats')
    @ApiOperation({
        summary: 'Obtener estadísticas del dashboard',
        description:
            'Retorna un resumen en tiempo real: conteo de usuarios, productos, platos, ' +
            'transacciones del día, órdenes abiertas, ingresos del día y las últimas 5 actividades.',
    })
    @ApiResponse({
        status: 200,
        description: 'Estadísticas del dashboard',
        schema: {
            type: 'object',
            properties: {
                totalUsuarios: { type: 'number', example: 4 },
                totalProductos: { type: 'number', example: 12 },
                totalPlatos: { type: 'number', example: 8 },
                transaccionesHoy: { type: 'number', example: 15 },
                ordenesAbiertas: { type: 'number', example: 3 },
                ingresosHoy: { type: 'string', example: '850.00' },
                actividadReciente: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'number', example: 42 },
                            concepto: { type: 'string', example: 'Mesa 3 - Almuerzo' },
                            mesa: { type: 'string', example: 'Mesa 3', nullable: true },
                            estado: { type: 'string', example: 'abierto' },
                            monto_total: { type: 'string', example: '120.00' },
                            hora: { type: 'string', format: 'date-time' },
                        },
                    },
                },
            },
        },
    })
    @ApiResponse({ status: 401, description: 'No autorizado' })
    getStats() {
        return this.dashboardService.getStats();
    }
}
