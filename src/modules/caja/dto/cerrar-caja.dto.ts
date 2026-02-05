import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, Min, IsString, IsOptional } from 'class-validator';

export class CerrarCajaDto {
  @ApiProperty({
    description: 'Cantidad de billetes de 200 Bs al cierre',
    example: 3,
  })
  @IsInt()
  @IsNotEmpty()
  @Min(0)
  b200: number;

  @ApiProperty({
    description: 'Cantidad de billetes de 100 Bs al cierre',
    example: 8,
  })
  @IsInt()
  @IsNotEmpty()
  @Min(0)
  b100: number;

  @ApiProperty({
    description: 'Cantidad de billetes de 50 Bs al cierre',
    example: 12,
  })
  @IsInt()
  @IsNotEmpty()
  @Min(0)
  b50: number;

  @ApiProperty({
    description: 'Cantidad de billetes de 20 Bs al cierre',
    example: 20,
  })
  @IsInt()
  @IsNotEmpty()
  @Min(0)
  b20: number;

  @ApiProperty({
    description: 'Cantidad de billetes de 10 Bs al cierre',
    example: 25,
  })
  @IsInt()
  @IsNotEmpty()
  @Min(0)
  b10: number;

  @ApiProperty({
    description: 'Cantidad de billetes de 5 Bs al cierre',
    example: 40,
  })
  @IsInt()
  @IsNotEmpty()
  @Min(0)
  b5: number;

  @ApiProperty({
    description: 'Cantidad de monedas de 2 Bs al cierre',
    example: 15,
  })
  @IsInt()
  @IsNotEmpty()
  @Min(0)
  m2: number;

  @ApiProperty({
    description: 'Cantidad de monedas de 1 Bs al cierre',
    example: 30,
  })
  @IsInt()
  @IsNotEmpty()
  @Min(0)
  m1: number;

  @ApiProperty({
    description: 'Cantidad de monedas de 0.50 Bs al cierre',
    example: 50,
  })
  @IsInt()
  @IsNotEmpty()
  @Min(0)
  m050: number;

  @ApiProperty({
    description: 'Cantidad de monedas de 0.20 Bs al cierre',
    example: 60,
  })
  @IsInt()
  @IsNotEmpty()
  @Min(0)
  m020: number;

  @ApiProperty({
    description: 'Cantidad de monedas de 0.10 Bs al cierre',
    example: 70,
  })
  @IsInt()
  @IsNotEmpty()
  @Min(0)
  m010: number;

  @ApiProperty({
    description: 'Observaciones del cierre de caja',
    example: 'Cierre normal sin novedades',
    required: false,
  })
  @IsOptional()
  @IsString()
  cierre_obs?: string;
}
