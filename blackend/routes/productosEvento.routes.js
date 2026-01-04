// routes/productosEvento.routes.js
// ============================================================
// 🛣️ RUTAS: PRODUCTOS_EVENTO
// ============================================================

const express = require("express");
const router = express.Router();

const {
  listarProductosEvento,
  obtenerProductoEventoPorId,
  crearProductoEvento,
  actualizarProductoEvento,
  eliminarProductoEvento,
} = require("../controllers/productosEvento.controller");

// Listar productos de un evento
// Ej: GET /api/productos-evento?evento_id=1
router.get("/", listarProductosEvento);

// Obtener un producto_evento por ID
router.get("/:id", obtenerProductoEventoPorId);

// Crear producto_evento
router.post("/", crearProductoEvento);

// Actualizar producto_evento
router.put("/:id", actualizarProductoEvento);

// Baja lógica
router.delete("/:id", eliminarProductoEvento);

module.exports = router;
