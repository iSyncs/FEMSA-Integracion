import { join } from 'node:path';
import { config } from 'dotenv';

// Se importa antes que AppModule: DATA_SOURCE decide qué repositorios se registran.
config({ path: join(__dirname, '..', '.env'), quiet: true });
