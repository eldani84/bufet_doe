// controllers/productos.controller.js
// ============================================================
// 🎛️ CONTROLADOR: PRODUCTOS
// - CRUD completo
// - Asociado a ORGANIZADOR y SUBCOMISIÓN PROPIETARIA
// - Incluye imagen_url para usar como ícono en POS
// - Incluye endpoint para subir imagen (multer) y guardar path
// ============================================================

const db = require("../db/connectionPromise");

// Helper: verificar organizador existente y activo
async function verificarOrganizadorActivo(organizador_id) {
  const [rows] = await db.query(
    "SELECT id FROM organizadores WHERE id = ? AND activo = 1",
    [organizador_id]
  );
  return rows.length > 0;
}

// Helper: verificar subcomisión y que pertenezca al organizador
async function verificarSubcomisionDelOrganizador(subcomision_id, organizador_id) {
  const [rows] = await db.query(
    "SELECT id FROM subcomisiones WHERE id = ? AND organizador_id = ? AND activo = 1",
    [subcomision_id, organizador_id]
  );
  return rows.length > 0;
}

// ---------------------------------------------------------------------
// 📌 GET /api/productos
//    Lista productos de un organizador (y opcionalmente de una subcomisión)
//    Query:
//      - organizador_id (OBLIGATORIO)
//      - subcomision_id (opcional)
//      - incluir_inactivos=1 (opcional)
// ---------------------------------------------------------------------
async function listarProductos(req, res) {
  try {
    const { organizador_id, subcomision_id, incluir_inactivos } = req.query;

    if (!organizador_id) {
      return res.status(400).json({
        message: "El parámetro 'organizador_id' es obligatorio",
      });
    }

    // Verificar organizador
    const organizadorOk = await verificarOrganizadorActivo(organizador_id);
    if (!organizadorOk) {
      return res
        .status(404)
        .json({ message: "Organizador no encontrado o inactivo" });
    }

    let sql = `
      SELECT 
        p.*,
        s.nombre AS subcomision_nombre
      FROM productos p
      LEFT JOIN subcomisiones s ON p.subcomision_propietaria_id = s.id
      WHERE p.organizador_id = ?
    `;
    const params = [organizador_id];

    if (subcomision_id) {
      sql += " AND p.subcomision_propietaria_id = ?";
      params.push(subcomision_id);
    }

    if (!incluir_inactivos) {
      sql += " AND p.activo = 1";
    }

    sql += " ORDER BY p.nombre ASC";

    const [rows] = await db.query(sql, params);

    return res.json(rows);
  } catch (error) {
    console.error("❌ Error listarProductos:", error);
    return res
      .status(500)
      .json({ message: "Error al obtener la lista de productos" });
  }
}

// ---------------------------------------------------------------------
// 📌 GET /api/productos/:id
// ---------------------------------------------------------------------
async function obtenerProductoPorId(req, res) {
  try {
    const { id } = req.params;

    const [rows] = await db.query(
      `
      SELECT 
        p.*,
        s.nombre AS subcomision_nombre
      FROM productos p
      LEFT JOIN subcomisiones s ON p.subcomision_propietaria_id = s.id
      WHERE p.id = ?
      `,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Producto no encontrado" });
    }

    return res.json(rows[0]);
  } catch (error) {
    console.error("❌ Error obtenerProductoPorId:", error);
    return res
      .status(500)
      .json({ message: "Error al obtener el producto" });
  }
}

// ---------------------------------------------------------------------
// 📌 POST /api/productos
//    Crea un nuevo producto
//    Body esperado:
//    {
//      "organizador_id": 1,
//      "subcomision_propietaria_id": 2,
//      "nombre": "Pancho",
//      "descripcion": "...",
//      "categoria": "comida",
//      "maneja_stock": true,
//      "imagen_url": "/uploads/productos/pancho.png" (opcional)
//    }
// ---------------------------------------------------------------------
async function crearProducto(req, res) {
  try {
    const {
      organizador_id,
      subcomision_propietaria_id,
      nombre,
      descripcion,
      categoria,
      maneja_stock,
      imagen_url,
    } = req.body;

    if (!organizador_id) {
      return res
        .status(400)
        .json({ message: "El campo 'organizador_id' es obligatorio" });
    }

    if (!nombre || typeof nombre !== "string" || nombre.trim() === "") {
      return res
        .status(400)
        .json({ message: "El campo 'nombre' es obligatorio" });
    }

    if (!subcomision_propietaria_id) {
      return res.status(400).json({
        message: "El campo 'subcomision_propietaria_id' es obligatorio",
      });
    }

    // Verificar organizador
    const organizadorOk = await verificarOrganizadorActivo(organizador_id);
    if (!organizadorOk) {
      return res
        .status(404)
        .json({ message: "Organizador no encontrado o inactivo" });
    }

    // Verificar subcomisión y que pertenezca al organizador
    const subOk = await verificarSubcomisionDelOrganizador(
      subcomision_propietaria_id,
      organizador_id
    );
    if (!subOk) {
      return res.status(400).json({
        message:
          "La subcomisión indicada no existe, no pertenece al organizador o está inactiva",
      });
    }

    const manejaStockFlag =
      typeof maneja_stock !== "undefined"
        ? maneja_stock
          ? 1
          : 0
        : 1;

    const imagen =
      typeof imagen_url === "string" && imagen_url.trim() ? imagen_url.trim() : null;

    const [result] = await db.query(
      `INSERT INTO productos 
        (organizador_id, nombre, descripcion, categoria, imagen_url, subcomision_propietaria_id, maneja_stock, activo)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        organizador_id,
        nombre.trim(),
        descripcion || null,
        categoria || null,
        imagen,
        subcomision_propietaria_id,
        manejaStockFlag,
      ]
    );

    const nuevoId = result.insertId;

    const [rows] = await db.query(
      `
      SELECT 
        p.*,
        s.nombre AS subcomision_nombre
      FROM productos p
      LEFT JOIN subcomisiones s ON p.subcomision_propietaria_id = s.id
      WHERE p.id = ?
      `,
      [nuevoId]
    );

    return res.status(201).json(rows[0]);
  } catch (error) {
    console.error("❌ Error crearProducto:", error);
    return res.status(500).json({ message: "Error al crear el producto" });
  }
}

// ---------------------------------------------------------------------
// 📌 PUT /api/productos/:id
//    Actualiza un producto
//    Body posible:
//    {
//      "nombre": "...",
//      "descripcion": "...",
//      "categoria": "...",
//      "imagen_url": "...",        (opcional)
//      "subcomision_propietaria_id": 3,
//      "maneja_stock": false,
//      "activo": true
//    }
// ---------------------------------------------------------------------
async function actualizarProducto(req, res) {
  try {
    const { id } = req.params;
    const {
      nombre,
      descripcion,
      categoria,
      imagen_url,
      subcomision_propietaria_id,
      maneja_stock,
      activo,
    } = req.body;

    // Verificar existencia del producto
    const [existe] = await db.query("SELECT * FROM productos WHERE id = ?", [id]);
    if (existe.length === 0) {
      return res.status(404).json({ message: "Producto no encontrado" });
    }

    const actual = existe[0];

    // Si se intenta cambiar la subcomisión, la validamos
    let nuevaSubcomisionId = actual.subcomision_propietaria_id;
    if (typeof subcomision_propietaria_id !== "undefined") {
      nuevaSubcomisionId = subcomision_propietaria_id;

      const subOk = await verificarSubcomisionDelOrganizador(
        nuevaSubcomisionId,
        actual.organizador_id
      );
      if (!subOk) {
        return res.status(400).json({
          message:
            "La subcomisión indicada no existe, no pertenece al organizador o está inactiva",
        });
      }
    }

    const nuevoNombre =
      typeof nombre === "string" && nombre.trim() !== ""
        ? nombre.trim()
        : actual.nombre;

    const nuevaDescripcion =
      typeof descripcion !== "undefined" ? descripcion : actual.descripcion;

    const nuevaCategoria =
      typeof categoria !== "undefined" ? categoria : actual.categoria;

    const nuevaImagenUrl =
      typeof imagen_url !== "undefined"
        ? (typeof imagen_url === "string" && imagen_url.trim() ? imagen_url.trim() : null)
        : actual.imagen_url;

    let nuevoManejaStock = actual.maneja_stock;
    if (typeof maneja_stock !== "undefined") {
      nuevoManejaStock = maneja_stock ? 1 : 0;
    }

    let nuevoActivo = actual.activo;
    if (typeof activo !== "undefined") {
      nuevoActivo = activo ? 1 : 0;
    }

    await db.query(
      `UPDATE productos
       SET nombre = ?, descripcion = ?, categoria = ?, imagen_url = ?, subcomision_propietaria_id = ?, maneja_stock = ?, activo = ?
       WHERE id = ?`,
      [
        nuevoNombre,
        nuevaDescripcion,
        nuevaCategoria,
        nuevaImagenUrl,
        nuevaSubcomisionId,
        nuevoManejaStock,
        nuevoActivo,
        id,
      ]
    );

    const [actualizado] = await db.query(
      `
      SELECT 
        p.*,
        s.nombre AS subcomision_nombre
      FROM productos p
      LEFT JOIN subcomisiones s ON p.subcomision_propietaria_id = s.id
      WHERE p.id = ?
      `,
      [id]
    );

    return res.json(actualizado[0]);
  } catch (error) {
    console.error("❌ Error actualizarProducto:", error);
    return res.status(500).json({ message: "Error al actualizar el producto" });
  }
}

// ---------------------------------------------------------------------
// 📌 DELETE /api/productos/:id
//    Baja lógica: activo = 0
// ---------------------------------------------------------------------
async function eliminarProducto(req, res) {
  try {
    const { id } = req.params;

    const [existe] = await db.query("SELECT * FROM productos WHERE id = ?", [id]);
    if (existe.length === 0) {
      return res.status(404).json({ message: "Producto no encontrado" });
    }

    await db.query("UPDATE productos SET activo = 0 WHERE id = ?", [id]);

    return res.json({
      message: "Producto dado de baja (activo = 0)",
      id,
    });
  } catch (error) {
    console.error("❌ Error eliminarProducto:", error);
    return res.status(500).json({ message: "Error al eliminar el producto" });
  }
}

// ---------------------------------------------------------------------
// 📌 POST /api/productos/:id/imagen
//    Sube imagen (multer la deja en req.file) y guarda imagen_url
// ---------------------------------------------------------------------
async function subirImagenProducto(req, res) {
  try {
    const { id } = req.params;

    // Verificar existencia del producto
    const [existe] = await db.query("SELECT * FROM productos WHERE id = ?", [id]);
    if (existe.length === 0) {
      return res.status(404).json({ message: "Producto no encontrado" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No se recibió archivo (field: imagen)" });
    }

    // Guardamos path relativo para servirlo como estático
    // Ej: /uploads/productos/1700000000-pancho.png
    const relative = `/uploads/productos/${req.file.filename}`;

    await db.query("UPDATE productos SET imagen_url = ? WHERE id = ?", [relative, id]);

    const [actualizado] = await db.query(
      `
      SELECT 
        p.*,
        s.nombre AS subcomision_nombre
      FROM productos p
      LEFT JOIN subcomisiones s ON p.subcomision_propietaria_id = s.id
      WHERE p.id = ?
      `,
      [id]
    );

    return res.json(actualizado[0]);
  } catch (error) {
    console.error("❌ Error subirImagenProducto:", error);
    return res.status(500).json({ message: "Error al subir imagen del producto" });
  }
}

module.exports = {
  listarProductos,
  obtenerProductoPorId,
  crearProducto,
  actualizarProducto,
  eliminarProducto,
  subirImagenProducto,
};
