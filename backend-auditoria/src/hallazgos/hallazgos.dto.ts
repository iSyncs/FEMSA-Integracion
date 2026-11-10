import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsPositive, Min } from 'class-validator';
import { TextoSignificativo } from '../common/validacion/texto-significativo';

export const SEVERIDADES = ['Crítica', 'Alta', 'Moderada', 'Baja'] as const;
export const TIPOS = ['Debilidad de control', 'Debilidad menor'] as const;
const vacioANulo = ({ value }: { value: unknown }) => (value === '' || value === null ? undefined : value);

/** HU_04 · Registro metodológico (condición, criterio, causa, efecto, recomendación). */
export class CrearHallazgoDto {
  @ApiProperty({ example: 2 }) @Type(() => Number) @IsInt({ message: 'Selecciona la auditoría.' }) @IsPositive({ message: 'Selecciona la auditoría.' })
  auditoriaId: number;

  @ApiProperty({ required: false, example: 4 }) @Transform(vacioANulo) @IsOptional() @Type(() => Number) @IsInt() @IsPositive()
  procedimientoId?: number;

  @ApiProperty({ example: 'Pagos liberados sin segunda firma' }) @TextoSignificativo(5, 'el título') titulo: string;
  @ApiProperty() @TextoSignificativo(20, 'la condición detectada') condicion: string;
  @ApiProperty() @TextoSignificativo(10, 'el criterio incumplido') criterio: string;
  @ApiProperty() @TextoSignificativo(10, 'la causa raíz') causa: string;
  @ApiProperty() @TextoSignificativo(10, 'el efecto o impacto') efecto: string;
  @ApiProperty() @TextoSignificativo(10, 'la recomendación') recomendacion: string;

  @ApiProperty({ enum: SEVERIDADES }) @IsIn(SEVERIDADES, { message: 'Selecciona la severidad.' })
  severidad: (typeof SEVERIDADES)[number];

  @ApiProperty({ enum: TIPOS }) @IsIn(TIPOS, { message: 'Selecciona el tipo.' })
  tipo: (typeof TIPOS)[number];

  @ApiProperty({ required: false, example: 780000 }) @Transform(vacioANulo) @IsOptional() @Type(() => Number)
  @IsNumber({}, { message: 'Captura un monto válido en MXN.' }) @Min(0, { message: 'El impacto debe ser un monto positivo en MXN.' })
  impactoMxn?: number;
}
