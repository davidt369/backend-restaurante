import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

interface RequestWithUser {
  user?: {
    id: string;
    nombre_usuario: string;
    rol: string;
  };
}

/**
 * Guard para validar que el usuario tenga uno de los roles requeridos
 *
 * Debe usarse en conjunto con AuthGuard('jwt') y el decorador @Roles()
 *
 * @example
 * ```typescript
 * @Get('admin-only')
 * @UseGuards(AuthGuard('jwt'), RolesGuard)
 * @Roles('admin')
 * async soloAdmin() {
 *   return { mensaje: 'Solo admins' };
 * }
 * ```
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Obtener roles requeridos del decorador @Roles()
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Si no hay roles especificados, permitir acceso
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // Obtener usuario del request (inyectado por JwtStrategy)
    const { user } = context.switchToHttp().getRequest<RequestWithUser>();

    // Validar que el usuario tenga al menos uno de los roles requeridos
    return requiredRoles.some((role) => user?.rol === role);
  }
}
