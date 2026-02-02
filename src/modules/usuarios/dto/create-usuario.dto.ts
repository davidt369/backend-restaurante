import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsIn,
  Matches,
} from 'class-validator';

export class CreateUsuarioDto {
  @ApiProperty({
    description: 'Nombre completo del usuario',
    example: 'Juan Pérez',
    minLength: 3,
    maxLength: 60,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(60)
  nombre: string;

  @ApiProperty({
    description: 'Nombre de usuario único para login',
    example: 'juanperez',
    minLength: 3,
    maxLength: 30,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-z0-9_]+$/, {
    message:
      'nombre_usuario solo puede contener letras minúsculas, números y guiones bajos',
  })
  nombre_usuario: string;

  @ApiProperty({
    description: 'Contraseña del usuario',
    example: 'Password123!',
    minLength: 6,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  contrasena: string;

  @ApiProperty({
    description: 'Rol del usuario en el sistema',
    example: 'cajero',
    enum: ['admin', 'cajero'],
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['admin', 'cajero'])
  rol: string;
}
