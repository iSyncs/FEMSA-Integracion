import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsPositive, IsString, MaxLength, ValidateIf } from 'class-validator';
import { TextoSignificativo } from '../common/validacion/texto-significativo';

export class CrearAuditoriaDto {
  @ApiProperty({ example: 'Control de inventarios · CEDIS Monterrey' })
  @TextoSignificativo(5, 'el nombre de la auditoría') @MaxLength(200)
  nombre: string;

  @ApiProperty({ example: 'Validar conteos cíclicos y ajustes de inventario del CEDIS.' })
  @TextoSignificativo(20, 'el objetivo')
  objetivo: string;

  @ApiProperty({ example: 4 }) @Type(() => Number) @IsInt({ message: 'Selecciona la unidad de negocio.' }) @IsPositive({ message: 'Selecciona la unidad de negocio.' })
  unidadNegocioId: number;

  @ApiProperty({ enum: ['Operativa', 'Financiera', 'Cybersecurity', 'Cumplimiento'] })
  @IsIn(['Operativa', 'Financiera', 'Cybersecurity', 'Cumplimiento'], { message: 'Selecciona el tipo.' })
  tipo: string;

  @ApiProperty({ enum: ['Alta', 'Media', 'Baja'] })
  @IsIn(['Alta', 'Media', 'Baja'], { message: 'La prioridad debe ser Alta, Media o Baja.' })
  prioridad: 'Alta' | 'Media' | 'Baja';

  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(120)
  area?: string;

  @ApiProperty({ required: false, example: '2026-10-05' }) @IsOptional() @IsDateString({}, { message: 'Fecha de inicio inválida.' })
  fechaInicio?: string;

  @ApiProperty({ required: false, example: '2026-10-30' }) @IsOptional() @IsDateString({}, { message: 'Fecha de fin inválida.' })
  fechaFin?: string;
}

const MADUREZ = ['Inicial', 'Funcional', 'Definido', 'Administrado', 'Optimizado'] as const;

export class EvaluarProcedimientoDto {
  @ApiProperty({ enum: MADUREZ })
  @IsIn(MADUREZ, { message: 'Selecciona una calificación de diseño válida.' })
  diseno: typeof MADUREZ[number];

  @ApiProperty({ enum: MADUREZ })
  @IsIn(MADUREZ, { message: 'Selecciona una calificación de efectividad válida.' })
  efectividad: typeof MADUREZ[number];

  @ApiProperty({ enum: ['Bajo', 'Moderado', 'Alto'] })
  @IsIn(['Bajo', 'Moderado', 'Alto'], { message: 'Selecciona la vulnerabilidad histórica.' })
  vulnerabilidad: 'Bajo' | 'Moderado' | 'Alto';

  @ApiProperty({ required: false, description: 'Obligatoria y significativa si la efectividad es Inicial o Funcional.' })
  @ValidateIf((o: EvaluarProcedimientoDto) => ['Inicial', 'Funcional'].includes(o.efectividad))
  @TextoSignificativo(20, 'la justificación técnica') @MaxLength(2000)
  comentarios?: string;
}
