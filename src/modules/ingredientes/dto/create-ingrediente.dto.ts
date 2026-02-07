import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  MaxLength,
} from 'class-validator';

export class CreateIngredienteDto {
  @ApiProperty({
    description: 'Nombre del ingrediente',
    example: 'Tomate',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombre: string;

  @ApiProperty({
    description: 'Unidad de medida',
    example: 'kg',
    maxLength: 20,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  unidad: string;

  @ApiProperty({
    description: 'Cantidad disponible',
    example: 50.5,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  cantidad: number;

  @ApiProperty({
    description: 'Cantidad mínima requerida (alerta de stock)',
    example: 10,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  cantidad_minima: number;
}
