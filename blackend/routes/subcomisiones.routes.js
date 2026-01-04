// routes/subcomisiones.routes.js
// ============================================================
// 🛣️ RUTAS: SUBCOMISIONES
// ============================================================

const express = require("express");
const router = express.Router();

const {
  listarSubcomisiones,
  obtenerSubcomisionPorId,
  crearSubcomision,
  actualizarSubcomision,
  eliminarSubcomision,
} = require("../controllers/subcomisiones.controller");

// Listar subcomisiones por organizador
// Ej: GET /api/subcomisiones?organizador_id=1
router.get("/", listarSubcomisiones);

// Obtener una subcomisión por ID
router.get("/:id", obtenerSubcomisionPorId);

// Crear nueva subcomisión
router.post("/", crearSubcomision);

// Actualizar subcomisión
router.put("/:id", actualizarSubcomision);

// Baja lógica
router.delete("/:id", eliminarSubcomision);

module.exports = router;

