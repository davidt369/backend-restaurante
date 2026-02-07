import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  MaxLength,
} from 'class-validator';

export class CreatePlatoDto {
  @ApiProperty({
    description: 'Nombre del plato',
    example: 'Sopa de Maní',
    maxLength: 60,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  nombre: string;

  @ApiProperty({
    description: 'Precio del plato en bolivianos',
    example: 25.0,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  precio: number;
}
