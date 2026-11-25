import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { api, apiWithMeta, errorMessage, qs } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import {
  Badge,
  Card,
  EmptyState,
  ErrorBox,
  EstadoBadge,
  Field,
  Loading,
  Modal,
  PageHeader,
  Pagination,
  fmtDate,
  money,
  numberFormat,
} from '../components/ui';

type EstadoCotizacion = 'BORRADOR' | 'ENVIADA' | 'ACEPTADA' | 'VENCIDA' | 'CONVERTIDA' | 'RECHAZADA';
type CondicionPago = 'CONTADO' | 'CREDITO';

interface CotizacionFila {
  id: number;
  codigo: string;
  cliente_id: number;
  vendedor_id: number;
  subtotal: number;
  descuento_porcentaje: number;
  descuento_monto: number;
  impuesto_monto: number;
  interes_monto: number;
  plazo_meses: number;
  fecha_limite_pago: string | null;
  total: number;
  condicion_pago: string;
  requiere_aprobacion: number;
  aprobada_en: string | null;
  estado: string;
  observacion: string | null;
  fecha_emision: string;
  fecha_vencimiento: string;
  razon_social: string;
  nit_ci: string;
  nombre_completo: string;
}

interface ItemDetalle {
  id: number;
  producto_id: number;
  cantidad: number;
  precio_unitario: number;
  descuento_porcentaje: number;
  subtotal: number;
  codigo: string;
  nombre: string;
  unidad_medida: string;
}

interface CotizacionDetalle extends CotizacionFila {
  items: ItemDetalle[];
  vigente: boolean;
  diasRestantes: number;
}

interface ClienteSelector {
  id: number;
  razonSocial: string;
  nitCi: string;
  estado: string;
}

interface ProductoSelector {
  id: number;
  codigo: string;
  nombre: string;
  precioUnitario: number;
  stockDisponible: number;
}

interface ListaSimple<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface ItemFormulario {
  clave: string;
  productoId: string;
  cantidad: string;
  precioUnitario: string;
  descuentoPorcentaje: string;
}

interface FormularioCotizacion {
  clienteId: string;
  condicionPago: CondicionPago;
  plazoMeses: string;
  descuentoPorcentaje: string;
  observacion: string;
  items: ItemFormulario[];
}

interface Totales {
  subtotal: number;
  descuentoMonto: number;
  impuestoMonto: number;
  interesMonto: number;
  total: number;
}

interface Paginacion {
  page: number;
  totalPages: number;
  total: number;
}

const ESTADOS: EstadoCotizacion[] = [
  'BORRADOR',
  'ENVIADA',
  'ACEPTADA',
  'VENCIDA',
  'CONVERTIDA',
  'RECHAZADA',
];

const round2 = (valor: number): number => Math.round((valor + Number.EPSILON) * 100) / 100;

const metaNumero = (meta: Record<string, unknown>, clave: string): number => {
  const valor = meta[clave];
  if (typeof valor === 'number') return valor;
  if (typeof valor === 'string') return Number(valor) || 0;
  return 0;
};

const calcularTotales = (form: FormularioCotizacion): Totales => {
  const esCredito = form.condicionPago === 'CREDITO';
  const subtotal = form.items.reduce((suma, item) => {
    const cantidad = Number(item.cantidad) || 0;
    const precio = Number(item.precioUnitario) || 0;
    const descuento = esCredito ? 0 : Number(item.descuentoPorcentaje) || 0;
    return suma + cantidad * precio * (1 - descuento / 100);
  }, 0);
  const descuentoMonto = esCredito ? 0 : subtotal * ((Number(form.descuentoPorcentaje) || 0) / 100);
  const base = subtotal - descuentoMonto;
  const impuestoMonto = base * 0.16;
  const baseConImpuesto = base + impuestoMonto;
  const plazoMeses = esCredito ? Math.max(0, Number(form.plazoMeses) || 0) : 0;
  const interesMonto = baseConImpuesto * 0.03 * plazoMeses;
  return {
    subtotal: round2(subtotal),
    descuentoMonto: round2(descuentoMonto),
    impuestoMonto: round2(impuestoMonto),
    interesMonto: round2(interesMonto),
    total: round2(baseConImpuesto + interesMonto),
  };
};

export default function CotizacionesPage() {
  const { hasPermiso } = useAuth();
  const contadorItems = useRef(0);
  const crearItem = (): ItemFormulario => {
    contadorItems.current += 1;
    return {
      clave: `item-${contadorItems.current}`,
      productoId: '',
      cantidad: '1',
      precioUnitario: '',
      descuentoPorcentaje: '0',
    };
  };
  const formularioInicial = (): FormularioCotizacion => ({
    clienteId: '',
    condicionPago: 'CONTADO',
    plazoMeses: '3',
    descuentoPorcentaje: '0',
    observacion: '',
    items: [crearItem()],
  });

  const [cotizaciones, setCotizaciones] = useState<CotizacionFila[]>([]);
  const [paginacion, setPaginacion] = useState<Paginacion>({ page: 1, totalPages: 1, total: 0 });
  const [clientes, setClientes] = useState<ClienteSelector[]>([]);
  const [productos, setProductos] = useState<ProductoSelector[]>([]);
  const [buscar, setBuscar] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [soloVigentes, setSoloVigentes] = useState(false);
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [cargandoSelectores, setCargandoSelectores] = useState(true);
  const [error, setError] = useState('');
  const [errorSelectores, setErrorSelectores] = useState('');
  const [notice, setNotice] = useState<{ tipo: 'ok' | 'error'; mensaje: string } | null>(null);
  const [modalNueva, setModalNueva] = useState(false);
  const [form, setForm] = useState<FormularioCotizacion>(formularioInicial);
  const [formError, setFormError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [detalleAbierto, setDetalleAbierto] = useState(false);
  const [detalleId, setDetalleId] = useState<number | null>(null);
  const [detalle, setDetalle] = useState<CotizacionDetalle | null>(null);
  const [detalleCargando, setDetalleCargando] = useState(false);
  const [detalleError, setDetalleError] = useState('');
  const [accion, setAccion] = useState<'aceptar' | 'rechazar' | 'convertir' | null>(null);

  const refrescar = useCallback(() => setVersion((valor) => valor + 1), []);

  const cargarSelectores = useCallback(async () => {
    setCargandoSelectores(true);
    setErrorSelectores('');
    try {
      const [clientesResp, productosResp] = await Promise.all([
        api<ListaSimple<ClienteSelector>>(`/clientes${qs({ estado: 'ACTIVO', page: 1, limit: 100 })}`),
        api<ListaSimple<ProductoSelector>>(`/productos${qs({ activo: true, page: 1, limit: 100 })}`),
      ]);
      setClientes(clientesResp.items);
      setProductos(productosResp.items);
    } catch (err) {
      setErrorSelectores(errorMessage(err));
    } finally {
      setCargandoSelectores(false);
    }
  }, []);

  useEffect(() => {
    void cargarSelectores();
  }, [cargarSelectores, version]);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    setError('');
    const consulta = qs({
      q: buscar,
      estado: filtroEstado,
      soloVigentes: soloVigentes ? true : undefined,
      page,
      limit: 10,
    });
    apiWithMeta<CotizacionFila[]>(`/cotizaciones${consulta}`)
      .then((respuesta) => {
        if (activo) {
          setCotizaciones(respuesta.data);
          setPaginacion({
            page: metaNumero(respuesta.meta, 'page') || page,
            totalPages: metaNumero(respuesta.meta, 'totalPages'),
            total: metaNumero(respuesta.meta, 'total'),
          });
        }
      })
      .catch((err) => {
        if (activo) setError(errorMessage(err));
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, [buscar, filtroEstado, soloVigentes, page, version]);

  const cargarDetalle = useCallback(async (id: number) => {
    setDetalleCargando(true);
    setDetalleError('');
    try {
      setDetalle(await api<CotizacionDetalle>(`/cotizaciones/${id}`));
    } catch (err) {
      setDetalleError(errorMessage(err));
    } finally {
        setDetalleCargando(false);
    }
  }, []);

  const abrirNueva = () => {
    setNotice(null);
    setForm(formularioInicial());
    setFormError('');
    setModalNueva(true);
  };

  const abrirDetalle = (id: number) => {
    setNotice(null);
    setDetalleId(id);
    setDetalle(null);
    setDetalleAbierto(true);
    void cargarDetalle(id);
  };

  const actualizarItem = (clave: string, campo: keyof Omit<ItemFormulario, 'clave'>, valor: string) => {
    setForm((anterior) => ({
      ...anterior,
      items: anterior.items.map((item) => (item.clave === clave ? { ...item, [campo]: valor } : item)),
    }));
  };

  const fusionarDuplicados = (items: ItemFormulario[]): ItemFormulario[] => {
    const agrupados = new Map<string, ItemFormulario>();
    for (const item of items) {
      if (!item.productoId) {
        agrupados.set(item.clave, item);
        continue;
      }
      const existente = [...agrupados.values()].find((actual) => actual.productoId === item.productoId);
      if (existente) {
        existente.cantidad = String(Number(existente.cantidad || 0) + Number(item.cantidad || 0));
      } else {
        agrupados.set(item.clave, { ...item });
      }
    }
    return [...agrupados.values()];
  };

  const cambiarProducto = (clave: string, valor: string) => {
    const producto = productos.find((item) => item.id === Number(valor));
    setForm((anterior) => ({
      ...anterior,
      items: fusionarDuplicados(
        anterior.items.map((item) =>
          item.clave === clave
            ? {
                ...item,
                productoId: valor,
                precioUnitario: producto ? String(producto.precioUnitario) : '',
              }
            : item,
        ),
      ),
    }));
  };

  const validar = (): string => {
    if (!form.clienteId) return 'Selecciona un cliente.';
    if (form.items.length === 0) return 'Agrega al menos un producto.';
    for (const [indice, item] of form.items.entries()) {
      if (!item.productoId) return `Selecciona un producto en la línea ${indice + 1}.`;
      const cantidad = Number(item.cantidad);
      if (!Number.isInteger(cantidad) || cantidad <= 0) {
        return `La cantidad de la línea ${indice + 1} debe ser un entero positivo.`;
      }
      const producto = productos.find((opcion) => opcion.id === Number(item.productoId));
      if (producto && cantidad > producto.stockDisponible) {
        return `Stock insuficiente para ${producto.nombre}. Disponible: ${producto.stockDisponible}.`;
      }
      const precio = Number(item.precioUnitario);
      if (!Number.isFinite(precio) || precio < 0) {
        return `El precio de la línea ${indice + 1} debe ser mayor o igual a cero.`;
      }
      const descuento = Number(item.descuentoPorcentaje);
      if (!Number.isFinite(descuento) || descuento < 0 || descuento > 100) {
        return `El descuento de la línea ${indice + 1} debe estar entre 0 y 100.`;
      }
    }
    const descuentoGlobal = Number(form.descuentoPorcentaje);
    if (!Number.isFinite(descuentoGlobal) || descuentoGlobal < 0 || descuentoGlobal > 100) {
      return 'El descuento global debe estar entre 0 y 100.';
    }
    if (form.condicionPago === 'CREDITO') {
      const plazo = Number(form.plazoMeses);
      if (!Number.isInteger(plazo) || plazo < 1 || plazo > 12) return 'El plazo de crédito debe estar entre 1 y 12 meses.';
      if (descuentoGlobal > 0 || form.items.some((item) => Number(item.descuentoPorcentaje) > 0)) {
        return 'No se permiten descuentos en ventas al crédito.';
      }
    }
    if (form.observacion.trim().length > 500) return 'La observación no puede superar 500 caracteres.';
    return '';
  };

  const guardar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const problema = validar();
    if (problema) {
      setFormError(problema);
      return;
    }
    const descuentoMaximo = Math.max(
      Number(form.descuentoPorcentaje) || 0,
      ...form.items.map((item) => Number(item.descuentoPorcentaje) || 0),
    );
    if (descuentoMaximo > 50 && !window.confirm(`El descuento es ${descuentoMaximo}%. ¿Deseas continuar?`)) {
      return;
    }

    setGuardando(true);
    setFormError('');
    try {
      await api('/cotizaciones', {
        method: 'POST',
        body: {
          cliente_id: Number(form.clienteId),
          items: form.items.map((item) => ({
            producto_id: Number(item.productoId),
            cantidad: Number(item.cantidad),
            precio_unitario: Number(item.precioUnitario),
            descuento_porcentaje: form.condicionPago === 'CREDITO' ? 0 : Number(item.descuentoPorcentaje),
          })),
          condicion_pago: form.condicionPago,
          plazo_meses: form.condicionPago === 'CREDITO' ? Number(form.plazoMeses) : 0,
          descuento_porcentaje: form.condicionPago === 'CREDITO' ? 0 : Number(form.descuentoPorcentaje),
          observacion: form.observacion.trim() || undefined,
        },
      });
      setModalNueva(false);
      setNotice({ tipo: 'ok', mensaje: 'Cotización registrada correctamente.' });
      refrescar();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setGuardando(false);
    }
  };

  const ejecutarAccion = async (nombre: 'aceptar' | 'rechazar' | 'convertir') => {
    if (!detalle || !hasPermiso('cotizaciones.actualizar') || accion) return;
    if (
      nombre === 'convertir' &&
      (detalle.estado !== 'ACEPTADA' ||
        !detalle.vigente ||
        (detalle.requiere_aprobacion === 1 && !detalle.aprobada_en))
    ) {
      return;
    }

    setAccion(nombre);
    setDetalleError('');
    try {
      await api(`/cotizaciones/${detalle.id}/${nombre}`, { method: 'POST' });
      const mensajes = {
        aceptar: 'Cotización aceptada.',
        rechazar: 'Cotización rechazada.',
        convertir: 'Pedido generado desde la cotización.',
      };
      setNotice({ tipo: 'ok', mensaje: mensajes[nombre] });
      refrescar();
      await cargarDetalle(detalle.id);
    } catch (err) {
      setDetalleError(errorMessage(err));
    } finally {
      setAccion(null);
    }
  };

  const cambiarCondicion = (condicion: CondicionPago) => {
    setForm((anterior) => ({
      ...anterior,
      condicionPago: condicion,
      descuentoPorcentaje: condicion === 'CREDITO' ? '0' : anterior.descuentoPorcentaje,
      items:
        condicion === 'CREDITO'
          ? anterior.items.map((item) => ({ ...item, descuentoPorcentaje: '0' }))
          : anterior.items,
    }));
  };

  const totales = calcularTotales(form);
  const puedeActualizar = hasPermiso('cotizaciones.actualizar');
  const puedeConvertir =
    detalle !== null &&
    detalle.estado === 'ACEPTADA' &&
    detalle.vigente &&
    (detalle.requiere_aprobacion !== 1 || Boolean(detalle.aprobada_en));

  return (
    <>
      <PageHeader
        title="Cotizaciones"
        subtitle="Registra propuestas comerciales y gestiona su aprobación y conversión."
        action={
          <button
            type="button"
            className="btn btn-primary"
            onClick={abrirNueva}
            disabled={cargandoSelectores}
          >
            Nueva cotización
          </button>
        }
      />

      {errorSelectores && <ErrorBox message={errorSelectores} onRetry={() => void cargarSelectores()} />}

      {notice && (
        <div className={`notice ${notice.tipo === 'ok' ? 'notice-ok' : 'notice-warn'}`} role="status">
          {notice.mensaje}
        </div>
      )}

      <Card>
        <form
          className="filters"
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
          }}
        >
          <Field label="Buscar">
            <input
              type="search"
              value={buscar}
              onChange={(event) => {
                setBuscar(event.target.value);
                setPage(1);
              }}
              placeholder="Código, cliente o NIT/CI"
            />
          </Field>
          <Field label="Estado">
            <select
              value={filtroEstado}
              onChange={(event) => {
                setFiltroEstado(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Todos</option>
              {ESTADOS.map((estado) => (
                <option key={estado} value={estado}>
                  {estado.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Vigencia">
            <span className="inline">
              <input
                type="checkbox"
                checked={soloVigentes}
                onChange={(event) => {
                  setSoloVigentes(event.target.checked);
                  setPage(1);
                }}
              />
              Solo vigentes
            </span>
          </Field>
        </form>
      </Card>

      <Card>
        <div className="card-head">
          <h2>Listado de cotizaciones</h2>
          <span className="muted">{numberFormat(paginacion.total)} registros</span>
        </div>

        {error && <ErrorBox message={error} onRetry={refrescar} />}

        {!error && cargando && <Loading label="Cargando..." />}
        {!error && !cargando && cotizaciones.length === 0 && (
          <EmptyState message="No se encontraron cotizaciones con los filtros seleccionados." />
        )}

        {!error && !cargando && cotizaciones.length > 0 && (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Cliente</th>
                    <th>Vendedor</th>
                    <th>Emisión</th>
                    <th>Vencimiento</th>
                    <th>Estado</th>
                    <th>Aprobación</th>
                    <th className="right">Total</th>
                    <th className="right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {cotizaciones.map((cotizacion) => (
                    <tr key={cotizacion.id}>
                      <td className="strong nowrap">{cotizacion.codigo}</td>
                      <td>
                        <div className="strong">{cotizacion.razon_social}</div>
                        <div className="muted">{cotizacion.nit_ci}</div>
                      </td>
                      <td>{cotizacion.nombre_completo}</td>
                      <td className="nowrap">{fmtDate(cotizacion.fecha_emision)}</td>
                      <td className="nowrap">{fmtDate(cotizacion.fecha_vencimiento)}</td>
                      <td>
                        <EstadoBadge estado={cotizacion.estado} />
                      </td>
                      <td>
                        <Badge tone={cotizacion.requiere_aprobacion === 1 ? 'amber' : 'gray'}>
                          {cotizacion.requiere_aprobacion === 1 ? 'Requiere aprobación' : 'No requerida'}
                        </Badge>
                      </td>
                      <td className="num strong">{money(cotizacion.total)}</td>
                      <td>
                        <button type="button" className="btn btn-sm" onClick={() => abrirDetalle(cotizacion.id)}>
                          Ver detalle
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={paginacion.page}
              totalPages={paginacion.totalPages}
              total={paginacion.total}
              onChange={setPage}
            />
          </>
        )}
      </Card>

      <Modal open={modalNueva} title="Nueva cotización" onClose={() => setModalNueva(false)} wide>
        <form onSubmit={guardar}>
          {formError && (
            <div className="notice notice-warn" role="alert">
              {formError}
            </div>
          )}
          <div className="form-grid">
            <Field label="Cliente" className="full">
              <select
                value={form.clienteId}
                onChange={(event) => setForm({ ...form, clienteId: event.target.value })}
                disabled={guardando}
              >
                <option value="">Selecciona un cliente</option>
                {clientes.map((cliente) => (
                  <option key={cliente.id} value={cliente.id}>
                    {cliente.razonSocial} · {cliente.nitCi}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="card-head" style={{ marginTop: 18 }}>
            <h2>Productos</h2>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setForm((anterior) => ({ ...anterior, items: [...anterior.items, crearItem()] }))}
              disabled={guardando}
            >
              Agregar producto
            </button>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th className="right">Cantidad</th>
                  <th className="right">Precio unitario</th>
                  <th className="right">Desc. %</th>
                  <th className="right">Subtotal</th>
                  <th className="right">Acción</th>
                </tr>
              </thead>
              <tbody>
                {form.items.map((item) => {
                  const subtotalLinea =
                    (Number(item.cantidad) || 0) *
                    (Number(item.precioUnitario) || 0) *
                    (1 - (Number(item.descuentoPorcentaje) || 0) / 100);
                  return (
                    <tr key={item.clave}>
                      <td>
                        <select
                          value={item.productoId}
                          onChange={(event) => cambiarProducto(item.clave, event.target.value)}
                          disabled={guardando}
                        >
                          <option value="">Selecciona un producto</option>
                          {productos.map((producto) => (
                            <option
                              key={producto.id}
                              value={producto.id}
                              disabled={producto.stockDisponible <= 0}
                            >
                              {producto.codigo} · {producto.nombre} ({numberFormat(producto.stockDisponible)})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={item.cantidad}
                          onChange={(event) => actualizarItem(item.clave, 'cantidad', event.target.value)}
                          disabled={guardando}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.precioUnitario}
                          onChange={(event) => actualizarItem(item.clave, 'precioUnitario', event.target.value)}
                          disabled={guardando}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={item.descuentoPorcentaje}
                          onChange={(event) => actualizarItem(item.clave, 'descuentoPorcentaje', event.target.value)}
                          disabled={guardando || form.condicionPago === 'CREDITO'}
                        />
                      </td>
                      <td className="num nowrap">{money(round2(subtotalLinea))}</td>
                      <td className="right">
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          onClick={() =>
                            setForm((anterior) => ({
                              ...anterior,
                              items: anterior.items.filter((producto) => producto.clave !== item.clave),
                            }))
                          }
                          disabled={guardando}
                        >
                          Quitar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="form-grid" style={{ marginTop: 18 }}>
            <Field label="Condición de pago">
              <select
                value={form.condicionPago}
                onChange={(event) => cambiarCondicion(event.target.value as CondicionPago)}
                disabled={guardando}
              >
                <option value="CONTADO">Contado</option>
                <option value="CREDITO">Crédito</option>
              </select>
            </Field>
            {form.condicionPago === 'CREDITO' && (
              <Field label="Plazo (meses)" hint="Interés del 3% mensual sobre el total con IVA.">
                <input
                  type="number"
                  min="1"
                  max="12"
                  step="1"
                  value={form.plazoMeses}
                  onChange={(event) => setForm({ ...form, plazoMeses: event.target.value })}
                  disabled={guardando}
                />
              </Field>
            )}
            <Field label="Descuento global %">
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.descuentoPorcentaje}
                onChange={(event) => setForm({ ...form, descuentoPorcentaje: event.target.value })}
                disabled={guardando || form.condicionPago === 'CREDITO'}
              />
            </Field>
            <Field label="Observación" className="full">
              <textarea
                value={form.observacion}
                onChange={(event) => setForm({ ...form, observacion: event.target.value })}
                disabled={guardando}
              />
            </Field>
          </div>

          <div className="notice" style={{ marginTop: 18 }}>
            <div className="item-line">
              <span>Subtotal</span>
              <strong>{money(totales.subtotal)}</strong>
            </div>
            <div className="item-line">
              <span>Descuento ({form.descuentoPorcentaje || '0'}%)</span>
              <strong>-{money(totales.descuentoMonto)}</strong>
            </div>
            <div className="item-line">
              <span>IVA (16%)</span>
              <strong>{money(totales.impuestoMonto)}</strong>
            </div>
            {form.condicionPago === 'CREDITO' && (
              <div className="item-line">
                <span>Interés crédito ({form.plazoMeses || '0'} meses × 3%)</span>
                <strong>{money(totales.interesMonto)}</strong>
              </div>
            )}
            <div className="total-line">
              <span>Total</span>
              <span>{money(totales.total)}</span>
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn" onClick={() => setModalNueva(false)} disabled={guardando}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={guardando}>
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={detalleAbierto}
        title={`Detalle de cotización${detalle ? ` ${detalle.codigo}` : ''}`}
        onClose={() => setDetalleAbierto(false)}
        wide
      >
        {detalleCargando && <Loading />}

        {!detalleCargando && detalleError && <ErrorBox message={detalleError} onRetry={() => detalleId && void cargarDetalle(detalleId)} />}

        {!detalleCargando && !detalleError && detalle && (<div className="stack">
            <div className="grid grid-3">
              <div>
                <div className="muted">Estado</div>
                <EstadoBadge estado={detalle.estado} />
              </div>
              <div>
                <div className="muted">Vigencia</div>
                <div className="inline">
                  <Badge tone={detalle.vigente ? 'green' : 'red'}>
                    {detalle.vigente ? 'Vigente' : 'No vigente'}
                  </Badge>
                  <span>{numberFormat(detalle.diasRestantes)} días restantes</span>
                </div>
              </div>
              <div>
                <div className="muted">Aprobación</div>
                <Badge tone={detalle.requiere_aprobacion === 1 ? 'amber' : 'gray'}>
                  {detalle.requiere_aprobacion === 1 ? 'Requiere aprobación' : 'No requerida'}
                </Badge>
              </div>
            </div>

            <div className="form-grid">
              <Field label="Cliente">
                <input value={`${detalle.razon_social} · ${detalle.nit_ci}`} readOnly />
              </Field>
              <Field label="Vendedor">
                <input value={detalle.nombre_completo} readOnly />
              </Field>
              <Field label="Emisión">
                <input value={fmtDate(detalle.fecha_emision)} readOnly />
              </Field>
              <Field label="Vencimiento">
                <input value={fmtDate(detalle.fecha_vencimiento)} readOnly />
              </Field>
              <Field label="Condición de pago">
                <input value={detalle.condicion_pago} readOnly />
              </Field>
              {detalle.condicion_pago === 'CREDITO' && (
                <>
                  <Field label="Plazo de pago">
                    <input value={`${detalle.plazo_meses || 0} meses`} readOnly />
                  </Field>
                  <Field label="Límite de pago">
                    <input value={detalle.fecha_limite_pago ? fmtDate(detalle.fecha_limite_pago) : '—'} readOnly />
                  </Field>
                </>
              )}
              {detalle.observacion && (
                <Field label="Observación" className="full">
                  <textarea value={detalle.observacion} readOnly />
                </Field>
              )}
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th className="right">Cantidad</th>
                    <th className="right">Precio unitario</th>
                    <th className="right">Desc. %</th>
                    <th className="right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {detalle.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="strong">{item.nombre}</div>
                        <div className="muted">
                          {item.codigo} · {item.unidad_medida}
                        </div>
                      </td>
                      <td className="num">{numberFormat(item.cantidad)}</td>
                      <td className="num">{money(item.precio_unitario)}</td>
                      <td className="num">{numberFormat(item.descuento_porcentaje)}</td>
                      <td className="num">{money(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="notice">
              <div className="item-line">
                <span>Subtotal</span>
                <strong>{money(detalle.subtotal)}</strong>
              </div>
              <div className="item-line">
                <span>Descuento ({numberFormat(detalle.descuento_porcentaje)}%)</span>
                <strong>-{money(detalle.descuento_monto)}</strong>
              </div>
              <div className="item-line">
                <span>IVA (16%)</span>
                <strong>{money(detalle.impuesto_monto)}</strong>
              </div>
              {detalle.condicion_pago === 'CREDITO' && (
                <div className="item-line">
                  <span>Interés crédito ({detalle.plazo_meses || 0} meses × 3%)</span>
                  <strong>{money(detalle.interes_monto)}</strong>
                </div>
              )}
              <div className="total-line">
                <span>Total</span>
                <span>{money(detalle.total)}</span>
              </div>
            </div>

            {!detalle.vigente && (
              <div className="notice notice-warn">La cotización no está vigente; no puede convertirse a pedido.</div>
            )}
            {detalle.vigente && detalle.requiere_aprobacion === 1 && !detalle.aprobada_en && (
              <div className="notice notice-warn">
                La cotización requiere aprobación administrativa antes de convertirse a pedido.
              </div>
            )}
            {detalle.vigente && detalle.requiere_aprobacion === 1 && Boolean(detalle.aprobada_en) && (
              <div className="notice notice-ok">
                Aprobada el {fmtDate(detalle.aprobada_en)}. Ya puede convertirse a pedido.
              </div>
            )}

            {puedeActualizar && (
              <div className="form-actions">
                {['BORRADOR', 'ENVIADA'].includes(detalle.estado) && (
                  <button
                    type="button"
                    className="btn btn-success"
                    onClick={() => void ejecutarAccion('aceptar')}
                    disabled={accion !== null}
                  >
                    {accion === 'aceptar' ? 'Procesando...' : 'Aceptar'}
                  </button>
                )}
                {!['VENCIDA', 'CONVERTIDA', 'RECHAZADA'].includes(detalle.estado) && (
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => void ejecutarAccion('rechazar')}
                    disabled={accion !== null}
                  >
                    {accion === 'rechazar' ? 'Procesando...' : 'Rechazar'}
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void ejecutarAccion('convertir')}
                  disabled={accion !== null || !puedeConvertir}
                >
                  {accion === 'convertir' ? 'Procesando...' : 'Convertir a pedido'}
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
