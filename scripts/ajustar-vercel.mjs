#!/usr/bin/env node
// Ajusta vercel.json justo antes de desplegar, según las partes que ya tienen código.
//
// - Quita los servicios cuya carpeta todavía no tiene package.json, junto con sus rutas y crons.
// - Si a una API le falta código pero hay una URL externa (variables API_AUDITORIA_URL o
//   API_RIESGOS_URL), sus rutas se mandan a esa URL. Sirve mientras los backends siguen en sus
//   repos de origen (Fase 1).
//
// Uso: node scripts/ajustar-vercel.mjs [--escribir]
//   Sin --escribir solo muestra el resultado. Con --escribir reemplaza vercel.json.
//   Escribe "servicios=<n>" en $GITHUB_OUTPUT si existe.
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Para cada API: prefijo público, ruta en su servidor y variable con su URL externa.
const APIS = {
  riesgos: { prefijo: "/api/maple/", destino: "/api/$1", variable: "API_RIESGOS_URL" },
  auditoria: { prefijo: "/api/", destino: "/api/$1", variable: "API_AUDITORIA_URL" },
};

const raiz = process.cwd();
const config = JSON.parse(readFileSync(join(raiz, "vercel.json"), "utf8"));
const avisos = [];

const apuntaA = (regla, nombre) => typeof regla.destination === "object" && regla.destination.service === nombre;

for (const [nombre, servicio] of Object.entries(config.services)) {
  if (existsSync(join(raiz, servicio.root, "package.json"))) continue;

  delete config.services[nombre];
  const api = APIS[nombre];
  const urlExterna = api ? process.env[api.variable]?.replace(/\/+$/, "") : "";

  if (api) {
    // Los crons viajan con su API. Si la API vive afuera, ese despliegue ya corre los suyos:
    // dejarlos aquí haría que se ejecutaran dos veces.
    const deOtraApi = (ruta) => Object.values(APIS).some((otra) => otra !== api && ruta.startsWith(otra.prefijo));
    config.crons = (config.crons ?? []).filter((cron) => !cron.path.startsWith(api.prefijo) || deOtraApi(cron.path));
  }

  if (urlExterna) {
    for (const regla of config.rewrites) {
      if (apuntaA(regla, nombre)) regla.destination = `${urlExterna}${api.destino}`;
    }
    avisos.push(`${nombre}: sin código aquí; ${api.prefijo}* va a ${urlExterna}`);
  } else {
    config.rewrites = config.rewrites.filter((regla) => !apuntaA(regla, nombre));
    avisos.push(`${nombre}: sin código aquí; se omite`);
  }
}

if (config.crons?.length === 0) delete config.crons;
const servicios = Object.keys(config.services).length;
const texto = `${JSON.stringify(config, null, 2)}\n`;

for (const aviso of avisos) console.error(`- ${aviso}`);
console.error(`Servicios a desplegar: ${servicios}`);

if (process.argv.includes("--escribir")) writeFileSync(join(raiz, "vercel.json"), texto);
else console.log(texto);

if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `servicios=${servicios}\n`);
