import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  MaxLength,
  IsInt,
} from 'class-validator';

export class CreateProductoDto {
  @ApiProperty({
    description: 'Nombre del producto',
    example: 'Arroz Premium',
    maxLength: 60,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  nombre: string;

  @ApiProperty({
    description: 'Precio del producto en bolivianos',
    example: 45.5,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  precio: number;

  @ApiProperty({
    description: 'Cantidad en stock',
    example: 100,
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  stock: number;

  @ApiProperty({
    description: 'Unidad de medida',
    example: 'kg',
    maxLength: 20,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  unidad: string;
}
