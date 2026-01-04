// controllers/organizadores.controller.js
// ============================================================
// 🎛️ CONTROLADOR: ORGANIZADORES
// - CRUD completo pensando a futuro
// - Maneja alta, baja lógica, modificación y listado
// ============================================================

const db = require("../db/connectionPromise");

// ---------------------------------------------------------------------
// 📌 GET /api/organizadores
//    Lista todos los organizadores (por defecto solo activos)
//    Query opcional: ?incluir_inactivos=1
// ---------------------------------------------------------------------
async function listarOrganizadores(req, res) {
  try {
    const { incluir_inactivos } = req.query;

    let sql = "SELECT * FROM organizadores";
    const params = [];

    if (!incluir_inactivos) {
      sql += " WHERE activo = 1";
    }

    sql += " ORDER BY nombre ASC";

    const [rows] = await db.query(sql, params);
    return res.json(rows);
  } catch (error) {
    console.error("❌ Error listarOrganizadores:", error);
    return res
      .status(500)
      .json({ message: "Error al obtener la lista de organizadores" });
  }
}

// ---------------------------------------------------------------------
// 📌 GET /api/organizadores/:id
// ---------------------------------------------------------------------
async function obtenerOrganizadorPorId(req, res) {
  try {
    const { id } = req.params;

    const [rows] = await db.query(
      "SELECT * FROM organizadores WHERE id = ?",
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Organizador no encontrado" });
    }

    return res.json(rows[0]);
  } catch (error) {
    console.error("❌ Error obtenerOrganizadorPorId:", error);
    return res
      .status(500)
      .json({ message: "Error al obtener el organizador" });
  }
}

// ---------------------------------------------------------------------
// 📌 POST /api/organizadores
//    Crea un nuevo organizador
//    Body esperado: { nombre, descripcion?, cuit_cuil? }
// ---------------------------------------------------------------------
async function crearOrganizador(req, res) {
  try {
    const { nombre, descripcion, cuit_cuil } = req.body;

    if (!nombre || typeof nombre !== "string" || nombre.trim() === "") {
      return res
        .status(400)
        .json({ message: "El campo 'nombre' es obligatorio" });
    }

    const [result] = await db.query(
      `INSERT INTO organizadores (nombre, descripcion, cuit_cuil, activo)
       VALUES (?, ?, ?, 1)`,
      [nombre.trim(), descripcion || null, cuit_cuil || null]
    );

    const nuevoId = result.insertId;

    const [rows] = await db.query(
      "SELECT * FROM organizadores WHERE id = ?",
      [nuevoId]
    );

    return res.status(201).json(rows[0]);
  } catch (error) {
    console.error("❌ Error crearOrganizador:", error);
    return res
      .status(500)
      .json({ message: "Error al crear el organizador" });
  }
}

// ---------------------------------------------------------------------
// 📌 PUT /api/organizadores/:id
//    Actualiza campos de un organizador
//    Body: { nombre?, descripcion?, cuit_cuil?, activo? }
// ---------------------------------------------------------------------
async function actualizarOrganizador(req, res) {
  try {
    const { id } = req.params;
    const { nombre, descripcion, cuit_cuil, activo } = req.body;

    // Verificar si existe
    const [existe] = await db.query(
      "SELECT * FROM organizadores WHERE id = ?",
      [id]
    );

    if (existe.length === 0) {
      return res.status(404).json({ message: "Organizador no encontrado" });
    }

    const organizadorActual = existe[0];

    const nuevoNombre =
      typeof nombre === "string" && nombre.trim() !== ""
        ? nombre.trim()
        : organizadorActual.nombre;

    const nuevaDescripcion =
      typeof descripcion !== "undefined"
        ? descripcion
        : organizadorActual.descripcion;

    const nuevoCuitCuil =
      typeof cuit_cuil !== "undefined" ? cuit_cuil : organizadorActual.cuit_cuil;

    let nuevoActivo = organizadorActual.activo;
    if (typeof activo !== "undefined") {
      nuevoActivo = activo ? 1 : 0;
    }

    await db.query(
      `UPDATE organizadores
       SET nombre = ?, descripcion = ?, cuit_cuil = ?, activo = ?
       WHERE id = ?`,
      [nuevoNombre, nuevaDescripcion, nuevoCuitCuil, nuevoActivo, id]
    );

    const [actualizado] = await db.query(
      "SELECT * FROM organizadores WHERE id = ?",
      [id]
    );

    return res.json(actualizado[0]);
  } catch (error) {
    console.error("❌ Error actualizarOrganizador:", error);
    return res
      .status(500)
      .json({ message: "Error al actualizar el organizador" });
  }
}

// ---------------------------------------------------------------------
// 📌 DELETE /api/organizadores/:id
//    Baja lógica: pone activo = 0
//    (A futuro se puede agregar endpoint para borrado físico si se necesita)
// ---------------------------------------------------------------------
async function eliminarOrganizador(req, res) {
  try {
    const { id } = req.params;

    const [existe] = await db.query(
      "SELECT * FROM organizadores WHERE id = ?",
      [id]
    );

    if (existe.length === 0) {
      return res.status(404).json({ message: "Organizador no encontrado" });
    }

    await db.query(
      "UPDATE organizadores SET activo = 0 WHERE id = ?",
      [id]
    );

    return res.json({
      message: "Organizador dado de baja (activo = 0)",
      id,
    });
  } catch (error) {
    console.error("❌ Error eliminarOrganizador:", error);
    return res
      .status(500)
      .json({ message: "Error al eliminar el organizador" });
  }
}

module.exports = {
  listarOrganizadores,
  obtenerOrganizadorPorId,
  crearOrganizador,
  actualizarOrganizador,
  eliminarOrganizador,
};
