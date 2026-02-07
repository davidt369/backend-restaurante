import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
  IsEnum,
  ValidateIf,
} from 'class-validator';

export class CreatePagoDto {
  @ApiProperty({
    description: 'Método de pago',
    example: 'efectivo',
    enum: ['efectivo', 'qr'],
  })
  @IsEnum(['efectivo', 'qr'])
  @IsNotEmpty()
  metodo_pago: 'efectivo' | 'qr';

  @ApiProperty({
    description: 'Monto del pago',
    example: 50.0,
    minimum: 0.01,
  })
  @IsNumber()
  @Min(0.01)
  monto: number;

  @ApiPropertyOptional({
    description: 'Monto recibido (solo para efectivo)',
    example: 100.0,
    minimum: 0,
  })
  @IsNumber()
  @IsOptional()
  @ValidateIf((o) => o.metodo_pago === 'efectivo')
  @Min(0)
  monto_recibido?: number;

  @ApiPropertyOptional({
    description: 'Referencia de transacción QR',
    example: 'QR-123456789',
  })
  @IsString()
  @IsOptional()
  @ValidateIf((o) => o.metodo_pago === 'qr')
  referencia_qr?: string;
}
