import { analizarZip, validarContenido, validarSolicitudArchivo } from "./archivo-seguro";
import yazl from "yazl";

const crearZip = (archivos: Array<[string, Buffer]>) =>
  new Promise<Buffer>((resolve, reject) => {
    const zip = new yazl.ZipFile();
    const partes: Buffer[] = [];
    zip.outputStream
      .on("data", (x: Buffer) => partes.push(x))
      .once("end", () => resolve(Buffer.concat(partes)))
      .once("error", reject);
    for (const [nombre, contenido] of archivos) zip.addBuffer(contenido, nombre);
    zip.end();
  });

describe("seguridad de evidencias (F_03)", () => {
  it("valida extensión, MIME y firma mágica, no sólo el nombre", async () => {
    expect(() => validarSolicitudArchivo("reporte.exe", "application/octet-stream", 4)).toThrow("Formato no permitido");
    await expect(validarContenido("reporte.pdf", Buffer.from("no es pdf"))).rejects.toThrow("no corresponde a un PDF");
    await expect(validarContenido("reporte.pdf", Buffer.from("%PDF-1.7\ncontenido"))).resolves.toBeUndefined();
  });

  it("asigna metadatos y SHA-256 a cada archivo permitido dentro del ZIP", async () => {
    const zip = await crearZip([["soporte.pdf", Buffer.from("%PDF-1.7\nprueba")]]);
    const hijos = await analizarZip(zip);
    expect(hijos).toEqual([
      expect.objectContaining({
        nombre_archivo: "soporte.pdf",
        tipo_mime: "application/pdf",
        hash_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    ]);
  });

  it("rechaza ZIP anidado", async () => {
    const interior = await crearZip([["soporte.pdf", Buffer.from("%PDF-1.7\nprueba")]]);
    await expect(analizarZip(await crearZip([["anidado.zip", interior]]))).rejects.toThrow(
      "Formato no permitido dentro del ZIP",
    );
  });
});
