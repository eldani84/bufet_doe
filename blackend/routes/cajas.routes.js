// routes/cajas.routes.js
// ============================================================
// 🛣️ RUTAS: CAJAS (ABM)
// ============================================================

const express = require("express");
const router = express.Router();

const {
  listarCajas,
  obtenerCajaPorId,
  crearCaja,
  actualizarCaja,
  eliminarCaja,
} = require("../controllers/cajas.controller");

// Listar cajas
router.get("/", listarCajas);

// Obtener caja por ID
router.get("/:id", obtenerCajaPorId);

// Crear caja
router.post("/", crearCaja);

// Actualizar caja
router.put("/:id", actualizarCaja);

// Desactivar (baja lógica)
router.delete("/:id", eliminarCaja);

module.exports = router;
