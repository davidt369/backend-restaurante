import { createParamDecorator, ExecutionContext } from '@nestjs/common';

interface UserPayload {
  id: string;
  nombre_usuario: string;
  rol: string;
}

interface RequestWithUser {
  user: UserPayload;
}

/**
 * Decorador para obtener el usuario actual del request
 *
 * @example
 * ```typescript
 * @Get('perfil')
 * @UseGuards(AuthGuard('jwt'))
 * async obtenerPerfil(@CurrentUser() usuario) {
 *   return usuario; // { id, nombre_usuario, rol }
 * }
 *
 * // Obtener solo una propiedad específica
 * @Get('mi-id')
 * @UseGuards(AuthGuard('jwt'))
 * async obtenerMiId(@CurrentUser('id') userId: string) {
 *   return { id: userId };
 * }
 * ```
 */
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    // Si se especifica una propiedad, retornar solo esa propiedad
    return data ? user?.[data as keyof UserPayload] : user;
  },
);
