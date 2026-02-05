import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min, IsOptional } from 'class-validator';

export class AbrirCajaDto {
  @ApiProperty({
    description: 'Cantidad de billetes de 200 Bs',
    example: 2,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  b200?: number;

  @ApiProperty({
    description: 'Cantidad de billetes de 100 Bs',
    example: 5,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  b100?: number;

  @ApiProperty({
    description: 'Cantidad de billetes de 50 Bs',
    example: 10,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  b50?: number;

  @ApiProperty({
    description: 'Cantidad de billetes de 20 Bs',
    example: 15,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  b20?: number;

  @ApiProperty({
    description: 'Cantidad de billetes de 10 Bs',
    example: 20,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  b10?: number;

  @ApiProperty({
    description: 'Cantidad de billetes de 5 Bs',
    example: 30,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  b5?: number;

  @ApiProperty({
    description: 'Cantidad de monedas de 2 Bs',
    example: 10,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  m2?: number;

  @ApiProperty({
    description: 'Cantidad de monedas de 1 Bs',
    example: 20,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  m1?: number;

  @ApiProperty({
    description: 'Cantidad de monedas de 0.50 Bs',
    example: 40,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  m050?: number;

  @ApiProperty({
    description: 'Cantidad de monedas de 0.20 Bs',
    example: 50,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  m020?: number;

  @ApiProperty({
    description: 'Cantidad de monedas de 0.10 Bs',
    example: 60,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  m010?: number;
}
