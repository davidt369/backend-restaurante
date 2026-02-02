import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, isNull } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import * as schema from '../../db/schema';
import { DRIZZLE_DB } from '../../drizzle/drizzle.module';

export interface JwtPayload {
  sub: string;
  nombre_usuario: string;
  rol: string;
}

export interface Usuario {
  id: string;
  nombre: string;
  nombre_usuario: string;
  rol: string;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Valida las credenciales del usuario
   * @param nombre_usuario - Nombre de usuario
   * @param contrasena - Contraseña sin encriptar
   * @returns Usuario si las credenciales son válidas, null en caso contrario
   */
  async validateUser(
    nombre_usuario: string,
    contrasena: string,
  ): Promise<Usuario | null> {
    // Buscar usuario por nombre_usuario y que no esté eliminado
    const usuarios = await this.db
      .select({
        id: schema.usuarios.id,
        nombre: schema.usuarios.nombre,
        nombre_usuario: schema.usuarios.nombre_usuario,
        contrasena: schema.usuarios.contrasena,
        rol: schema.usuarios.rol,
      })
      .from(schema.usuarios)
      .where(
        and(
          eq(schema.usuarios.nombre_usuario, nombre_usuario),
          isNull(schema.usuarios.borrado_en),
        ),
      )
      .limit(1);

    if (usuarios.length === 0) {
      return null;
    }

    const usuario = usuarios[0];

    // Verificar la contraseña
    const isPasswordValid = await bcrypt.compare(
      contrasena,
      usuario.contrasena,
    );

    if (!isPasswordValid) {
      return null;
    }

    // Retornar usuario sin la contraseña
    return {
      id: usuario.id,
      nombre: usuario.nombre,
      nombre_usuario: usuario.nombre_usuario,
      rol: usuario.rol,
    };
  }

  /**
   * Genera un token JWT para el usuario autenticado
   * @param usuario - Información del usuario
   * @returns Objeto con access_token y datos del usuario
   */
  login(usuario: Usuario) {
    const payload: JwtPayload = {
      sub: usuario.id,
      nombre_usuario: usuario.nombre_usuario,
      rol: usuario.rol,
    };

    return {
      access_token: this.jwtService.sign(payload),
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        nombre_usuario: usuario.nombre_usuario,
        rol: usuario.rol,
      },
    };
  }

  /**
   * Obtiene el perfil completo del usuario por su ID
   * @param userId - ID del usuario
   * @returns Información del usuario
   */
  async getProfile(userId: string): Promise<Usuario> {
    const usuarios = await this.db
      .select({
        id: schema.usuarios.id,
        nombre: schema.usuarios.nombre,
        nombre_usuario: schema.usuarios.nombre_usuario,
        rol: schema.usuarios.rol,
      })
      .from(schema.usuarios)
      .where(
        and(eq(schema.usuarios.id, userId), isNull(schema.usuarios.borrado_en)),
      )
      .limit(1);

    if (usuarios.length === 0) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    return usuarios[0];
  }
}
