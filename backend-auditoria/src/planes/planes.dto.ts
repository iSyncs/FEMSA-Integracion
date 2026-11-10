import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsNumber, Matches, Max, Min, ValidateIf } from 'class-validator';
import { TextoSignificativo } from '../common/validacion/texto-significativo';

export class CrearPlanDto {

  @ApiProperty({example: 3,description: 'Identificador del hallazgo.'
  })
  @Type(() => Number)
  @IsInt({ message: 'El hallazgo debe ser un identificador entero.'})
  @Min(1, { message: 'El hallazgo debe ser válido.'}) 
  hallazgoId: number;
  @ApiProperty({ example: 'Implementar doble validación para pagos mayores a $50,000 MXN.'})
  @TextoSignificativo(10, 'la descripción del plan') 
  descripcion: string;
  @ApiProperty({ example: 12, description: 'Identificador del usuario responsable.'})
  @Type(() => Number)
  @IsInt({ message: 'El responsable debe ser un identificador entero.'})
  @Min(1, { message: 'El responsable debe ser válido.'}) 
  responsableId: number;
  @ApiProperty({ example: '2026-10-30', description: 'Fecha compromiso en formato YYYY-MM-DD.'})
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha compromiso debe tener formato YYYY-MM-DD.'})
  @IsDateString({ strict: true },{ message: 'La fecha compromiso debe ser una fecha válida.'}) 
  fechaCompromiso: string;
  @ApiProperty({ example: 150000, description: 'Monto de impacto normalizado a MXN.'})
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 },{message: 'El monto debe ser un número con máximo dos decimales.'})
  @Min(0, {message: 'El monto no puede ser negativo.'}) 
  montoMxn: number;
}


export class RegistrarAvanceDto {
  @ApiProperty({ example: 80, minimum: 0, maximum: 100 })
  @Type(() => Number) @IsInt({ message: 'El avance debe ser un entero entre 0 y 100.' })
  @Min(0, { message: 'El avance debe ser un entero entre 0 y 100.' }) @Max(100, { message: 'El avance debe ser un entero entre 0 y 100.' })
  avance: number;

  @ApiProperty({ example: 'Se removió el último conflicto de tesorería.' })
  @TextoSignificativo(10, 'el comentario de avance')
  comentario: string;
}

export class ValidarPlanDto {
  @ApiProperty({ enum: ['aprobado', 'rechazado'], example: 'aprobado' })
  @IsIn(['aprobado', 'rechazado'], { message: 'La decisión debe ser aprobado o rechazado.' })
  decision: 'aprobado' | 'rechazado';

  @ApiProperty({ required: false, example: 'Falta evidencia del control en producción.' })
  // Al aprobar el comentario es opcional; al rechazar debe explicar el motivo.
  @ValidateIf((o: ValidarPlanDto) => o.decision === 'rechazado')
  @TextoSignificativo(10, 'la retroalimentación del rechazo')
  comentario?: string;
}
