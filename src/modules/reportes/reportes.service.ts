import type { Response } from 'express';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { BadRequestError } from '../../shared/errors';
import * as repo from './reportes.repository';
import type { ExportQuery, ReporteQuery, TopQuery } from './reportes.schema';

interface ColumnaTabla {
  header: string;
  key: string;
  width: number;
}

interface TablaExportacion {
  tipo: ExportQuery['tipo'];
  titulo: string;
  columnas: ColumnaTabla[];
  encabezados: string[];
  filas: (string | number)[][];
  totalEtiqueta: string;
  totalValor: number;
  fechaDesde: string;
  fechaHasta: string;
}

function redondear(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

export function resumen(query: ReporteQuery) {
  const rango = repo.resolverRango(query);
  const indicadores = repo.obtenerIndicadores(rango);
  const ticketPromedio =
    indicadores.cantidadPedidos > 0 ? indicadores.totalVendido / indicadores.cantidadPedidos : 0;
  return {
    periodo: query.periodo,
    rango,
    totalVendido: redondear(indicadores.totalVendido),
    cantidadPedidos: indicadores.cantidadPedidos,
    totalCotizaciones: indicadores.totalCotizaciones,
    totalClientesActivos: repo.contarClientesActivos(),
    alertasStock: repo.contarAlertasStock(),
    ticketPromedio: redondear(ticketPromedio),
    serie: repo
      .obtenerSerieVentas(rango, query.periodo)
      .map((punto) => ({ ...punto, monto: redondear(punto.monto) })),
  };
}

export function ventas(query: ReporteQuery): repo.VentaItem[] {
  return repo.listarVentas(repo.resolverRango(query));
}

export function cotizaciones(query: ReporteQuery): repo.CotizacionItem[] {
  return repo.listarCotizaciones(repo.resolverRango(query));
}

export function kardex(query: ReporteQuery): repo.KardexItem[] {
  return repo.listarKardex(repo.resolverRango(query));
}

export function topProductos(query: TopQuery): repo.TopProductoItem[] {
  return repo.listarTopProductos(repo.resolverRango(query), query.limit);
}

export function topClientes(query: TopQuery): repo.TopClienteItem[] {
  return repo.listarTopClientes(repo.resolverRango(query), query.limit);
}

function construirTabla(query: ExportQuery): TablaExportacion {
  const rango = repo.resolverRango(query);
  const base = { tipo: query.tipo, fechaDesde: rango.desde, fechaHasta: rango.hasta };

  switch (query.tipo) {
    case 'ventas': {
      const items = repo.listarVentas(rango);
      const pedidosVistos = new Set<number>();
      let total = 0;
      for (const item of items) {
        if (pedidosVistos.has(item.pedidoId)) continue;
        pedidosVistos.add(item.pedidoId);
        total += item.pedidoTotal;
      }
      return {
        ...base,
        titulo: 'Ventas',
        columnas: [
          { header: 'Pedido', key: 'pedido', width: 18 },
          { header: 'Cliente', key: 'cliente', width: 30 },
          { header: 'NIT/CI', key: 'nit', width: 18 },
          { header: 'Vendedor', key: 'vendedor', width: 25 },
          { header: 'Estado', key: 'estado', width: 20 },
          { header: 'Fecha', key: 'fecha', width: 22 },
          { header: 'Producto', key: 'producto', width: 30 },
          { header: 'Cantidad', key: 'cantidad', width: 12 },
          { header: 'Precio unitario', key: 'precio', width: 16 },
          { header: 'Subtotal', key: 'subtotal', width: 16 },
        ],
        encabezados: [
          'Pedido',
          'Cliente',
          'NIT/CI',
          'Vendedor',
          'Estado',
          'Fecha',
          'Producto',
          'Cantidad',
          'Precio unitario',
          'Subtotal',
        ],
        filas: items.map((item) => [
          item.pedidoCodigo,
          item.clienteRazonSocial,
          item.clienteNitCi,
          item.vendedorNombreCompleto,
          item.estado,
          item.creadoEn,
          item.productoNombre ?? '',
          item.cantidad ?? '',
          item.precioUnitario ?? '',
          item.subtotal ?? '',
        ]),
        totalEtiqueta: 'TOTAL VENDIDO',
        totalValor: redondear(total),
      };
    }
    case 'cotizaciones': {
      const items = repo.listarCotizaciones(rango);
      return {
        ...base,
        titulo: 'Cotizaciones',
        columnas: [
          { header: 'Cotizacion', key: 'codigo', width: 18 },
          { header: 'Cliente', key: 'cliente', width: 32 },
          { header: 'NIT/CI', key: 'nit', width: 18 },
          { header: 'Vendedor', key: 'vendedor', width: 26 },
          { header: 'Estado', key: 'estado', width: 18 },
          { header: 'Fecha emision', key: 'emision', width: 18 },
          { header: 'Fecha vencimiento', key: 'vencimiento', width: 20 },
          { header: 'Total', key: 'total', width: 16 },
        ],
        encabezados: [
          'Cotizacion',
          'Cliente',
          'NIT/CI',
          'Vendedor',
          'Estado',
          'Fecha emision',
          'Fecha vencimiento',
          'Total',
        ],
        filas: items.map((item) => [
          item.codigo,
          item.clienteRazonSocial,
          item.clienteNitCi,
          item.vendedorNombreCompleto,
          item.estado,
          item.fechaEmision,
          item.fechaVencimiento,
          item.total,
        ]),
        totalEtiqueta: 'TOTAL COTIZADO',
        totalValor: redondear(items.reduce((suma, item) => suma + item.total, 0)),
      };
    }
    case 'kardex': {
      const items = repo.listarKardex(rango);
      return {
        ...base,
        titulo: 'Kardex',
        columnas: [
          { header: 'ID', key: 'id', width: 10 },
          { header: 'Fecha', key: 'fecha', width: 22 },
          { header: 'Producto', key: 'producto', width: 32 },
          { header: 'Codigo', key: 'codigo', width: 18 },
          { header: 'Tipo movimiento', key: 'tipo', width: 20 },
          { header: 'Cantidad', key: 'cantidad', width: 12 },
          { header: 'Stock anterior', key: 'anterior', width: 16 },
          { header: 'Stock nuevo', key: 'nuevo', width: 16 },
          { header: 'Usuario', key: 'usuario', width: 26 },
          { header: 'Verificado por', key: 'verificado', width: 26 },
          { header: 'Referencia', key: 'referencia', width: 22 },
        ],
        encabezados: [
          'ID',
          'Fecha',
          'Producto',
          'Codigo',
          'Tipo movimiento',
          'Cantidad',
          'Stock anterior',
          'Stock nuevo',
          'Usuario',
          'Verificado por',
          'Referencia',
        ],
        filas: items.map((item) => [
          item.id,
          item.fecha,
          item.productoNombre,
          item.productoCodigo,
          item.tipoMovimiento,
          item.cantidad,
          item.stockAnterior,
          item.stockNuevo,
          item.usuarioNombreCompleto,
          item.verificadoPor ?? '',
          item.referencia ?? '',
        ]),
        totalEtiqueta: 'TOTAL MOVIMIENTOS',
        totalValor: items.length,
      };
    }
    default:
      throw new BadRequestError('Tipo de exportacion no soportado');
  }
}

export async function exportarXlsx(res: Response, query: ExportQuery): Promise<void> {
  const tabla = construirTabla(query);
  const fechaArchivo = new Date().toISOString().slice(0, 10);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sistema EPP';
  workbook.created = new Date();

  const hoja = workbook.addWorksheet('Reporte', { views: [{ state: 'frozen', ySplit: 1 }] });
  hoja.columns = tabla.columnas;

  const cabecera = hoja.addRow(tabla.encabezados);
  cabecera.height = 22;
  cabecera.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  cabecera.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
  cabecera.alignment = { vertical: 'middle', horizontal: 'center' };

  for (const fila of tabla.filas) hoja.addRow(fila);

  const filaTotal = hoja.addRow(Array(tabla.encabezados.length).fill(''));
  filaTotal.getCell(1).value = tabla.totalEtiqueta;
  filaTotal.getCell(tabla.encabezados.length).value = tabla.totalValor;
  filaTotal.font = { bold: true };
  filaTotal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE6F1' } };

  res.status(200);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="reporte-${tabla.tipo}-${fechaArchivo}.xlsx"`);
  await workbook.xlsx.write(res);
  res.end();
}

export function exportarPdf(res: Response, query: ExportQuery): void {
  const tabla = construirTabla(query);
  const fechaGeneracion = new Date();
  const fechaArchivo = fechaGeneracion.toISOString().slice(0, 10);

  res.status(200);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="reporte-${tabla.tipo}-${fechaArchivo}.pdf"`);

  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 40, bufferPages: true });
  doc.pipe(res);

  const margen = doc.page.margins.left;
  const ancho = doc.page.width - margen - doc.page.margins.right;
  const sumaPesos = tabla.columnas.reduce((suma, columna) => suma + columna.width, 0);
  const anchos = tabla.columnas.map((columna) => (columna.width / sumaPesos) * ancho);

  doc.font('Helvetica-Bold')
    .fontSize(16)
    .text(`Reporte de ${tabla.titulo}`, margen, doc.y, { width: ancho, align: 'center' });
  doc.moveDown(0.4);
  doc.font('Helvetica').fontSize(9);
  doc.text(`Generado: ${fechaGeneracion.toLocaleString('es-BO')}`, margen, doc.y, {
    width: ancho,
    align: 'center',
  });
  doc.text(`Periodo: ${query.periodo} | Desde: ${tabla.fechaDesde} | Hasta: ${tabla.fechaHasta}`, margen, doc.y, {
    width: ancho,
    align: 'center',
  });
  doc.moveDown(0.8);

  let y = doc.y;
  const dibujarFila = (valores: (string | number)[], esCabecera: boolean, indice: number): void => {
    doc.font(esCabecera ? 'Helvetica-Bold' : 'Helvetica').fontSize(esCabecera ? 8 : 7.5);
    const altura =
      Math.max(
        ...valores.map((valor, i) => doc.heightOfString(String(valor ?? ''), { width: anchos[i] - 8 })),
        12,
      ) + 6;
    if (y + altura > doc.page.height - doc.page.margins.bottom - 20) {
      doc.addPage();
      y = doc.page.margins.top;
      dibujarFila(tabla.encabezados, true, 0);
    }
    if (esCabecera) doc.rect(margen, y, ancho, altura).fill('#1F4E78');
    else if (indice % 2 === 0) doc.rect(margen, y, ancho, altura).fill('#F2F6FA');
    doc.fillColor(esCabecera ? '#FFFFFF' : '#000000');
    let x = margen;
    valores.forEach((valor, i) => {
      doc.text(String(valor ?? ''), x + 4, y + 3, { width: anchos[i] - 8 });
      x += anchos[i];
    });
    y += altura;
  };

  dibujarFila(tabla.encabezados, true, 0);
  tabla.filas.forEach((fila, indice) => dibujarFila(fila, false, indice));
  const filaTotal: (string | number)[] = Array(tabla.encabezados.length).fill('');
  filaTotal[0] = tabla.totalEtiqueta;
  filaTotal[filaTotal.length - 1] = tabla.totalValor;
  dibujarFila(filaTotal, false, tabla.filas.length);

  const paginas = doc.bufferedPageRange();
  for (let i = 0; i < paginas.count; i++) {
    doc.switchToPage(paginas.start + i);
    doc.font('Helvetica')
      .fontSize(8)
      .fillColor('#666666')
      .text(`Pagina ${i + 1} de ${paginas.count}`, margen, doc.page.height - doc.page.margins.bottom + 8, {
        width: ancho,
        align: 'center',
      });
  }
  doc.end();
}
