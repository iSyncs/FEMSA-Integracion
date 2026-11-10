import { BadRequestException, Injectable } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { PDFParse } from 'pdf-parse';
import { AccesoService } from '../auth/acceso.service';
import { noEncontrado } from '../common/errores';
import { EvidenciasRepository } from '../datos/repositorios/evidencias.repository';
import type { UsuarioSesion } from '../datos/repositorios/vistas';
import { BlobStorageService } from '../evidencias/blob-storage.service';

export function compactarContenido(texto: string) {
  const limpio = texto.replace(/[^\S\r\n]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  // 12,000 caracteres (unos 3,000 tokens) bastan para actas y reportes; el inicio y el cierre se conservan.
  const configurado = Number(process.env.OPENROUTER_MAX_DOCUMENT_CHARS ?? 12000);
  const limite = Number.isFinite(configurado) ? Math.min(50000, Math.max(4000, configurado)) : 12000;
  if (limpio.length <= limite) return limpio;
  const inicio = Math.floor(limite * 0.7);
  const fin = limite - inicio;
  return `${limpio.slice(0, inicio)}\n\n[... contenido intermedio omitido para optimizar el análisis ...]\n\n${limpio.slice(-fin)}`;
}

@Injectable()
export class ContenidoEvidenciaService {
  constructor(private readonly repo: EvidenciasRepository, private readonly acceso: AccesoService, private readonly blobs: BlobStorageService) {}

  async extraer(usuario: UsuarioSesion, auditoriaId: number, evidenciaId: number) {
    const evidencia = await this.repo.buscar(evidenciaId);
    if (!evidencia || evidencia.eliminado || evidencia.auditoria_id !== auditoriaId || evidencia.evidencia_padre_id) throw noEncontrado('Evidencia');
    await this.acceso.auditoriaVisible(usuario, auditoriaId);
    if (evidencia.tipo_mime !== 'application/pdf') throw new BadRequestException('Por ahora el análisis directo admite evidencias PDF.');
    if (!evidencia.blob_url) throw new BadRequestException('La evidencia no tiene un archivo asociado.');
    const buffer = evidencia.blob_url.startsWith('demo://')
      ? await readFile(join(__dirname, '../datos/memoria/archivos-demo', basename(evidencia.blob_url.slice('demo://'.length))))
      : (await this.blobs.descargar(evidencia.blob_url, 25 * 1024 * 1024)).buffer;
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const resultado = await parser.getText();
      const contenido = compactarContenido(resultado.text);
      if (contenido.length < 20) throw new BadRequestException('No se pudo extraer texto suficiente del PDF seleccionado.');
      return { nombre: evidencia.nombre_archivo, contenido };
    } finally { await parser.destroy(); }
  }
}
