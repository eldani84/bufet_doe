// routes/cajaSesiones.routes.js
// ============================================================
// 🛣️ RUTAS: SESIONES DE CAJA (APERTURA / CIERRE / RESUMEN)
// ============================================================

const express = require("express");
const router = express.Router();

const {
  listarSesionesCaja,
  obtenerSesionCajaPorId,
  obtenerResumenSesionCaja,
  abrirSesionCaja,
  cerrarSesionCaja,
} = require("../controllers/cajaSesiones.controller");

// Listar sesiones
// GET /api/caja-sesiones?evento_id=&caja_id=&usuario_id=&estado=
router.get("/", listarSesionesCaja);

// Obtener una sesión por ID
// GET /api/caja-sesiones/:id
router.get("/:id", obtenerSesionCajaPorId);

// Resumen en tiempo real de una sesión (EFECTIVO)
// GET /api/caja-sesiones/:id/resumen
router.get("/:id/resumen", obtenerResumenSesionCaja);

// Apertura de caja
// POST /api/caja-sesiones/apertura
router.post("/apertura", abrirSesionCaja);

// Cierre de caja (👈 ADAPTADO: ahora es /:id/cierre)
// POST /api/caja-sesiones/:id/cierre
router.post("/:id/cierre", cerrarSesionCaja);

module.exports = router;
