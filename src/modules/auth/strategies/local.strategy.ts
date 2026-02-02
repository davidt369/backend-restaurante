import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({
      usernameField: 'nombre_usuario', // Campo personalizado en lugar de 'username'
      passwordField: 'contrasena', // Campo personalizado en lugar de 'password'
    });
  }

  async validate(nombre_usuario: string, contrasena: string): Promise<any> {
    const usuario = await this.authService.validateUser(
      nombre_usuario,
      contrasena,
    );

    if (!usuario) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    return usuario;
  }
}
