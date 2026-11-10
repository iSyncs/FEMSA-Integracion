import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { AccesoService } from '../auth/acceso.service';
import type { Contexto } from '../auth/decoradores';
import { AuditoriasRepository } from '../datos/repositorios/auditorias.repository';
import { BitacoraRepository } from '../datos/repositorios/bitacora.repository';
import { EvidenciasRepository } from '../datos/repositorios/evidencias.repository';
import type { EvidenciaHija } from '../datos/repositorios/evidencias.repository';
import { noEncontrado, prohibido } from '../common/errores';
import { analizarZip, MAX_ARCHIVO, sha256, validarContenido, validarSolicitudArchivo } from './archivo-seguro';
import { BlobStorageService } from './blob-storage.service';
import { ConfirmarCargaDto, IniciarCargaDto } from './evidencias.dto';
import { TokenCargaService } from './token-carga.service';

@Injectable()
export class EvidenciasService {
  constructor(
    private readonly acceso: AccesoService,
    private readonly auditorias: AuditoriasRepository,
    private readonly repo: EvidenciasRepository,
    private readonly bitacora: BitacoraRepository,
    private readonly blobs: BlobStorageService,
    private readonly tokens: TokenCargaService,
  ) {}

  async iniciar(ctx: Contexto, dto: IniciarCargaDto) {
    const auditoria = await this.acceso.auditoriaVisible(ctx.usuario, dto.auditoriaId);
    if (auditoria.estado === 'cerrada') throw new ConflictException('Expediente cerrado: las evidencias son de solo lectura.');
    if (ctx.usuario.rol === 'auditado' && !dto.solicitudPbcId) throw prohibido('El auditado sólo puede responder solicitudes PBC.');
    if (!(await this.repo.destinoValido({ auditoriaId: dto.auditoriaId, procedimientoId: dto.procedimientoId ?? null, solicitudPbcId: dto.solicitudPbcId ?? null }))) {
      throw new BadRequestException('El procedimiento o solicitud PBC no pertenece a la auditoría.');
    }
    if (ctx.usuario.rol === 'auditor' && dto.procedimientoId) {
      const p = await this.auditorias.procedimiento(dto.procedimientoId);
      if (!p || p.auditor_id !== ctx.usuario.id) throw prohibido('Sólo puedes adjuntar evidencia a procedimientos asignados.');
    }
    if (dto.reemplazaId) {
      const anterior = await this.repo.buscar(dto.reemplazaId);
      if (!anterior || anterior.auditoria_id !== dto.auditoriaId || anterior.eliminado || anterior.evidencia_padre_id) throw new BadRequestException('La evidencia a reemplazar no es válida.');
      if (ctx.usuario.rol !== 'lider' && anterior.cargado_por_id !== ctx.usuario.id) throw prohibido('Sólo el autor o el líder puede reemplazar esta evidencia.');
    }
    let archivo: ReturnType<typeof validarSolicitudArchivo>;
    try { archivo = validarSolicitudArchivo(dto.nombreArchivo, dto.tipoMime, dto.tamanoBytes); }
    catch (e) { throw new BadRequestException((e as Error).message); }
    const blob = `${dto.auditoriaId}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}${extname(archivo.nombre).toLowerCase()}`;
    const token = this.tokens.firmar({ usuarioId: ctx.usuario.id, auditoriaId: dto.auditoriaId, procedimientoId: dto.procedimientoId ?? null,
      solicitudPbcId: dto.solicitudPbcId ?? null, reemplazaId: dto.reemplazaId ?? null, nombre: archivo.nombre, mime: archivo.mime,
      tamano: dto.tamanoBytes, blob });
    return { uploadUrl: await this.blobs.autorizarCarga(blob), token, expiraEnSegundos: 600, encabezados: { 'x-ms-blob-type': 'BlockBlob', 'Content-Type': 'application/octet-stream' } };
  }

  /** El navegador manda los bytes a la API y ésta los escribe en el blob autorizado por el token. */
  async subirPorApi(ctx: Contexto, token: string, contenido: unknown) {
    const carga = this.tokens.verificar(token);
    if (carga.usuarioId !== ctx.usuario.id) throw new ForbiddenException('El token pertenece a otro usuario.');
    if (!Buffer.isBuffer(contenido) || !contenido.length) throw new BadRequestException('No llegó el archivo.');
    if (contenido.length !== carga.tamano) throw new BadRequestException('El tamaño subido no coincide con el autorizado.');
    await this.blobs.subir(carga.blob, contenido);
    return { subido: true };
  }

  async confirmar(ctx: Contexto, dto: ConfirmarCargaDto) {
    const carga = this.tokens.verificar(dto.token);
    if (carga.usuarioId !== ctx.usuario.id) throw new ForbiddenException('El token pertenece a otro usuario.');
    await this.acceso.auditoriaVisible(ctx.usuario, carga.auditoriaId);
    let datos: Awaited<ReturnType<BlobStorageService['descargar']>>;
    try { datos = await this.blobs.descargar(carga.blob, Math.min(MAX_ARCHIVO, carga.tamano)); }
    catch (e) { throw new BadRequestException((e as Error).message); }
    if (datos.tamano !== carga.tamano) { await this.blobs.borrarCargaRechazada(carga.blob); throw new BadRequestException('El tamaño subido no coincide con el autorizado.'); }
    const antivirus = this.blobs.resultadoAntivirus(datos.etiquetas);
    if (/malicious/i.test(antivirus ?? '')) { await this.blobs.borrarCargaRechazada(carga.blob); throw new BadRequestException('Defender for Storage detectó contenido malicioso.'); }
    if (process.env.AZURE_DEFENDER_REQUIRED !== 'false' && !/no threats found/i.test(antivirus ?? '')) {
      throw new ConflictException({ error: 'El archivo todavía está siendo analizado por Microsoft Defender.', detalles: { estado: antivirus ?? 'Pendiente' } });
    }
    let hijas: EvidenciaHija[] = [];
    try {
      await validarContenido(carga.nombre, datos.buffer);
      if (extname(carga.nombre).toLowerCase() === '.zip') hijas = await analizarZip(datos.buffer);
    } catch (e) { await this.blobs.borrarCargaRechazada(carga.blob); throw new BadRequestException((e as Error).message); }
    const evidencia = await this.repo.crear({ procedimiento_id: carga.procedimientoId, solicitud_pbc_id: carga.solicitudPbcId, hallazgo_id: null,
      nombre_archivo: carga.nombre, blob_url: carga.blob, tipo_mime: carga.mime, tamano_bytes: datos.tamano,
      hash_sha256: sha256(datos.buffer), cargado_por_id: ctx.usuario.id }, hijas, carga.reemplazaId ?? undefined);
    await this.bitacora.agregarOperacion({ entidad: 'evidencias', entidad_id: evidencia.id, folio: evidencia.tracking_id,
      accion: carga.reemplazaId ? 'REEMPLAZAR' : 'CARGAR', usuario_id: ctx.usuario.id,
      detalle: JSON.stringify({ nombre: evidencia.nombre_archivo, hash_sha256: evidencia.hash_sha256, hijos_zip: hijas.length, reemplaza_id: carga.reemplazaId }),
      ip: ctx.ip, zona_horaria: ctx.zonaHoraria });
    return { ...evidencia, hijos: hijas.length, antivirus: antivirus ?? (process.env.AZURE_DEFENDER_REQUIRED === 'false' ? 'Deshabilitado en desarrollo' : 'No threats found') };
  }

  async accesoArchivo(ctx: Contexto, id: number, vistaPrevia: boolean) {
    const evidencia = await this.repo.buscar(id);
    if (!evidencia || evidencia.eliminado) throw noEncontrado('Evidencia');
    await this.acceso.auditoriaVisible(ctx.usuario, evidencia.auditoria_id);
    const fisica = evidencia.evidencia_padre_id ? await this.repo.buscar(evidencia.evidencia_padre_id) : evidencia;
    if (!fisica?.blob_url) throw noEncontrado('Archivo');
    return { url: await this.blobs.autorizarLectura(fisica.blob_url, fisica.nombre_archivo, fisica.tipo_mime ?? 'application/octet-stream', vistaPrevia),
      expiraEnSegundos: 300, entradaZip: evidencia.evidencia_padre_id ? evidencia.nombre_archivo : null };
  }

  async eliminar(ctx: Contexto, id: number) {
    const evidencia = await this.repo.buscar(id);
    if (!evidencia || evidencia.eliminado || evidencia.evidencia_padre_id) throw noEncontrado('Evidencia');
    const auditoria = await this.acceso.auditoriaVisible(ctx.usuario, evidencia.auditoria_id);
    if (auditoria.estado === 'cerrada') throw new ConflictException('Expediente cerrado: las evidencias son de solo lectura.');
    if (ctx.usuario.rol !== 'lider' && evidencia.cargado_por_id !== ctx.usuario.id) throw prohibido('Sólo el autor o el líder puede eliminar esta evidencia.');
    await this.repo.marcarEliminada(id);
    await this.bitacora.agregarOperacion({ entidad: 'evidencias', entidad_id: id, folio: evidencia.tracking_id, accion: 'ELIMINAR_LOGICO',
      usuario_id: ctx.usuario.id, detalle: JSON.stringify({ retencion_dias: 180, blob_conservado: true }), ip: ctx.ip, zona_horaria: ctx.zonaHoraria });
  }
}
