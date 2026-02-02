import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, isNull, and } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';

import * as schema from '../../db/schema';
import { DRIZZLE_DB } from '../../drizzle/drizzle.module';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { nanoid } from 'nanoid/non-secure';

export interface Usuario {
  id: string;
  nombre: string;
  nombre_usuario: string;
  rol: string;
  creado_en: Date;
  actualizado_en: Date;
}

/**
 * Servicio de gestión de usuarios
 * Implementa operaciones CRUD siguiendo principios SOLID
 */
@Injectable()
export class UsuariosService {
  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  /**
   * Crea un nuevo usuario en el sistema
   * @param createUsuarioDto - Datos del usuario a crear
   * @returns Usuario creado sin contraseña
   */
  async create(createUsuarioDto: CreateUsuarioDto): Promise<Usuario> {
    // Validar que el nombre_usuario no exista
    await this.validateUniqueUsername(createUsuarioDto.nombre_usuario);

    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash(createUsuarioDto.contrasena, 10);

    // Generar ID único
    const userId = `usr_${nanoid(16)}`;

    // Insertar usuario
    const [usuario] = await this.db
      .insert(schema.usuarios)
      .values({
        id: userId,
        nombre: createUsuarioDto.nombre,
        nombre_usuario: createUsuarioDto.nombre_usuario,
        contrasena: hashedPassword,
        rol: createUsuarioDto.rol,
        creado_en: new Date(),
        actualizado_en: new Date(),
      })
      .returning({
        id: schema.usuarios.id,
        nombre: schema.usuarios.nombre,
        nombre_usuario: schema.usuarios.nombre_usuario,
        rol: schema.usuarios.rol,
        creado_en: schema.usuarios.creado_en,
        actualizado_en: schema.usuarios.actualizado_en,
      });

    return usuario;
  }

  /**
   * Obtiene todos los usuarios activos (no eliminados)
   * @returns Lista de usuarios sin contraseñas
   */
  async findAll(): Promise<Usuario[]> {
    const usuarios = await this.db
      .select({
        id: schema.usuarios.id,
        nombre: schema.usuarios.nombre,
        nombre_usuario: schema.usuarios.nombre_usuario,
        rol: schema.usuarios.rol,
        creado_en: schema.usuarios.creado_en,
        actualizado_en: schema.usuarios.actualizado_en,
      })
      .from(schema.usuarios)
      .where(isNull(schema.usuarios.borrado_en))
      .orderBy(schema.usuarios.creado_en);

    return usuarios;
  }

  /**
   * Obtiene un usuario por su ID
   * @param id - ID del usuario
   * @returns Usuario sin contraseña
   */
  async findOne(id: string): Promise<Usuario> {
    const [usuario] = await this.db
      .select({
        id: schema.usuarios.id,
        nombre: schema.usuarios.nombre,
        nombre_usuario: schema.usuarios.nombre_usuario,
        rol: schema.usuarios.rol,
        creado_en: schema.usuarios.creado_en,
        actualizado_en: schema.usuarios.actualizado_en,
      })
      .from(schema.usuarios)
      .where(
        and(eq(schema.usuarios.id, id), isNull(schema.usuarios.borrado_en)),
      )
      .limit(1);

    if (!usuario) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    return usuario;
  }

  /**
   * Actualiza un usuario existente
   * @param id - ID del usuario a actualizar
   * @param updateUsuarioDto - Datos a actualizar
   * @returns Usuario actualizado sin contraseña
   */
  async update(
    id: string,
    updateUsuarioDto: UpdateUsuarioDto,
  ): Promise<Usuario> {
    // Verificar que el usuario existe
    await this.findOne(id);

    // Si se está actualizando el nombre_usuario, validar que sea único
    if (updateUsuarioDto.nombre_usuario) {
      await this.validateUniqueUsername(updateUsuarioDto.nombre_usuario, id);
    }

    // Preparar datos a actualizar
    const updateData: Record<string, string | Date> = {
      actualizado_en: new Date(),
    };

    if (updateUsuarioDto.nombre) {
      updateData.nombre = updateUsuarioDto.nombre;
    }

    if (updateUsuarioDto.nombre_usuario) {
      updateData.nombre_usuario = updateUsuarioDto.nombre_usuario;
    }

    if (updateUsuarioDto.rol) {
      updateData.rol = updateUsuarioDto.rol;
    }

    // Si se proporciona contraseña, hashearla
    if (updateUsuarioDto.contrasena) {
      updateData.contrasena = await bcrypt.hash(
        updateUsuarioDto.contrasena,
        10,
      );
    }

    // Actualizar usuario
    const [usuarioActualizado] = await this.db
      .update(schema.usuarios)
      .set(updateData)
      .where(eq(schema.usuarios.id, id))
      .returning({
        id: schema.usuarios.id,
        nombre: schema.usuarios.nombre,
        nombre_usuario: schema.usuarios.nombre_usuario,
        rol: schema.usuarios.rol,
        creado_en: schema.usuarios.creado_en,
        actualizado_en: schema.usuarios.actualizado_en,
      });

    return usuarioActualizado;
  }

  /**
   * Elimina un usuario (soft delete)
   * @param id - ID del usuario a eliminar
   */
  async remove(id: string): Promise<void> {
    // Verificar que el usuario existe
    await this.findOne(id);

    // Soft delete: marcar como eliminado
    await this.db
      .update(schema.usuarios)
      .set({
        borrado_en: new Date(),
        actualizado_en: new Date(),
      })
      .where(eq(schema.usuarios.id, id));
  }

  /**
   * Valida que un nombre_usuario sea único
   * @param nombre_usuario - Nombre de usuario a validar
   * @param excludeId - ID del usuario a excluir de la validación (para actualizaciones)
   * @throws ConflictException si el nombre_usuario ya existe
   */
  private async validateUniqueUsername(
    nombre_usuario: string,
    excludeId?: string,
  ): Promise<void> {
    const conditions = [
      eq(schema.usuarios.nombre_usuario, nombre_usuario),
      isNull(schema.usuarios.borrado_en),
    ];

    const [existingUser] = await this.db
      .select({ id: schema.usuarios.id })
      .from(schema.usuarios)
      .where(and(...conditions))
      .limit(1);

    if (existingUser && existingUser.id !== excludeId) {
      throw new ConflictException(
        `El nombre de usuario "${nombre_usuario}" ya está en uso`,
      );
    }
  }
}
