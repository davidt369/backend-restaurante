import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsIn,
  MaxLength,
} from 'class-validator';

export class RegistrarGastoDto {
  @ApiProperty({
    description: 'Descripción del gasto (ej: "Compra de gas", "Limpieza")',
    example: 'Compra de gas para cocina',
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  descripcion: string;

  @ApiProperty({
    description: 'Método de pago del gasto',
    enum: ['efectivo', 'qr'],
    example: 'efectivo',
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['efectivo', 'qr'])
  metodo_pago: 'efectivo' | 'qr';

  @ApiProperty({
    description: 'Monto del gasto en bolivianos',
    example: 50.0,
    minimum: 0.01,
  })
  @IsNumber()
  @IsPositive()
  monto: number;
}
