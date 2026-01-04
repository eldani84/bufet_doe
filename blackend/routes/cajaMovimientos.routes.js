// routes/cajaMovimientos.routes.js
// ============================================================
// 🛣️ RUTAS: MOVIMIENTOS DE CAJA
// ============================================================

const express = require("express");
const router = express.Router();

const {
  listarMovimientosCaja,
  crearMovimientoCaja,
} = require("../controllers/cajaMovimientos.controller");

// Listar movimientos
// Ej: GET /api/caja-movimientos?caja_sesion_id=1
router.get("/", listarMovimientosCaja);

// Crear movimiento
router.post("/", crearMovimientoCaja);

module.exports = router;

