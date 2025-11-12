import fetch from "node-fetch";
import { Command } from "commander";

const SERVER_URL = "http://localhost:3000/logs";

const TOKENS = {
  "auth-service": "token123",
  "payment-service": "token456",
  "api-service": "token789",
  "admin": "xXAdminXx",
};

// Lo que vamos a mandar
function makeLog(service) {
  return {
    service,
    timestamp: new Date().toISOString(),
    severity: ["INFO", "WARN", "ERROR"][Math.floor(Math.random() * 3)],
    message: `Log event from ${service}`,
  };
}


// Metodo POST para mandar un log

async function sendOne(service) {
  const token = TOKENS[service];
  const headers = {                          // En el header esta el token para que sea evaluado en el servidor
    "Authorization": `Token ${token}`,
    "Content-Type": "application/json",
  };

  const payload = makeLog(service);          // En el body esta lo que queremos mandar

  try {
    const resp = await fetch(SERVER_URL, {   // Fetch manda una request al url
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {                          // Si el servidor responde con error imprimimos el error y terminamos la funcion
        const errorBody = await resp.json();
        console.error(`[${service}] ONE -> FAILED (${resp.status}): ${errorBody.error}`);
        return;

    }

    console.log(`[${service}] ONE -> SUCCESS ${resp.status}`);    // De otro modo manda exitosamente

  } catch (err) {
    console.error(`[${service}] ERROR:`, err.message);    
  }
}


// Metodo POST para enviar muchos logs

async function sendBatch(service, n) {
  const token = TOKENS[service];
  const headers = {
    "Authorization": `Token ${token}`,
    "Content-Type": "application/json",
  };

  const logs = Array.from({ length: n }, () => makeLog(service));   // Array de n tamanyo con makelogs dentro
  const payload = { logs };                                         // Desempaqueta

  try {
    const resp = await fetch(SERVER_URL, {   // Fetch manda una request al url      
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {                          // Si el servidor responde con error imprimimos el error y terminamos la funcion
        const errorBody = await resp.json();
        console.error(`[${service}] ONE -> FAILED (${resp.status}): ${errorBody.error}`);
        return; 
    }

    console.log(`[${service}] BATCH x${n} -> SUCCESS ${resp.status}`);  // De otro modo manda exitosamente

  } catch (err) {
    console.error(`[${service}] ERROR:`, err.message);
  }
}


// Metodo GET para obtener logs

async function getLogs({
  service = null,
  limit = 10,
  severity = null,
  timestamp_start = null,
  timestamp_end = null,
  received_at_start = null,
  received_at_end = null,
} = {}) {

  const params = new URLSearchParams();

  if (service && service !== "all") params.append("service", service);
  if (severity && severity !== "all") params.append("severity", severity);
  if (timestamp_start) params.append("timestamp_start", timestamp_start);
  if (timestamp_end) params.append("timestamp_end", timestamp_end);
  if (received_at_start) params.append("received_at_start", received_at_start);
  if (received_at_end) params.append("received_at_end", received_at_end);
  params.append("limit", limit);

  const url = `${SERVER_URL}?${params.toString()}`;
  console.log("Fetching:", url);

  try {
    const resp = await fetch(url);
    const data = await resp.json();

    if (!resp.ok) {
      console.error("GET failed:", data.error);
      return;
    }

    console.log(`\n✅ Retrieved ${data.count} logs\n`);
    console.table(
      data.results.map((r) => ({
        service: r.service,
        severity: r.severity,
        message: r.message,
        date: new Date(r.timestamp).toLocaleDateString(),
        time: new Date(r.timestamp).toLocaleTimeString(),
        received: new Date(r.received_at).toLocaleTimeString(),
      }))
    );
  } catch (err) {
    console.error("GET error:", err.message);
  }
}



// Comandos para determinar que funciones correr al ejecutar el archivo

const program = new Command();
program
  .option("--mode <mode>", "one | batch | get", "one")
  .option("--service <service>", "Service name", "api-service")
  .option("--severity <severity>", "Filter by severity", "all")
  .option("--limit <n>", "How many logs to fetch (for get mode)", 10)
  .option("--timestamp-start <date>", "Start timestamp filter", null)
  .option("--timestamp-end <date>", "End timestamp filter", null)
  .option("--received-at-start <date>", "Start received_at filter", null)
  .option("--repeat <n>", "Repeat count", 1)
  .option("--batch-size <n>", "Batch size", 5)
  .option("--sleep <s>", "Seconds between sends", 1)
  .option("--received-at-end <date>", "End received_at filter", null);

program.parse();
const args = program.opts();


if (args.mode === "get") {
  await getLogs({
    service: args.service,
    severity: args.severity,
    limit: args.limit,
    timestamp_start: args.timestampStart,
    timestamp_end: args.timestampEnd,
    received_at_start: args.receivedAtStart,
    received_at_end: args.receivedAtEnd,
  });
  process.exit(0);
}


for (let i = 0; i < args.repeat; i++) {
  if (args.mode === "batch") await sendBatch(args.service, args.batchSize);
  else await sendOne(args.service);
  await new Promise((r) => setTimeout(r, args.sleep * 1000));
}


//node clientvirus.js --mode batch --service payment-service --batch-size 5
//node clientvirus.js --mode get --service auth-service --limit 10
//node clientvirus.js --mode get --service all --limit 50