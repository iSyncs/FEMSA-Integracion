import { Injectable } from '@nestjs/common';
import { AccesoService } from '../auth/acceso.service';
import { AuditoriasRepository } from '../datos/repositorios/auditorias.repository';
import { CierreRepository } from '../datos/repositorios/cierre.repository';
import { conflicto, prohibido } from '../common/errores';
import { BitacoraService } from '../bitacora/bitacora.service';
import type { Contexto } from '../auth/decoradores';
import type { NivelAprobacion } from '../datos/modelos';
import { PrecierreService } from './precierre.service';
import { SelladoService } from './sellado.service';
import { DecisionDto } from './cierre.dto';

const NIVELES: NivelAprobacion[] = ['jefe', 'gerente', 'director'];

@Injectable()
export class CierreService {
  constructor(
    private readonly acceso: AccesoService,
    private readonly auditorias: AuditoriasRepository,
    private readonly repo: CierreRepository,
    private readonly precierre: PrecierreService,
    private readonly sellado: SelladoService,
    private readonly bitacora: BitacoraService,
  ) {}

  /** HU_06: sólo el Auditor Líder responsable, en ejecución y sin pendientes. */
  async solicitar(ctx: Contexto, id: number) {
    const a = await this.acceso.auditoriaVisible(ctx.usuario, id);
    if (a.lider_id !== ctx.usuario.id) throw prohibido('Sólo el Auditor Líder responsable puede solicitar el cierre.');
    if (a.estado !== 'en_ejecucion') throw conflicto(`La auditoría está en estado "${a.estado}"; sólo se puede solicitar el cierre en ejecución.`);
    const pre = await this.precierre.evaluar(id);
    if (!pre.listo) throw conflicto('El expediente tiene pendientes y no puede turnarse a aprobación.', pre.pendientes);
    await this.repo.iniciarRonda(id, NIVELES);
    await this.auditorias.cambiarEstado(id, 'en_aprobacion');
    await this.bitacora.registrarOperacion(ctx, { entidad: 'auditorias', entidadId: id, folio: a.tracking_id, accion: 'SOLICITAR_CIERRE', anterior: { estado: a.estado }, nuevo: { estado: 'en_aprobacion' } });
    return this.acceso.auditoriaVisible(ctx.usuario, id);
  }

  /** HU_07 / HU_08: Jefe → Gerente → Director; la firma del Director sella el expediente. */
  async decidir(ctx: Contexto, id: number, dto: DecisionDto) {
    const a = await this.acceso.auditoriaVisible(ctx.usuario, id);
    if (a.estado !== 'en_aprobacion') throw conflicto('La auditoría no está en flujo de aprobación.');
    const turno = (await this.repo.aprobaciones(id)).find((x) => x.decision === 'pendiente');
    if (!turno || turno.nivel !== ctx.usuario.rol) throw prohibido(`El expediente está en la bandeja de: ${turno?.nivel ?? 'nadie'}.`);

    const comentario = dto.comentario?.trim() || null;
    await this.repo.registrarDecision(turno.id, { decision: dto.decision, aprobador_id: ctx.usuario.id, comentarios: comentario, zona_horaria: ctx.zonaHoraria });

    if (dto.decision === 'rechazado') {
      await this.auditorias.cambiarEstado(id, 'en_ejecucion');
      await this.repo.notificar(a.lider_id, id, 'rechazo_cierre', `${a.tracking_id} rechazada por ${turno.nivel}: ${comentario}`);
      await this.bitacora.registrarOperacion(ctx, { entidad: 'auditorias', entidadId: id, folio: a.tracking_id, accion: 'RECHAZAR', anterior: { estado: a.estado, nivel: turno.nivel }, nuevo: { estado: 'en_ejecucion', comentario } });
      return { estado: 'en_ejecucion' };
    }
    if (turno.nivel === 'director') {
      const sello = await this.sellado.sellar(id, ctx.usuario.id);
      await this.bitacora.registrarOperacion(ctx, { entidad: 'auditorias', entidadId: id, folio: a.tracking_id, accion: 'CERRAR', anterior: { estado: a.estado, nivel: turno.nivel }, nuevo: { estado: 'cerrada', hash: sello.hash } });
      return { estado: 'cerrada', ...sello };
    }
    await this.bitacora.registrarOperacion(ctx, { entidad: 'auditorias', entidadId: id, folio: a.tracking_id, accion: 'APROBAR', anterior: { estado: a.estado, nivel: turno.nivel }, nuevo: { estado: 'en_aprobacion', comentario } });
    return { estado: 'en_aprobacion' };
  }

  async integridad(ctx: Contexto, id: number) {
    await this.acceso.auditoriaVisible(ctx.usuario, id);
    const r = await this.sellado.verificar(id);
    if (!r) throw conflicto('La auditoría aún no ha sido sellada.');
    return r;
  }
}
