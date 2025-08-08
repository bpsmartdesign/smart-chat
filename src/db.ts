import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(__dirname, "../db/chat_app.db");
const db = new Database(dbPath, { verbose: console.log });

export default db;
