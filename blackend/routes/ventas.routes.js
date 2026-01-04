// routes/ventas.routes.js
// ============================================================
// 🛣️ RUTAS: VENTAS
// ============================================================

const express = require("express");
const router = express.Router();

const {
  listarVentas,
  obtenerVentaPorId,
  crearVenta,
} = require("../controllers/ventas.controller");

// Listar ventas
// Ej: GET /api/ventas?evento_id=1&caja_id=2
router.get("/", listarVentas);

// Obtener venta + detalle
router.get("/:id", obtenerVentaPorId);

// Crear venta
router.post("/", crearVenta);

module.exports = router;
