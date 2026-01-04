// db/connectionPromise.js
// ============================================================
// 📦 Pool de conexión MySQL (mysql2/promise)
// Usado por todo el sistema BUFET_DOE
// ============================================================

// ⚠️ IMPORTANTE:
// - NO usamos dotenv acá
// - dotenv se carga SOLO en server.js
// - Aquí solo usamos process.env ya inicializado

const mysql = require("mysql2/promise"); // ÚNICO require

const pool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "bufet_doe",
  port: Number(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

module.exports = pool;
