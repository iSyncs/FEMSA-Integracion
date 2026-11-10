import { Module } from "@nestjs/common";
import { EvidenciasController } from "./evidencias.controller";
import { EvidenciasService } from "./evidencias.service";
import { BlobStorageService } from "./blob-storage.service";
import { TokenCargaService } from "./token-carga.service";

@Module({
  controllers: [EvidenciasController],
  providers: [EvidenciasService, BlobStorageService, TokenCargaService],
  exports: [BlobStorageService],
})
export class EvidenciasModule {}
