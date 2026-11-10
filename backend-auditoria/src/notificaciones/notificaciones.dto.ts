import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, Max, Min } from "class-validator";

export class ConsultarNotificacionesDto {
  @ApiPropertyOptional({ enum: ["todas", "no_leidas"], default: "todas" })
  @IsOptional()
  @IsIn(["todas", "no_leidas"])
  estado?: "todas" | "no_leidas";
}

export class SimularNotificacionesDto {
  @ApiPropertyOptional({ example: 10, description: "Segundos de espera antes de que lleguen los avisos (0 a 120)." })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(120)
  retrasoSegundos?: number;
}
