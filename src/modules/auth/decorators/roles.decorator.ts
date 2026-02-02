import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Decorador para especificar los roles permitidos en un endpoint
 *
 * @example
 * ```typescript
 * @Get('admin-only')
 * @UseGuards(AuthGuard('jwt'), RolesGuard)
 * @Roles('admin')
 * async soloAdmin() {
 *   return { mensaje: 'Solo admins pueden ver esto' };
 * }
 *
 * @Post('multiple-roles')
 * @UseGuards(AuthGuard('jwt'), RolesGuard)
 * @Roles('admin', 'cajero')
 * async multipleRoles() {
 *   return { mensaje: 'Admins y cajeros pueden acceder' };
 * }
 * ```
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
