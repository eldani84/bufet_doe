// controllers/subcomisiones.controller.js
// ============================================================
// 🎛️ CONTROLADOR: SUBCOMISIONES
// - CRUD completo
// - Siempre asociado a un ORGANIZADOR
// ============================================================

const db = require("../db/connectionPromise");

// ---------------------------------------------------------------------
// 📌 GET /api/subcomisiones
//    Lista subcomisiones de un organizador
//    Query:
//      - organizador_id (OBLIGATORIO)
//      - incluir_inactivas=1 (opcional)
// ---------------------------------------------------------------------
async function listarSubcomisiones(req, res) {
  try {
    const { organizador_id, incluir_inactivas } = req.query;

    if (!organizador_id) {
      return res.status(400).json({
        message: "El parámetro 'organizador_id' es obligatorio",
      });
    }

    // Verificar que el organizador exista
    const [orgRows] = await db.query(
      "SELECT id FROM organizadores WHERE id = ? AND activo = 1",
      [organizador_id]
    );

    if (orgRows.length === 0) {
      return res
        .status(404)
        .json({ message: "Organizador no encontrado o inactivo" });
    }

    let sql = `
      SELECT *
      FROM subcomisiones
      WHERE organizador_id = ?
    `;
    const params = [organizador_id];

    if (!incluir_inactivas) {
      sql += " AND activo = 1";
    }

    sql += " ORDER BY nombre ASC";

    const [rows] = await db.query(sql, params);

    return res.json(rows);
  } catch (error) {
    console.error("❌ Error listarSubcomisiones:", error);
    return res
      .status(500)
      .json({ message: "Error al obtener la lista de subcomisiones" });
  }
}

// ---------------------------------------------------------------------
// 📌 GET /api/subcomisiones/:id
// ---------------------------------------------------------------------
async function obtenerSubcomisionPorId(req, res) {
  try {
    const { id } = req.params;

    const [rows] = await db.query(
      "SELECT * FROM subcomisiones WHERE id = ?",
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Subcomisión no encontrada" });
    }

    return res.json(rows[0]);
  } catch (error) {
    console.error("❌ Error obtenerSubcomisionPorId:", error);
    return res
      .status(500)
      .json({ message: "Error al obtener la subcomisión" });
  }
}

// ---------------------------------------------------------------------
// 📌 POST /api/subcomisiones
//    Crea una nueva subcomisión
//    Body esperado: { organizador_id, nombre, descripcion? }
// ---------------------------------------------------------------------
async function crearSubcomision(req, res) {
  try {
    const { organizador_id, nombre, descripcion } = req.body;

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

    // Verificar organizador
    const [orgRows] = await db.query(
      "SELECT id FROM organizadores WHERE id = ? AND activo = 1",
      [organizador_id]
    );

    if (orgRows.length === 0) {
      return res
        .status(404)
        .json({ message: "Organizador no encontrado o inactivo" });
    }

    const [result] = await db.query(
      `INSERT INTO subcomisiones (organizador_id, nombre, descripcion, activo)
       VALUES (?, ?, ?, 1)`,
      [organizador_id, nombre.trim(), descripcion || null]
    );

    const nuevoId = result.insertId;

    const [rows] = await db.query(
      "SELECT * FROM subcomisiones WHERE id = ?",
      [nuevoId]
    );

    return res.status(201).json(rows[0]);
  } catch (error) {
    console.error("❌ Error crearSubcomision:", error);
    return res
      .status(500)
      .json({ message: "Error al crear la subcomisión" });
  }
}

// ---------------------------------------------------------------------
// 📌 PUT /api/subcomisiones/:id
//    Actualiza una subcomisión
//    Body: { nombre?, descripcion?, activo? }
// ---------------------------------------------------------------------
async function actualizarSubcomision(req, res) {
  try {
    const { id } = req.params;
    const { nombre, descripcion, activo } = req.body;

    // Verificar existencia
    const [existe] = await db.query(
      "SELECT * FROM subcomisiones WHERE id = ?",
      [id]
    );

    if (existe.length === 0) {
      return res.status(404).json({ message: "Subcomisión no encontrada" });
    }

    const actual = existe[0];

    const nuevoNombre =
      typeof nombre === "string" && nombre.trim() !== ""
        ? nombre.trim()
        : actual.nombre;

    const nuevaDescripcion =
      typeof descripcion !== "undefined" ? descripcion : actual.descripcion;

    let nuevoActivo = actual.activo;
    if (typeof activo !== "undefined") {
      nuevoActivo = activo ? 1 : 0;
    }

    await db.query(
      `UPDATE subcomisiones
       SET nombre = ?, descripcion = ?, activo = ?
       WHERE id = ?`,
      [nuevoNombre, nuevaDescripcion, nuevoActivo, id]
    );

    const [actualizado] = await db.query(
      "SELECT * FROM subcomisiones WHERE id = ?",
      [id]
    );

    return res.json(actualizado[0]);
  } catch (error) {
    console.error("❌ Error actualizarSubcomision:", error);
    return res
      .status(500)
      .json({ message: "Error al actualizar la subcomisión" });
  }
}

// ---------------------------------------------------------------------
// 📌 DELETE /api/subcomisiones/:id
//    Baja lógica: activo = 0
// ---------------------------------------------------------------------
async function eliminarSubcomision(req, res) {
  try {
    const { id } = req.params;

    const [existe] = await db.query(
      "SELECT * FROM subcomisiones WHERE id = ?",
      [id]
    );

    if (existe.length === 0) {
      return res.status(404).json({ message: "Subcomisión no encontrada" });
    }

    await db.query(
      "UPDATE subcomisiones SET activo = 0 WHERE id = ?",
      [id]
    );

    return res.json({
      message: "Subcomisión dada de baja (activo = 0)",
      id,
    });
  } catch (error) {
    console.error("❌ Error eliminarSubcomision:", error);
    return res
      .status(500)
      .json({ message: "Error al eliminar la subcomisión" });
  }
}

module.exports = {
  listarSubcomisiones,
  obtenerSubcomisionPorId,
  crearSubcomision,
  actualizarSubcomision,
  eliminarSubcomision,
};
