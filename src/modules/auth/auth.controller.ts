import { asyncHandler } from '../../shared/asyncHandler';
import { created, ok } from '../../shared/response';
import * as service from './auth.service';

export const registro = asyncHandler(async (req, res) => {
  created(res, service.registrar(req.body as service.RegistrarInput), 'Cuenta de comprador creada');
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body as { email: string; password: string };
  ok(res, service.login(email, password), { message: 'Inicio de sesion exitoso' });
});

export const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body as { refreshToken: string };
  ok(res, service.refresh(refreshToken), { message: 'Sesion renovada' });
});

export const logout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body as { refreshToken: string };
  service.logout(refreshToken, req.user!.id);
  ok(res, { closed: true }, { message: 'Sesion cerrada' });
});

export const me = asyncHandler(async (req, res) => {
  ok(res, req.user);
});
