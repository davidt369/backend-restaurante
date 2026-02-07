import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
  IsEnum,
} from 'class-validator';

export class CreateTransaccionDto {
  @ApiProperty({
    description: 'Número de registro secuencial',
    example: 1,
  })
  @IsNumber()
  @Min(1)
  nro_reg: number;

  @ApiPropertyOptional({
    description: 'Tipo de transacción',
    example: 'venta',
    default: 'venta',
  })
  @IsString()
  @IsOptional()
  tipo?: string;

  @ApiProperty({
    description: 'Concepto o descripción del pedido',
    example: 'Pedido mesa 5',
  })
  @IsString()
  @IsNotEmpty()
  concepto: string;

  @ApiPropertyOptional({
    description: 'Ubicación del servicio (Mesa 5, Para llevar, Delivery, etc.)',
    example: 'Mesa 5',
  })
  @IsString()
  @IsOptional()
  mesa?: string;

  @ApiPropertyOptional({
    description: 'Nombre del cliente',
    example: 'Juan Pérez',
  })
  @IsString()
  @IsOptional()
  cliente?: string;

  @ApiPropertyOptional({
    description: 'Estado del pedido',
    example: 'pendiente',
    enum: ['pendiente', 'abierto', 'cerrado'],
    default: 'pendiente',
  })
  @IsEnum(['pendiente', 'abierto', 'cerrado'])
  @IsOptional()
  estado?: 'pendiente' | 'abierto' | 'cerrado';

  @ApiPropertyOptional({
    description: 'ID de la caja/turno actual',
    example: 1,
  })
  @IsNumber()
  @IsOptional()
  caja_id?: number;
}
