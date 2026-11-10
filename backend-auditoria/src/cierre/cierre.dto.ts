import { ApiProperty } from '@nestjs/swagger';
import { IsIn, ValidateIf } from 'class-validator';
import { TextoSignificativo } from '../common/validacion/texto-significativo';

export class DecisionDto {
  @ApiProperty({ enum: ['aprobado', 'rechazado'] })
  @IsIn(['aprobado', 'rechazado'], { message: 'La decisión debe ser aprobado o rechazado.' })
  decision: 'aprobado' | 'rechazado';

  @ApiProperty({ required: false, description: 'Obligatorio al rechazar (mínimo 20 caracteres con contenido)' })
  @ValidateIf((o: DecisionDto) => o.decision === 'rechazado')
  @TextoSignificativo(20, 'el motivo del rechazo')
  comentario?: string;
}
