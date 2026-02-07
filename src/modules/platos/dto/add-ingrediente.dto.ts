import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class AddIngredienteDto {
  @ApiProperty({
    description: 'ID del ingrediente',
    example: 'abc123xyz',
  })
  @IsString()
  @IsNotEmpty()
  ingrediente_id: string;

  @ApiProperty({
    description: 'Cantidad requerida del ingrediente',
    example: 2.5,
    minimum: 0,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  cantidad: number;
}
