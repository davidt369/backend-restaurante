import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

@WebSocketGateway({
  cors: {
    origin: '*', // En producción, especifica el dominio del frontend
    credentials: true,
  },
  namespace: '/cocina',
})
export class CocinaGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(CocinaGateway.name);
  private readonly TIMEZONE = 'America/La_Paz';
  private readonly DATE_FORMAT = 'HH:mm - dd/MM/yyyy';

  handleConnection(client: Socket) {
    this.logger.log(`Cliente conectado a /cocina: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Cliente desconectado de /cocina: ${client.id}`);
  }

  // Formatear fechas recursivamente en un objeto
  private formatDates(obj: any): any {
    if (!obj) return obj;

    if (Array.isArray(obj)) {
      return obj.map((item) => this.formatDates(item));
    }

    if (typeof obj === 'object' && obj !== null) {
      const formatted: any = {};

      for (const key of Object.keys(obj)) {
        const value = obj[key];

        // Formatear campos de fecha/hora
        if (
          (key === 'fecha' ||
            key === 'hora' ||
            key === 'creado_en' ||
            key === 'actualizado_en') &&
          value
        ) {
          try {
            const date =
              typeof value === 'string' ? new Date(value) : new Date(value);
            const zonedDate = toZonedTime(date, this.TIMEZONE);
            formatted[key] = format(zonedDate, this.DATE_FORMAT);
          } catch {
            formatted[key] = value;
          }
        }
        // Procesar recursivamente objetos y arrays anidados
        else if (typeof value === 'object' && value !== null) {
          formatted[key] = this.formatDates(value);
        } else {
          formatted[key] = value;
        }
      }

      return formatted;
    }

    return obj;
  }

  // Emitir actualización cuando hay nuevos pedidos pendientes
  emitPedidosActualizados(pedidos: any[]) {
    this.logger.log(
      `Emitiendo actualización de pedidos: ${pedidos.length} pedidos`,
    );
    const pedidosFormateados = this.formatDates(pedidos);
    this.server.emit('pedidos-actualizados', pedidosFormateados);
  }

  // Emitir cuando se completa un pedido
  emitPedidoCompletado(pedidoId: number) {
    this.logger.log(`Emitiendo pedido completado: ${pedidoId}`);
    this.server.emit('pedido-completado', pedidoId);
  }

  // Emitir cuando se crea un nuevo pedido
  emitNuevoPedido(pedido: any) {
    this.logger.log(`Emitiendo nuevo pedido: ${pedido.id}`);
    const pedidoFormateado = this.formatDates(pedido);
    this.server.emit('nuevo-pedido', pedidoFormateado);
  }
}
