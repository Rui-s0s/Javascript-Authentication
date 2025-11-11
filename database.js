import Database from "better-sqlite3";

const db = new Database("logs.db");

// Create the logs table if not exists
db.exec(`
CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT,
    service TEXT,
    severity TEXT,
    message TEXT,
    received_at TEXT,
    token_used TEXT
);
`);

export default db;
