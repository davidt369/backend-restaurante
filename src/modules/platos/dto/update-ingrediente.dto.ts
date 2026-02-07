import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdatePlatoIngredienteDto {
  @ApiProperty({
    description: 'Cantidad requerida del ingrediente',
    example: 2.5,
    minimum: 0.01,
  })
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  @Min(0.01)
  cantidad: number;
}
