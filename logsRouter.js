import express from "express";
import db from "./database.js";

const VALID_TOKENS = {
  "token123": "auth-service",
  "token456": "payment-service",
  "token789": "api-service",
};

const router = express.Router();

// ✅ Helper: validate one log
function validateLog(log) {
  const required = ["timestamp", "service", "severity", "message"];
  const missing = required.filter((key) => !(key in log));
  if (missing.length > 0) {
    return `Missing fields: ${missing.join(", ")}`;
  }
  return null;
}

// ✅ Helper: extract token
function getTokenAndOwner(req) {
  const auth = req.headers["authorization"] || "";
  if (!auth.startsWith("Token ")) return [null, null];
  const token = auth.split(" ")[1].trim();
  const owner = VALID_TOKENS[token] || null;
  return [token, owner];
}

// ✅ Endpoint: POST /logs
router.post("/", (req, res) => {
  const [token, owner] = getTokenAndOwner(req);
  if (!owner) return res.status(401).json({ error: "Invalid token" });

  const now = new Date().toISOString();
  const data = req.body;
  const logs = data.logs && Array.isArray(data.logs) ? data.logs : [data];

  let accepted = 0;
  let failed = 0;
  const errors = [];

  const insert = db.prepare(`
    INSERT INTO logs (timestamp, service, severity, message, received_at, token_used)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const log of logs) {
    const error = validateLog(log);
    if (error) {
      failed++;
      errors.push(error);
      continue;
    }

    try {
      insert.run(
        log.timestamp,
        log.service,
        log.severity,
        log.message,
        now,
        token
      );
      accepted++;
    } catch (err) {
      failed++;
      errors.push(err.message);
    }
  }

  return res.status(accepted ? 200 : 400).json({
    accepted,
    failed,
    errors,
  });
});

// ✅ Endpoint: GET /logs
router.get("/", (req, res) => {
    // Access query parameters from req.query
    const qp = req.query;

    const timestamp_start   = qp.timestamp_start;
    const timestamp_end     = qp.timestamp_end;
    const received_at_start = qp.received_at_start;
    const received_at_end   = qp.received_at_end;
    const service           = qp.service;
    const severity          = qp.severity;

    let limit, offset;

    try {
        // Use unary plus (+) or parseInt for conversion, with fallback
        limit  = parseInt(qp.limit) || 100;
        offset = parseInt(qp.offset) || 0;

        // Basic validation for non-positive values
        if (limit <= 0 || offset < 0) {
             return res.status(400).json({ error: "limit debe ser positivo y offset no puede ser negativo" });
        }
    } catch (e) {
        // In JavaScript, parseInt handles non-numeric strings gracefully (results in NaN),
        // but it's good practice to check if the result is a number.
        if (isNaN(limit) || isNaN(offset)) {
            return res.status(400).json({ error: "limit/offset deben ser enteros" });
        }
    }

    const clauses = [];
    const params = [];

    // --- Dynamic WHERE Clause Construction ---

    if (timestamp_start) {
        clauses.push("timestamp >= ?");
        params.push(timestamp_start);
    }
    if (timestamp_end) {
        clauses.push("timestamp <= ?");
        params.push(timestamp_end);
    }
    if (received_at_start) {
        clauses.push("received_at >= ?");
        params.push(received_at_start);
    }
    if (received_at_end) {
        clauses.push("received_at <= ?");
        params.push(received_at_end);
    }
    if (service) {
        clauses.push("service = ?");
        params.push(service);
    }
    if (severity) {
        clauses.push("severity = ?");
        params.push(severity);
    }

    // Assemble the WHERE clause
    const whereSql = clauses.length > 0 ? "WHERE " + clauses.join(" AND ") : "";

    // Final SQL Query
    const sql = `
        SELECT id, timestamp, service, severity, message, received_at, token_used
        FROM logs
        ${whereSql}
        ORDER BY received_at DESC, id DESC
        LIMIT ? OFFSET ?
    `;

    // Add pagination parameters for the final placeholders
    params.push(limit, offset);

    try {
        // Use the db connection object (assuming better-sqlite3)
        // prepare() creates a statement, all() executes it with params and fetches all rows
        const statement = db.prepare(sql);
        const rows = statement.all(...params); // ...spreads the params array

        // Send the JSON response
        return res.json({ count: rows.length, results: rows });

    } catch (error) {
        // Handle database or unexpected errors
        console.error("Database query failed:", error.message);
        return res.status(500).json({ error: "Error interno del servidor al consultar logs." });
    }
});

export default router;
