// routes/productos.routes.js
// ============================================================
// 🛣️ RUTAS: PRODUCTOS
// - Incluye upload de imagen: POST /api/productos/:id/imagen
// ============================================================

const express = require("express");
const router = express.Router();

const path = require("path");
const fs = require("fs");
const multer = require("multer");

const {
  listarProductos,
  obtenerProductoPorId,
  crearProducto,
  actualizarProducto,
  eliminarProducto,
  subirImagenProducto,
} = require("../controllers/productos.controller");

// -------------------------
// Multer config
// -------------------------
const uploadDir = path.join(process.cwd(), "uploads", "productos");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const safeExt = ext && ext.length <= 10 ? ext : ".png";
    cb(null, `${Date.now()}-${req.params.id}${safeExt}`);
  },
});

const fileFilter = (req, file, cb) => {
  const ok = /^image\/(png|jpeg|jpg|webp)$/i.test(file.mimetype || "");
  if (!ok) return cb(new Error("Formato inválido. Usar PNG/JPG/JPEG/WEBP."));
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
});

// -------------------------
// Routes
// -------------------------

// Listar productos por organizador (y opcionalmente por subcomisión)
// Ej: GET /api/productos?organizador_id=1
router.get("/", listarProductos);

// Obtener un producto por ID
router.get("/:id", obtenerProductoPorId);

// Crear nuevo producto
router.post("/", crearProducto);

// Actualizar producto
router.put("/:id", actualizarProducto);

// Subir imagen del producto
// Field multipart: "imagen"
router.post("/:id/imagen", upload.single("imagen"), subirImagenProducto);

// Baja lógica
router.delete("/:id", eliminarProducto);

module.exports = router;
