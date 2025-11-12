import express from "express";
import db from "./database.js";

const VALID_TOKENS = {
  "token123": "auth-service",
  "token456": "payment-service",
  "token789": "api-service",
};

const router = express.Router();

// Funcion para validar que un log este en el formato correcto

function validateLog(log) {
  const required = ["timestamp", "service", "severity", "message"];
  const missing = required.filter((key) => !(key in log));
  if (missing.length > 0) {
    return `Missing fields: ${missing.join(", ")}`;
  }
  return null;
}

// Funcion para extrar del header el token

function getTokenAndOwner(req) {
  const auth = req.headers["authorization"] || "";
  if (!auth.startsWith("Token ")) return [null, null];
  const token = auth.split(" ")[1].trim();
  const owner = VALID_TOKENS[token] || null;
  return [token, owner];
}

// Endpoint POST
// req = cliente a servidor, res = servidor a cliente
router.post("/", (req, res) => {
  console.log(`Request de POST iniciada ${new Date().toLocaleString()}`)                                          
  const [token, owner] = getTokenAndOwner(req);                           // Verificamos el token, si existe continuamos de otro modo devuelve un error
  if (!owner) {
    console.log(`Request de POST fallida por token invalido`)
    return res.status(401).json({ error: "Invalid token" });
  }

  const now = new Date().toISOString();
  const data = req.body;
  const logs = data.logs && Array.isArray(data.logs) ? data.logs : [data];

  let accepted = 0;
  let failed = 0;
  const errors = [];                                                      // Preparamos una declaracion de sql para agregar elementos a la base de datos

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
  console.log(`Resultados de POST aceptados: ${accepted} fallos: ${failed}`)

  return res.status(accepted ? 200 : 400).json({
    accepted,
    failed,
    errors,
  });
});

// Enpoint GET
// req = cliente a servidor, res = servidor a cliente

router.get("/", (req, res) => {

  console.log(`Request de GET iniciada ${new Date().toLocaleString()}`)

  const {
    service,
    severity,
    limit = 10,
    offset = 0,
    timestamp_start,
    timestamp_end,
    received_at_start,
    received_at_end,
  } = req.query;
  
  const clauses = [];
  const params = [];

  if (service && service !== "all") {
    clauses.push("service = ?");
    params.push(service);
  }

  if (severity && severity !== "all") {
    clauses.push("severity = ?")
    params.push(severity)
  }

  // --- timestamp range ---
  if (timestamp_start) {
    clauses.push("timestamp >= ?");
    params.push(timestamp_start);
  }
  if (timestamp_end) {
    clauses.push("timestamp <= ?");
    params.push(timestamp_end);
  }

  // --- received_at range ---
  if (received_at_start) {
    clauses.push("received_at >= ?");
    params.push(received_at_start);
  }
  if (received_at_end) {
    clauses.push("received_at <= ?");
    params.push(received_at_end);
  }
  
  const whereSql = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const sql = `
    SELECT id, timestamp, service, severity, message, received_at, token_used
    FROM logs
    ${whereSql}
    ORDER BY received_at DESC, id DESC
    LIMIT ? OFFSET ?
  `;

  params.push(Number(limit), Number(offset));

  try {
    const rows = db.prepare(sql).all(...params);
    console.log(`Request de GET exitosa`)
    return res.json({ count: rows.length, results: rows });
  } catch (error) {
    console.error("Database query failed:", error.message);
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});


export default router;
