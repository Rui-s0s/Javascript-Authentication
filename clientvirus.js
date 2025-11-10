import fetch from "node-fetch";
import { randomUUID } from "crypto";
import { Command } from "commander";

/**
 * Asynchronously pauses execution for a given number of milliseconds.
 * @param {number} ms - The number of milliseconds to wait.
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const SERVER_URL = "http://localhost:3000/logs";

const TOKENS = {
  "auth-service": "token123",
  "payment-service": "token456",
  "api-service": "token789",
  "unauthorized-service": "invalidtoken",
};

function makeLog(service) {
  return {
    id: randomUUID(),
    service,
    timestamp: new Date().toISOString(),
    severity: ["INFO", "WARN", "ERROR"][Math.floor(Math.random() * 3)],
    message: `Log event from ${service}`,
  };
}

async function sendOne(service) {
  const token = TOKENS[service];
  const headers = {
    "Authorization": `Token ${token}`,
    "Content-Type": "application/json",
  };

  const payload = makeLog(service);

  try {
    const resp = await fetch(SERVER_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
        // 2. Read the error body (which should contain { error: "Invalid token" })
        const errorBody = await resp.json();
        
        // 3. Log the status AND the error message from the server
        console.error(`[${service}] ONE -> FAILED (${resp.status}): ${errorBody.error}`);
        return; // Stop processing here
    }
    console.log(`[${service}] ONE -> SUCCESS ${resp.status}`);
  } catch (err) {
    console.error(`[${service}] ERROR:`, err.message);
  }
}

async function sendBatch(service, n) {
  const token = TOKENS[service];
  const headers = {
    "Authorization": `Token ${token}`,
    "Content-Type": "application/json",
  };

  const logs = Array.from({ length: n }, () => makeLog(service));
  const payload = { logs };

  try {
    const resp = await fetch(SERVER_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
        // 2. Read the error body (which should contain { error: "Invalid token" })
        const errorBody = await resp.json();
        
        // 3. Log the status AND the error message from the server
        console.error(`[${service}] ONE -> FAILED (${resp.status}): ${errorBody.error}`);
        return; // Stop processing here
    }
    console.log(`[${service}] BATCH x${n} -> SUCCESS ${resp.status}`);
  } catch (err) {
    console.error(`[${service}] ERROR:`, err.message);
  }
}

async function getLogs(service = null, limit = 10) {
  const params = new URLSearchParams();
  if (service && service !== "all") params.append("service", service); // only add service if not "all"
  params.append("limit", limit);

  const url = `${SERVER_URL}?${params.toString()}`;

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



const program = new Command();
program
  .option("--mode <mode>", "one | batch | get", "one")
  .option("--service <service>", "Service name", "auth-service")
  .option("--batch-size <n>", "Batch size", 5)
  .option("--limit <n>", "How many logs to fetch (for get mode)", 10)
  .option("--repeat <n>", "Repeat count", 1)
  .option("--sleep <s>", "Seconds between sends", 1);

program.parse();
const args = program.opts();

if (args.mode === "get") {
  await getLogs(args.service, args.limit);
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

