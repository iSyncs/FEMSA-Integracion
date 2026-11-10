# -*- coding: utf-8 -*-
"""FE1S-35 · Genera las 40 evidencias PDF simuladas (ficticias) para la pantalla de IA,
el script SQL que las registra en dbo.EVIDENCE y el manifiesto de casos.

Uso:
    pip install reportlab pypdf
    python generar_evidencias_ia.py --pdf-dir ../../src/datos/memoria/archivos-demo

Escribe los PDF en --pdf-dir y `datos_prueba_evidencias_ia.sql` y `manifiesto_evidencias_ia.md`
junto a este script. Todos los datos son ficticios.
"""
import argparse
import hashlib
import io
import os
import re

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

AQUI = os.path.dirname(os.path.abspath(__file__))

# Frases con las que se marca un faltante. Los documentos completos (C) no deben contener ninguna.
FRASES_FALTANTE = ['pendiente', 'no se indicó', 'no se indico', 'no adjunto', 'sin firma', 'por definir']


# ---------------------------------------------------------------- formato
def mxn(x):
    return ('-' if x < 0 else '') + f'$ {abs(x):,.2f} MXN'


def brl(x):
    return ('-' if x < 0 else '') + f'R$ {abs(x):,.2f}'


def n(x, dec=0):
    return f'{x:,.{dec}f}'


def firmado(rol, nombre, cargo, fecha):
    return (rol, nombre, cargo, fecha, f'/s/ {nombre}')


def falta(rol, nombre, cargo, estado):
    return (rol, nombre, cargo, '-', estado)


DOCS = []


def doc(**kw):
    DOCS.append(kw)


# ====================================================================================
# AUD-000001 · Control de inventarios, Planta Toluca (KOF)
# ====================================================================================
U1 = 'Coca-Cola FEMSA (KOF) · Planta Toluca'

conteo = [  # sku, descripción, unidad, sistema, físico, costo unitario
    ('3101', 'Preforma PET 600 ml', 'millar', 420, 412, 1850),
    ('3102', 'Tapa rosca 28 mm', 'millar', 610, 606, 950),
    ('3215', 'Etiqueta termoencogible 600 ml', 'millar', 380, 371, 1250),
    ('3330', 'Película stretch', 'rollo', 145, 147, 420),
    ('3410', 'Charola de cartón 24 piezas', 'millar', 96, 92, 2600),
    ('3520', 'Cinta de embalaje', 'caja', 60, 62, 480),
]
dif_conteo = sum((f - s) * c for _, _, _, s, f, c in conteo)
assert dif_conteo == -38450
doc(file='aud000001_conteo_ciclico_alm03_sep2026.pdf', aud='AUD-000001', unidad=U1,
    tipo='Conteo cíclico de inventario', folio='CC-ALM03-2026-0917', fecha='18/09/2026',
    area='Almacén de Materias Primas y Empaque',
    resp='Ricardo Salinas Ortega, Jefe de Almacén 03', periodo='Conteo del 17/09/2026 (ciclo de septiembre 2026)',
    politica='Política INV-02 Conteos cíclicos de inventario',
    extra=[('Almacén', 'Almacén 03 · Materias primas y empaque'), ('SKU contados', '6 SKU de la clase A')],
    cols=['SKU', 'Descripción', 'Unidad', 'Existencia sistema', 'Conteo físico', 'Diferencia (unid.)', 'Costo unitario', 'Diferencia ($)'],
    widths=[30, 110, 38, 52, 48, 52, 82, 100],
    rows=[[s, d, u, n(si), n(f), n(f - si), mxn(c), mxn((f - si) * c)] for s, d, u, si, f, c in conteo],
    total=['Total', '6 SKU', '', '', '', '', '', mxn(dif_conteo)],
    notas=['Diferencia neta del conteo: ' + mxn(dif_conteo) + '.'],
    obs=['La diferencia neta de ' + mxn(dif_conteo) + ' queda por investigar; Almacén revisará los movimientos de consumo a línea de los SKU 3101, 3215 y 3410.',
         'El conteo se realizó con el almacén cerrado y con doble conteo ciego en los 6 SKU.'],
    firmas=[firmado('Elaboró', 'Daniela Robles Fuentes', 'Analista de Inventarios', '18/09/2026'),
            firmado('Revisó', 'Ricardo Salinas Ortega', 'Jefe de Almacén 03', '18/09/2026'),
            falta('Autorizó', 'Héctor Villanueva Ruiz', 'Contralor de Planta', 'Firma de Contraloría pendiente')],
    anexos=[('A', 'Hojas de conteo ciego firmadas por los contadores', True),
            ('B', 'Reporte de existencias del sistema al 17/09/2026', True)],
    caso='P', sev='Moderada',
    datos='Almacén 03, 6 SKU, diferencia neta −$38,450 MXN.',
    problema='En Cierre, firma de Contraloría pendiente; en Observaciones, diferencia "por investigar".')

ajuste = [  # sku, descripción, unidad, cantidad, costo
    ('4410', 'Jarabe simple', 'litro', -2400, 38.50),
    ('3101', 'Preforma PET 600 ml', 'millar', -32, 1850),
    ('3215', 'Etiqueta termoencogible 600 ml', 'millar', -28, 1250),
    ('3410', 'Charola de cartón 24 piezas', 'millar', -10, 2600),
    ('3605', 'CO2 grado alimenticio', 'kg', -100, 23),
]
tot_ajuste = sum(q * c for *_, q, c in ajuste)
assert tot_ajuste == -214900
doc(file='aud000001_ajuste_inventario_aj1187.pdf', aud='AUD-000001', unidad=U1,
    tipo='Ajuste de inventario', folio='AJ-1187', fecha='22/09/2026', area='Almacén de Materias Primas y Empaque',
    resp='Ricardo Salinas Ortega, Jefe de Almacén 03', periodo='Septiembre 2026',
    politica='Política INV-04 Ajustes de inventario',
    extra=[('Origen del ajuste', 'Conteos cíclicos de septiembre 2026 en almacén 03'),
           ('Nivel de autorización', 'Política INV-04: los ajustes mayores a $ 100,000.00 MXN requieren autorización del Gerente de Planta')],
    cols=['SKU', 'Descripción', 'Unidad', 'Cantidad ajustada', 'Costo unitario', 'Importe del ajuste'],
    widths=[40, 140, 50, 70, 95, 117],
    rows=[[s, d, u, n(q), mxn(c), mxn(q * c)] for s, d, u, q, c in ajuste],
    total=['Total', '5 partidas', '', '', '', mxn(tot_ajuste)],
    notas=['Importe total del ajuste: ' + mxn(tot_ajuste) + ' (baja de inventario).'],
    obs=['El ajuste supera el umbral de ' + mxn(100000) + ' de la Política INV-04, por lo que requiere autorización del Gerente de Planta.',
         'El ajuste se registrará en el sistema una vez autorizado.'],
    firmas=[firmado('Elaboró', 'Daniela Robles Fuentes', 'Analista de Inventarios', '22/09/2026'),
            firmado('Revisó', 'Héctor Villanueva Ruiz', 'Contralor de Planta', '23/09/2026'),
            falta('Autorizó', 'Arturo Medina Lozano', 'Gerente de Planta', 'Autorización pendiente')],
    anexos=[('A', 'Cédulas de conteo cíclico de septiembre 2026', True),
            ('B', 'Reporte de valuación de inventario al 21/09/2026', True)],
    caso='P', sev='Alta',
    datos='Ajuste −$214,900 MXN; la Política INV-04 pide autorización del Gerente de Planta arriba de $100,000.',
    problema='En Cierre, Autorizó pendiente.')

entradas_k = [('02/09/2026', 'EA-5431', 3100), ('09/09/2026', 'EA-5468', 3200), ('16/09/2026', 'EA-5502', 2900), ('23/09/2026', 'EA-5537', 3200)]
salidas_k = [('05/09/2026', 'CP-2210', 2950), ('12/09/2026', 'CP-2234', 3050), ('19/09/2026', 'CP-2261', 2980), ('26/09/2026', 'CP-2289', 2970)]
movs = sorted([(f, 'Entrada de almacén', d, q, 0) for f, d, q in entradas_k] + [(f, 'Consumo a producción', d, 0, q) for f, d, q in salidas_k],
              key=lambda m: m[0][3:5] + m[0][:2])
ent_k, sal_k = sum(m[3] for m in movs), sum(m[4] for m in movs)
assert (ent_k, sal_k) == (12400, 11950) and 3200 + ent_k - sal_k == 3650
doc(file='aud000001_kardex_jarabe_sku4410.pdf', aud='AUD-000001', unidad=U1,
    tipo='Kardex de inventario', folio='KDX-4410-2026-09', fecha='30/09/2026', area='Almacén de Materias Primas y Empaque',
    resp='Ricardo Salinas Ortega, Jefe de Almacén 03', periodo='01/09/2026 al 30/09/2026',
    politica='Política INV-01 Registro y control de existencias',
    extra=[('Artículo', 'SKU 4410 · Jarabe simple (litros)'), ('Costo promedio', mxn(38.50) + ' por litro')],
    cols=['Fecha', 'Movimiento', 'Documento', 'Entradas (L)', 'Salidas (L)'],
    widths=[70, 150, 90, 101, 101],
    rows=[['01/09/2026', 'Saldo inicial: 3,200 L', '-', '-', '-']] + [[f, t, d, n(e) if e else '-', n(s) if s else '-'] for f, t, d, e, s in movs],
    total=['Total', 'Movimientos del mes', '', n(ent_k), n(sal_k)],
    notas=['Saldo inicial: 3,200 L · Entradas: 12,400 L · Salidas: 11,950 L · Saldo final: 3,560 L.'],
    obs=['Sin excepciones en el periodo. Los consumos a producción corresponden a las órdenes de fabricación de bebidas carbonatadas.'],
    firmas=[firmado('Elaboró', 'Daniela Robles Fuentes', 'Analista de Inventarios', '30/09/2026'),
            firmado('Revisó', 'Ricardo Salinas Ortega', 'Jefe de Almacén 03', '30/09/2026'),
            firmado('Autorizó', 'Héctor Villanueva Ruiz', 'Contralor de Planta', '01/10/2026')],
    anexos=[('A', 'Entradas de almacén EA-5431, EA-5468, EA-5502 y EA-5537', True),
            ('B', 'Vales de consumo a producción CP-2210, CP-2234, CP-2261 y CP-2289', True)],
    caso='A', sev='Moderada',
    datos='Saldo inicial 3,200, entradas 12,400, salidas 11,950, saldo final escrito 3,560 (el correcto es 3,650).',
    problema='En Detalle, el saldo final no cuadra.')

ea = [('1', 'Preforma PET 600 ml 23.5 g (caja con 1,000 piezas)', 'L-0912-A', 160, 160, 200),
      ('2', 'Preforma PET 600 ml 23.5 g (caja con 1,000 piezas)', 'L-0912-B', 160, 160, 200),
      ('3', 'Preforma PET 600 ml 23.5 g (caja con 1,000 piezas)', 'L-0913-A', 160, 160, 200)]
tot_ea = sum(r * p for *_, r, p in ea)
assert tot_ea == 96000 and sum(e[4] for e in ea) == 480
doc(file='aud000001_entrada_almacen_ea5520.pdf', aud='AUD-000001', unidad=U1,
    tipo='Entrada de almacén', folio='EA-5520', fecha='14/09/2026', area='Recepción de Materiales',
    resp='Sofía Cárdenas Ibarra, Supervisora de Recepción', periodo='Recepción del 14/09/2026',
    politica='Procedimiento REC-03 Recepción de materiales contra orden de compra',
    extra=[('Proveedor', 'Envases Plásticos del Altiplano, S.A. de C.V. (PRV-11408)'), ('Orden de compra', 'OC-5520'),
           ('Remisión del proveedor', 'REM-88412')],
    cols=['Partida', 'Descripción', 'Lote', 'Cantidad OC (cajas)', 'Cantidad recibida (cajas)', 'Precio unitario', 'Importe'],
    widths=[38, 150, 52, 52, 60, 75, 85],
    rows=[[p, d, l, n(o), n(r), mxn(pr), mxn(r * pr)] for p, d, l, o, r, pr in ea],
    total=['Total', '', '', n(480), n(480), '', mxn(tot_ea)],
    notas=['La cantidad y el importe recibidos coinciden con la OC-5520 (480 cajas por ' + mxn(tot_ea) + ').'],
    obs=['Sin excepciones. Inspección de calidad liberada con el certificado de análisis del proveedor.'],
    firmas=[firmado('Elaboró', 'Jorge Ávila Montes', 'Auxiliar de Recepción', '14/09/2026'),
            firmado('Revisó', 'Sofía Cárdenas Ibarra', 'Supervisora de Recepción', '14/09/2026'),
            firmado('Autorizó', 'Ricardo Salinas Ortega', 'Jefe de Almacén 03', '15/09/2026')],
    anexos=[('A', 'Copia de la orden de compra OC-5520', True), ('B', 'Remisión REM-88412 del proveedor', True),
            ('C', 'Certificado de análisis de calidad del lote', True)],
    caso='C', sev='-', datos='480 cajas de preforma PET, $96,000 MXN, coincide con la OC-5520.', problema='')

merma = [('Coca-Cola 600 ml (caja 24)', 22000, 900, 34.00), ('Sprite 600 ml (caja 24)', 12000, 440, 31.00),
         ('Fanta Naranja 600 ml (caja 24)', 9000, 320, 31.00), ('Ciel 1 L (caja 12)', 7000, 240, 29.75)]
prod_m, cajas_m = sum(m[1] for m in merma), sum(m[2] for m in merma)
val_m = sum(m[2] * m[3] for m in merma)
assert (prod_m, cajas_m, val_m) == (50000, 1900, 61300) and round(cajas_m / prod_m * 100, 2) == 3.8
doc(file='aud000001_merma_producto_terminado_ago2026.pdf', aud='AUD-000001', unidad=U1,
    tipo='Reporte de merma de producto terminado', folio='RM-PT-2026-08', fecha='05/09/2026', area='Producción y Calidad',
    resp='Por definir (no se ha asignado responsable del seguimiento)', periodo='01/08/2026 al 31/08/2026',
    politica='Política PRD-05 Control de mermas (tolerancia máxima 2.0 %)',
    extra=[('Líneas de producción', 'Líneas 2, 4 y 5')],
    cols=['Producto', 'Producción (cajas)', 'Merma (cajas)', '% de merma', 'Costo por caja', 'Valor de la merma'],
    widths=[140, 70, 60, 55, 87, 100],
    rows=[[p, n(pr), n(c), f'{c / pr * 100:.2f} %', mxn(cu), mxn(c * cu)] for p, pr, c, cu in merma],
    total=['Total', n(prod_m), n(cajas_m), f'{cajas_m / prod_m * 100:.2f} %', '', mxn(val_m)],
    notas=['Merma del mes: 3.80 % contra una tolerancia de 2.00 % (Política PRD-05), equivalente a ' + mxn(val_m) + '.'],
    obs=['La merma excede la tolerancia en 1.80 puntos porcentuales.',
         'Causa raíz: no se indicó; el reporte se emite sin causa raíz documentada.'],
    firmas=[firmado('Elaboró', 'Paola Guzmán Treviño', 'Analista de Producción', '05/09/2026'),
            firmado('Revisó', 'Mauricio León Castañeda', 'Jefe de Calidad', '05/09/2026'),
            firmado('Autorizó', 'Arturo Medina Lozano', 'Gerente de Planta', '08/09/2026')],
    anexos=[('A', 'Reporte de producción de agosto 2026 por línea', True), ('B', 'Registro diario de merma por turno', True)],
    caso='P', sev='Moderada',
    datos='Merma de 3.8 % contra una tolerancia de 2 %, $61,300 MXN.',
    problema='En Observaciones, sin causa raíz; en Datos generales, responsable "por definir".')

destr = [('Coca-Cola 600 ml', 'L-2604-118', '30/07/2026', 1200, 13.00), ('Sprite 600 ml', 'L-2604-131', '02/08/2026', 550, 13.00),
         ('Fanta Naranja 600 ml', 'L-2604-140', '05/08/2026', 400, 13.00)]
bot_d, val_d = sum(d[3] for d in destr), sum(d[3] * d[4] for d in destr)
assert (bot_d, val_d) == (2150, 27950)
doc(file='aud000001_acta_destruccion_ad0219.pdf', aud='AUD-000001', unidad=U1,
    tipo='Acta de destrucción de producto', folio='AD-0219', fecha='11/09/2026', area='Calidad y Almacén de Producto Terminado',
    resp='Mauricio León Castañeda, Jefe de Calidad', periodo='Producto caducado de julio y agosto 2026',
    politica='Procedimiento CAL-09 Destrucción de producto no conforme',
    extra=[('Lugar de destrucción', 'Patio de servicios de Planta Toluca'), ('Fecha de destrucción', '11/09/2026')],
    cols=['Producto', 'Lote', 'Caducidad', 'Botellas', 'Costo unitario', 'Importe'],
    widths=[130, 75, 70, 60, 87, 90],
    rows=[[p, l, c, n(b), mxn(cu), mxn(b * cu)] for p, l, c, b, cu in destr],
    total=['Total', '', '', n(bot_d), '', mxn(val_d)],
    notas=['Se destruyeron 2,150 botellas caducas con valor de ' + mxn(val_d) + '; el PET se envió a reciclaje.'],
    obs=['Sin diferencias entre las botellas relacionadas y las destruidas.'],
    firmas=[firmado('Elaboró', 'Paola Guzmán Treviño', 'Analista de Producción', '11/09/2026'),
            firmado('Revisó', 'Ricardo Salinas Ortega', 'Jefe de Almacén 03', '11/09/2026'),
            firmado('Autorizó', 'Arturo Medina Lozano', 'Gerente de Planta', '12/09/2026'),
            falta('Testigo', 'Valeria Núñez Paredes', 'Inspectora de Calidad', 'Sin firma')],
    anexos=[('A', 'Relación de lotes caducados', True), ('B', 'Fotografías de la destrucción', False)],
    caso='P', sev='Baja',
    datos='2,150 botellas caducas, $27,950 MXN.',
    problema='En Cierre, testigo de Calidad sin firma; Anexo B (fotografías) no adjunto.')

trasp = [('Coca-Cola 600 ml (caja 24)', 700, 160), ('Coca-Cola 2.5 L (caja 8)', 300, 150), ('Sprite 600 ml (caja 24)', 200, 145)]
caj_t, val_t = sum(t[1] for t in trasp), sum(t[1] * t[2] for t in trasp)
assert (caj_t, val_t) == (1200, 186000)
doc(file='aud000001_traspaso_plantas_tr0884.pdf', aud='AUD-000001', unidad=U1,
    tipo='Traspaso entre plantas', folio='TR-0884', fecha='09/09/2026', area='Logística de Producto Terminado',
    resp='Eduardo Pineda Sosa, Coordinador de Logística', periodo='Traspaso del 09/09/2026',
    politica='Procedimiento LOG-06 Traspasos entre centros de producción',
    extra=[('Origen', 'Planta Toluca'), ('Destino', 'Planta Apizaco'), ('Fecha de salida', '09/09/2026'),
           ('Fecha de recepción', 'No se indicó'), ('Transporte', 'Unidad TL-208, operador Felipe Rangel Soto')],
    cols=['Producto', 'Cajas', 'Costo por caja', 'Importe'],
    widths=[200, 80, 112, 120],
    rows=[[p, n(c), mxn(cu), mxn(c * cu)] for p, c, cu in trasp],
    total=['Total', n(caj_t), '', mxn(val_t)],
    notas=['Traspaso de 1,200 cajas por ' + mxn(val_t) + ' de Planta Toluca a Planta Apizaco.'],
    obs=['La carga salió completa y sellada con el marchamo MR-55120.'],
    firmas=[firmado('Elaboró', 'Eduardo Pineda Sosa', 'Coordinador de Logística', '09/09/2026'),
            firmado('Revisó', 'Ricardo Salinas Ortega', 'Jefe de Almacén 03', '09/09/2026'),
            firmado('Autorizó', 'Arturo Medina Lozano', 'Gerente de Planta', '09/09/2026'),
            falta('Recibido en destino', 'Gilberto Romo Aguilar', 'Jefe de Almacén, Planta Apizaco', 'Sin firma')],
    anexos=[('A', 'Remisión de traspaso TR-0884', True), ('B', 'Registro de marchamo MR-55120', True)],
    caso='P', sev='Moderada',
    datos='Toluca a Apizaco, 1,200 cajas, $186,000 MXN.',
    problema='En Datos generales, fecha de recepción no indicada; en Cierre, recibido en destino sin firma.')

# ====================================================================================
# AUD-000002 · Pagos a proveedores LatAm (FEMSA Servicios)
# ====================================================================================
U2 = 'FEMSA Servicios · Cuentas por Pagar LatAm'

alta = [('FAC-A101', 'Fletes Toluca - Querétaro, semana 36', 212400), ('FAC-A102', 'Fletes Toluca - León, semana 36', 182600),
        ('FAC-A103', 'Maniobras de carga y descarga, semana 36', 91200)]
tot_alta = sum(a[2] for a in alta)
assert tot_alta == 486200
doc(file='aud000002_alta_proveedor_prv20931.pdf', aud='AUD-000002', unidad=U2,
    tipo='Alta de proveedor', folio='PRV-20931', fecha='03/09/2026', area='Datos Maestros de Proveedores',
    resp='Laura Benítez Carrillo, Analista de Compras', periodo='Alta del 03/09/2026',
    politica='Política PRV-01 Alta y mantenimiento de proveedores',
    extra=[('Proveedor', 'Transportes Logísticos Bajío Norte, S.A. de C.V.'), ('RFC', 'TLB190823KQ4'),
           ('Giro', 'Autotransporte de carga'), ('Banco y CLABE registrada', 'Banco del Centro · 058 180 00412 7739 15 2')],
    cols=['Factura', 'Concepto', 'Importe'],
    widths=[90, 280, 142],
    rows=[[f, c, mxn(i)] for f, c, i in alta],
    total=['Total del primer pago', '', mxn(tot_alta)],
    notas=['Primer pago programado al proveedor: ' + mxn(tot_alta) + ' (corrida del 10/09/2026).'],
    obs=['El proveedor se da de alta para cubrir rutas de fletes del Bajío por cambio de transportista.'],
    firmas=[firmado('Elaboró (solicitó)', 'Laura Benítez Carrillo', 'Analista de Compras', '03/09/2026'),
            firmado('Revisó', 'Óscar Delgado Herrera', 'Analista de Datos Maestros', '03/09/2026'),
            firmado('Autorizó (aprobó)', 'Laura Benítez Carrillo', 'Analista de Compras', '03/09/2026')],
    cierre_notas=['La solicitud y la aprobación del alta fueron firmadas por la misma persona (Laura Benítez Carrillo).'],
    anexos=[('A', 'Constancia de situación fiscal', True), ('B', 'Opinión de cumplimiento SAT (32-D)', False),
            ('C', 'Validación en lista del artículo 69-B del CFF', False), ('D', 'Estado de cuenta bancario del proveedor', True)],
    caso='P', sev='Alta',
    datos='Proveedor ficticio de transporte; primer pago $486,200 MXN.',
    problema='En Cierre, la misma persona solicitó y aprobó; en Anexos, la opinión 32-D y la validación 69-B no están adjuntas.')

oc = [('1', 'Tarimas plásticas 1.20 x 1.00 m', 1200, 185), ('2', 'Emplayadora semiautomática', 2, 148250),
      ('3', 'Instalación y capacitación de emplayadoras', 1, 224000)]
tot_oc = sum(o[2] * o[3] for o in oc)
assert tot_oc == 742500
doc(file='aud000002_orden_compra_oc77812.pdf', aud='AUD-000002', unidad=U2,
    tipo='Orden de compra', folio='OC-77812', fecha='19/08/2026', area='Compras Indirectas',
    resp='Mariela Fuentes Olvera, Compradora Senior', periodo='Agosto 2026',
    politica='Política COM-03 Compras y niveles de aprobación',
    extra=[('Proveedor', 'Soluciones de Empaque Industrial del Norte, S.A. de C.V. (PRV-17722)'),
           ('Condiciones de pago', '30 días'), ('Firmas requeridas', '2 (Gerente de Compras y Director de Finanzas)')],
    cols=['Partida', 'Descripción', 'Cantidad', 'Precio unitario', 'Importe'],
    widths=[42, 200, 60, 100, 110],
    rows=[[p, d, n(c), mxn(pu), mxn(c * pu)] for p, d, c, pu in oc],
    total=['Total', '3 partidas', '', '', mxn(tot_oc)],
    notas=['Importes antes de IVA. Total de la orden: ' + mxn(tot_oc) + '.'],
    obs=['Sin excepciones. La orden cuenta con las dos firmas de aprobación que exige la Política COM-03.'],
    firmas=[firmado('Elaboró', 'Mariela Fuentes Olvera', 'Compradora Senior', '19/08/2026'),
            firmado('Revisó', 'Gustavo Peña Arriaga', 'Gerente de Compras', '19/08/2026'),
            firmado('Autorizó', 'Claudia Serrano Vidal', 'Directora de Finanzas', '20/08/2026')],
    anexos=[('A', 'Cotizaciones de tres proveedores', True), ('B', 'Cuadro comparativo de cotizaciones', True)],
    caso='C', sev='-', datos='3 partidas, total $742,500 MXN, dos firmas.', problema='')

doc(file='aud000002_factura_fac9930_recepcion.pdf', aud='AUD-000002', unidad=U2,
    tipo='Validación de factura contra recepción', folio='VF-9930', fecha='24/09/2026', area='Cuentas por Pagar',
    resp='Iván Morales Zepeda, Analista de Cuentas por Pagar', periodo='Septiembre 2026',
    politica='Procedimiento CXP-04 Validación de tres vías (OC, recepción y factura)',
    extra=[('Proveedor', 'Frío Express Logística, S.A. de C.V. (PRV-15530)'), ('Orden de compra', 'OC-77650'),
           ('Recepción', 'REC-40218'), ('Factura', 'FAC-9930')],
    cols=['Concepto', 'Orden de compra', 'Recepción', 'Factura'],
    widths=[152, 120, 120, 120],
    rows=[['Transporte refrigerado, lote 1', mxn(620000), mxn(620000), mxn(650000)],
          ['Transporte refrigerado, lote 2', mxn(560000), mxn(560000), mxn(600000)],
          ['Subtotal', mxn(1180000), mxn(1180000), mxn(1250000)],
          ['IVA 16 %', mxn(188800), mxn(188800), mxn(195000)]],
    total=['Total', mxn(1368800), mxn(1368800), mxn(1445000)],
    notas=['Diferencia del subtotal de la factura contra la orden de compra: ' + mxn(70000) + '.',
           'Justificación de la diferencia: no se indicó.'],
    obs=['Factura programada para pago en la corrida del 30/09/2026.'],
    firmas=[firmado('Elaboró', 'Iván Morales Zepeda', 'Analista de Cuentas por Pagar', '24/09/2026'),
            firmado('Revisó', 'Rebeca Aguirre Lemus', 'Supervisora de Cuentas por Pagar', '24/09/2026'),
            firmado('Autorizó', 'Gustavo Peña Arriaga', 'Gerente de Compras', '25/09/2026')],
    anexos=[('A', 'Factura FAC-9930 (CFDI y PDF)', True), ('B', 'Orden de compra OC-77650', True), ('C', 'Recepción REC-40218', True)],
    caso='A', sev='Alta',
    datos='OC $1,180,000; factura $1,250,000; IVA escrito $195,000 (el correcto es $200,000).',
    problema='En Detalle, diferencia de $70,000 sin nota e IVA mal calculado.')

ap = [('FAC-8811', 'Servicios de mantenimiento a CEDIS, agosto', 940000), ('FAC-8815', 'Servicios de limpieza industrial, agosto', 760000),
      ('FAC-8820', 'Servicios de vigilancia, agosto', 600000)]
tot_ap = sum(a[2] for a in ap)
assert tot_ap == 2300000
doc(file='aud000002_autorizacion_pago_ap4471.pdf', aud='AUD-000002', unidad=U2,
    tipo='Autorización de pago', folio='AP-4471', fecha='15/09/2026', area='Tesorería',
    resp='Iván Morales Zepeda, Analista de Cuentas por Pagar', periodo='Corrida de pagos del 16/09/2026',
    politica='Política PAG-02 Autorización de pagos (2 firmas para pagos mayores a $ 1,000,000.00 MXN)',
    extra=[('Proveedor', 'Grupo Integral de Servicios Industriales, S.A. de C.V. (PRV-12091)'), ('Forma de pago', 'Transferencia SPEI')],
    cols=['Factura', 'Concepto', 'Importe'],
    widths=[80, 290, 142],
    rows=[[f, c, mxn(i)] for f, c, i in ap],
    total=['Total a pagar', '', mxn(tot_ap)],
    notas=['Monto de la autorización: ' + mxn(tot_ap) + '. Por la Política PAG-02 se requieren 2 firmas de autorización.'],
    obs=['Las tres facturas cuentan con validación de tres vías y recepción de servicio.'],
    firmas=[firmado('Elaboró', 'Iván Morales Zepeda', 'Analista de Cuentas por Pagar', '15/09/2026'),
            firmado('Revisó', 'Rebeca Aguirre Lemus', 'Supervisora de Cuentas por Pagar', '15/09/2026'),
            firmado('Autorizó (firma 1)', 'Rodrigo Cantú Elizondo', 'Gerente de Tesorería', '15/09/2026'),
            falta('Autorizó (firma 2)', 'Claudia Serrano Vidal', 'Directora de Finanzas', 'Sin firma')],
    cierre_notas=['Firmas de autorización requeridas: 2. Firmas recabadas: 1.'],
    anexos=[('A', 'Facturas FAC-8811, FAC-8815 y FAC-8820', True), ('B', 'Validaciones de tres vías', True)],
    caso='P', sev='Alta',
    datos='Pago de $2,300,000 MXN; la Política PAG-02 exige 2 firmas arriba de $1,000,000.',
    problema='En Cierre, solo hay una firma.')

conc = [('Cheques emitidos no cobrados', 9, 742300), ('Depósitos no identificados', 5, 542200)]
tot_conc = sum(c[2] for c in conc)
assert tot_conc == 1284500 and sum(c[1] for c in conc) == 14
doc(file='aud000002_conciliacion_bbva0123_ago2026.pdf', aud='AUD-000002', unidad=U2,
    tipo='Conciliación bancaria', folio='CB-0123-2026-08', fecha='10/09/2026', area='Tesorería',
    resp='Natalia Herrera Quiroga, Analista de Tesorería', periodo='01/08/2026 al 31/08/2026',
    politica='Política FIN-07 Conciliaciones bancarias',
    extra=[('Cuenta', 'BBVA terminación 0123 (MXN)'), ('Saldo según estado de cuenta', mxn(18452300)),
           ('Saldo según libros', mxn(17167800)), ('Diferencia', mxn(1284500))],
    cols=['Concepto', 'Número de partidas', 'Antigüedad', 'Importe'],
    widths=[190, 90, 100, 132],
    rows=[[c, n(p), 'Más de 90 días', mxn(i)] for c, p, i in conc],
    total=['Total de partidas en conciliación', n(14), '', mxn(tot_conc)],
    notas=['Saldo banco ' + mxn(18452300) + ' - saldo libros ' + mxn(17167800) + ' = ' + mxn(1284500) +
           '. La diferencia se integra por 14 partidas con antigüedad mayor a 90 días.'],
    obs=['Las 14 partidas mayores a 90 días se turnaron a Cuentas por Pagar y Crédito para su depuración en el cierre de septiembre.'],
    firmas=[firmado('Elaboró', 'Natalia Herrera Quiroga', 'Analista de Tesorería', '10/09/2026'),
            falta('Revisó', 'Rodrigo Cantú Elizondo', 'Gerente de Tesorería', 'Revisión pendiente'),
            firmado('Autorizó', 'Claudia Serrano Vidal', 'Directora de Finanzas', '12/09/2026')],
    anexos=[('A', 'Detalle de las 14 partidas en conciliación', False), ('B', 'Estado de cuenta BBVA de agosto 2026', True),
            ('C', 'Auxiliar contable de bancos', True)],
    caso='P', sev='Alta',
    datos='Igual al ejemplo 1, diferencia de $1,284,500 MXN y 14 partidas de más de 90 días.',
    problema='En Cierre, Revisó pendiente; Anexo A no adjunto.')

nc = [('Coca-Cola 600 ml (caja 24) con empaque dañado', 200, 150), ('Del Valle 1 L (caja 12) con empaque dañado', 100, 200)]
sub_nc = sum(c * p for _, c, p in nc)
assert sub_nc == 50000 and sub_nc * 116 // 100 == 58000
doc(file='aud000002_nota_credito_nc0315.pdf', aud='AUD-000002', unidad=U2,
    tipo='Nota de crédito', folio='NC-0315', fecha='08/09/2026', area='Cuentas por Cobrar',
    resp='Fernanda Quiroz Lara, Analista de Crédito y Cobranza', periodo='Septiembre 2026',
    politica='Procedimiento CXC-06 Emisión de notas de crédito por devolución',
    extra=[('Cliente', 'Distribuidora Comercial del Pacífico, S.A. de C.V. (CLI-30155)'), ('Factura relacionada', 'FAC-9876'),
           ('Motivo', 'Devolución de producto con empaque dañado')],
    cols=['Concepto', 'Cajas', 'Precio por caja', 'Importe'],
    widths=[230, 60, 100, 122],
    rows=[[c, n(q), mxn(p), mxn(q * p)] for c, q, p in nc] + [['Subtotal', '', '', mxn(50000)], ['IVA 16 %', '', '', mxn(8000)]],
    total=['Total de la nota de crédito', n(300), '', mxn(58000)],
    notas=['Devolución por ' + mxn(58000) + ' ligada a la factura FAC-9876.'],
    obs=['Sin excepciones. El producto devuelto ingresó al almacén con la entrada EA-5498.'],
    firmas=[firmado('Elaboró', 'Fernanda Quiroz Lara', 'Analista de Crédito y Cobranza', '08/09/2026'),
            firmado('Revisó', 'Rebeca Aguirre Lemus', 'Supervisora de Cuentas por Pagar', '08/09/2026'),
            firmado('Autorizó', 'Rodrigo Cantú Elizondo', 'Gerente de Tesorería', '09/09/2026')],
    anexos=[('A', 'Factura FAC-9876', True), ('B', 'Entrada de devolución EA-5498', True), ('C', 'CFDI de la nota de crédito', True)],
    caso='C', sev='-', datos='Devolución de $58,000 MXN ligada a la FAC-9876.', problema='')

cm = [('15/05/2026', 'FAC-2231', 220000, 'Sí'), ('14/06/2026', 'FAC-2298', 225000, 'Sí'), ('15/07/2026', 'FAC-2350', 230000, 'No'),
      ('31/07/2026', 'FAC-2377', 215000, 'No'), ('14/08/2026', 'FAC-2405', 240000, 'No'), ('29/08/2026', 'FAC-2439', 225000, 'No')]
fuera = sum(c[2] for c in cm if c[3] == 'No')
tot_cm = sum(c[2] for c in cm)
assert fuera == 910000 and tot_cm == 1355000
doc(file='aud000002_contrato_marco_cm2024_018.pdf', aud='AUD-000002', unidad=U2,
    tipo='Ficha de control de contrato marco', folio='CM-2024-018', fecha='04/09/2026', area='Jurídico y Compras',
    resp='Gustavo Peña Arriaga, Gerente de Compras', periodo='Pagos de mayo a agosto 2026',
    politica='Política COM-05 Contratos con proveedores',
    extra=[('Proveedor', 'Mantenimiento Industrial Integral del Centro, S.A. de C.V. (PRV-10584)'),
           ('Objeto', 'Mantenimiento preventivo de equipos de refrigeración'), ('Vigencia', '01/07/2024 al 30/06/2026')],
    cols=['Fecha de pago', 'Factura', 'Importe', 'Dentro de vigencia'],
    widths=[100, 100, 172, 140],
    rows=[[f, fa, mxn(i), v] for f, fa, i, v in cm],
    total=['Total pagado', '6 facturas', mxn(tot_cm), ''],
    notas=['Pagos de julio y agosto 2026 posteriores al término de la vigencia: ' + mxn(fuera) + '.'],
    obs=['Renovación del contrato pendiente; el proveedor continúa prestando el servicio después del 30/06/2026.'],
    firmas=[firmado('Elaboró', 'Mariela Fuentes Olvera', 'Compradora Senior', '04/09/2026'),
            firmado('Revisó', 'Alejandra Montiel Duarte', 'Abogada Corporativa', '04/09/2026'),
            firmado('Autorizó', 'Gustavo Peña Arriaga', 'Gerente de Compras', '05/09/2026')],
    anexos=[('A', 'Contrato marco CM-2024-018 firmado', True), ('B', 'Relación de facturas pagadas en 2026', True)],
    caso='P', sev='Alta',
    datos='La vigencia terminó el 30/06/2026; hay pagos de julio y agosto por $910,000 MXN.',
    problema='En Observaciones, renovación pendiente.')

spei = [('FAC-7702', 'Suministro de refacciones de refrigeración', 820000), ('FAC-7710', 'Suministro de compresores', 540000),
        ('FAC-7718', 'Suministro de gas refrigerante', 280000)]
tot_spei = sum(s[2] for s in spei)
assert tot_spei == 1640000
doc(file='aud000002_transferencia_spei_tf88120.pdf', aud='AUD-000002', unidad=U2,
    tipo='Comprobante de transferencia SPEI', folio='TF-88120', fecha='18/09/2026', area='Tesorería',
    resp='Natalia Herrera Quiroga, Analista de Tesorería', periodo='Pago del 18/09/2026',
    politica='Política PAG-04 Pagos electrónicos y cambio de datos bancarios',
    extra=[('Beneficiario', 'Refrigeración Comercial Andina, S.A. de C.V. (PRV-18744)'),
           ('CLABE registrada en el alta', '014 180 65501 2398 41 7'), ('CLABE destino de la transferencia', '646 180 15720 4466 03 9'),
           ('Clave de rastreo', 'FEMSA2026091888120')],
    cols=['Factura', 'Concepto', 'Importe'],
    widths=[80, 290, 142],
    rows=[[f, c, mxn(i)] for f, c, i in spei],
    total=['Total transferido', '', mxn(tot_spei)],
    notas=['Transferencia de ' + mxn(tot_spei) + ' a una CLABE distinta de la registrada en el alta del proveedor.'],
    obs=['La cuenta destino se cambió el 16/09/2026 a solicitud recibida por correo electrónico; cambio de cuenta sin validación con el proveedor.'],
    firmas=[firmado('Elaboró', 'Natalia Herrera Quiroga', 'Analista de Tesorería', '18/09/2026'),
            firmado('Revisó', 'Rodrigo Cantú Elizondo', 'Gerente de Tesorería', '18/09/2026'),
            firmado('Autorizó', 'Claudia Serrano Vidal', 'Directora de Finanzas', '18/09/2026')],
    anexos=[('A', 'Comprobante electrónico de pago (CEP) de Banxico', True), ('B', 'Facturas FAC-7702, FAC-7710 y FAC-7718', True),
            ('C', 'Carta del proveedor que solicita el cambio de cuenta', False)],
    caso='P', sev='Crítica',
    datos='$1,640,000 MXN a una CLABE distinta de la registrada en el alta.',
    problema='En Observaciones, cambio de cuenta sin validación; en Anexos, carta del proveedor no adjunta.')

# ====================================================================================
# AUD-000006 · Distribución KOF Brasil
# ====================================================================================
U6 = 'Coca-Cola FEMSA (KOF) Brasil · Distribución São Paulo'

cajas_r = [312, 298, 335, 341, 287, 305, 322, 316, 299, 344, 308, 290, 327, 333, 301, 296, 318, 339, 324, 306, 311, 297]
clientes_r = [41, 38, 44, 45, 37, 40, 42, 41, 39, 46, 40, 37, 43, 44, 39, 38, 42, 45, 43, 40, 41, 38]
doc(file='aud000006_bitacora_rutas_sp_ago2026.pdf', aud='AUD-000006', unidad=U6,
    tipo='Bitácora de rutas de distribución', folio='BR-SP-2026-08', fecha='01/09/2026', area='Despacho y Distribución',
    resp='Thiago Almeida Rocha, Supervisor de Despacho', periodo='01/08/2026 al 31/08/2026',
    politica='Procedimiento DIS-02 Liquidación y validación de rutas',
    extra=[('Centro de distribución', 'CD São Paulo Zona Norte'), ('Rutas registradas', '22')],
    cols=['Ruta', 'Unidad', 'Clientes atendidos', 'Cajas entregadas', 'Valor entregado'],
    widths=[60, 100, 100, 100, 152],
    rows=[[f'{i + 1:02d}', f'SP-{4100 + i + 1}', n(cl), n(c), brl(c * 38)] for i, (c, cl) in enumerate(zip(cajas_r, clientes_r))],
    total=['Total', '22 rutas', n(sum(clientes_r)), n(sum(cajas_r)), brl(sum(cajas_r) * 38)],
    notas=['Valor calculado a R$ 38.00 por caja promedio.'],
    obs=['Las 22 rutas se liquidaron sin diferencias de producto ni de cobranza.'],
    firmas=[firmado('Elaboró', 'Camila Souza Lima', 'Analista de Distribución', '01/09/2026'),
            firmado('Revisó', 'Thiago Almeida Rocha', 'Supervisor de Despacho', '01/09/2026'),
            firmado('Autorizó', 'Renata Carvalho Prado', 'Gerente de Distribución', '02/09/2026')],
    cierre_notas=['Firma del supervisor de despacho por ruta: 19 de 22 rutas firmadas. Faltan las firmas de las rutas 07, 13 y 19 (sin firma).'],
    anexos=[('A', 'Hojas de liquidación de las 22 rutas', True)],
    caso='P', sev='Baja',
    datos='22 rutas de São Paulo, 3 sin firma del supervisor de despacho.',
    problema='En Cierre, faltan las firmas de las rutas 07, 13 y 19.')

ce = [('Coca-Cola 2 L (caja 6)', 200, 38), ('Fanta Guaraná 2 L (caja 6)', 140, 38)]
assert sum(c[1] for c in ce) == 340 and sum(c[1] * c[2] for c in ce) == 12920
doc(file='aud000006_comprobante_entrega_ce5501.pdf', aud='AUD-000006', unidad=U6,
    tipo='Comprobante de entrega', folio='CE-5501', fecha='21/08/2026', area='Despacho y Distribución',
    resp='Lucas Pereira Santos, Motorista de Ruta 09', periodo='Entrega del 21/08/2026',
    politica='Procedimiento DIS-04 Entrega y comprobación con el cliente',
    extra=[('Cliente', 'Mercado Bom Preço Vila Maria Ltda. (CLI-BR-77310)'), ('Ruta', '09 · Unidad SP-4109'), ('Pedido', 'PED-55018')],
    cols=['Producto', 'Cajas', 'Precio por caja', 'Importe'],
    widths=[220, 70, 100, 122],
    rows=[[p, n(c), brl(pr), brl(c * pr)] for p, c, pr in ce],
    total=['Total', n(340), '', brl(12920)],
    notas=['Entrega completa de 340 cajas por ' + brl(12920) + ', recibida de conformidad por el cliente.'],
    obs=['Sin excepciones. Producto entregado sin daños y conforme al pedido PED-55018.'],
    firmas=[firmado('Elaboró', 'Lucas Pereira Santos', 'Motorista de Ruta 09', '21/08/2026'),
            firmado('Revisó', 'Thiago Almeida Rocha', 'Supervisor de Despacho', '21/08/2026'),
            firmado('Autorizó', 'Renata Carvalho Prado', 'Gerente de Distribución', '22/08/2026'),
            firmado('Recibió (cliente)', 'Marcos Oliveira Dias', 'Encargado de recepción del cliente', '21/08/2026')],
    anexos=[('A', 'Pedido PED-55018', True), ('B', 'Nota fiscal de venta NF-e 448812', True)],
    caso='C', sev='-', datos='340 cajas, R$ 12,920.00, con firma del cliente.', problema='')

doc(file='aud000006_devolucion_producto_dv0712.pdf', aud='AUD-000006', unidad=U6,
    tipo='Devolución de producto', folio='DV-0712', fecha='26/08/2026', area='Despacho y Distribución',
    resp='Thiago Almeida Rocha, Supervisor de Despacho', periodo='Devolución del 26/08/2026',
    politica='Procedimiento DIS-07 Devoluciones de clientes',
    extra=[('Cliente', 'Supermercado Estrela do Norte Ltda. (CLI-BR-70288)'), ('Motivo', 'Producto próximo a caducar')],
    cols=['Producto', 'Cajas', 'Precio por caja', 'Importe'],
    widths=[220, 70, 100, 122],
    rows=[['Coca-Cola 2 L (caja 6)', n(120), brl(38), brl(4650)]],
    total=['Total de la devolución', n(120), '', brl(4650)],
    notas=['Importe de la devolución: ' + brl(4650) + '.'],
    obs=['Producto reingresado al almacén para su revisión por Calidad.'],
    firmas=[firmado('Elaboró', 'Camila Souza Lima', 'Analista de Distribución', '26/08/2026'),
            firmado('Revisó', 'Thiago Almeida Rocha', 'Supervisor de Despacho', '26/08/2026'),
            firmado('Autorizó', 'Renata Carvalho Prado', 'Gerente de Distribución', '27/08/2026')],
    anexos=[('A', 'Nota fiscal de devolución', True), ('B', 'Registro de reingreso a almacén', True)],
    caso='A', sev='Baja',
    datos='120 cajas × R$ 38.00, escrito R$ 4,650.00 (el correcto es R$ 4,560.00).',
    problema='En Detalle, multiplicación incorrecta.')

comb = [('SP-4121', 8000, 2900), ('SP-4122', 8000, 2750), ('SP-4123', 8000, 2880), ('SP-4124', 8000, 2770), ('SP-4125', 8000, 2800)]
est_c, real_c = sum(c[1] / 4 for c in comb), sum(c[2] for c in comb)
assert (est_c, real_c) == (10000, 14100)
doc(file='aud000006_control_combustible_frota12.pdf', aud='AUD-000006', unidad=U6,
    tipo='Control de consumo de combustible', folio='CC-FROTA12-2026-08', fecha='03/09/2026', area='Flota y Mantenimiento',
    resp='Bruno Martins Ferreira, Coordinador de Flota', periodo='01/08/2026 al 31/08/2026',
    politica='Procedimiento FLT-03 Control de combustible (estándar 4.0 km por litro)',
    extra=[('Flota', 'Frota 12 · 5 camiones de reparto'), ('Precio promedio del diésel', brl(6.20) + ' por litro'),
           ('Cargas de combustible en el periodo', '15')],
    cols=['Unidad', 'Km recorridos', 'Litros estándar', 'Litros consumidos', 'Variación', 'Gasto'],
    widths=[70, 80, 85, 90, 77, 110],
    rows=[[u, n(km), n(km / 4), n(l), f'{(l / (km / 4) - 1) * 100:.1f} %', brl(l * 6.20)] for u, km, l in comb],
    total=['Total', n(40000), n(est_c), n(real_c), f'{(real_c / est_c - 1) * 100:.1f} %', brl(real_c * 6.20)],
    notas=['El consumo de la Frota 12 fue 41.0 % arriba del estándar (14,100 L contra 10,000 L).'],
    obs=['El exceso de consumo se registra sin justificación de rutas, cargas o fallas mecánicas.'],
    firmas=[firmado('Elaboró', 'Bruno Martins Ferreira', 'Coordinador de Flota', '03/09/2026'),
            firmado('Revisó', 'Thiago Almeida Rocha', 'Supervisor de Despacho', '03/09/2026'),
            firmado('Autorizó', 'Renata Carvalho Prado', 'Gerente de Distribución', '04/09/2026')],
    anexos=[('A', 'Tickets de carga de combustible: 4 de 15 adjuntos', True), ('B', 'Tickets de carga de combustible: 11 de 15 no adjuntos', False),
            ('C', 'Reporte de odómetros de agosto 2026', True)],
    caso='P', sev='Moderada',
    datos='Consumo 41 % arriba del estándar; solo 4 de 15 tickets.',
    problema='En Observaciones, sin justificación; en Anexos, 11 tickets no adjuntos.')

mf = [('SP-4121', 'FTR-2B41', '182,400', '01/06/2026', '01/08/2026', 45, 3850), ('SP-4122', 'FTR-2B42', '176,950', '15/07/2026', '15/09/2026', 0, 3850),
      ('SP-4123', 'FTR-2B43', '190,120', '01/06/2026', '01/08/2026', 45, 4120), ('SP-4124', 'FTR-2B44', '168,300', '20/07/2026', '20/09/2026', 0, 3850),
      ('SP-4125', 'FTR-2B45', '171,880', '28/07/2026', '28/09/2026', 0, 3850), ('SP-4126', 'FTR-2B46', '159,410', '05/08/2026', '05/10/2026', 0, 3850)]
doc(file='aud000006_mantenimiento_flota_mf221.pdf', aud='AUD-000006', unidad=U6,
    tipo='Orden de mantenimiento de flota', folio='MF-221', fecha='15/09/2026', area='Flota y Mantenimiento',
    resp='Bruno Martins Ferreira, Coordinador de Flota', periodo='Programa de servicio preventivo agosto - octubre 2026',
    politica='Procedimiento FLT-05 Mantenimiento preventivo (servicio cada 60 días)',
    extra=[('Taller', 'Oficina Mecânica Vila Guilherme Ltda.'), ('Unidades en la orden', '6')],
    cols=['Unidad', 'Placa', 'Km actuales', 'Último servicio', 'Próximo servicio', 'Días vencido', 'Costo estimado'],
    widths=[52, 60, 62, 78, 82, 60, 118],
    rows=[[u, p, k, a, b, str(d), brl(c)] for u, p, k, a, b, d, c in mf],
    total=['Total', '6 unidades', '', '', '', '', brl(sum(m[6] for m in mf))],
    notas=['Las unidades SP-4121 y SP-4123 tienen el servicio preventivo vencido desde el 01/08/2026 (45 días al 15/09/2026).'],
    obs=['Las 2 unidades con servicio vencido siguen operando en rutas de reparto.'],
    firmas=[firmado('Elaboró', 'Bruno Martins Ferreira', 'Coordinador de Flota', '15/09/2026'),
            firmado('Revisó', 'Thiago Almeida Rocha', 'Supervisor de Despacho', '15/09/2026'),
            firmado('Autorizó', 'Renata Carvalho Prado', 'Gerente de Distribución', '16/09/2026')],
    cierre_notas=['Estado de la orden MF-221: sin cierre. Fecha compromiso de atención: no se indicó.'],
    anexos=[('A', 'Programa de mantenimiento preventivo de la flota', True), ('B', 'Cotización del taller', True)],
    caso='P', sev='Moderada',
    datos='2 unidades con servicio preventivo vencido desde hace 45 días.',
    problema='En Cierre, orden sin cierre ni fecha compromiso.')

fr = [('Coca-Cola 2 L (caja 6)', 50, 38), ('Fanta Guaraná 2 L (caja 6)', 35, 38)]
assert sum(f[1] for f in fr) == 85 and sum(f[1] * f[2] for f in fr) == 3230
doc(file='aud000006_faltante_ruta_fr0098.pdf', aud='AUD-000006', unidad=U6,
    tipo='Reporte de faltante en ruta', folio='FR-0098', fecha='28/08/2026', area='Despacho y Distribución',
    resp='Por definir', periodo='Ruta 15 del 27/08/2026',
    politica='Procedimiento DIS-09 Faltantes y siniestros en ruta',
    extra=[('Ruta y unidad', 'Ruta 15 · Unidad SP-4115'), ('Fecha del hecho', '27/08/2026')],
    cols=['Producto', 'Cajas faltantes', 'Precio por caja', 'Importe'],
    widths=[220, 80, 100, 112],
    rows=[[p, n(c), brl(pr), brl(c * pr)] for p, c, pr in fr],
    total=['Total del faltante', n(85), '', brl(3230)],
    notas=['Faltante detectado en la liquidación de la ruta 15: 85 cajas por ' + brl(3230) + '.'],
    obs=['El motorista reportó que la carga se encontró incompleta al llegar al tercer cliente.'],
    firmas=[firmado('Elaboró', 'Camila Souza Lima', 'Analista de Distribución', '28/08/2026'),
            firmado('Revisó', 'Thiago Almeida Rocha', 'Supervisor de Despacho', '28/08/2026'),
            firmado('Autorizó', 'Renata Carvalho Prado', 'Gerente de Distribución', '29/08/2026')],
    anexos=[('A', 'Hoja de carga y liquidación de la ruta 15', True), ('B', 'Acta o denuncia (boletim de ocorrência)', False)],
    caso='P', sev='Alta',
    datos='85 cajas, R$ 3,230.00.',
    problema='En Datos generales, responsable "por definir"; en Anexos, acta o denuncia no adjunta.')

# ====================================================================================
# AUD-000007 · Prevención de lavado de dinero (Spin by OXXO)
# ====================================================================================
U7 = 'Spin by OXXO · Cumplimiento PLD/FT'

kyc = [('Depósitos en efectivo en tienda', 25000), ('Transferencias recibidas', 18000), ('Pagos de servicios', 4500)]
doc(file='aud000007_expediente_kyc_cl40921.pdf', aud='AUD-000007', unidad=U7,
    tipo='Expediente de identificación del cliente (KYC)', folio='KYC-CL-40921', fecha='10/09/2026', area='Cumplimiento PLD/FT',
    resp='Andrea Solís Bermúdez, Analista de Cumplimiento', periodo='Revisión periódica de septiembre 2026',
    politica='Manual PLD-01 Identificación y conocimiento del cliente',
    extra=[('Cliente', 'Persona física · Sergio Iván Treviño Mata (CL-40921)'), ('Nivel de riesgo', 'Medio'),
           ('Fecha de apertura de la cuenta', '14/02/2025')],
    cols=['Concepto del perfil transaccional', 'Monto mensual estimado'],
    widths=[300, 212],
    rows=[[c, mxn(i)] for c, i in kyc],
    total=['Total mensual estimado', mxn(sum(k[1] for k in kyc))],
    notas=['Identificación oficial: credencial para votar con vigencia al 15/03/2026 (vencida al momento de la revisión).',
           'Ocupación declarada: comerciante. Origen de los recursos: venta de abarrotes.'],
    obs=['La operación del cliente es consistente con el perfil transaccional declarado.'],
    firmas=[firmado('Elaboró', 'Andrea Solís Bermúdez', 'Analista de Cumplimiento', '10/09/2026'),
            firmado('Revisó', 'Diego Rentería Campos', 'Supervisor de Cumplimiento', '11/09/2026'),
            firmado('Autorizó', 'Mónica Esquivel Bravo', 'Oficial de Cumplimiento', '11/09/2026')],
    anexos=[('A', 'Identificación oficial', True), ('B', 'Comprobante de domicilio', False), ('C', 'Contrato de apertura firmado', True)],
    caso='P', sev='Alta',
    datos='Cliente persona física ficticio, riesgo Medio.',
    problema='En Anexos, comprobante de domicilio no adjunto; en Detalle, identificación vencida el 15/03/2026.')

al = [('29/07/2026', 'Depósito en efectivo en tienda 3021', 98000), ('30/07/2026', 'Depósito en efectivo en tienda 3021', 92500),
      ('31/07/2026', 'Depósito en efectivo en tienda 3044', 96000), ('01/08/2026', 'Depósito en efectivo en tienda 3021', 93500)]
assert sum(a[2] for a in al) == 380000
doc(file='aud000007_alerta_operacion_inusual_al1180.pdf', aud='AUD-000007', unidad=U7,
    tipo='Alerta de operación inusual', folio='AL-1180', fecha='29/08/2026', area='Monitoreo Transaccional',
    resp='Diego Rentería Campos, Supervisor de Cumplimiento', periodo='Operaciones del 29/07/2026 al 01/08/2026',
    politica='Manual PLD-03 Análisis de alertas (plazo de 10 días para el análisis)',
    extra=[('Cliente', 'Persona física · Elena Patricia Ruelas Cano (CL-52207)'), ('Fecha de generación de la alerta', '02/08/2026'),
           ('Fecha de análisis', '29/08/2026'), ('Regla detonante', 'R-07 Depósitos en efectivo fuera de perfil')],
    cols=['Fecha', 'Operación', 'Importe'],
    widths=[90, 280, 142],
    rows=[[f, o, mxn(i)] for f, o, i in al],
    total=['Total', '4 operaciones', mxn(380000)],
    notas=['El perfil declarado del cliente es de ' + mxn(30000) + ' mensuales.'],
    obs=['Dictamen de la alerta pendiente (reportar o descartar como operación inusual).'],
    firmas=[firmado('Elaboró', 'Andrea Solís Bermúdez', 'Analista de Cumplimiento', '29/08/2026'),
            firmado('Revisó', 'Diego Rentería Campos', 'Supervisor de Cumplimiento', '29/08/2026'),
            firmado('Autorizó', 'Mónica Esquivel Bravo', 'Oficial de Cumplimiento', '30/08/2026')],
    anexos=[('A', 'Estado de cuenta del cliente de julio y agosto 2026', True), ('B', 'Expediente KYC del cliente', True)],
    caso='P', sev='Alta',
    datos='Alerta del 02/08/2026 analizada el 29/08/2026 (el plazo es de 10 días), $380,000 MXN.',
    problema='En Observaciones, dictamen pendiente.')

ro = [('05/07/2026', 'CL-31877', 'Depósito en efectivo', 152000), ('19/08/2026', 'CL-44120', 'Depósito en efectivo', 168500),
      ('11/09/2026', 'CL-38056', 'Depósito en efectivo', 141300)]
doc(file='aud000007_reporte_uif_ro0042.pdf', aud='AUD-000007', unidad=U7,
    tipo='Reporte de operaciones relevantes a la UIF', folio='RO-0042', fecha='08/10/2026', area='Cumplimiento PLD/FT',
    resp='Mónica Esquivel Bravo, Oficial de Cumplimiento', periodo='Tercer trimestre 2026 (01/07/2026 al 30/09/2026)',
    politica='Manual PLD-05 Reportes regulatorios',
    extra=[('Fecha límite de presentación', '14/10/2026'), ('Fecha de presentación', '08/10/2026'),
           ('Acuse de recibo', 'UIF-ACU-2026-0042-77815')],
    cols=['Fecha', 'Cliente', 'Tipo de operación', 'Importe'],
    widths=[80, 90, 200, 142],
    rows=[[f, c, t, mxn(i)] for f, c, t, i in ro],
    total=['Total', '3 operaciones', '', mxn(sum(r[3] for r in ro))],
    notas=['Reporte presentado en tiempo, 6 días antes de la fecha límite, con acuse de recibo.'],
    obs=['Sin excepciones. Las 3 operaciones relevantes del trimestre se incluyeron en el reporte.'],
    firmas=[firmado('Elaboró', 'Andrea Solís Bermúdez', 'Analista de Cumplimiento', '07/10/2026'),
            firmado('Revisó', 'Diego Rentería Campos', 'Supervisor de Cumplimiento', '07/10/2026'),
            firmado('Autorizó', 'Mónica Esquivel Bravo', 'Oficial de Cumplimiento', '08/10/2026')],
    anexos=[('A', 'Archivo del reporte enviado', True), ('B', 'Acuse de recibo de la UIF', True)],
    caso='C', sev='-', datos='Reporte de operación relevante, presentado en tiempo y con acuse.', problema='')

mr = [('C-101', 10, 15, 10, None, None), ('C-107', 20, 15, 15, None, None), ('C-112', 15, 25, 20, None, None),
      ('C-118', 25, 30, 20, 65, 'Medio'), ('C-123', 30, 25, 20, None, None), ('C-129', 10, 10, 15, None, None)]


def nivel(p):
    return 'Alto' if p >= 70 else 'Medio' if p >= 40 else 'Bajo'


filas_mr = []
for c, g, pr, t, esc, niv in mr:
    p = esc if esc is not None else g + pr + t
    filas_mr.append([c, str(g), str(pr), str(t), str(p), niv or nivel(p)])
assert 25 + 30 + 20 == 75
niveles = [f[5] for f in filas_mr]
doc(file='aud000007_matriz_riesgo_clientes_q3.pdf', aud='AUD-000007', unidad=U7,
    tipo='Matriz de riesgo de clientes', folio='MRC-2026-Q3', fecha='02/10/2026', area='Cumplimiento PLD/FT',
    resp='Diego Rentería Campos, Supervisor de Cumplimiento', periodo='Tercer trimestre 2026',
    politica='Metodología PLD-02 Evaluación de riesgo de clientes',
    extra=[('Escala', 'Bajo: menos de 40 puntos · Medio: 40 a 69 puntos · Alto: 70 puntos o más'),
           ('Factores', 'Geográfico + producto/canal + transaccionalidad')],
    cols=['Cliente', 'Geográfico', 'Producto/canal', 'Transaccionalidad', 'Puntaje total', 'Nivel de riesgo'],
    widths=[58, 65, 80, 92, 77, 140],
    rows=filas_mr,
    total=['Total', '6 clientes', '', '', '', f'Alto {niveles.count("Alto")} · Medio {niveles.count("Medio")} · Bajo {niveles.count("Bajo")}'],
    notas=['Los clientes de riesgo Alto se someten a debida diligencia reforzada.'],
    obs=['Sin cambios de metodología respecto al trimestre anterior.'],
    firmas=[firmado('Elaboró', 'Andrea Solís Bermúdez', 'Analista de Cumplimiento', '02/10/2026'),
            firmado('Revisó', 'Diego Rentería Campos', 'Supervisor de Cumplimiento', '02/10/2026'),
            firmado('Autorizó', 'Mónica Esquivel Bravo', 'Oficial de Cumplimiento', '03/10/2026')],
    anexos=[('A', 'Metodología PLD-02 vigente', True), ('B', 'Base de clientes evaluados', True)],
    caso='A', sev='Alta',
    datos='Cliente C-118 con 25 + 30 + 20 = 75 puntos (Alto a partir de 70), pero escrito 65 y "Medio".',
    problema='En Detalle, suma y clasificación incorrectas.')

cap = [('Operaciones', 50, 44), ('Atención a clientes', 30, 26), ('Tecnología', 20, 14), ('Finanzas', 12, 10), ('Cumplimiento', 8, 8)]
assert sum(c[1] for c in cap) == 120 and sum(c[2] for c in cap) == 102
doc(file='aud000007_capacitacion_pld_2026.pdf', aud='AUD-000007', unidad=U7,
    tipo='Reporte de capacitación PLD/FT', folio='CAP-PLD-2026', fecha='30/09/2026', area='Cumplimiento PLD/FT',
    resp='Mónica Esquivel Bravo, Oficial de Cumplimiento', periodo='01/01/2026 al 30/09/2026',
    politica='Manual PLD-06 Programa anual de capacitación',
    extra=[('Curso', 'Prevención de lavado de dinero y financiamiento al terrorismo 2026 (4 horas)'), ('Modalidad', 'En línea con evaluación')],
    cols=['Área', 'Colaboradores', 'Capacitados', 'Sin capacitar', 'Avance'],
    widths=[150, 90, 90, 90, 92],
    rows=[[a, n(t), n(c), n(t - c), f'{c / t * 100:.1f} %'] for a, t, c in cap],
    total=['Total', n(120), n(102), n(18), f'{102 / 120 * 100:.1f} %'],
    notas=['Colaboradores capacitados: 102 de 120.'],
    obs=['18 colaboradores pendientes de capacitación (Operaciones, Atención a clientes, Tecnología y Finanzas).'],
    firmas=[firmado('Elaboró', 'Andrea Solís Bermúdez', 'Analista de Cumplimiento', '30/09/2026'),
            firmado('Revisó', 'Diego Rentería Campos', 'Supervisor de Cumplimiento', '30/09/2026'),
            firmado('Autorizó', 'Mónica Esquivel Bravo', 'Oficial de Cumplimiento', '30/09/2026')],
    anexos=[('A', 'Lista de asistencia y calificaciones', True), ('B', 'Constancias de capacitación', False)],
    caso='P', sev='Moderada',
    datos='102 de 120 colaboradores capacitados.',
    problema='En Observaciones, 18 pendientes; en Anexos, constancias no adjuntas.')

lr = [('Lista de Personas Bloqueadas (UIF)', 0, 0), ('Lista consolidada del Consejo de Seguridad de la ONU', 0, 1),
      ('Lista SDN de la OFAC', 0, 0), ('Personas políticamente expuestas nacionales', 0, 0)]
doc(file='aud000007_revision_listas_restringidas_lr0907.pdf', aud='AUD-000007', unidad=U7,
    tipo='Revisión de listas restringidas', folio='LR-0907', fecha='07/09/2026', area='Cumplimiento PLD/FT',
    resp='Diego Rentería Campos, Supervisor de Cumplimiento', periodo='Cartera de clientes al 31/08/2026',
    politica='Manual PLD-04 Consulta de listas restringidas',
    extra=[('Clientes revisados', '48,230'), ('Herramienta', 'Motor de coincidencias de nombres, umbral de similitud 85 %')],
    cols=['Lista consultada', 'Registros revisados', 'Coincidencias exactas', 'Coincidencias parciales'],
    widths=[212, 100, 100, 100],
    rows=[[l, n(48230), str(e), str(p)] for l, e, p in lr],
    total=['Total', n(48230 * 4), '0', '1'],
    notas=['Coincidencia parcial: cliente CL-61904 "Ramiro Esteban Quintanilla Ozuna" contra el registro "Ramiro E. Quintanilla Osuna" de la lista internacional (similitud de 88 %).'],
    obs=['La resolución de la coincidencia parcial no está documentada.'],
    firmas=[firmado('Elaboró', 'Andrea Solís Bermúdez', 'Analista de Cumplimiento', '07/09/2026'),
            firmado('Revisó', 'Diego Rentería Campos', 'Supervisor de Cumplimiento', '07/09/2026'),
            falta('Autorizó', 'Mónica Esquivel Bravo', 'Oficial de Cumplimiento', 'Sin firma')],
    anexos=[('A', 'Reporte del motor de coincidencias', True), ('B', 'Expediente KYC del cliente CL-61904', True)],
    caso='P', sev='Crítica',
    datos='Coincidencia parcial con una lista internacional (nombre ficticio).',
    problema='En Observaciones, resolución no documentada; en Cierre, oficial de cumplimiento sin firma.')

bm = [('01/09 al 07/09', 7, 61240, 1), ('08/09 al 14/09', 7, 63110, 1), ('15/09 al 21/09', 7, 62880, 1), ('22/09 al 28/09', 7, 64015, 1),
      ('29/09 al 30/09', 2, 18320, 0)]
assert sum(b[1] for b in bm) == 30 and sum(b[3] for b in bm) == 4
doc(file='aud000007_bitacora_monitoreo_sep2026.pdf', aud='AUD-000007', unidad=U7,
    tipo='Bitácora de monitoreo transaccional', folio='BM-2026-09', fecha='01/10/2026', area='Monitoreo Transaccional',
    resp='Diego Rentería Campos, Supervisor de Cumplimiento', periodo='01/09/2026 al 30/09/2026',
    politica='Manual PLD-03 Análisis de alertas (plazo de 10 días para el análisis)',
    extra=[('Alertas atendidas', 'AL-1231 (2 días), AL-1236 (3 días), AL-1244 (4 días) y AL-1252 (2 días)')],
    cols=['Semana', 'Días registrados', 'Operaciones monitoreadas', 'Alertas generadas', 'Alertas atendidas en plazo'],
    widths=[100, 80, 120, 90, 122],
    rows=[[s, str(d), n(o), str(a), str(a)] for s, d, o, a in bm],
    total=['Total', '30', n(sum(b[2] for b in bm)), '4', '4'],
    notas=['Se registraron los 30 días del mes; las 4 alertas se atendieron dentro del plazo de 10 días.'],
    obs=['Sin excepciones. Ninguna alerta derivó en reporte de operación inusual.'],
    firmas=[firmado('Elaboró', 'Andrea Solís Bermúdez', 'Analista de Cumplimiento', '01/10/2026'),
            firmado('Revisó', 'Diego Rentería Campos', 'Supervisor de Cumplimiento', '01/10/2026'),
            firmado('Autorizó', 'Mónica Esquivel Bravo', 'Oficial de Cumplimiento', '02/10/2026')],
    anexos=[('A', 'Reporte diario del sistema de monitoreo', True), ('B', 'Dictámenes de las alertas AL-1231, AL-1236, AL-1244 y AL-1252', True)],
    caso='C', sev='-', datos='30 días registrados, 4 alertas atendidas en plazo.', problema='')

# ====================================================================================
# AUD-000008 · Manejo de efectivo en tiendas (OXXO México)
# ====================================================================================
U8 = 'OXXO México · Plaza Monterrey'

corte = [(1000, 12), (500, 30), (200, 45), (100, 52), (50, 48), (20, 55)]
monedas = 550
suma_corte = sum(d * c for d, c in corte) + monedas
assert suma_corte == 45250
doc(file='aud000008_corte_caja_tienda1842_0913.pdf', aud='AUD-000008', unidad=U8,
    tipo='Corte de caja', folio='CC-1842-260913', fecha='13/09/2026', area='Operación de Tienda',
    resp='Ana López García, Responsable de Tienda 1842', periodo='Turno vespertino del 13/09/2026',
    politica='Política POL-EFE-04 Manejo de efectivo en tienda',
    extra=[('Tienda', '1842 · Monterrey'), ('Caja', 'Caja principal'), ('Venta en efectivo según POS', mxn(46600))],
    cols=['Denominación', 'Piezas', 'Importe'],
    widths=[200, 120, 192],
    rows=[[mxn(d), n(c), mxn(d * c)] for d, c in corte] + [['Monedas', '-', mxn(monedas)]],
    total=['Total declarado', '', mxn(46600)],
    notas=['Total declarado en el corte: ' + mxn(46600) + '.'],
    obs=['El total declarado coincide con la venta en efectivo registrada en el POS.'],
    firmas=[firmado('Elaboró', 'Jesús Garza Leal', 'Cajero', '13/09/2026'),
            firmado('Revisó', 'Ana López García', 'Responsable de Tienda 1842', '13/09/2026'),
            firmado('Autorizó', 'Carlos Méndez Ruiz', 'Supervisor de Operaciones', '14/09/2026')],
    anexos=[('A', 'Reporte de cierre del POS', True), ('B', 'Ficha de depósito del turno', True)],
    caso='A', sev='Moderada',
    datos='Las denominaciones suman $45,250 MXN; total declarado $46,600 MXN.',
    problema='En Detalle, faltante de $1,350 no explicado.')

dep = [(1000, 20), (500, 80), (200, 100), (100, 60), (50, 40), (20, 20)]
assert sum(d * c for d, c in dep) == 88400
doc(file='aud000008_deposito_banco_dp33019.pdf', aud='AUD-000008', unidad=U8,
    tipo='Depósito bancario', folio='DP-33019', fecha='15/09/2026', area='Tesorería de Plaza',
    resp='Ana López García, Responsable de Tienda 1842', periodo='Venta del 14/09/2026',
    politica='Política POL-EFE-04 Manejo de efectivo en tienda',
    extra=[('Banco y cuenta', 'Banorte terminación 4471'), ('Referencia', '1842-260914'), ('Sello del banco', 'Sucursal 0219 Monterrey Centro, 15/09/2026 10:42')],
    cols=['Denominación', 'Piezas', 'Importe'],
    widths=[200, 120, 192],
    rows=[[mxn(d), n(c), mxn(d * c)] for d, c in dep],
    total=['Total depositado', '', mxn(88400)],
    notas=['El importe depositado coincide con la ficha sellada por el banco y con la venta del 14/09/2026.'],
    obs=['Sin excepciones.'],
    firmas=[firmado('Elaboró', 'Ana López García', 'Responsable de Tienda 1842', '15/09/2026'),
            firmado('Revisó', 'Carlos Méndez Ruiz', 'Supervisor de Operaciones', '15/09/2026'),
            firmado('Autorizó', 'Beatriz Ochoa Salazar', 'Gerente de Tesorería de Plaza', '16/09/2026')],
    anexos=[('A', 'Ficha de depósito con sello del banco', True), ('B', 'Reporte de venta del POS', True)],
    caso='C', sev='-', datos='$88,400 MXN, ficha con sello del banco.', problema='')

rv = [('1', 'Tienda 1842', 'SV-552301', 48500), ('2', 'Tienda 2210', 'No se indicó', 41300), ('3', 'Tienda 2675', 'SV-552303', 42200)]
assert sum(r[3] for r in rv) == 132000
doc(file='aud000008_recoleccion_valores_rv7712.pdf', aud='AUD-000008', unidad=U8,
    tipo='Recolección de valores', folio='RV-7712', fecha='16/09/2026', area='Tesorería de Plaza',
    resp='Beatriz Ochoa Salazar, Gerente de Tesorería de Plaza', periodo='Recolección del 16/09/2026',
    politica='Política POL-EFE-06 Traslado de valores',
    extra=[('Empresa de traslado', 'Custodia y Valores del Norte, S.A. de C.V.'), ('Unidad blindada', 'CVN-118')],
    cols=['Bolsa', 'Origen', 'Número de sello', 'Importe'],
    widths=[60, 150, 140, 162],
    rows=[[b, o, s, mxn(i)] for b, o, s, i in rv],
    total=['Total', '3 bolsas', '', mxn(132000)],
    notas=['Total recolectado: ' + mxn(132000) + ' en 3 bolsas.'],
    obs=['Las 3 bolsas se entregaron íntegras en la bóveda del banco.'],
    firmas=[firmado('Elaboró', 'Ana López García', 'Responsable de Tienda 1842', '16/09/2026'),
            firmado('Revisó', 'Carlos Méndez Ruiz', 'Supervisor de Operaciones', '16/09/2026'),
            firmado('Autorizó', 'Beatriz Ochoa Salazar', 'Gerente de Tesorería de Plaza', '16/09/2026'),
            falta('Custodio', 'Raúl Estrada Cepeda', 'Custodio de la empresa de traslado', 'Sin firma')],
    anexos=[('A', 'Remisión de la empresa de traslado', True), ('B', 'Comprobante de recepción en bóveda', True)],
    caso='P', sev='Alta',
    datos='3 bolsas, $132,000 MXN.',
    problema='En Detalle, una bolsa sin número de sello; en Cierre, custodio sin firma.')

ff = [(500, 4), (200, 5), (100, 8), (50, 6), (20, 10)]
ef_ff = sum(d * c for d, c in ff) + 200
assert ef_ff + 500 == 5000
doc(file='aud000008_fondo_fijo_tienda2210.pdf', aud='AUD-000008', unidad=U8,
    tipo='Arqueo de fondo fijo', folio='AFF-2210-0917', fecha='17/09/2026', area='Operación de Tienda',
    resp='Lorena Castillo Peña, Responsable de Tienda 2210', periodo='Arqueo del 17/09/2026',
    politica='Política POL-EFE-05 Fondos fijos de tienda',
    extra=[('Tienda', '2210 · San Nicolás de los Garza'), ('Fondo autorizado', mxn(5000))],
    cols=['Concepto', 'Piezas', 'Importe'],
    widths=[240, 100, 172],
    rows=[[f'Billetes de {mxn(d)}', n(c), mxn(d * c)] for d, c in ff] +
         [['Monedas', '-', mxn(200)], ['Comprobantes de gastos autorizados (2 vales)', '2', mxn(500)]],
    total=['Total arqueado', '', mxn(5000)],
    notas=['Fondo autorizado ' + mxn(5000) + ' - total arqueado ' + mxn(5000) + ' = ' + mxn(0) + '. El fondo cuadra exacto.'],
    obs=['Sin excepciones.'],
    firmas=[firmado('Elaboró', 'Lorena Castillo Peña', 'Responsable de Tienda 2210', '17/09/2026'),
            firmado('Revisó', 'Carlos Méndez Ruiz', 'Supervisor de Operaciones', '17/09/2026'),
            firmado('Autorizó', 'Beatriz Ochoa Salazar', 'Gerente de Tesorería de Plaza', '18/09/2026')],
    anexos=[('A', 'Cédula de conteo por denominación', True), ('B', 'Vales de gastos autorizados', True)],
    caso='C', sev='-', datos='Fondo de $5,000 MXN, cuadra exacto.', problema='')

doc(file='aud000008_faltante_caja_fc0451.pdf', aud='AUD-000008', unidad=U8,
    tipo='Reporte de faltante de caja', folio='FC-0451', fecha='19/09/2026', area='Operación de Tienda',
    resp='Ana López García, Responsable de Tienda 1842', periodo='Turno nocturno del 18/09/2026',
    politica='Política POL-EFE-07 Faltantes y sobrantes de caja',
    extra=[('Tienda', '1842 · Monterrey'), ('Cajero del turno', 'Jesús Garza Leal')],
    cols=['Concepto', 'Importe'],
    widths=[300, 212],
    rows=[['Saldo esperado según POS', mxn(62450)], ['Efectivo contado', mxn(53750)]],
    total=['Faltante', mxn(8700)],
    notas=['Faltante de caja de ' + mxn(8700) + ' en el turno nocturno.'],
    obs=['El faltante se detectó en el arqueo de cambio de turno a las 07:00.'],
    firmas=[firmado('Elaboró', 'Ana López García', 'Responsable de Tienda 1842', '19/09/2026'),
            firmado('Revisó', 'Carlos Méndez Ruiz', 'Supervisor de Operaciones', '19/09/2026'),
            falta('Autorizó', 'Ernesto Valdez Ríos', 'Gerente de Plaza', 'Sin firma')],
    cierre_notas=['Se aplicó un descuento de ' + mxn(8700) + ' en nómina al cajero Jesús Garza Leal sin autorización del Gerente de Plaza ni de Recursos Humanos.'],
    anexos=[('A', 'Reporte de cierre del POS', True), ('B', 'Acta administrativa del faltante', False)],
    caso='P', sev='Alta',
    datos='Faltante de $8,700 MXN.',
    problema='En Anexos, acta administrativa no adjunta; en Cierre, descuento al empleado sin autorización.')

cf = [('02/09/2026', '07:15', 'Ana López García', 'Dotación de cambio', 3000), ('04/09/2026', '21:30', 'Jesús Garza Leal', 'Resguardo de excedente', 12000),
      ('06/09/2026', '02:10', 'Jesús Garza Leal', 'Resguardo de excedente', 9500), ('09/09/2026', '08:05', 'Ana López García', 'Entrega a traslado de valores', 25000),
      ('12/09/2026', '03:45', 'Jesús Garza Leal', 'Retiro de cambio', 2000), ('15/09/2026', '20:40', 'Ana López García', 'Resguardo de excedente', 11000),
      ('17/09/2026', '23:50', 'Jesús Garza Leal', 'Resguardo de excedente', 8500), ('20/09/2026', '09:20', 'Ana López García', 'Entrega a traslado de valores', 28000),
      ('23/09/2026', '01:20', 'Jesús Garza Leal', 'Retiro de cambio', 1500), ('26/09/2026', '07:40', 'Ana López García', 'Dotación de cambio', 3000),
      ('28/09/2026', '19:10', 'Ana López García', 'Resguardo de excedente', 10500), ('30/09/2026', '08:30', 'Ana López García', 'Entrega a traslado de valores', 24000)]
fuera_h = [c[1] for c in cf if not ('06:00' <= c[1] <= '22:00')]
assert fuera_h == ['02:10', '03:45', '23:50', '01:20']
doc(file='aud000008_bitacora_caja_fuerte_sep2026.pdf', aud='AUD-000008', unidad=U8,
    tipo='Bitácora de caja fuerte', folio='BCF-1842-2026-09', fecha='01/10/2026', area='Operación de Tienda',
    resp='Ana López García, Responsable de Tienda 1842', periodo='01/09/2026 al 30/09/2026',
    politica='Política POL-EFE-08 Caja fuerte (aperturas de 06:00 a 22:00; fuera de horario requieren autorización del supervisor)',
    extra=[('Tienda', '1842 · Monterrey'), ('Aperturas registradas', str(len(cf)))],
    cols=['Fecha', 'Hora', 'Usuario', 'Motivo', 'Importe'],
    widths=[70, 45, 120, 150, 127],
    rows=[[f, h, u, m, mxn(i)] for f, h, u, m, i in cf],
    total=['Total', f'{len(cf)} aperturas', '', '', mxn(sum(c[4] for c in cf))],
    notas=['Aperturas fuera del horario de 06:00 a 22:00: 4 (02:10, 03:45, 23:50 y 01:20).'],
    obs=['Las 4 aperturas fuera de horario quedaron sin autorización registrada; autorización del supervisor: no se indicó.'],
    firmas=[firmado('Elaboró', 'Ana López García', 'Responsable de Tienda 1842', '01/10/2026'),
            firmado('Revisó', 'Carlos Méndez Ruiz', 'Supervisor de Operaciones', '01/10/2026'),
            firmado('Autorizó', 'Ernesto Valdez Ríos', 'Gerente de Plaza', '02/10/2026')],
    anexos=[('A', 'Registro electrónico de la cerradura de la caja fuerte', True)],
    caso='P', sev='Alta',
    datos='4 aperturas fuera de horario (02:10, 03:45, 23:50 y 01:20).',
    problema='En Observaciones, sin autorización registrada.')

# ====================================================================================
# AUD-000011 · Residuos y reporte ESG (OXXO México)
# ====================================================================================
U11 = 'OXXO México · Sustentabilidad y Medio Ambiente'

doc(file='aud000011_manifiesto_residuos_mr2290.pdf', aud='AUD-000011', unidad=U11,
    tipo='Manifiesto de residuos peligrosos', folio='MR-2290', fecha='12/09/2026', area='Medio Ambiente',
    resp='Rosa Elena Ibarra Treviño, Coordinadora Ambiental', periodo='Embarque del 12/09/2026',
    politica='Procedimiento AMB-03 Manejo de residuos peligrosos',
    extra=[('Generador', 'CEDIS Monterrey y CEDIS Guadalupe (NRA ficticio GEN-NL-0457)'),
           ('Transportista', 'Ecotransportes Regiomontanos, S.A. de C.V.'),
           ('Número de autorización ambiental del transportista', 'No se indicó'),
           ('Destino final', 'Regeneradora de Aceites del Norte, S.A. de C.V. (autorización 19-IV-41-24)')],
    cols=['Residuo', 'Origen', 'Contenedores', 'Cantidad (kg)'],
    widths=[180, 130, 90, 112],
    rows=[['Aceite lubricante usado', 'CEDIS Monterrey', '5 tambos', n(1050)], ['Aceite lubricante usado', 'CEDIS Guadalupe', '4 tambos', n(750)]],
    total=['Total', '', '9 tambos', n(1800)],
    notas=['Cantidad total manifestada: 1,800 kg (1.8 toneladas) de aceite usado.'],
    obs=['Los tambos se entregaron etiquetados y cerrados.'],
    firmas=[firmado('Elaboró', 'Rosa Elena Ibarra Treviño', 'Coordinadora Ambiental', '12/09/2026'),
            firmado('Revisó', 'Javier Leal Cavazos', 'Jefe de Mantenimiento CEDIS', '12/09/2026'),
            firmado('Autorizó', 'Patricia Garza Zambrano', 'Gerente de Sustentabilidad', '12/09/2026'),
            falta('Recepción en destino final', 'Responsable de recepción', 'Regeneradora de Aceites del Norte', 'Sin firma')],
    anexos=[('A', 'Etiquetas de los tambos', True), ('B', 'Registro de generación del mes', True)],
    caso='P', sev='Alta',
    datos='1.8 toneladas de aceite usado.',
    problema='En Datos generales, falta el número de autorización ambiental del transportista; en Cierre, recepción en destino final sin firma.')

rec = [('Cartón', 12400, 'Recicladora de Fibras del Norte'), ('PET', 3150, 'Recicladora PET Monterrey'), ('Aluminio', 860, 'Metales Reciclables de Nuevo León')]
assert sum(r[1] for r in rec) == 16410
doc(file='aud000011_bitacora_reciclaje_ago2026.pdf', aud='AUD-000011', unidad=U11,
    tipo='Bitácora de reciclaje', folio='BRC-2026-08', fecha='04/09/2026', area='Medio Ambiente',
    resp='Rosa Elena Ibarra Treviño, Coordinadora Ambiental', periodo='01/08/2026 al 31/08/2026',
    politica='Procedimiento ESG-02 Indicadores de residuos',
    extra=[('Alcance', 'CEDIS Monterrey y 180 tiendas de la plaza'), ('Residuos totales generados en el mes', '21,000 kg')],
    cols=['Material', 'Kilogramos reciclados', 'Recicladora'],
    widths=[120, 140, 252],
    rows=[[m, n(k), r] for m, k, r in rec],
    total=['Total reciclado', n(15900), ''],
    notas=['Indicador ESG de valorización: 15,900 kg reciclados / 21,000 kg generados = 75.7 %.'],
    obs=['El indicador se reportará en el tablero ESG mensual.'],
    firmas=[firmado('Elaboró', 'Rosa Elena Ibarra Treviño', 'Coordinadora Ambiental', '04/09/2026'),
            firmado('Revisó', 'Javier Leal Cavazos', 'Jefe de Mantenimiento CEDIS', '04/09/2026'),
            firmado('Autorizó', 'Patricia Garza Zambrano', 'Gerente de Sustentabilidad', '05/09/2026')],
    anexos=[('A', 'Boletas de báscula de las recicladoras', True), ('B', 'Comprobantes de entrega de material', True)],
    caso='A', sev='Moderada',
    datos='Cartón 12,400 + PET 3,150 + aluminio 860 kg, escrito 15,900 (el correcto es 16,410).',
    problema='En Detalle, suma incorrecta que afecta el indicador ESG.')

doc(file='aud000011_reporte_esg_septiembre.pdf', aud='AUD-000011', unidad=U11,
    tipo='Reporte ESG mensual', folio='ESG-2026-09', fecha='08/10/2026', area='Sustentabilidad',
    resp='Patricia Garza Zambrano, Gerente de Sustentabilidad', periodo='01/09/2026 al 30/09/2026',
    politica='Procedimiento ESG-01 Reporte de indicadores ambientales',
    extra=[('Alcance', 'CEDIS Monterrey y 180 tiendas de la plaza')],
    cols=['Indicador', 'Valor', 'Fuente'],
    widths=[180, 110, 222],
    rows=[['Consumo de energía eléctrica', '2,412,600 kWh', 'Recibos de CFE y lecturas de medidor'],
          ['Consumo de agua', '18,640 m3', 'Recibos del organismo operador de agua'],
          ['Residuos valorizados', '16,820 kg', 'Boletas de báscula de recicladoras'],
          ['Residuos enviados a relleno sanitario', '4,180 kg', 'Manifiestos del recolector autorizado']],
    total=['Total de residuos generados', '21,000 kg', 'Suma de residuos valorizados y enviados a relleno'],
    notas=['Indicador de valorización de residuos: 16,820 kg / 21,000 kg = 80.1 %.'],
    obs=['Sin excepciones. Todos los indicadores cuentan con su fuente documental.'],
    firmas=[firmado('Elaboró', 'Rosa Elena Ibarra Treviño', 'Coordinadora Ambiental', '08/10/2026'),
            firmado('Revisó', 'Javier Leal Cavazos', 'Jefe de Mantenimiento CEDIS', '08/10/2026'),
            firmado('Autorizó', 'Patricia Garza Zambrano', 'Gerente de Sustentabilidad', '09/10/2026')],
    anexos=[('A', 'Recibos de energía y agua de septiembre 2026', True), ('B', 'Boletas de báscula y manifiestos', True)],
    caso='C', sev='-', datos='Indicadores de energía, agua y residuos con su fuente.', problema='')

cd = [('Aceite usado', 700, 'Regeneración'), ('Filtros contaminados con aceite', 300, 'Coprocesamiento'), ('Trapos y estopas impregnados', 200, 'Coprocesamiento')]
assert sum(c[1] for c in cd) == 1200
doc(file='aud000011_certificado_disposicion_cd0118.pdf', aud='AUD-000011', unidad=U11,
    tipo='Certificado de disposición final', folio='CD-0118', fecha='22/09/2026', area='Medio Ambiente',
    resp='Rosa Elena Ibarra Treviño, Coordinadora Ambiental', periodo='Recepción del 20/09/2026',
    politica='Procedimiento AMB-03 Manejo de residuos peligrosos',
    extra=[('Empresa de disposición', 'Tratamientos Ambientales Integrales del Norte, S.A. de C.V.'),
           ('Número de autorización ambiental', '19-IV-87-25'), ('Manifiesto relacionado', 'MR-2275')],
    cols=['Residuo', 'Cantidad (kg)', 'Método de disposición'],
    widths=[220, 110, 182],
    rows=[[r, n(k), m] for r, k, m in cd],
    total=['Total', n(1200), ''],
    notas=['Se certifica la disposición final de 1,200 kg (1.2 toneladas) de residuos peligrosos.'],
    obs=['Sin excepciones.'],
    firmas=[firmado('Elaboró', 'Hugo Sepúlveda Garza', 'Responsable técnico de la planta de disposición', '22/09/2026'),
            firmado('Revisó', 'Rosa Elena Ibarra Treviño', 'Coordinadora Ambiental', '22/09/2026'),
            firmado('Autorizó', 'Patricia Garza Zambrano', 'Gerente de Sustentabilidad', '23/09/2026')],
    anexos=[('A', 'Copia de la autorización ambiental 19-IV-87-25', True), ('B', 'Manifiesto MR-2275 con firma de recepción', True)],
    caso='C', sev='-', datos='1.2 toneladas, con número de autorización y firma.', problema='')

en = [('Monterrey Centro', 80, 76, 1312400), ('Monterrey Norte', 70, 67, 1148200), ('Saltillo', 50, 48, 826300), ('Monclova', 40, 37, 655100)]
assert sum(e[1] for e in en) == 240 and sum(e[1] - e[2] for e in en) == 12
doc(file='aud000011_consumo_energia_tiendas_q3.pdf', aud='AUD-000011', unidad=U11,
    tipo='Reporte de consumo de energía', folio='CE-2026-Q3', fecha='06/10/2026', area='Sustentabilidad',
    resp='Patricia Garza Zambrano, Gerente de Sustentabilidad', periodo='01/07/2026 al 30/09/2026',
    politica='Procedimiento ESG-03 Medición de consumo de energía',
    extra=[('Tiendas en el alcance', '240')],
    cols=['Zona', 'Tiendas', 'Con lectura de medidor', 'Sin lectura (estimadas)', 'Consumo (kWh)'],
    widths=[120, 70, 110, 110, 102],
    rows=[[z, n(t), n(c), n(t - c), n(k)] for z, t, c, k in en],
    total=['Total', n(240), n(228), n(12), n(sum(e[3] for e in en))],
    notas=['12 tiendas sin lectura de medidor; su consumo se incluye como dato estimado.'],
    obs=['Los consumos de las 12 tiendas sin lectura son datos estimados; nota metodológica de la estimación: no se indicó.'],
    firmas=[firmado('Elaboró', 'Rosa Elena Ibarra Treviño', 'Coordinadora Ambiental', '06/10/2026'),
            firmado('Revisó', 'Javier Leal Cavazos', 'Jefe de Mantenimiento CEDIS', '06/10/2026'),
            firmado('Autorizó', 'Patricia Garza Zambrano', 'Gerente de Sustentabilidad', '07/10/2026')],
    anexos=[('A', 'Recibos de CFE del trimestre', True), ('B', 'Lecturas de medidor de 228 tiendas', True)],
    caso='P', sev='Baja',
    datos='240 tiendas, 12 sin lectura de medidor.',
    problema='En Observaciones, datos estimados sin nota metodológica.')

cr = [('Recolección de cartón y PET en 3 CEDIS', 'Semanal', 48000), ('Recolección de aceite usado', 'Quincenal', 22500),
      ('Disposición final de residuos peligrosos', 'Mensual', 31000), ('Elaboración de manifiestos y reportes', 'Mensual', 6500)]
assert sum(c[2] for c in cr) == 108000
doc(file='aud000011_contrato_recolector_cr0076.pdf', aud='AUD-000011', unidad=U11,
    tipo='Ficha de contrato con recolector', folio='CR-0076', fecha='05/09/2026', area='Medio Ambiente y Compras',
    resp='Patricia Garza Zambrano, Gerente de Sustentabilidad', periodo='Vigencia del 01/08/2024 al 31/07/2026',
    politica='Política COM-05 Contratos con proveedores',
    extra=[('Proveedor', 'Ecotransportes Regiomontanos, S.A. de C.V. (PRV-19310)'), ('Objeto', 'Recolección y disposición de residuos')],
    cols=['Servicio', 'Frecuencia', 'Tarifa mensual'],
    widths=[260, 100, 152],
    rows=[[s, f, mxn(t)] for s, f, t in cr],
    total=['Total mensual', '', mxn(108000)],
    notas=['La vigencia del contrato terminó el 31/07/2026.'],
    obs=['Renovación del contrato pendiente.'],
    firmas=[firmado('Elaboró', 'Rosa Elena Ibarra Treviño', 'Coordinadora Ambiental', '05/09/2026'),
            firmado('Revisó', 'Alejandra Montiel Duarte', 'Abogada Corporativa', '05/09/2026'),
            firmado('Autorizó', 'Patricia Garza Zambrano', 'Gerente de Sustentabilidad', '05/09/2026')],
    anexos=[('A', 'Contrato CR-0076 firmado', True), ('B', 'Autorización ambiental del recolector', True),
            ('C', 'Póliza de responsabilidad ambiental', False)],
    caso='P', sev='Moderada',
    datos='La vigencia terminó el 31/07/2026.',
    problema='En Anexos, póliza de responsabilidad ambiental (Anexo C) no adjunta; en Observaciones, renovación pendiente.')


# ---------------------------------------------------------------- PDF
ST = {
    'org': ParagraphStyle('org', fontName='Helvetica-Bold', fontSize=11, leading=14, textColor=colors.HexColor('#B3001B')),
    'tit': ParagraphStyle('tit', fontName='Helvetica-Bold', fontSize=14, leading=18),
    'h': ParagraphStyle('h', fontName='Helvetica-Bold', fontSize=10.5, leading=14, spaceBefore=8, spaceAfter=3,
                        textColor=colors.HexColor('#1F3A5F'), keepWithNext=1),
    'p': ParagraphStyle('p', fontName='Helvetica', fontSize=8.8, leading=11.5),
    'c': ParagraphStyle('c', fontName='Helvetica', fontSize=8, leading=10),
    'cb': ParagraphStyle('cb', fontName='Helvetica-Bold', fontSize=8, leading=10),
}
GRIS = colors.HexColor('#E8ECF2')


def esc(t):
    return str(t).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def tabla(filas, widths, encabezado=True, total=False):
    data = [[Paragraph(esc(c), ST['cb'] if (encabezado and i == 0) or (total and i == len(filas) - 1) else ST['c'])
             for c in fila] for i, fila in enumerate(filas)]
    t = Table(data, colWidths=widths, repeatRows=1 if encabezado else 0)
    estilo = [('GRID', (0, 0), (-1, -1), 0.4, colors.HexColor('#9AA5B1')), ('VALIGN', (0, 0), (-1, -1), 'TOP'),
              ('TOPPADDING', (0, 0), (-1, -1), 2.5), ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5)]
    if encabezado:
        estilo.append(('BACKGROUND', (0, 0), (-1, 0), GRIS))
    if total:
        estilo.append(('BACKGROUND', (0, -1), (-1, -1), GRIS))
    t.setStyle(TableStyle(estilo))
    return t


def construir(d):
    s = []
    s.append(Paragraph('1. Encabezado', ST['h']))
    s.append(Paragraph(esc('FEMSA · ' + d['unidad']), ST['org']))
    s.append(Paragraph(esc(d['tipo'].upper()), ST['tit']))
    s.append(tabla([['Tipo de documento', d['tipo']], ['Folio', d['folio']], ['Fecha de emisión', d['fecha']], ['Área', d['area']]],
                   [130, 382], encabezado=False))

    s.append(Paragraph('2. Datos generales', ST['h']))
    s.append(tabla([['Responsable', d['resp']], ['Periodo que cubre', d['periodo']],
                    ['Política o procedimiento de referencia', d['politica']]] + [list(e) for e in d.get('extra', [])],
                   [170, 342], encabezado=False))

    s.append(Paragraph('3. Detalle', ST['h']))
    s.append(tabla([d['cols']] + d['rows'] + [d['total']], d['widths'], total=True))
    for nota in d.get('notas', []):
        s.append(Spacer(1, 3))
        s.append(Paragraph(esc(nota), ST['p']))

    s.append(Paragraph('4. Observaciones', ST['h']))
    for o in d['obs']:
        s.append(Paragraph('• ' + esc(o), ST['p']))

    s.append(Paragraph('5. Cierre', ST['h']))
    s.append(tabla([['Rol', 'Nombre', 'Cargo', 'Fecha', 'Firma']] + [list(f) for f in d['firmas']], [82, 115, 125, 60, 130]))
    for nota in d.get('cierre_notas', []):
        s.append(Spacer(1, 3))
        s.append(Paragraph(esc(nota), ST['p']))
    s.append(Spacer(1, 5))
    s.append(Paragraph('<b>Lista de anexos</b>', ST['p']))
    s.append(Spacer(1, 2))
    s.append(tabla([['Anexo', 'Descripción', 'Estado']] + [[a, desc, 'Adjunto' if ok else 'No adjunto'] for a, desc, ok in d['anexos']],
                   [50, 352, 110]))
    return s


def pie(canvas, documento):
    canvas.saveState()
    canvas.setFont('Helvetica', 7)
    canvas.setFillColor(colors.HexColor('#6B7785'))
    canvas.drawString(18 * mm, 10 * mm, 'Documento de prueba para análisis de evidencia - FEMSA Auditoría · Datos ficticios')
    canvas.drawRightString(letter[0] - 18 * mm, 10 * mm, f'{documento._folio} · Página {canvas.getPageNumber()}')
    canvas.restoreState()


def generar_pdf(d, ruta):
    buf = io.BytesIO()
    documento = SimpleDocTemplate(buf, pagesize=letter, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=15 * mm, bottomMargin=18 * mm,
                                  title=f'{d["tipo"]} {d["folio"]}', author='FEMSA Auditoría (datos ficticios)', subject=d['aud'],
                                  invariant=1, pageCompression=1)
    documento._folio = d['folio']
    documento.build(construir(d), onFirstPage=pie, onLaterPages=pie)
    datos = buf.getvalue()
    with open(ruta, 'wb') as f:
        f.write(datos)
    return datos


# ---------------------------------------------------------------- validación
def validar(d, datos):
    from pypdf import PdfReader
    lector = PdfReader(io.BytesIO(datos))
    texto = '\n'.join(p.extract_text() for p in lector.pages)
    errores = []
    if not 1 <= len(lector.pages) <= 2:
        errores.append(f'{len(lector.pages)} páginas')
    if len(datos) >= 300 * 1024:
        errores.append(f'{len(datos)} bytes')
    for titulo in ['1. Encabezado', '2. Datos generales', '3. Detalle', '4. Observaciones', '5. Cierre', 'Elaboró', 'Revisó', 'Autorizó']:
        if titulo not in texto:
            errores.append(f'falta "{titulo}" en el texto extraído')
    encontradas = [f for f in FRASES_FALTANTE if f in texto.lower()]
    if d['caso'] == 'C' and encontradas:
        errores.append(f'documento completo con frases de faltante: {encontradas}')
    if d['caso'] == 'P' and not encontradas:
        errores.append('documento con problema sin frase de faltante explícita')
    return errores


# ---------------------------------------------------------------- SQL y manifiesto
def escribir_sql(filas, ruta):
    valores = '\n'.join(('   ' if i == 0 else '  ,') + f"({i + 1}, '{f['aud']}', '{f['file']}', {f['bytes']}, '{f['sha256']}')"
                        for i, f in enumerate(filas))
    contenido = f"""-- FE1S-35 · Evidencias PDF simuladas para la IA (ficticias)
-- Generado por scripts/generar_evidencias_ia.py. Los PDF viven en
-- backend/src/datos/memoria/archivos-demo/ del repo de la app (blob_url = 'demo://<archivo>').
-- Se puede correr más de una vez: no inserta archivos que ya estén registrados.
SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @base INT = (
  SELECT ISNULL(MAX(TRY_CAST(SUBSTRING(tracking_id, 9, 20) AS INT)), 0)
  FROM dbo.EVIDENCE WITH (UPDLOCK, HOLDLOCK) WHERE tracking_id LIKE 'SOPORTE-%');

INSERT INTO dbo.EVIDENCE (tracking_id, procedure_id, file_name, blob_url, mime_type, size_bytes, sha256, uploaded_by, deleted)
SELECT
  'SOPORTE-' + RIGHT('000000' + CAST(@base + ROW_NUMBER() OVER (ORDER BY v.orden) AS VARCHAR(10)), 6),
  (SELECT TOP 1 p.procedure_id FROM dbo.[PROCEDURE] p WHERE p.audit_id = a.audit_id ORDER BY p.procedure_id),
  v.archivo, 'demo://' + v.archivo, 'application/pdf', v.bytes, v.sha256, a.user_id, 0
FROM (VALUES
{valores}
) AS v (orden, auditoria, archivo, bytes, sha256)
JOIN dbo.AUDIT a ON a.tracking_id = v.auditoria
WHERE NOT EXISTS (SELECT 1 FROM dbo.EVIDENCE e WHERE e.file_name = v.archivo AND e.deleted = 0);

COMMIT;

-- Verificación: debe dar 7, 8, 6, 7, 9 (6 + 3 de Jorge) y 6
SELECT a.tracking_id, COUNT(*) AS evidencias_pdf
FROM dbo.EVIDENCE e
JOIN dbo.[PROCEDURE] p ON p.procedure_id = e.procedure_id
JOIN dbo.AUDIT a ON a.audit_id = p.audit_id
WHERE e.blob_url LIKE 'demo://%' AND e.deleted = 0
GROUP BY a.tracking_id ORDER BY a.tracking_id;
"""
    with open(ruta, 'w', encoding='utf-8', newline='\n') as f:
        f.write(contenido)


CASOS = {'C': 'C · Completo', 'P': 'P · Con problema', 'A': 'A · Error aritmético'}


def escribir_manifiesto(filas, ruta):
    lineas = ['# Manifiesto de evidencias simuladas para la IA (FE1S-35)', '',
              'Documentos ficticios generados con `scripts/generar_evidencias_ia.py`. Los PDF están en '
              '`backend/src/datos/memoria/archivos-demo/` del repo de la app y se registran con `scripts/datos_prueba_evidencias_ia.sql`.', '',
              'Clave del caso: **C** = completo, **P** = con problema, **A** = error aritmético a propósito. '
              'La severidad es la que esperamos que sugiera la IA.', '',
              f'Total: {len(filas)} archivos · {sum(f["caso"] == "C" for f in filas)} completos · '
              f'{sum(f["caso"] == "A" for f in filas)} con error aritmético · {sum(f["caso"] == "P" for f in filas)} con faltantes.', '',
              '| # | Archivo | Auditoría | Tipo | Caso | Severidad esperada | Lo que la IA debe detectar |',
              '|---|---|---|---|---|---|---|']
    for i, f in enumerate(filas, 1):
        detectar = f'Datos: {f["datos"]}' + (f' Problema: {f["problema"]}' if f['problema'] else ' Sin faltantes ni errores: no debe sugerir hallazgos.')
        lineas.append(f'| {i} | `{f["file"]}` | {f["aud"]} | {f["tipo"]} | {CASOS[f["caso"]]} | {f["sev"]} | {detectar.replace("|", "/")} |')
    with open(ruta, 'w', encoding='utf-8', newline='\n') as fh:
        fh.write('\n'.join(lineas) + '\n')


def main():
    ap_ = argparse.ArgumentParser()
    ap_.add_argument('--pdf-dir', required=True, help='Carpeta archivos-demo del repo de la app')
    ap_.add_argument('--out-dir', default=AQUI, help='Carpeta para el SQL y el manifiesto')
    args = ap_.parse_args()

    assert len(DOCS) == 40, len(DOCS)
    assert len({d['file'] for d in DOCS}) == 40
    assert [d['caso'] for d in DOCS].count('C') == 10 and [d['caso'] for d in DOCS].count('A') == 6

    os.makedirs(args.pdf_dir, exist_ok=True)
    filas, problemas = [], []
    for d in DOCS:
        datos = generar_pdf(d, os.path.join(args.pdf_dir, d['file']))
        for e in validar(d, datos):
            problemas.append(f'{d["file"]}: {e}')
        filas.append({**d, 'bytes': len(datos), 'sha256': hashlib.sha256(datos).hexdigest()})
    if problemas:
        raise SystemExit('Validación fallida:\n' + '\n'.join(problemas))

    escribir_sql(filas, os.path.join(args.out_dir, 'datos_prueba_evidencias_ia.sql'))
    escribir_manifiesto(filas, os.path.join(args.out_dir, 'manifiesto_evidencias_ia.md'))
    print(f'{len(filas)} PDF generados en {args.pdf_dir}; SQL y manifiesto en {args.out_dir}')


if __name__ == '__main__':
    main()
