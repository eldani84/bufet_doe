// server.js
// ============================================================
// 🌐 SERVIDOR PRINCIPAL - SISTEMA BUFET LAN (bufet_doe)
// Ubicación: D:\VENTAS-DIGITAL\BUFET_DOE\blackend
// ============================================================

require("dotenv").config(); // Lee D:\VENTAS-DIGITAL\BUFET_DOE\blackend\.env

const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

// ============================================================
// ⚙️ Middlewares base
// ============================================================

// CORS (por defecto permite todo; si querés restringir, usá CORS_ORIGIN en .env)
const corsOrigin = process.env.CORS_ORIGIN;
if (corsOrigin) {
  // Permite múltiples orígenes separados por coma
  const allowed = corsOrigin.split(",").map((o) => o.trim());
  app.use(
    cors({
      origin: function (origin, cb) {
        // Permitir requests sin origin (Postman, curl, etc.)
        if (!origin) return cb(null, true);
        if (allowed.includes(origin)) return cb(null, true);
        return cb(new Error("CORS: Origin no permitido: " + origin));
      },
      credentials: true,
    })
  );
} else {
  app.use(cors());
}

// Body parser (limite recomendado)
app.use(express.json({ limit: "2mb" }));

// ============================================================
// ✅ SERVIR ARCHIVOS ESTÁTICOS (UPLOADS)
// IMPORTANTE: debe ir ANTES de las rutas /api y antes del 404
// Ruta pública:  http://localhost:3005/uploads/productos/archivo.png
// Ruta física:   D:\VENTAS-DIGITAL\BUFET_DOE\blackend\uploads\productos\archivo.png
// ============================================================
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ============================================================
// ✅ Test rápido / health
// ============================================================
app.get("/", (req, res) => {
  res.json({
    message: "API bufet_doe operativa",
    timestamp: new Date().toISOString(),
  });
});

// ============================================================
// ===================== RUTAS =====================
// Todas las rutas salen desde ./routes/
// ============================================================

app.use("/api/organizadores", require("./routes/organizadores.routes"));
app.use("/api/subcomisiones", require("./routes/subcomisiones.routes"));
app.use("/api/productos", require("./routes/productos.routes"));
app.use("/api/eventos", require("./routes/eventos.routes"));

app.use("/api/productos-evento", require("./routes/productosEvento.routes"));

app.use("/api/cajas", require("./routes/cajas.routes"));
app.use("/api/caja-sesiones", require("./routes/cajaSesiones.routes"));
app.use("/api/caja-movimientos", require("./routes/cajaMovimientos.routes"));

app.use("/api/ventas", require("./routes/ventas.routes"));

app.use(
  "/api/reportes/subcomisiones",
  require("./routes/reportesSubcomisiones.routes")
);

// ============================================================
// 🧭 404 - Ruta no encontrada
// ============================================================
app.use((req, res) => {
  return res.status(404).json({
    message: "Ruta no encontrada",
    path: req.originalUrl,
  });
});

// ============================================================
// 🧯 Middleware de error (CORS / errores internos)
// ============================================================
app.use((err, req, res, next) => {
  console.error("❌ Error middleware:", err);

  // Error típico de CORS configurado arriba
  if (String(err.message || "").startsWith("CORS:")) {
    return res.status(403).json({ message: err.message });
  }

  return res.status(500).json({
    message: "Error interno del servidor",
  });
});

// ============================================================
// ===================== SERVIDOR ====================
// ============================================================
const PORT = process.env.PORT || 3005;

app.listen(PORT, () => {
  console.log(`🚀 Servidor bufet_doe escuchando en http://localhost:${PORT}`);
});
