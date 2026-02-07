import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum } from 'class-validator';

export class UpdateTransaccionDto {
  @ApiPropertyOptional({
    description: 'Concepto o descripción del pedido',
    example: 'Pedido mesa 5 - Actualizado',
  })
  @IsString()
  @IsOptional()
  concepto?: string;

  @ApiPropertyOptional({
    description: 'Ubicación del servicio',
    example: 'Mesa 10',
  })
  @IsString()
  @IsOptional()
  mesa?: string;

  @ApiPropertyOptional({
    description: 'Nombre del cliente',
    example: 'María López',
  })
  @IsString()
  @IsOptional()
  cliente?: string;

  @ApiPropertyOptional({
    description: 'Estado del pedido',
    example: 'abierto',
    enum: ['pendiente', 'abierto', 'cerrado'],
  })
  @IsEnum(['pendiente', 'abierto', 'cerrado'])
  @IsOptional()
  estado?: 'pendiente' | 'abierto' | 'cerrado';
}
