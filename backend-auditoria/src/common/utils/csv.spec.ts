import { aCsv, celdaCsv, csvDeColumnas } from "./csv";

describe("csv", () => {
  it("deja igual el texto simple y vacía null o undefined", () => {
    expect(celdaCsv("hola")).toBe("hola");
    expect(celdaCsv(null)).toBe("");
    expect(celdaCsv(undefined)).toBe("");
  });

  it("pone comillas cuando hay coma, comilla, punto y coma o salto de línea", () => {
    expect(celdaCsv("a,b")).toBe('"a,b"');
    expect(celdaCsv('dijo "sí"')).toBe('"dijo ""sí"""');
    expect(celdaCsv("a;b")).toBe('"a;b"');
    expect(celdaCsv("a\nb")).toBe('"a\nb"');
  });

  it("convierte fechas a ISO y objetos a JSON", () => {
    expect(celdaCsv(new Date("2026-11-06T12:00:00.000Z"))).toBe("2026-11-06T12:00:00.000Z");
    expect(celdaCsv({ a: 1 })).toBe('"{""a"":1}"');
  });

  it("arma el archivo con BOM, encabezado y una fila por registro", () => {
    expect(
      aCsv(
        ["folio", "nota"],
        [
          ["AUD-1", "ok"],
          ["AUD-2", "x,y"],
        ],
      ),
    ).toBe('﻿folio,nota\nAUD-1,ok\nAUD-2,"x,y"\n');
  });

  it("arma el CSV desde una lista de columnas", () => {
    const registros = [{ folio: "AUD-1", avance: 40 }];
    expect(
      csvDeColumnas(
        [
          ["folio", (r) => r.folio],
          ["avance", (r) => `${r.avance}%`],
        ],
        registros,
      ),
    ).toBe("\uFEFFfolio,avance\nAUD-1,40%\n");
  });
});
