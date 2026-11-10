import { createHash } from "node:crypto";
import { basename, extname } from "node:path";
import yauzl, { Entry, ZipFile } from "yauzl";
import type { EvidenciaHija } from "../datos/repositorios/evidencias.repository";

export const TIPOS = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".zip": "application/zip",
} as const;
export const MAX_ARCHIVO = Number(process.env.EVIDENCE_MAX_BYTES ?? 25 * 1024 * 1024);
export const MAX_ZIP_ARCHIVOS = Number(process.env.EVIDENCE_ZIP_MAX_FILES ?? 50);
export const MAX_ZIP_DESCOMPRIMIDO = Number(process.env.EVIDENCE_ZIP_MAX_UNCOMPRESSED_BYTES ?? 100 * 1024 * 1024);
const MAX_RATIO = Number(process.env.EVIDENCE_ZIP_MAX_RATIO ?? 100);

export function nombreSeguro(nombre: string) {
  const limpio = basename(nombre.replaceAll("\\", "/"))
    .normalize("NFC")
    // biome-ignore lint/suspicious/noControlCharactersInRegex: se quitan a propósito los caracteres de control del nombre del archivo
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim();
  if (!limpio || limpio.length > 255) throw new Error("Nombre de archivo inválido.");
  return limpio;
}

export function tipoPermitido(nombre: string) {
  return TIPOS[extname(nombre).toLowerCase() as keyof typeof TIPOS] ?? null;
}

export function validarSolicitudArchivo(nombre: string, mime: string, tamano: number) {
  const limpio = nombreSeguro(nombre);
  const esperado = tipoPermitido(limpio);
  if (!esperado) throw new Error("Formato no permitido. Usa PDF, XLSX, DOCX, PNG o ZIP.");
  if (mime !== esperado && mime !== "application/octet-stream")
    throw new Error("El tipo MIME no coincide con la extensión.");
  if (!Number.isSafeInteger(tamano) || tamano <= 0 || tamano > MAX_ARCHIVO)
    throw new Error(`El archivo debe medir entre 1 byte y ${MAX_ARCHIVO} bytes.`);
  return { nombre: limpio, mime: esperado };
}

const esZip = (b: Buffer) => b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && [0x03, 0x05, 0x07].includes(b[2]);
const abrirZip = (buffer: Buffer) =>
  new Promise<ZipFile>((resolve, reject) =>
    yauzl.fromBuffer(buffer, { lazyEntries: true, validateEntrySizes: true }, (e, z) =>
      e || !z ? reject(e ?? new Error("ZIP inválido.")) : resolve(z),
    ),
  );

async function nombresZip(buffer: Buffer) {
  const zip = await abrirZip(buffer);
  return new Promise<string[]>((resolve, reject) => {
    const nombres: string[] = [];
    zip.on("entry", (e: Entry) => {
      nombres.push(e.fileName);
      zip.readEntry();
    });
    zip.once("end", () => resolve(nombres));
    zip.once("error", reject);
    zip.readEntry();
  });
}

export async function validarContenido(nombre: string, buffer: Buffer) {
  const ext = extname(nombre).toLowerCase();
  if (ext === ".pdf" && buffer.subarray(0, 5).toString("ascii") !== "%PDF-")
    throw new Error("El contenido no corresponde a un PDF.");
  if (ext === ".png" && !buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    throw new Error("El contenido no corresponde a un PNG.");
  if ([".zip", ".docx", ".xlsx"].includes(ext) && !esZip(buffer))
    throw new Error("El contenido no corresponde a un contenedor ZIP válido.");
  if (ext === ".docx" || ext === ".xlsx") {
    const nombres = await nombresZip(buffer);
    if (
      !nombres.includes("[Content_Types].xml") ||
      !nombres.some((n) => n.startsWith(ext === ".docx" ? "word/" : "xl/"))
    ) {
      throw new Error(`El contenido no corresponde a un ${ext.slice(1).toUpperCase()} válido.`);
    }
  }
}

const leerEntrada = (zip: ZipFile, e: Entry) =>
  new Promise<Buffer>((resolve, reject) => {
    zip.openReadStream(e, (error, stream) => {
      if (error || !stream) return reject(error ?? new Error("No se pudo leer una entrada del ZIP."));
      const partes: Buffer[] = [];
      let total = 0;
      stream.on("data", (x: Buffer) => {
        total += x.length;
        if (total > MAX_ARCHIVO) stream.destroy(new Error("Archivo interno demasiado grande."));
        else partes.push(x);
      });
      stream.once("end", () => resolve(Buffer.concat(partes)));
      stream.once("error", reject);
    });
  });

export async function analizarZip(buffer: Buffer): Promise<EvidenciaHija[]> {
  const zip = await abrirZip(buffer);
  return new Promise((resolve, reject) => {
    const hijas: EvidenciaHija[] = [];
    let total = 0;
    let ocupada = false;
    const fallo = (e: unknown) => {
      zip.close();
      reject(e instanceof Error ? e : new Error(String(e)));
    };
    zip.once("error", fallo);
    zip.on("entry", async (e: Entry) => {
      if (ocupada) return;
      ocupada = true;
      try {
        if (/\/$/.test(e.fileName)) {
          ocupada = false;
          return zip.readEntry();
        }
        if ((e.generalPurposeBitFlag & 0x1) !== 0) throw new Error("No se aceptan ZIP protegidos con contraseña.");
        const ruta = e.fileName.replaceAll("\\", "/");
        if (ruta.startsWith("/") || ruta.split("/").includes("..") || ruta.includes("\u0000"))
          throw new Error("El ZIP contiene una ruta insegura.");
        const nombre = nombreSeguro(ruta);
        const tipo = tipoPermitido(nombre);
        if (!tipo || extname(nombre).toLowerCase() === ".zip")
          throw new Error(`Formato no permitido dentro del ZIP: ${nombre}.`);
        if (++total > MAX_ZIP_ARCHIVOS) throw new Error(`El ZIP supera el límite de ${MAX_ZIP_ARCHIVOS} archivos.`);
        if (
          e.uncompressedSize > MAX_ARCHIVO ||
          (e.compressedSize > 0 && e.uncompressedSize / e.compressedSize > MAX_RATIO)
        )
          throw new Error(`Posible ZIP bomb detectada en ${nombre}.`);
        const acumulado = hijas.reduce((n, h) => n + (h.tamano_bytes ?? 0), 0) + e.uncompressedSize;
        if (acumulado > MAX_ZIP_DESCOMPRIMIDO)
          throw new Error("El contenido descomprimido del ZIP supera el límite permitido.");
        const contenido = await leerEntrada(zip, e);
        await validarContenido(nombre, contenido);
        hijas.push({
          nombre_archivo: nombre,
          tipo_mime: tipo,
          tamano_bytes: contenido.length,
          hash_sha256: createHash("sha256").update(contenido).digest("hex"),
        });
        ocupada = false;
        zip.readEntry();
      } catch (error) {
        fallo(error);
      }
    });
    zip.once("end", () =>
      hijas.length ? resolve(hijas) : reject(new Error("El ZIP no contiene archivos permitidos.")),
    );
    zip.readEntry();
  });
}

export const sha256 = (buffer: Buffer) => createHash("sha256").update(buffer).digest("hex");
