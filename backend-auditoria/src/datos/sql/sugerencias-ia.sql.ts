import { Injectable } from '@nestjs/common';
import { ConexionSql } from './conexion-sql';
import { AnalisisGuardado, SugerenciasIaRepository } from '../repositorios/sugerencias-ia.repository';

/** Tabla dbo.IA_ANALYSIS (script: datos/sql/scripts/ia_analysis.sql). */
type Fila = { id: number; auditoriaId: number; evidenciaId: number; lote: string; contenido: string };
const COLUMNAS = 'analysis_id AS id, audit_id AS auditoriaId, evidence_id AS evidenciaId, batch AS lote, payload AS contenido';
const leer = <P>(f: Fila): AnalisisGuardado<P> => ({ ...f, contenido: JSON.parse(f.contenido) as P });

@Injectable()
export class SugerenciasIaSqlRepository extends SugerenciasIaRepository {
  constructor(private readonly db: ConexionSql) { super(); }

  async listar<P>() {
    return (await this.db.consulta<Fila>(`SELECT ${COLUMNAS} FROM dbo.IA_ANALYSIS ORDER BY analysis_id`)).map(leer<P>);
  }

  async buscar<P>(auditoriaId: number, evidenciaId: number) {
    const [f] = await this.db.consulta<Fila>(`SELECT ${COLUMNAS} FROM dbo.IA_ANALYSIS WHERE audit_id=@a AND evidence_id=@e`, { a: auditoriaId, e: evidenciaId });
    return f ? leer<P>(f) : null;
  }

  async buscarPorId<P>(id: number) {
    const [f] = await this.db.consulta<Fila>(`SELECT ${COLUMNAS} FROM dbo.IA_ANALYSIS WHERE analysis_id=@id`, { id });
    return f ? leer<P>(f) : null;
  }

  async guardar<P>(d: Omit<AnalisisGuardado<P>, 'id'> & { usuarioId: number }) {
    const [f] = await this.db.consulta<{ id: number }>(`
      INSERT INTO dbo.IA_ANALYSIS (audit_id, evidence_id, batch, payload, created_by)
      OUTPUT INSERTED.analysis_id AS id
      VALUES (@a, @e, @lote, @payload, @usuario)`, {
      a: d.auditoriaId, e: d.evidenciaId, lote: d.lote, payload: JSON.stringify(d.contenido), usuario: d.usuarioId,
    });
    return { id: f.id, auditoriaId: d.auditoriaId, evidenciaId: d.evidenciaId, lote: d.lote, contenido: d.contenido };
  }

  async actualizar<P>(id: number, contenido: P) {
    await this.db.consulta('UPDATE dbo.IA_ANALYSIS SET payload=@payload, updated_at=SYSUTCDATETIME() WHERE analysis_id=@id', { id, payload: JSON.stringify(contenido) });
  }
}
