import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
  ValidateIf,
  IsNotEmpty,
} from 'class-validator';

export class AddExtraDto {
  @ApiPropertyOptional({
    description: 'ID del ingrediente (excluyente con descripcion)',
    example: 'ing123',
  })
  @IsString()
  @IsOptional()
  @ValidateIf((o) => !o.descripcion)
  @IsNotEmpty({ message: 'Debe proporcionar ingrediente_id o descripcion' })
  ingrediente_id?: string;

  @ApiPropertyOptional({
    description: 'Descripción del extra (excluyente con ingrediente_id)',
    example: 'Extra queso',
  })
  @IsString()
  @IsOptional()
  @ValidateIf((o) => !o.ingrediente_id)
  @IsNotEmpty({ message: 'Debe proporcionar ingrediente_id o descripcion' })
  descripcion?: string;

  @ApiProperty({
    description: 'Precio del extra',
    example: 5.0,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  precio: number;

  @ApiPropertyOptional({
    description: 'Cantidad del extra',
    example: 1,
    minimum: 0.01,
    default: 1,
  })
  @IsNumber()
  @Min(0.01)
  @IsOptional()
  cantidad?: number;
}
