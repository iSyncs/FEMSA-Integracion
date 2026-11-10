// Ejecuta un script .sql (separado por GO) contra la base configurada en backend/.env.
// Uso: npm run db:sql -- ../../auditoria_bd/scripts/ampliacion_eq12.sql
const fs = require('node:fs');
const path = require('node:path');
const sql = require('mssql');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const archivo = process.argv[2];
if (!archivo) {
  console.error('Indica la ruta del archivo .sql');
  process.exit(1);
}

const lotes = fs.readFileSync(path.resolve(archivo), 'utf8')
  .split(/^\s*GO\s*$/im)
  .map((l) => l.trim())
  .filter((l) => l.replace(/--.*$/gm, '').trim());

(async () => {
  const pool = await sql.connect({
    server: process.env.DB_HOST, port: Number(process.env.DB_PORT || 1433), database: process.env.DB_NAME,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    options: { encrypt: true, trustServerCertificate: process.env.DB_TRUST_CERT === 'true' }, connectionTimeout: 90000, requestTimeout: 120000,
  });
  console.log(`Ejecutando ${lotes.length} lotes de ${path.basename(archivo)} en ${process.env.DB_NAME}`);
  for (const [i, lote] of lotes.entries()) {
    try {
      await pool.request().batch(lote);
    } catch (e) {
      console.error(`Error en el lote ${i + 1}:\n${lote.slice(0, 300)}\n-> ${e.message}`);
      await pool.close();
      process.exit(1);
    }
  }
  console.log('Listo');
  await pool.close();
})();
