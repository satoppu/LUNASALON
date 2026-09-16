import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import dashboardRoutes from "./routes/dashboard.js";
import storeSettingsRoutes from "./routes/storeSettings.js";
import importRoutes from "./routes/importRoute.js";
import templateRoutes from "./routes/template.js";
import customerRoutes from "./routes/customers.js";
import transactionRoutes from "./routes/transactions.js";
import "./seed.js"; // seeds transactions from the bundled CSV on first run only

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api", dashboardRoutes);
app.use("/api", storeSettingsRoutes);
app.use("/api", importRoutes);
app.use("/api", templateRoutes);
app.use("/api", customerRoutes);
app.use("/api", transactionRoutes);

app.get("/api/health", (req, res) => res.json({ ok: true }));

// Serve the built client in production (single-deployment setup per spec 7.4).
const clientDist = path.join(__dirname, "..", "..", "client", "dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/.*/, (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "internal server error" });
});

app.listen(PORT, () => {
  console.log(`LUNA dashboard server listening on http://localhost:${PORT}`);
});
