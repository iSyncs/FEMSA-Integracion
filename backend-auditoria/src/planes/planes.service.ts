import { Injectable } from '@nestjs/common';
import { AccesoService } from '../auth/acceso.service';
import { PlanesRepository } from '../datos/repositorios/planes.repository';
import { conflicto, noEncontrado, prohibido } from '../common/errores';
import { BitacoraService } from '../bitacora/bitacora.service';
import type { Contexto } from '../auth/decoradores';
import type { PlanVista, UsuarioSesion } from '../datos/repositorios/vistas';
import { semaforo } from './semaforo';
import { CrearPlanDto, RegistrarAvanceDto, ValidarPlanDto } from './planes.dto';
import { CatalogosRepository } from '../datos/repositorios/usuarios.repository';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { UsuariosRepository } from '../datos/repositorios/usuarios.repository';
import { HallazgosRepository } from '../datos/repositorios/hallazgos.repository';

const salida = (p: PlanVista) => ({
  id: p.id, tracking_id: p.tracking_id, descripcion: p.descripcion, fecha_compromiso: p.fecha_compromiso, monto_mxn: p.monto_mxn,
  estado: p.estado, avance_pct: p.avance_pct, fecha_conclusion: p.fecha_conclusion, responsable_id: p.responsable_id,
  responsable: p.responsable, hallazgo_id: p.hallazgo_id, hallazgo_folio: p.hallazgo_folio, hallazgo: p.hallazgo, severidad: p.severidad,
  auditoria_id: p.auditoria_id, auditoria_folio: p.auditoria_folio, auditoria: p.auditoria, unidad: p.unidad, zona_horaria: p.zona_horaria,
  ...semaforo(p),
});

/** HU_09 · Asignación y formalización de planes de remediación. */

function finDelDiaEnZona(
  fecha: string,
  zonaHoraria: string,
): Date {
  const [anio, mes, dia] = fecha.split('-').map(Number);

  // Representación aproximada del horario local como si fuera UTC.
  const aproximacion = Date.UTC(
    anio,
    mes - 1,
    dia,
    23,
    59,
    59,
    999,
  );

  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: zonaHoraria,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
    hourCycle: 'h23',
  }).formatToParts(new Date(aproximacion));

  const valores = Object.fromEntries(
    partes
      .filter((parte) => parte.type !== 'literal')
      .map((parte) => [parte.type, parte.value]),
  );

  const representadoComoUtc = Date.UTC(
    Number(valores.year),
    Number(valores.month) - 1,
    Number(valores.day),
    Number(valores.hour),
    Number(valores.minute),
    Number(valores.second),
    Number(valores.fractionalSecond ?? 0),
  );

  const desplazamiento = representadoComoUtc - aproximacion;

  return new Date(aproximacion - desplazamiento);
}

/** HU_10 · Registro de avances y semáforo de cumplimiento. */
@Injectable()
export class PlanesService {
  constructor(
    private readonly acceso: AccesoService,
    private readonly repo: PlanesRepository,
    private readonly bitacora: BitacoraService,
    private readonly hallazgos: HallazgosRepository,
    private readonly usuarios: UsuariosRepository,
    private readonly catalogos: CatalogosRepository,
    private readonly notificaciones: NotificacionesService,
  ) {}

  async listar(usuario: UsuarioSesion) {
    const visible = await this.acceso.filtro(usuario);
    return (await this.repo.listar())
      .filter((p) => visible(p) && (usuario.rol !== 'auditado' || p.responsable_id === usuario.id))
      .map(salida);
  }

  async crear(ctx: Contexto, dto: CrearPlanDto) {
    /*
     * HallazgosRepository.listar() devuelve vistas con:
     * auditoria_id, unidad_negocio_id y direccion.
     *
     * Por ello podemos reutilizar AccesoService.filtro()
     * y evitar duplicar las reglas de seguridad por fila.
     */
    const hallazgos = await this.hallazgos.listar();
  
    const hallazgo = hallazgos.find(
      (h) => h.id === dto.hallazgoId,
    );
  
    if (
      !hallazgo ||
      !(await this.acceso.filtro(ctx.usuario))(hallazgo)
    ) {
      throw noEncontrado('Hallazgo');
    }
  
    /*
     * Obtenemos la unidad de negocio para determinar
     * la zona horaria que gobierna la fecha compromiso.
     */
    const unidad = await this.catalogos.unidad(
      hallazgo.unidad_negocio_id,
    );
  
    if (!unidad) {
      throw noEncontrado('Unidad de negocio');
    }
  
    /*
     * El responsable debe ser un usuario activo.
     */
    const responsable = await this.usuarios.buscarActivo(
      dto.responsableId,
    );
  
    if (!responsable) {
      throw noEncontrado('Responsable');
    }
  
    /*
     * La fecha compromiso se guarda como el instante
     * correspondiente a las 23:59:59.999 en la zona
     * horaria de la unidad de negocio.
     */
    const fechaCompromiso = finDelDiaEnZona(
      dto.fechaCompromiso,
      unidad.zona_horaria,
    );
  
    const plan = await this.repo.crear({
      hallazgo_id: dto.hallazgoId,
      descripcion: dto.descripcion.trim(),
      responsable_id: dto.responsableId,
      fecha_compromiso: fechaCompromiso,
      monto_mxn: dto.montoMxn,
      estado: 'abierto',
      avance_pct: 0,
      fecha_conclusion: null,
    });

    await this.bitacora.registrarOperacion(ctx, { entidad: 'planes', entidadId: plan.id, folio: plan.tracking_id, accion: 'CREAR', nuevo: { hallazgo_id: plan.hallazgo_id, responsable_id: plan.responsable_id, estado: plan.estado } });

    return salida(
      (await this.repo.buscar(plan.id))!,
    );
  }

  private async visible(usuario: UsuarioSesion, id: number) {
    const p = await this.repo.buscar(id);
    if (!p || !(await this.acceso.filtro(usuario))(p)) throw noEncontrado('Plan de remediación');
    return p;
  }

  async detalle(usuario: UsuarioSesion, id: number) {
    const p = await this.visible(usuario, id);
    const avances = await this.repo.avances(id);
    return { ...salida(p), avances: avances.map((a) => ({ id: a.id, avance_pct: a.avance_pct, comentario: a.comentario, fecha: a.fecha, zona_horaria: a.zona_horaria, usuario: a.usuario })) };
  }

  /** HU_16 · Historial consolidado de avances para la vista del Director. */
  async avancesGenerales(usuario: UsuarioSesion) {
    const visible = await this.acceso.filtro(usuario);
    const planes = (await this.repo.listar()).filter((p) => visible(p));
    const avances = await Promise.all(planes.map(async (p) => {
      const historial = await this.repo.avances(p.id);
      return historial.map((a) => ({
        id: a.id, plan_id: p.id, tracking_id: p.tracking_id, plan: p.descripcion,
        avance_pct: a.avance_pct, comentario: a.comentario, fecha: a.fecha, zona_horaria: a.zona_horaria,
        usuario: a.usuario, responsable: p.responsable, auditoria: p.auditoria, auditoria_folio: p.auditoria_folio,
        unidad: p.unidad,
      }));
    }));
    return avances.flat().sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
  }

  /** Al llegar a 100 % el plan pasa a revisión de Control Interno (GRC). */
  async registrarAvance(ctx: Contexto, id: number, dto: RegistrarAvanceDto) {
    const p = await this.visible(ctx.usuario, id);
    if (ctx.usuario.rol === 'auditado' && p.responsable_id !== ctx.usuario.id) throw prohibido('Sólo el responsable del plan puede capturar avances.');
    if (!['abierto', 'en_progreso', 'rechazado'].includes(p.estado)) throw conflicto(`El plan está en "${p.estado}" y no admite nuevos avances.`);
    if (dto.avance < p.avance_pct) throw conflicto(`El avance no puede ser menor al último registrado (${p.avance_pct}%).`);
    const estado = dto.avance === 100 ? 'revision_grc' : 'en_progreso';
    await this.repo.actualizar(id, { avance_pct: dto.avance, estado, fecha_conclusion: dto.avance === 100 ? new Date() : null });
    await this.repo.registrarAvance({
      plan_id: id, avance_pct: dto.avance, comentario: dto.comentario.trim(), evidencia_id: null,
      actualizado_por_id: ctx.usuario.id, zona_horaria: ctx.zonaHoraria,
    });
    await this.bitacora.registrarOperacion(ctx, { entidad: 'planes', entidadId: id, folio: p.tracking_id, accion: 'ACTUALIZAR', anterior: { avance_pct: p.avance_pct, estado: p.estado }, nuevo: { avance_pct: dto.avance, estado } });
    if (estado === 'revision_grc') {
      const grc = (await this.usuarios.listarActivos()).filter((u) => u.rol === 'grc' && u.unidad_negocio_id === p.unidad_negocio_id);
      await this.notificaciones.avisar(grc.map((u) => u.id), {
        tipo: 'plan_revision', planId: id, auditoriaId: p.auditoria_id,
        mensaje: `${p.tracking_id} llegó a 100 % y espera tu validación: ${p.descripcion}`,
      });
    }
    return salida((await this.repo.buscar(id))!);
  }

  /** Solo el rol de la etapa actual puede decidir; el repositorio vuelve a comprobar el estado al escribir. */
  async validar(ctx: Contexto, id: number, dto: ValidarPlanDto) {
    const p = await this.visible(ctx.usuario, id);
    const rolEsperado = p.estado === 'revision_grc' ? 'grc' : p.estado === 'revision_jefe' ? 'jefe' : null;
    if (rolEsperado && ctx.usuario.rol !== rolEsperado) throw prohibido(`La etapa "${p.estado}" sólo puede resolverla ${rolEsperado === 'grc' ? 'GRC' : 'Jefatura'}.`);
    if (p.avance_pct < 100) throw conflicto('El plan requiere 100 % de avance para iniciar o continuar la validación.');
    if (!rolEsperado) throw conflicto(`El plan está en "${p.estado}" y no admite validación.`);
    await this.repo.validar(id, p.estado, dto.decision, dto.comentario?.trim() || null, ctx.usuario, ctx.zonaHoraria, ctx.ip);
    const comentario = dto.comentario?.trim() ? ` "${dto.comentario.trim()}"` : '';
    await this.notificaciones.avisar([p.responsable_id], {
      tipo: dto.decision === 'aprobado' ? 'plan_aprobado' : 'plan_rechazado', planId: id, auditoriaId: p.auditoria_id,
      mensaje: `${p.tracking_id}: ${ctx.usuario.rol_nombre} ${dto.decision === 'aprobado' ? 'aprobó' : 'rechazó'} el plan.${comentario}`,
    });
    return salida((await this.repo.buscar(id))!);
  }
}
