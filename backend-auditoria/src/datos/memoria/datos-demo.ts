import type { BaseDeDatosMemoria } from './base-de-datos-memoria';
import type {
  Aprobacion, Auditoria, ClaveRol, Hallazgo, Plan, Procedimiento, UnidadNegocio, Usuario,
} from '../modelos';
import { hashContrasena } from '../../common/utils/contrasena';

/** Cuenta con contraseña en los datos en memoria (desarrollo y pruebas). En Azure SQL cada usuario tiene su hash en dbo.[USER].password_hash. */
export const CUENTA_DEMO = {
  correo: 'jose.martinez@demo.femsa.test',
  contrasena: process.env.DEMO_PASSWORD || 'FemsaAudit-2026',
};

/**
 * Datos de demostración (ficticios). Equivalen a sql/seed_datos_demo.sql para trabajar sin BD conectada.
 * Las fechas son relativas al momento de arranque para que el semáforo de vencimientos sea realista.
 */
export function sembrarDatosDemo(db: BaseDeDatosMemoria): void {
  const ahora = Date.now();
  const hace = (dias: number, horas = 0) => new Date(ahora - dias * 86_400_000 - horas * 3_600_000);
  const hoyUtc = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z').getTime();
  const fecha = (dias: number) => new Date(hoyUtc + dias * 86_400_000);
  const id = (tabla: string) => db.siguienteId(tabla);

  const roles: [ClaveRol, string, string][] = [
    ['auditor', 'Auditor', 'Ejecuta pruebas, califica controles y solicita PBC.'],
    ['lider', 'Auditor Líder', 'Responsable del expediente; registra hallazgos y solicita el cierre.'],
    ['jefe', 'Jefe de Auditoría', 'Supervisa procedimientos; primer nivel de aprobación de cierre.'],
    ['gerente', 'Gerente de Auditoría', 'Segundo nivel de aprobación; monitorea planes.'],
    ['director', 'Director de Auditoría', 'Firma final; sella el expediente.'],
    ['grc', 'Revisor de Control Interno', 'Segunda línea: valida evidencia de remediación de su UdN.'],
    ['auditado', 'Personal Auditado', 'Atiende PBC y captura avances de SUS auditorías.'],
    ['admin', 'Administrador Funcional', 'Catálogos y configuración; sin acceso a modificar expedientes.'],
  ];
  for (const [clave, nombre, descripcion] of roles) db.roles.push({ id: id('roles'), clave, nombre, descripcion });
  const rol = (clave: ClaveRol) => db.roles.find((r) => r.clave === clave)!.id;

  const unidades: Omit<UnidadNegocio, 'id'>[] = [
    { clave: 'UDN-0001', unidad: 'Coca-Cola FEMSA (KOF)', direccion: 'Bebidas', division: 'Manufactura', area: 'Planta Toluca', pais: 'México', zona_horaria: 'America/Mexico_City' },
    { clave: 'UDN-0002', unidad: 'OXXO México', direccion: 'Retail & Spin', division: 'Proximidad', area: 'Cadena de suministro', pais: 'México', zona_horaria: 'America/Monterrey' },
    { clave: 'UDN-0003', unidad: 'Spin by OXXO', direccion: 'Retail & Spin', division: 'Servicios financieros', area: 'Tecnología', pais: 'México', zona_horaria: 'America/Monterrey' },
    { clave: 'UDN-0004', unidad: 'FEMSA Servicios', direccion: 'Retail & Spin', division: 'Corporativo', area: 'Finanzas corporativas', pais: 'México', zona_horaria: 'America/Monterrey' },
    { clave: 'UDN-0005', unidad: 'KOF Brasil', direccion: 'Bebidas', division: 'Operaciones', area: 'Distribución', pais: 'Brasil', zona_horaria: 'America/Sao_Paulo' },
    { clave: 'UDN-0006', unidad: 'Valora (Europa)', direccion: 'Retail & Spin', division: 'Proximidad Europa', area: 'Finanzas', pais: 'Suiza', zona_horaria: 'Europe/Zurich' },
  ];
  for (const u of unidades) db.unidades.push({ id: id('unidades'), ...u });

  const usuarios: [string, string, ClaveRol, Usuario['direccion'], number | null, string][] = [
    ['M. Rodríguez', 'm.rodriguez@demo.femsa.test', 'lider', 'Retail & Spin', null, 'America/Monterrey'],
    ['J. Fernández', 'j.fernandez@demo.femsa.test', 'lider', 'Bebidas', null, 'America/Mexico_City'],
    ['Anita Muñoz', 'a.munoz@demo.femsa.test', 'auditor', 'Retail & Spin', null, 'America/Monterrey'],
    ['Carlos Torres', 'c.torres@demo.femsa.test', 'auditor', 'Retail & Spin', null, 'America/Bogota'],
    ['Theo Lawrence', 't.lawrence@demo.femsa.test', 'auditor', 'Bebidas', null, 'America/Sao_Paulo'],
    ['L. Garza', 'l.garza@demo.femsa.test', 'jefe', 'Retail & Spin', null, 'America/Monterrey'],
    ['R. Salinas', 'r.salinas@demo.femsa.test', 'jefe', 'Bebidas', null, 'America/Mexico_City'],
    ['P. Villarreal', 'p.villarreal@demo.femsa.test', 'gerente', 'Retail & Spin', null, 'America/Monterrey'],
    ['S. Cantú', 's.cantu@demo.femsa.test', 'gerente', 'Bebidas', null, 'America/Mexico_City'],
    ['D. Herrera', 'd.herrera@demo.femsa.test', 'director', null, null, 'America/Monterrey'],
    ['G. Ibarra', 'g.ibarra@demo.femsa.test', 'grc', 'Retail & Spin', 4, 'America/Monterrey'],
    ['E. Ramos', 'e.ramos@demo.femsa.test', 'auditado', 'Retail & Spin', 4, 'America/Monterrey'],
    ['F. Moreno', 'f.moreno@demo.femsa.test', 'auditado', 'Bebidas', 1, 'America/Mexico_City'],
    ['Admin Funcional', 'admin@demo.femsa.test', 'admin', null, null, 'America/Monterrey'],
    ['José Martínez', CUENTA_DEMO.correo, 'lider', 'Retail & Spin', null, 'America/Monterrey'],
  ];
  // Sólo en local: DEMO_TODAS_LAS_CUENTAS=1 deja entrar con cualquier usuario demo (misma contraseña) para probar cada rol.
  const hash = hashContrasena(CUENTA_DEMO.contrasena);
  const todas = process.env.DEMO_TODAS_LAS_CUENTAS === '1';
  for (const [nombre, correo, r, direccion, udn, tz] of usuarios) {
    db.usuarios.push({
      id: id('usuarios'), nombre, correo, rol_id: rol(r), direccion, unidad_negocio_id: udn, zona_horaria: tz, activo: true,
      contrasena_hash: todas || correo === CUENTA_DEMO.correo ? hash : null,
    });
  }
  const JOSE = db.usuarios.find((u) => u.correo === CUENTA_DEMO.correo)!.id;

  const riesgos: [string, string, string, string][] = [
    ['RSK-000101', 'Diferencias de inventario no detectadas', 'Operativo', 'Alto'],
    ['RSK-000102', 'Pagos no autorizados a proveedores', 'Financiero', 'Crítico'],
    ['RSK-000103', 'Accesos privilegiados sin revisión', 'Tecnológico', 'Alto'],
    ['RSK-000104', 'Partidas en conciliación sin depurar', 'Financiero', 'Moderado'],
    ['RSK-000105', 'Incumplimiento en tiempos de entrega a clientes', 'Operativo', 'Moderado'],
    ['RSK-000106', 'Operaciones inusuales no reportadas a la autoridad (PLD)', 'Cumplimiento', 'Crítico'],
    ['RSK-000107', 'Faltantes de efectivo en tienda', 'Operativo', 'Alto'],
    ['RSK-000108', 'Conflictos de interés no declarados', 'Ética y conducta', 'Moderado'],
    ['RSK-000109', 'Pérdida de información por respaldos no probados', 'Tecnológico', 'Alto'],
    ['RSK-000110', 'Indicadores de sustentabilidad sin soporte trazable', 'Sustentabilidad', 'Moderado'],
  ];
  for (const [tracking_id, nombre, categoria, nivel_inherente] of riesgos) {
    db.riesgos.push({ id: id('riesgos'), tracking_id, nombre, categoria, nivel_inherente });
  }
  const controles: [string, string, string, number][] = [
    ['CP-000201', 'Conteos cíclicos con conciliación a libro mayor', 'Operational', 1],
    ['CP-000202', 'Autorización de ajustes manuales de inventario', 'Operational', 1],
    ['CP-000203', 'Segregación en alta y liberación de pagos', 'Finance', 2],
    ['CP-000204', 'Revisión trimestral de accesos privilegiados', 'Cybersecurity', 3],
    ['CP-000205', 'Conciliación bancaria mensual con revisión', 'Finance', 4],
    ['CP-000206', 'Monitoreo de nivel de servicio en rutas', 'Operational', 5],
    ['CP-000207', 'Análisis y cierre documentado de alertas de monitoreo transaccional', 'Compliance', 6],
    ['CP-000208', 'Conocimiento del cliente (KYC) en apertura de cuentas', 'Compliance', 6],
    ['CP-000209', 'Arqueos sorpresivos y depósito diario de efectivo', 'Operational', 7],
    ['CP-000210', 'Declaración anual de conflictos de interés', 'Ethics and Behavior', 8],
    ['CP-000211', 'Pruebas trimestrales de restauración de respaldos', 'Cybersecurity', 9],
    ['CP-000212', 'Conciliación de manifiestos de residuos contra el reporte ESG', 'Sustainability', 10],
  ];
  for (const [tracking_id, nombre, dominio, riesgo_id] of controles) {
    db.controles.push({ id: id('controles'), tracking_id, nombre, dominio, riesgo_id });
  }

  const auditorias: Omit<Auditoria, 'id' | 'tracking_id' | 'creado_en'>[] = [
    { nombre: 'Control de inventarios · Planta Toluca', objetivo: 'Validar que los controles de inventario operen con evidencia suficiente, segregación de funciones adecuada y conciliaciones oportunas entre almacén y libro mayor.', unidad_negocio_id: 1, tipo: 'Operativa', area: 'Planta Toluca', prioridad: 'Alta', lider_id: 2, estado: 'en_ejecucion', fecha_inicio: fecha(-40), fecha_fin: fecha(9) },
    { nombre: 'Pagos a proveedores LatAm', objetivo: 'Evaluar la segregación de funciones y las autorizaciones en el ciclo de cuentas por pagar.', unidad_negocio_id: 4, tipo: 'Financiera', area: 'Finanzas corporativas', prioridad: 'Alta', lider_id: 1, estado: 'en_ejecucion', fecha_inicio: fecha(-25), fecha_fin: fecha(18) },
    { nombre: 'Accesos y ciberseguridad Spin', objetivo: 'Verificar la revisión periódica de accesos privilegiados en plataformas de Spin.', unidad_negocio_id: 3, tipo: 'Cybersecurity', area: 'Tecnología', prioridad: 'Alta', lider_id: 1, estado: 'pendiente', fecha_inicio: fecha(5), fecha_fin: fecha(45) },
    { nombre: 'Conciliaciones bancarias Q2', objetivo: 'Confirmar que las conciliaciones bancarias del segundo trimestre se preparen y revisen en tiempo.', unidad_negocio_id: 4, tipo: 'Financiera', area: 'Finanzas corporativas', prioridad: 'Baja', lider_id: 1, estado: 'en_aprobacion', fecha_inicio: fecha(-90), fecha_fin: fecha(-20) },
    { nombre: 'Abasto y distribución OXXO Norte', objetivo: 'Revisar el cumplimiento de niveles de servicio y la documentación de mermas en CEDIS.', unidad_negocio_id: 2, tipo: 'Operativa', area: 'Cadena de suministro', prioridad: 'Media', lider_id: 1, estado: 'en_aprobacion', fecha_inicio: fecha(-60), fecha_fin: fecha(-2) },
    { nombre: 'Distribución KOF Brasil', objetivo: 'Evaluar controles de entrega y cobranza en rutas de distribución.', unidad_negocio_id: 5, tipo: 'Operativa', area: 'Distribución', prioridad: 'Media', lider_id: 2, estado: 'en_ejecucion', fecha_inicio: fecha(-15), fecha_fin: fecha(30) },
    { nombre: 'Prevención de lavado de dinero · Spin by OXXO', objetivo: 'Evaluar que las alertas de monitoreo transaccional se analicen y cierren con soporte, y que la apertura de cuentas cumpla con la política de conocimiento del cliente.', unidad_negocio_id: 3, tipo: 'Cumplimiento', area: 'Servicios financieros', prioridad: 'Alta', lider_id: JOSE, estado: 'en_ejecucion', fecha_inicio: fecha(-20), fecha_fin: fecha(12) },
    { nombre: 'Manejo de efectivo en tiendas OXXO Monterrey', objetivo: 'Verificar arqueos sorpresivos, depósitos diarios y el seguimiento de diferencias de efectivo en tiendas de la plaza Monterrey.', unidad_negocio_id: 2, tipo: 'Operativa', area: 'Operación de tiendas', prioridad: 'Alta', lider_id: JOSE, estado: 'en_ejecucion', fecha_inicio: fecha(-30), fecha_fin: fecha(6) },
    { nombre: 'Conflictos de interés y regalos · FEMSA Servicios', objetivo: 'Confirmar que el personal con funciones de compras tenga su declaración anual de conflictos de interés vigente y que los regalos recibidos se registren.', unidad_negocio_id: 4, tipo: 'Cumplimiento', area: 'Compras corporativas', prioridad: 'Media', lider_id: JOSE, estado: 'en_aprobacion', fecha_inicio: fecha(-70), fecha_fin: fecha(-5) },
    { nombre: 'Respaldo y recuperación de datos · Valora', objetivo: 'Revisar que los respaldos de los sistemas financieros de Valora se prueben cada trimestre y que los tiempos de recuperación cumplan lo acordado con el negocio.', unidad_negocio_id: 6, tipo: 'Cybersecurity', area: 'Tecnología', prioridad: 'Media', lider_id: JOSE, estado: 'pendiente', fecha_inicio: fecha(7), fecha_fin: fecha(50) },
    { nombre: 'Indicadores de residuos y reporte ESG · OXXO', objetivo: 'Validar que las toneladas de residuos reportadas en el informe de sustentabilidad estén soportadas por manifiestos de los CEDIS.', unidad_negocio_id: 2, tipo: 'Cumplimiento', area: 'Sustentabilidad', prioridad: 'Baja', lider_id: JOSE, estado: 'en_ejecucion', fecha_inicio: fecha(-10), fecha_fin: fecha(35) },
  ];
  for (const a of auditorias) {
    db.auditorias.push({ id: id('auditorias'), tracking_id: db.siguienteFolio('aud'), creado_en: hace(30), ...a });
  }

  db.participantes.push(
    { auditoria_id: 2, usuario_id: 12, papel: 'enlace' }, { auditoria_id: 4, usuario_id: 12, papel: 'responsable' },
    { auditoria_id: 1, usuario_id: 13, papel: 'enlace' }, { auditoria_id: 2, usuario_id: 3, papel: 'auditor' },
    { auditoria_id: 3, usuario_id: 4, papel: 'auditor' }, { auditoria_id: 1, usuario_id: 5, papel: 'auditor' },
    { auditoria_id: 7, usuario_id: 3, papel: 'auditor' }, { auditoria_id: 7, usuario_id: 4, papel: 'auditor' },
    { auditoria_id: 8, usuario_id: 3, papel: 'auditor' }, { auditoria_id: 8, usuario_id: 4, papel: 'auditor' },
    { auditoria_id: 9, usuario_id: 12, papel: 'responsable' }, { auditoria_id: 9, usuario_id: 3, papel: 'auditor' },
    { auditoria_id: 10, usuario_id: 4, papel: 'auditor' }, { auditoria_id: 11, usuario_id: 3, papel: 'auditor' },
  );

  type P = [number, number, number, Procedimiento['estado'], string | null, string | null, string | null, boolean, string | null, number | null];
  const procedimientos: P[] = [
    [1, 1, 5, 'supervisado', 'Definido', 'Definido', 'Moderado', false, 'Conteos cíclicos ejecutados conforme a calendario.', 12],
    [1, 2, 5, 'evaluado', 'Funcional', 'Inicial', 'Alto', true, 'Ajustes manuales recurrentes sin soporte documental completo; merma de 8% vs 3% de política.', 6],
    [1, 1, 2, 'abierto', null, null, null, false, null, null],
    [2, 3, 3, 'revisado', 'Funcional', 'Funcional', 'Alto', true, 'Se identificaron usuarios con permisos para dar de alta y liberar pagos simultáneamente.', 4],
    [2, 3, 3, 'supervisado', 'Administrado', 'Definido', 'Bajo', false, 'Muestra de 25 pagos con autorización dual correcta.', 8],
    [3, 4, 4, 'abierto', null, null, null, false, null, null],
    [4, 5, 1, 'supervisado', 'Administrado', 'Administrado', 'Bajo', false, 'Conciliaciones preparadas y revisadas dentro de los 5 días hábiles.', 40],
    [4, 5, 1, 'supervisado', 'Definido', 'Funcional', 'Moderado', true, 'Partidas en conciliación con antigüedad mayor a 90 días sin depurar.', 38],
    [5, 6, 3, 'supervisado', 'Definido', 'Definido', 'Moderado', false, 'Niveles de servicio monitoreados semanalmente.', 10],
    [5, 1, 3, 'supervisado', 'Funcional', 'Funcional', 'Moderado', true, 'Documentación de mermas incompleta en 3 de 12 CEDIS revisados.', 9],
    [6, 6, 5, 'evaluado', 'Definido', 'Definido', 'Bajo', false, 'Rutas con entrega en tiempo mayor a 95%.', 3],
    [6, 1, 5, 'abierto', null, null, null, false, null, null],
    [7, 7, 3, 'revisado', 'Definido', 'Funcional', 'Alto', true, 'El 18% de las alertas del trimestre se cerró sin análisis documentado ni firma del oficial de cumplimiento.', 5],
    [7, 8, 4, 'evaluado', 'Funcional', 'Inicial', 'Alto', true, 'Expedientes de conocimiento del cliente incompletos en 9 de 40 cuentas de la muestra.', 3],
    [7, 7, JOSE, 'abierto', null, null, null, false, null, null],
    [8, 9, 3, 'supervisado', 'Administrado', 'Definido', 'Moderado', false, 'Arqueos sorpresivos en 30 tiendas con diferencias dentro de la tolerancia autorizada.', 9],
    [8, 9, 4, 'evaluado', 'Definido', 'Funcional', 'Moderado', true, 'Depósitos diarios con 2 a 4 días de retraso en 6 de 30 tiendas revisadas.', 4],
    [9, 10, 3, 'supervisado', 'Definido', 'Definido', 'Moderado', true, '12 colaboradores con funciones de compras no tienen declaración anual vigente.', 20],
    [9, 10, 3, 'supervisado', 'Administrado', 'Administrado', 'Bajo', false, 'Registro de regalos y atenciones completo y revisado por el Comité de Ética.', 19],
    [10, 11, 4, 'abierto', null, null, null, false, null, null],
    [11, 12, 3, 'evaluado', 'Funcional', 'Funcional', 'Moderado', true, 'Manifiestos de residuos sin conciliar contra el reporte ESG en 2 de 5 CEDIS.', 2],
    [11, 12, JOSE, 'abierto', null, null, null, false, null, null],
  ];
  for (const [auditoria_id, control_id, auditor_id, estado, calif_diseno, calif_efectividad, vulnerabilidad, aplica_hallazgo, comentarios, dias] of procedimientos) {
    db.procedimientos.push({
      id: id('procedimientos'), tracking_id: db.siguienteFolio('ap'), auditoria_id, control_id, auditor_id, estado,
      calif_diseno, calif_efectividad, vulnerabilidad, aplica_hallazgo, comentarios, fecha_evaluacion: dias == null ? null : hace(dias),
    });
  }

  const hallazgos: Omit<Hallazgo, 'id' | 'tracking_id'>[] = [
    { auditoria_id: 1, procedimiento_id: 2, titulo: 'Ajustes manuales de inventario sin soporte documental', condicion: 'Se registraron 37 ajustes manuales en el trimestre sin documento soporte adjunto en sistema.', criterio: 'Política de inventarios KOF: todo ajuste requiere soporte y doble autorización.', causa: 'El sistema permite registrar ajustes sin adjunto obligatorio.', efecto: 'Posible distorsión de inventario y margen operativo.', recomendacion: 'Bloquear ajustes manuales sin soporte y exigir autorización dual en sistema.', severidad: 'Crítica', tipo: 'Debilidad de control', riesgo_residual: 'Alto', impacto_mxn: 1_850_000, estado: 'esperando_plan', responsable_id: 13, fecha_identificacion: hace(6) },
    { auditoria_id: 1, procedimiento_id: 2, titulo: 'Merma por encima del umbral autorizado', condicion: 'La merma acumulada del periodo es de 8%, frente a un máximo autorizado de 3%.', criterio: 'Lineamiento de mermas de Planta Toluca (umbral 3%).', causa: 'Falta de análisis de causa raíz de diferencias recurrentes.', efecto: 'Pérdida económica y subestimación del costo de ventas.', recomendacion: 'Implementar análisis mensual de merma con responsable y umbral de alerta.', severidad: 'Alta', tipo: 'Debilidad de control', riesgo_residual: 'Alto', impacto_mxn: 920_000, estado: 'abierto', responsable_id: 13, fecha_identificacion: hace(5) },
    { auditoria_id: 2, procedimiento_id: 4, titulo: 'Roles incompatibles en liberación de pagos a proveedores', condicion: 'Cuatro usuarios pueden dar de alta proveedores y liberar pagos sin segunda revisión.', criterio: 'Matriz de segregación de funciones de Finanzas corporativas.', causa: 'Asignación de perfiles sin revisión periódica de conflictos.', efecto: 'Riesgo de pagos no autorizados o fraude.', recomendacion: 'Redefinir la matriz de permisos y activar revisión semanal de conflictos.', severidad: 'Crítica', tipo: 'Debilidad de control', riesgo_residual: 'Crítico', impacto_mxn: 3_400_000, estado: 'en_seguimiento', responsable_id: 12, fecha_identificacion: hace(4) },
    { auditoria_id: 4, procedimiento_id: 8, titulo: 'Partidas de conciliación con antigüedad mayor a 90 días', condicion: 'Se detectaron 14 partidas en conciliación con más de 90 días sin depurar.', criterio: 'Procedimiento de tesorería: depurar partidas en máximo 60 días.', causa: 'Carga operativa y falta de seguimiento del responsable.', efecto: 'Saldos bancarios contables no representativos.', recomendacion: 'Depuración mensual con reporte de antigüedad al Gerente de Tesorería.', severidad: 'Moderada', tipo: 'Debilidad menor', riesgo_residual: 'Moderado', impacto_mxn: 210_000, estado: 'en_seguimiento', responsable_id: 12, fecha_identificacion: hace(38) },
    { auditoria_id: 5, procedimiento_id: 10, titulo: 'Documentación de mermas incompleta en CEDIS', condicion: 'En 3 de 12 CEDIS revisados, las actas de merma no cuentan con firma del responsable.', criterio: 'Lineamiento de control de mermas OXXO.', causa: 'Rotación de personal y falta de capacitación en el formato.', efecto: 'Retraso en el cierre formal y riesgo de mermas no justificadas.', recomendacion: 'Capacitación trimestral y tablero de vencimientos con responsable único.', severidad: 'Moderada', tipo: 'Debilidad menor', riesgo_residual: 'Moderado', impacto_mxn: 150_000, estado: 'en_seguimiento', responsable_id: 12, fecha_identificacion: hace(9) },
    { auditoria_id: 2, procedimiento_id: 4, titulo: 'Proveedores duplicados en el maestro', condicion: 'Se identificaron 11 proveedores con RFC duplicado y cuentas bancarias distintas.', criterio: 'Política de alta de proveedores: RFC único por proveedor.', causa: 'Validaciones de unicidad deshabilitadas en el maestro.', efecto: 'Riesgo de pagos duplicados.', recomendacion: 'Activar validación de RFC único y depurar el maestro.', severidad: 'Baja', tipo: 'Debilidad menor', riesgo_residual: 'Bajo', impacto_mxn: 45_000, estado: 'abierto', responsable_id: null, fecha_identificacion: hace(2) },
    { auditoria_id: 7, procedimiento_id: 13, titulo: 'Alertas de monitoreo transaccional cerradas sin análisis', condicion: 'De 1,240 alertas generadas en el trimestre, 223 se cerraron sin análisis documentado ni firma del oficial de cumplimiento.', criterio: 'Manual de prevención de lavado de dinero de Spin: toda alerta se analiza y documenta antes de cerrarse.', causa: 'El sistema de monitoreo permite cerrar alertas en lote sin capturar el dictamen.', efecto: 'Operaciones inusuales sin reportar a la autoridad y riesgo de sanción regulatoria.', recomendacion: 'Bloquear el cierre en lote y exigir dictamen y firma del oficial en cada alerta.', severidad: 'Crítica', tipo: 'Debilidad de control', riesgo_residual: 'Crítico', impacto_mxn: 2_600_000, estado: 'abierto', responsable_id: null, fecha_identificacion: hace(5) },
    { auditoria_id: 7, procedimiento_id: 14, titulo: 'Expedientes de conocimiento del cliente incompletos', condicion: 'En 9 de 40 cuentas revisadas falta comprobante de domicilio o identificación vigente.', criterio: 'Política KYC de Spin: expediente completo antes de activar la cuenta.', causa: 'La validación documental se hace después de activar la cuenta para no frenar la apertura.', efecto: 'Cuentas operando sin identificación plena del titular.', recomendacion: 'Activar la cuenta sólo con expediente validado y depurar las cuentas incompletas.', severidad: 'Alta', tipo: 'Debilidad de control', riesgo_residual: 'Alto', impacto_mxn: 780_000, estado: 'revision_jefe', responsable_id: null, fecha_identificacion: hace(3) },
    { auditoria_id: 8, procedimiento_id: 17, titulo: 'Depósitos de efectivo fuera del plazo de 24 horas', condicion: 'En 6 de 30 tiendas el efectivo de venta se depositó con 2 a 4 días de retraso.', criterio: 'Lineamiento de valores OXXO: depósito diario de la venta en efectivo.', causa: 'La empresa de traslado de valores no cubre la ruta todos los días.', efecto: 'Mayor exposición a robo y faltantes de efectivo en tienda.', recomendacion: 'Ajustar frecuencias con la transportadora y alertar a la plaza cuando una tienda acumule más de un día sin depósito.', severidad: 'Moderada', tipo: 'Debilidad menor', riesgo_residual: 'Moderado', impacto_mxn: 340_000, estado: 'abierto', responsable_id: null, fecha_identificacion: hace(4) },
    { auditoria_id: 9, procedimiento_id: 18, titulo: 'Declaraciones de conflicto de interés vencidas en Compras', condicion: '12 colaboradores con funciones de compras no tienen su declaración anual vigente.', criterio: 'Código de Ética FEMSA: declaración anual obligatoria para puestos de compras.', causa: 'No existe recordatorio automático ni bloqueo para quien no declara.', efecto: 'Posibles conflictos de interés no identificados en la asignación de proveedores.', recomendacion: 'Recabar las declaraciones pendientes y condicionar el acceso al sistema de compras a una declaración vigente.', severidad: 'Alta', tipo: 'Debilidad de control', riesgo_residual: 'Moderado', impacto_mxn: null, estado: 'en_seguimiento', responsable_id: 12, fecha_identificacion: hace(20) },
    { auditoria_id: 11, procedimiento_id: 21, titulo: 'Toneladas de residuos reportadas sin manifiesto que las soporte', condicion: 'En 2 de 5 CEDIS las toneladas del reporte ESG no coinciden con los manifiestos del gestor de residuos.', criterio: 'Lineamiento corporativo de reporte de sustentabilidad: cada cifra debe tener soporte trazable.', causa: 'Los CEDIS capturan estimaciones cuando el manifiesto llega después del corte.', efecto: 'Riesgo reputacional por cifras ESG no verificables.', recomendacion: 'Conciliar mensualmente manifiestos contra el reporte y marcar las cifras estimadas.', severidad: 'Moderada', tipo: 'Debilidad menor', riesgo_residual: 'Moderado', impacto_mxn: 95_000, estado: 'abierto', responsable_id: null, fecha_identificacion: hace(2) },
  ];
  for (const h of hallazgos) db.hallazgos.push({ id: id('hallazgos'), tracking_id: db.siguienteFolio('fnd'), ...h });

  const planes: Omit<Plan, 'id' | 'tracking_id'>[] = [
    { hallazgo_id: 3, descripcion: 'Rediseñar la matriz de perfiles de Cuentas por Pagar y remover los conflictos detectados.', responsable_id: 12, fecha_compromiso: fecha(4), monto_mxn: 3_400_000, estado: 'en_progreso', avance_pct: 60, fecha_conclusion: null },
    { hallazgo_id: 3, descripcion: 'Implementar reporte semanal automático de conflictos de segregación.', responsable_id: 12, fecha_compromiso: fecha(25), monto_mxn: 0, estado: 'en_progreso', avance_pct: 20, fecha_conclusion: null },
    { hallazgo_id: 4, descripcion: 'Depurar las 14 partidas antiguas y documentar su resolución con tesorería.', responsable_id: 12, fecha_compromiso: fecha(-6), monto_mxn: 210_000, estado: 'en_progreso', avance_pct: 70, fecha_conclusion: null },
    { hallazgo_id: 5, descripcion: 'Capacitar a responsables de CEDIS en el formato de actas de merma.', responsable_id: 12, fecha_compromiso: fecha(14), monto_mxn: 150_000, estado: 'revision_grc', avance_pct: 100, fecha_conclusion: hace(1) },
    { hallazgo_id: 4, descripcion: 'Establecer reporte mensual de antigüedad de partidas al Gerente de Tesorería.', responsable_id: 12, fecha_compromiso: fecha(1), monto_mxn: 0, estado: 'abierto', avance_pct: 0, fecha_conclusion: null },
    { hallazgo_id: 10, descripcion: 'Recabar las 12 declaraciones pendientes y condicionar el acceso al sistema de compras a una declaración vigente.', responsable_id: 12, fecha_compromiso: fecha(10), monto_mxn: 0, estado: 'en_progreso', avance_pct: 45, fecha_conclusion: null },
    { hallazgo_id: 10, descripcion: 'Configurar un recordatorio anual automático de la declaración en el portal de Ética.', responsable_id: 12, fecha_compromiso: fecha(-3), monto_mxn: 0, estado: 'en_progreso', avance_pct: 30, fecha_conclusion: null },
  ];
  for (const p of planes) db.planes.push({ id: id('planes'), tracking_id: db.siguienteFolio('rp'), ...p });

  const avances: [number, number, string, number][] = [
    [1, 30, 'Se levantó inventario de perfiles con conflicto.', 3],
    [1, 60, 'Se removieron 3 de 4 conflictos; falta usuario de tesorería.', 1],
    [3, 70, 'Depuradas 10 de 14 partidas.', 8],
    [4, 100, 'Capacitación impartida a los 12 CEDIS; se adjuntan listas de asistencia.', 1],
    [6, 45, 'Se recibieron 5 de 12 declaraciones; el resto tiene fecha compromiso con su jefe directo.', 4],
    [7, 30, 'Requerimiento enviado a TI; en espera del ambiente de pruebas.', 9],
  ];
  for (const [plan_id, avance_pct, comentario, dias] of avances) {
    db.avances.push({ id: id('avances'), plan_id, avance_pct, comentario, evidencia_id: null, actualizado_por_id: 12, fecha: hace(dias), zona_horaria: 'America/Monterrey' });
  }

  const aprobaciones: Omit<Aprobacion, 'id'>[] = [
    { auditoria_id: 4, secuencia: 1, nivel: 'jefe', aprobador_id: 6, decision: 'aprobado', comentarios: 'Procedimientos supervisados y soportados.', fecha_decision: hace(18), zona_horaria: 'America/Monterrey' },
    { auditoria_id: 4, secuencia: 2, nivel: 'gerente', aprobador_id: 8, decision: 'aprobado', comentarios: 'Sin observaciones metodológicas.', fecha_decision: hace(17), zona_horaria: 'America/Monterrey' },
    { auditoria_id: 4, secuencia: 3, nivel: 'director', aprobador_id: 10, decision: 'aprobado', comentarios: 'Firma final.', fecha_decision: hace(16), zona_horaria: 'America/Monterrey' },
    { auditoria_id: 5, secuencia: 1, nivel: 'jefe', aprobador_id: 6, decision: 'aprobado', comentarios: 'Expediente completo.', fecha_decision: hace(1), zona_horaria: 'America/Monterrey' },
    { auditoria_id: 5, secuencia: 2, nivel: 'gerente', aprobador_id: null, decision: 'pendiente', comentarios: null, fecha_decision: null, zona_horaria: null },
    { auditoria_id: 5, secuencia: 3, nivel: 'director', aprobador_id: null, decision: 'pendiente', comentarios: null, fecha_decision: null, zona_horaria: null },
    { auditoria_id: 9, secuencia: 1, nivel: 'jefe', aprobador_id: 6, decision: 'aprobado', comentarios: 'Procedimientos supervisados; el hallazgo tiene planes asignados.', fecha_decision: hace(3), zona_horaria: 'America/Monterrey' },
    { auditoria_id: 9, secuencia: 2, nivel: 'gerente', aprobador_id: null, decision: 'pendiente', comentarios: null, fecha_decision: null, zona_horaria: null },
    { auditoria_id: 9, secuencia: 3, nivel: 'director', aprobador_id: null, decision: 'pendiente', comentarios: null, fecha_decision: null, zona_horaria: null },
  ];
  for (const a of aprobaciones) db.aprobaciones.push({ id: id('aprobaciones'), ...a });

  db.evidencias.push(
    { id: id('evidencias'), tracking_id: db.siguienteFolio('soporte'), evidencia_padre_id: null, procedimiento_id: 2, solicitud_pbc_id: null, hallazgo_id: 1, nombre_archivo: 'ajustes_manuales_Q3.xlsx', blob_url: 'evidencias/AUD-000001/ajustes_manuales_Q3.xlsx', tipo_mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', tamano_bytes: 48_213, hash_sha256: 'a'.repeat(64), cargado_por_id: 5, fecha_carga: hace(6), eliminado: false },
  );
  const zip = db.siguienteFolio('soporte');
  db.evidencias.push(
    { id: id('evidencias'), tracking_id: zip, evidencia_padre_id: null, procedimiento_id: 4, solicitud_pbc_id: null, hallazgo_id: 3, nombre_archivo: 'matriz_perfiles_cxp.zip', blob_url: `evidencias/AUD-000002/matriz_perfiles_cxp.zip`, tipo_mime: 'application/zip', tamano_bytes: 1_250_331, hash_sha256: 'b'.repeat(64), cargado_por_id: 3, fecha_carga: hace(4), eliminado: false },
  );
  const padre = db.evidencias[db.evidencias.length - 1].id;
  db.evidencias.push(
    { id: id('evidencias'), tracking_id: `${zip}-001`, evidencia_padre_id: padre, procedimiento_id: null, solicitud_pbc_id: null, hallazgo_id: null, nombre_archivo: 'perfiles_sap.xlsx', blob_url: null, tipo_mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', tamano_bytes: 802_112, hash_sha256: 'c'.repeat(64), cargado_por_id: 3, fecha_carga: hace(4), eliminado: false },
    { id: id('evidencias'), tracking_id: `${zip}-002`, evidencia_padre_id: padre, procedimiento_id: null, solicitud_pbc_id: null, hallazgo_id: null, nombre_archivo: 'conflictos_sod.pdf', blob_url: null, tipo_mime: 'application/pdf', tamano_bytes: 448_219, hash_sha256: 'd'.repeat(64), cargado_por_id: 3, fecha_carga: hace(4), eliminado: false },
  );

  const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const evidenciasJose: [number, number | null, string, string, number, string, number][] = [
    [14, 8, 'muestra_kyc_40_cuentas.xlsx', XLSX, 96_402, 'e', 3],
    [13, 7, 'alertas_cerradas_sin_dictamen_Q3.xlsx', XLSX, 210_884, 'f', 5],
    [21, 11, 'manifiestos_residuos_cedis.pdf', 'application/pdf', 1_402_377, '2', 2],
  ];
  for (const [procedimiento_id, hallazgo_id, nombre_archivo, tipo_mime, tamano_bytes, h, dias] of evidenciasJose) {
    const p = db.procedimientos.find((x) => x.id === procedimiento_id)!;
    const a = db.auditorias.find((x) => x.id === p.auditoria_id)!;
    db.evidencias.push({
      id: id('evidencias'), tracking_id: db.siguienteFolio('soporte'), evidencia_padre_id: null, procedimiento_id, solicitud_pbc_id: null, hallazgo_id,
      nombre_archivo, blob_url: `evidencias/${a.tracking_id}/${nombre_archivo}`, tipo_mime, tamano_bytes, hash_sha256: h.repeat(64),
      cargado_por_id: p.auditor_id ?? JOSE, fecha_carga: hace(dias), eliminado: false,
    });
  }

  // PDF real incluido como evidencia de AUD-000008 para probar el análisis con IA.
  db.evidencias.push({
    id: id('evidencias'), tracking_id: db.siguienteFolio('soporte'), evidencia_padre_id: null, procedimiento_id: 16,
    solicitud_pbc_id: null, hallazgo_id: null, nombre_archivo: 'acta_arqueo_tienda_1842.pdf',
    blob_url: 'demo://acta_arqueo_tienda_1842.pdf', tipo_mime: 'application/pdf', tamano_bytes: 2803,
    hash_sha256: 'e20799ddaec8c99bf333cbf5d337ab4828f7f6044acc6fc3fd85bacfb06711dc', cargado_por_id: JOSE,
    fecha_carga: hace(1), eliminado: false,
  });
  for (const [nombre_archivo, tamano_bytes, hash_sha256] of [
    ['acta_arqueo_completa_1842.pdf', 6156, '306474cb2f9367e393e290477d2be6ab16a88d117194535288aef816e2584aeb'],
    ['acta_arqueo_parcial_1842.pdf', 3292, 'ec4c3728067300747651f624a1f63360701f8eee14769ba1c6579645dc05521b'],
  ] as const) db.evidencias.push({
    id: id('evidencias'), tracking_id: db.siguienteFolio('soporte'), evidencia_padre_id: null, procedimiento_id: 16,
    solicitud_pbc_id: null, hallazgo_id: null, nombre_archivo, blob_url: `demo://${nombre_archivo}`,
    tipo_mime: 'application/pdf', tamano_bytes, hash_sha256, cargado_por_id: JOSE, fecha_carga: hace(0), eliminado: false,
  });

  // HU_05 · Solicitudes de información de ejemplo: una por responder, una vencida y una respondida que espera revisión.
  const procedimientoDe = (auditoria: number) => db.procedimientos.find((p) => p.auditoria_id === auditoria)!.id;
  const solicitudes: [number, number, number, string, number, 'solicitada' | 'enviada', string[]][] = [
    [2, 3, 12, 'Soporte de pagos a proveedores de septiembre', 4, 'solicitada', ['Autorizaciones de pago firmadas por el gerente', 'Facturas de los 10 pagos de mayor monto', 'Conciliación de la cuenta de proveedores']],
    [4, 3, 12, 'Estados de cuenta bancarios del segundo trimestre', -2, 'solicitada', ['Estados de cuenta de abril a junio', 'Conciliaciones firmadas por tesorería']],
    [2, 3, 12, 'Matriz de perfiles de Cuentas por Pagar', 6, 'enviada', ['Matriz de perfiles vigente', 'Bitácora de cambios de perfiles', 'Revisión semanal de conflictos']],
  ];
  for (const [auditoria, por, a, asunto, dias, estado, puntos] of solicitudes) {
    const sid = id('solicitudesPbc');
    db.solicitudesPbc.push({
      id: sid, tracking_id: db.siguienteFolio('pbc'), procedimiento_id: procedimientoDe(auditoria), estado, asunto, solicitado_por_id: por,
      solicitado_a_id: a, fecha_limite: fecha(dias), creado: hace(3), enviado: estado === 'enviada' ? hace(1) : null, cerrado: null, comentario_revision: null,
    });
    puntos.forEach((descripcion, i) => db.puntosPbc.push({ id: id('puntosPbc'), solicitud_id: sid, descripcion, obligatorio: true, estado: 'pendiente', orden: i + 1 }));
  }

  db.bitacora.push(
    { id: id('bitacora'), entidad: 'hallazgos', entidad_id: 1, folio: 'FND-000001', accion: 'CREAR', usuario_id: 2, detalle: '{"origen":"carga inicial"}', ip: '10.0.0.12', zona_horaria: 'America/Mexico_City', fecha: hace(6) },
    { id: id('bitacora'), entidad: 'hallazgos', entidad_id: 7, folio: 'FND-000007', accion: 'CREAR', usuario_id: JOSE, detalle: '{"origen":"carga inicial"}', ip: '10.0.0.31', zona_horaria: 'America/Monterrey', fecha: hace(5) },
    { id: id('bitacora'), entidad: 'hallazgos', entidad_id: 8, folio: 'FND-000008', accion: 'CREAR', usuario_id: JOSE, detalle: '{"origen":"carga inicial"}', ip: '10.0.0.31', zona_horaria: 'America/Monterrey', fecha: hace(3) },
    { id: id('bitacora'), entidad: 'auditorias', entidad_id: 9, folio: 'AUD-000009', accion: 'SOLICITAR_CIERRE', usuario_id: JOSE, detalle: '{"niveles":["jefe","gerente","director"]}', ip: '10.0.0.31', zona_horaria: 'America/Monterrey', fecha: hace(4) },
    { id: id('bitacora'), entidad: 'aprobaciones', entidad_id: 2, folio: 'AUD-000004', accion: 'APROBAR', usuario_id: 8, detalle: '{"nivel":"gerente"}', ip: '10.0.0.40', zona_horaria: 'America/Monterrey', fecha: hace(17) },
  );
  db.accesos.push(
    { id: id('accesos'), usuario_id: 1, correo: 'm.rodriguez@demo.femsa.test', resultado: 'exito', ip: '10.0.0.21', agente: 'Edge 140', zona_horaria: 'America/Monterrey', fecha: hace(0, 3) },
    { id: id('accesos'), usuario_id: 12, correo: 'e.ramos@demo.femsa.test', resultado: 'denegado', ip: '10.0.0.77', agente: 'Chrome 140', zona_horaria: 'America/Monterrey', fecha: hace(0, 2) },
    { id: id('accesos'), usuario_id: JOSE, correo: CUENTA_DEMO.correo, resultado: 'exito', ip: '10.0.0.31', agente: 'Edge 140', zona_horaria: 'America/Monterrey', fecha: hace(1, 2) },
  );
}
