import express from "express";
import logsRouter from "./logsRouter.js";

const app = express();
app.use(express.json());

app.use("/logs", logsRouter);

app.get("/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// 👇 Capture the actual HTTP server object
const server = app.listen(3000, () => {
  console.log("Server running on port 3000");
});

// 👇 Attach the listener to the *server*, not app
server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error("❌ Port 3000 is already in use. Please stop the other process or use a different port.");
  } else {
    console.error("Server error:", err);
  }
});
