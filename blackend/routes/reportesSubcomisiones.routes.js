// routes/reportesSubcomisiones.routes.js
// ============================================================
// 🛣️ RUTAS: REPORTE SUBCOMISIONES (LIQUIDACIÓN EVENTO)
// ============================================================

const express = require("express");
const router = express.Router();

const {
  reporteSubcomisionesEvento,
} = require("../controllers/reportesSubcomisiones.controller");

// GET /api/reportes/subcomisiones
router.get("/", reporteSubcomisionesEvento);

module.exports = router;
