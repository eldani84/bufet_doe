// routes/organizadores.routes.js
// ============================================================
// 🛣️ RUTAS: ORGANIZADORES
// ============================================================

const express = require("express");
const router = express.Router();

const {
  listarOrganizadores,
  obtenerOrganizadorPorId,
  crearOrganizador,
  actualizarOrganizador,
  eliminarOrganizador,
} = require("../controllers/organizadores.controller");

// Listar organizadores
router.get("/", listarOrganizadores);

// Obtener uno por ID
router.get("/:id", obtenerOrganizadorPorId);

// Crear nuevo
router.post("/", crearOrganizador);

// Actualizar
router.put("/:id", actualizarOrganizador);

// Baja lógica
router.delete("/:id", eliminarOrganizador);

module.exports = router;
