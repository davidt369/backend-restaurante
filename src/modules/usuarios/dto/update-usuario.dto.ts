import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  IsIn,
  Matches,
} from 'class-validator';

export class UpdateUsuarioDto {
  @ApiPropertyOptional({
    description: 'Nombre completo del usuario',
    example: 'Juan Pérez Actualizado',
    minLength: 3,
    maxLength: 60,
  })
  @IsString()
  @IsOptional()
  @MinLength(3)
  @MaxLength(60)
  nombre?: string;

  @ApiPropertyOptional({
    description: 'Nombre de usuario único para login',
    example: 'juanperez2',
    minLength: 3,
    maxLength: 30,
  })
  @IsString()
  @IsOptional()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-z0-9_]+$/, {
    message:
      'nombre_usuario solo puede contener letras minúsculas, números y guiones bajos',
  })
  nombre_usuario?: string;

  @ApiPropertyOptional({
    description: 'Nueva contraseña del usuario',
    example: 'NewPassword123!',
    minLength: 6,
  })
  @IsString()
  @IsOptional()
  @MinLength(6)
  contrasena?: string;

  @ApiPropertyOptional({
    description: 'Rol del usuario en el sistema',
    example: 'admin',
    enum: ['admin', 'cajero'],
  })
  @IsString()
  @IsOptional()
  @IsIn(['admin', 'cajero'])
  rol?: string;
}
