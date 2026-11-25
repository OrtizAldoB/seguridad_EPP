import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import aprobacionesRoutes from './modules/aprobaciones/aprobaciones.routes';
import authRoutes from './modules/auth/auth.routes';
import clientesRoutes from './modules/clientes/clientes.routes';
import cotizacionesRoutes from './modules/cotizaciones/cotizaciones.routes';
import despachoRoutes from './modules/despacho/despacho.routes';
import inventarioRoutes from './modules/inventario/inventario.routes';
import notificacionesRoutes from './modules/notificaciones/notificaciones.routes';
import pedidosRoutes from './modules/pedidos/pedidos.routes';
import productosRoutes from './modules/productos/productos.routes';
import reportesRoutes from './modules/reportes/reportes.routes';
import usuariosRoutes from './modules/usuarios/usuarios.routes';
import proveedoresRoutes from './modules/proveedores/proveedores.routes';
import comprasRoutes from './modules/compras/compras.routes';
import solicitudesRoutes from './modules/solicitudes/solicitudes.routes';
import tiendaRoutes from './modules/tienda/tienda.routes';
import { ok } from './shared/response';

const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', env.CORS_ORIGIN);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

app.get('/api/health', (_req, res) => {
  ok(res, { status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/productos', productosRoutes);
app.use('/api/inventario', inventarioRoutes);
app.use('/api/cotizaciones', cotizacionesRoutes);
app.use('/api/pedidos', pedidosRoutes);
app.use('/api/aprobaciones', aprobacionesRoutes);
app.use('/api/notificaciones', notificacionesRoutes);
app.use('/api/despacho', despachoRoutes);
app.use('/api/reportes', reportesRoutes);
app.use('/api/proveedores', proveedoresRoutes);
app.use('/api/compras', comprasRoutes);
app.use('/api/solicitudes-compra', solicitudesRoutes);
app.use('/api/tienda', tiendaRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
