import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
  ValidateIf,
} from 'class-validator';

export class AddItemDto {
  @ApiPropertyOptional({
    description: 'ID del producto (excluyente con plato_id)',
    example: 'abc123xyz',
  })
  @IsString()
  @IsOptional()
  @ValidateIf((o) => !o.plato_id)
  @IsNotEmpty({ message: 'Debe proporcionar producto_id o plato_id' })
  producto_id?: string;

  @ApiPropertyOptional({
    description: 'ID del plato (excluyente con producto_id)',
    example: 'xyz789abc',
  })
  @IsString()
  @IsOptional()
  @ValidateIf((o) => !o.producto_id)
  @IsNotEmpty({ message: 'Debe proporcionar producto_id o plato_id' })
  plato_id?: string;

  @ApiProperty({
    description: 'Cantidad del item',
    example: 2,
    minimum: 0.01,
  })
  @IsNumber()
  @Min(0.01)
  cantidad: number;

  @ApiPropertyOptional({
    description: 'Notas especiales del cliente',
    example: 'Sin cebolla, punto medio',
  })
  @IsString()
  @IsOptional()
  notas?: string;
}
