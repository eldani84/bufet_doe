// routes/eventos.routes.js
// ============================================================
// 🛣️ RUTAS: EVENTOS
// ============================================================

const express = require("express");
const router = express.Router();

const {
  listarEventos,
  obtenerEventoPorId,
  crearEvento,
  actualizarEvento,
  cerrarEvento,
} = require("../controllers/eventos.controller");

// Listar eventos por organizador
// Ej: GET /api/eventos?organizador_id=1
router.get("/", listarEventos);

// Obtener un evento por ID
router.get("/:id", obtenerEventoPorId);

// Crear evento
router.post("/", crearEvento);

// Actualizar evento
router.put("/:id", actualizarEvento);

// Cerrar (baja lógica) evento
router.delete("/:id", cerrarEvento);

module.exports = router;
