import { hoyEn } from '../common/utils/fechas';
import type { EstadoPlan } from '../datos/modelos';

export type Semaforo = 'en_tiempo' | 'por_vencer' | 'demorado' | 'cerrado';

interface PlanParaSemaforo {
  estado: EstadoPlan; avance_pct: number; fecha_compromiso: Date; fecha_conclusion: Date | null; zona_horaria: string;
}

/* HU_10 · La fecha compromiso vence a las 23:59:59 en la zona horaria de la unidad de negocio. */
export function semaforo(plan: PlanParaSemaforo, ahora: Date = new Date()): { semaforo: Semaforo; diasRestantes: number } {
  const compromiso = hoyEn(
    plan.zona_horaria,
    plan.fecha_compromiso,
  );
  const hoy = hoyEn(plan.zona_horaria, ahora);
  const dias = Math.round((Date.parse(compromiso) - Date.parse(hoy)) / 86_400_000);
  if (plan.estado === 'cerrado') return { semaforo: 'cerrado', diasRestantes: dias };
  if (plan.avance_pct === 100 && plan.fecha_conclusion) {
    return { semaforo: hoyEn(plan.zona_horaria, plan.fecha_conclusion) <= compromiso ? 'en_tiempo' : 'demorado', diasRestantes: dias };
  }
  if (dias < 0) return { semaforo: 'demorado', diasRestantes: dias };
  if (dias <= 5) return { semaforo: 'por_vencer', diasRestantes: dias };
  return { semaforo: 'en_tiempo', diasRestantes: dias };
}
