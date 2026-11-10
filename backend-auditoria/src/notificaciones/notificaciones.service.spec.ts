import { avisoDeVencimiento } from "./notificaciones.service";

describe("HU_12 · avisoDeVencimiento", () => {
  it.each([
    [20, null],
    [15, "vencimiento_15"],
    [6, "vencimiento_15"],
    [5, "vencimiento_5"],
    [2, "vencimiento_5"],
    [1, "vencimiento_1"],
    [0, "vencimiento_1"],
    [-1, "escalamiento"],
    [-30, "escalamiento"],
  ])("con %i días restantes manda %s", (dias, tipo) => {
    expect(avisoDeVencimiento(dias)).toBe(tipo);
  });
});
