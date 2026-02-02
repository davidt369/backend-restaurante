import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'default-secret',
    });
  }

  validate(payload: JwtPayload) {
    if (!payload.sub || !payload.nombre_usuario || !payload.rol) {
      throw new UnauthorizedException('Token JWT inválido');
    }

    // Retorna el payload completo para ser usado en los guards y decoradores
    return {
      id: payload.sub,
      nombre_usuario: payload.nombre_usuario,
      rol: payload.rol,
    };
  }
}
