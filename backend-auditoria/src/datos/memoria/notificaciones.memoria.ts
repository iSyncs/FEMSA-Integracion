import { Injectable } from '@nestjs/common';
import { BaseDeDatosMemoria } from './base-de-datos-memoria';
import { NotificacionesRepository, NotificacionVista, NuevaNotificacion } from '../repositorios/notificaciones.repository';
import type { Notificacion } from '../modelos';

@Injectable()
export class NotificacionesMemoriaRepository extends NotificacionesRepository {
  constructor(private readonly db: BaseDeDatosMemoria) { super(); }

  private vista(n: Notificacion): NotificacionVista {
    const plan = n.plan_id ? this.db.planes.find((p) => p.id === n.plan_id) : undefined;
    const hallazgo = plan ? this.db.hallazgos.find((h) => h.id === plan.hallazgo_id) : undefined;
    const auditoriaId = n.auditoria_id ?? hallazgo?.auditoria_id ?? null;
    const auditoria = auditoriaId ? this.db.auditorias.find((a) => a.id === auditoriaId) : undefined;
    return {
      id: n.id, usuario_id: n.usuario_id, tipo: n.tipo, mensaje: n.mensaje ?? '', fecha: n.fecha_envio ?? new Date(0), leida: n.leida,
      plan_id: n.plan_id, plan_folio: plan?.tracking_id ?? null, auditoria_id: auditoriaId, auditoria_folio: auditoria?.tracking_id ?? null,
    };
  }

  async crear(n: NuevaNotificacion) {
    this.db.notificaciones.push({
      id: this.db.siguienteId('notificaciones'), usuario_id: n.usuarioId, plan_id: n.planId ?? null, auditoria_id: n.auditoriaId ?? null,
      tipo: n.tipo, mensaje: n.mensaje.slice(0, 500), canal: 'plataforma', fecha_programada: null, fecha_envio: new Date(), leida: false,
    });
  }

  async listar(usuarioId: number, limite: number) {
    return this.db.notificaciones.filter((n) => n.usuario_id === usuarioId)
      .sort((a, b) => b.id - a.id).slice(0, limite).map((n) => this.vista(n));
  }

  async noLeidas(usuarioId: number) {
    return this.db.notificaciones.filter((n) => n.usuario_id === usuarioId && !n.leida).length;
  }

  async marcarLeida(id: number, usuarioId: number) {
    const n = this.db.notificaciones.find((x) => x.id === id && x.usuario_id === usuarioId);
    if (n) n.leida = true;
    return !!n;
  }

  async marcarTodas(usuarioId: number) {
    for (const n of this.db.notificaciones) if (n.usuario_id === usuarioId) n.leida = true;
  }

  async yaEnviadaConFolio(usuarioId: number, tipo: string, folio: string) {
    return this.db.notificaciones.some((n) => n.usuario_id === usuarioId && n.tipo === tipo && (n.mensaje ?? '').includes(folio));
  }

  async yaEnviada(usuarioId: number, planId: number, tipo: string) {
    return this.db.notificaciones.some((n) => n.usuario_id === usuarioId && n.plan_id === planId && n.tipo === tipo);
  }
}
