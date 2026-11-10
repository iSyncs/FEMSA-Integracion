import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { DefaultAzureCredential } from '@azure/identity';
import {
  BlobSASPermissions, BlobServiceClient, generateBlobSASQueryParameters, SASProtocol, StorageSharedKeyCredential,
} from '@azure/storage-blob';

@Injectable()
export class BlobStorageService {
  private readonly contenedor = process.env.AZURE_STORAGE_CONTAINER ?? 'evidencias';
  private readonly cuenta = process.env.AZURE_STORAGE_ACCOUNT_NAME ?? this.valorConexion('AccountName');
  private readonly clave = this.valorConexion('AccountKey');
  private readonly endpoint = process.env.AZURE_STORAGE_BLOB_ENDPOINT ?? (this.cuenta ? `https://${this.cuenta}.blob.core.windows.net` : '');
  private readonly shared = this.cuenta && this.clave ? new StorageSharedKeyCredential(this.cuenta, this.clave) : null;
  private readonly cliente = this.crearCliente();

  private valorConexion(clave: string) {
    const parte = (process.env.AZURE_STORAGE_CONNECTION_STRING ?? '').split(';').find((x) => x.startsWith(`${clave}=`));
    return parte?.slice(clave.length + 1) ?? '';
  }

  // Una configuración inválida deja el servicio no disponible (503 en evidencias) en lugar de impedir que arranque la API.
  private crearCliente() {
    try {
      if (process.env.AZURE_STORAGE_CONNECTION_STRING) return BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
      if (this.endpoint && this.cuenta) return new BlobServiceClient(this.endpoint, new DefaultAzureCredential());
    } catch (e) {
      new Logger('Evidencias').error(`Azure Blob Storage mal configurado: ${(e as Error).message}`);
    }
    return null;
  }

  private disponible() {
    if (!this.cliente || !this.cuenta) throw new ServiceUnavailableException('Azure Blob Storage no está configurado.');
    return this.cliente;
  }

  private async sas(blob: string, permisos: string, minutos: number, headers?: { contentDisposition?: string; contentType?: string }) {
    const cliente = this.disponible(); const ahora = new Date(); const inicio = new Date(ahora.getTime() - 60_000); const fin = new Date(ahora.getTime() + minutos * 60_000);
    const valores = { containerName: this.contenedor, blobName: blob, permissions: BlobSASPermissions.parse(permisos), startsOn: inicio, expiresOn: fin,
      protocol: this.endpoint.startsWith('http://') ? SASProtocol.HttpsAndHttp : SASProtocol.Https, ...headers };
    const token = this.shared
      ? generateBlobSASQueryParameters(valores, this.shared).toString()
      : generateBlobSASQueryParameters(valores, await cliente.getUserDelegationKey(inicio, fin), this.cuenta).toString();
    return `${this.endpoint}/${this.contenedor}/${blob}?${token}`;
  }

  async autorizarCarga(blob: string) {
    await this.disponible().getContainerClient(this.contenedor).createIfNotExists();
    return this.sas(blob, 'cw', 10);
  }

  /** Subida a través de la API (cuando el navegador no puede escribir directo en Azure, p. ej. sin CORS). */
  async subir(blob: string, contenido: Buffer) {
    const contenedor = this.disponible().getContainerClient(this.contenedor);
    await contenedor.createIfNotExists();
    await contenedor.getBlockBlobClient(blob).uploadData(contenido, { blobHTTPHeaders: { blobContentType: 'application/octet-stream' } });
  }

  async descargar(blob: string, maximo: number) {
    const cliente = this.disponible().getContainerClient(this.contenedor).getBlockBlobClient(blob);
    const props = await cliente.getProperties();
    if (!props.contentLength || props.contentLength > maximo) throw new Error('El tamaño almacenado no coincide con los límites permitidos.');
    const respuesta = await cliente.download(); const partes: Buffer[] = []; let total = 0;
    for await (const parte of respuesta.readableStreamBody ?? []) { const b = Buffer.from(parte); total += b.length; if (total > maximo) throw new Error('Archivo demasiado grande.'); partes.push(b); }
    return { buffer: Buffer.concat(partes), tamano: total, etiquetas: await cliente.getTags().then((x) => x.tags).catch(() => ({})) };
  }

  resultadoAntivirus(etiquetas: Record<string, string>) {
    return Object.entries(etiquetas).find(([k]) => k.toLowerCase().includes('malware') && k.toLowerCase().includes('result'))?.[1] ?? null;
  }

  async autorizarLectura(blob: string, nombre: string, mime: string, vistaPrevia: boolean) {
    const disposicion = `${vistaPrevia && ['application/pdf', 'image/png'].includes(mime) ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(nombre)}`;
    return this.sas(blob, 'r', 5, { contentDisposition: disposicion, contentType: mime });
  }

  async borrarCargaRechazada(blob: string) {
    await this.disponible().getContainerClient(this.contenedor).deleteBlob(blob, { deleteSnapshots: 'include' }).catch(() => undefined);
  }
}
