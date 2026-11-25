import { z } from 'zod';
import { asyncHandler } from '../../shared/asyncHandler';
import { ForbiddenError } from '../../shared/errors';
import { created, ok } from '../../shared/response';
import { listUsuariosQuerySchema } from './usuarios.schema';
import * as service from './usuarios.service';

type ListQuery = z.infer<typeof listUsuariosQuerySchema>;

export const list = asyncHandler(async (req, res) => {
  const { q, role, activo, page, limit } = req.query as unknown as ListQuery;
  const result = service.list({ q, role, activo, page, limit });
  ok(res, result.items, {
    meta: { total: result.total, page, limit, totalPages: Math.ceil(result.total / limit) },
  });
});

export const catalogs = asyncHandler(async (_req, res) => {
  ok(res, service.catalogs());
});

export const getById = asyncHandler(async (req, res) => {
  ok(res, service.getById(Number(req.params.id)));
});

export const create = asyncHandler(async (req, res) => {
  created(res, service.create(req.body as service.CreateUsuarioInput), 'Usuario creado');
});

export const update = asyncHandler(async (req, res) => {
  ok(res, service.update(Number(req.params.id), req.body, req.user!), {
    message: 'Usuario actualizado',
  });
});

export const deactivate = asyncHandler(async (req, res) => {
  ok(res, service.deactivate(Number(req.params.id), req.user!), { message: 'Usuario desactivado' });
});

export const changePassword = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (req.user!.id !== id) throw new ForbiddenError('Solo puede cambiar su propia contrasena');
  const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
  service.changePassword(id, currentPassword, newPassword);
  ok(res, { updated: true }, { message: 'Contrasena actualizada; cierre sesion en todos los dispositivos' });
});
