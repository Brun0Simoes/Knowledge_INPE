import "dotenv/config";

import { ensureDatabaseSchema } from "./sqlite";

const databasePath = ensureDatabaseSchema();

console.log(`Schema SQLite inicializado em ${databasePath}`);
