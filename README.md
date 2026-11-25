# Sistema de Gestión de EPP, Kardex y Ciclo Comercial

Backend Express + TypeScript + SQLite embebido y frontend React + Vite, con control de acceso por roles, Kardex transaccional, cotizaciones, pedidos, aprobaciones, despacho y reportes PDF/Excel.

## Arranque rápido

Requisito: Node.js 20 o superior (probado con Node 25). No requiere XAMPP ni MySQL.

```bash
npm install
npm run dev
```

Con un solo comando se inician:

- API: http://localhost:3000 (health en `http://localhost:3000/api/health`)
- Web: http://localhost:5173

La primera ejecución crea automáticamente `database/epp_sistema.sqlite`, aplica las migraciones y siembra usuarios, clientes y productos EPP.

### Credenciales de demostración

Password para los cuatro usuarios: `Clave123!`

| Email | Rol | Permisos principales |
| --- | --- | --- |
| `admin@epp.com` | ADMINISTRADOR | Todo, incluidas aprobaciones y usuarios |
| `vendedor@epp.com` | VENDEDOR | Clientes, catálogo, cotizaciones y pedidos |
| `almacen@epp.com` | ALMACENERO | Kardex, inventario, despacho y notificaciones |
| `comprador@epp.com` | COMPRADOR | Catálogo, carrito, checkout y pedidos propios |

También puede registrarse un comprador desde `/registro` con `POST /api/auth/registro`; la cuenta queda activa con rol `COMPRADOR` y cliente asociado.

## Scripts

| Comando | Descripción |
| --- | --- |
| `npm run dev` | API y frontend en modo watch |
| `npm run dev:api` | Solo API con recarga automática |
| `npm run dev:web` | Solo Vite en `:5173` (proxy `/api` a `:3000`) |
| `npm run migrate` | Aplica migraciones y seed inicial |
| `npm run seed` | Solo siembra datos base |
| `npm run build` | Compila backend a `dist/` |
| `npm run build:web` | Compila frontend a `dist-web/` |
| `npm run build:all` | Compila backend y frontend |
| `npm start` | Ejecuta backend compilado |
| `npm run typecheck` / `npm run typecheck:web` | Verificación de tipos |
| `npm test` | Pruebas de integración (flujo, RBAC, concurrencia, reportes) |

## Estructura

```
migrations/
  001_init_schema.sql       12 entidades + índices + PRAGMAs
  002_seed_data.sql         roles, permisos y matriz RBAC
  003_proveedores_compras.sql proveedores y compras
  004_tienda_comprador.sql  rol comprador, carrito y permisos de tienda
  005_aprobacion_cotizaciones.sql control de aprobación vigente
  006_reservas_stock.sql    libro de reservas, liberaciones y despachos
database/                   epp_sistema.sqlite (generado)
src/
  config/                   env, conexión, transacciones, migraciones, seed
  middleware/               autenticación JWT, RBAC, validación Zod, errores
  modules/                  auth, usuarios, clientes, productos, inventario,
                            cotizaciones, pedidos, aprobaciones,
                            notificaciones, despacho, reportes, tienda, reservas
  shared/                   constantes, semáforo, precios, respuestas
frontend/
  src/api/                  cliente HTTP con refresh automático de token
  src/auth/                 sesión y permisos en el navegador
  src/components/           layout, rutas protegidas, componentes UI
  src/pages/                dashboard, módulos internos, registro y tienda
tests/                      pruebas Vitest con base de datos aislada
```

## Flujo de trabajo recomendado

1. **Clientes** y **Catálogo EPP**: alta y edición con semáforo de stock (`VERDE`, `AMARILLO`, `ROJO`).
2. **Cotizador**: seleccionar cliente, ítems, condición de pago y descuento. Vigencia de 15 días.
3. Si el descuento es mayor al 10% o la condición es `CREDITO`, un administrador aprueba desde **Aprobaciones**; se escribe en `auditoria_financiera`.
4. **Pedidos**: conversión desde cotización aceptada y vigente, o alta directa. La reserva de stock usa `BEGIN IMMEDIATE`: `stock_comprometido` se incrementa de forma atómica.
5. **Almacén**: notificación automática, Pick List por pedido y confirmación de despacho con salida definitiva de `stock_real` + movimiento `SALIDA_VENTA` en el Kardex.
6. **Tienda pública**: el comprador se registra, navega el catálogo en `/tienda`, arma su carrito y hace checkout; el stock se reserva con `BEGIN IMMEDIATE`.
7. **Reportes**: indicadores, ranking de productos/clientes y exportación real a XLSX y PDF.

Regla de stock: `stock_disponible = stock_real - stock_comprometido`. Toda reserva, liberación y despacho queda registrada en `reservas_stock`.

La fecha de emisión de compras no puede ser anterior al día actual; se valida en el formulario (`min`) y en la API. Los filtros históricos de Kardex y Reportes sí permiten fechas pasadas.

Los teléfonos/celulares de clientes, proveedores y registro, y el campo `Contacto` del proveedor, aceptan solo dígitos (7 a 15) y se validan en frontend y API.

Una aprobación administrativa se invalida si la cotización se edita después: `aprobada_en` vuelve a `NULL`, el estado vuelve a `ENVIADA` y el registro reaparece en **Aprobaciones**. Los pedidos en `PENDIENTE_APROBACION` solo pueden aprobarse desde esa bandeja, nunca con `PATCH /pedidos/:id/estado`.

El ciclo de vida se valida dentro de `BEGIN IMMEDIATE` con transiciones permitidas; `DESPACHADO`/`ENTREGADO` solo se alcanzan desde **Despacho**. La fecha estimada de entrega se calcula en fecha local desde `dias_entrega` (1–90) y nunca puede ser anterior al día del pedido.

## API principal

Todas las rutas están bajo `/api` y usan `Authorization: Bearer <accessToken>`, salvo `/auth/login`, `/auth/registro` y `/auth/refresh`.

| Módulo | Rutas |
| --- | --- |
| Auth | `POST /auth/registro`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me` |
| Tienda | `GET /tienda/catalogo`, `GET/POST /tienda/carrito`, `POST /tienda/carrito/items`, `PATCH/DELETE /tienda/carrito/items/:productoId`, `DELETE /tienda/carrito`, `POST /tienda/checkout`, `GET /tienda/mis-pedidos`, `GET /tienda/mis-pedidos/:id` |
| Usuarios | `GET/POST /usuarios`, `PATCH /usuarios/:id`, `PATCH /usuarios/:id/estado`, `GET /usuarios/catalogos` |
| Clientes | `GET/POST /clientes`, `GET/PATCH/DELETE /clientes/:id` |
| Productos | `GET/POST /productos`, `GET/PATCH/DELETE /productos/:id`, `GET /productos/alertas`, `GET /productos/categorias` |
| Inventario | `GET /inventario/disponibilidad`, `GET /inventario/alertas`, `GET /inventario/kardex`, `POST /inventario/movimientos` |
| Cotizaciones | `GET/POST /cotizaciones`, `GET/PATCH /cotizaciones/:id`, `POST /cotizaciones/:id/{aceptar,rechazar,convertir}` |
| Pedidos | `GET/POST /pedidos`, `GET /pedidos/:id`, `PATCH /pedidos/:id/estado` |
| Aprobaciones | `GET /aprobaciones/pendientes`, `GET /aprobaciones/historial`, `POST /aprobaciones/{cotizaciones,pedidos}/:id` |
| Notificaciones | `GET /notificaciones`, `PATCH /notificaciones/leer-todas`, `PATCH /notificaciones/:id/leida` |
| Despacho | `GET /despacho/pendientes`, `GET /despacho/pick-list/:pedidoId`, `POST /despacho/confirmar/:pedidoId` |
| Reportes | `GET /reportes/{resumen,ventas,cotizaciones,kardex,top-productos,top-clientes}`, `GET /reportes/exportar.{xlsx,pdf}` |

## Pruebas

```bash
npm test
```

Las pruebas usan `database/test_epp.sqlite`, lo eliminan al inicio y ejecutan migraciones y seed sobre esa base aislada. Cubren:

- login, refresh, rutas sin token y bloqueos RBAC (403);
- NIT duplicado, semáforo y movimientos de Kardex;
- cotización → aceptación → aprobación → conversión → pedido → Pick List → despacho;
- aprobación de crédito/descuento y auditoría financiera;
- exportación XLSX y PDF con bytes reales;
- dos pedidos simultáneos compitiendo por el último stock disponible: uno `201`, otro `409`, con una sola reserva;
- registro/login de comprador, validaciones de contraseña y duplicados, carrito, checkout, stock reservado y libro `reservas_stock`;
- aprobación de cotización invalidada al editar, bloqueo de re-aprobación y bloqueo de aprobación de pedidos por cambio de estado.

## Configuración y reinicio

Copiar `.env.example` a `.env` si se desean cambiar secretos, TTLs, correos del seed o la ruta de la base.

Para reiniciar la base de datos:

```bash
npm run migrate
```

Para una reinstallación limpia, detener el servidor, borrar `database/epp_sistema.sqlite*` y ejecutar `npm run migrate`.
