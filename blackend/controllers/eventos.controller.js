// controllers/eventos.controller.js
// ============================================================
// 🎛️ CONTROLADOR: EVENTOS
// - CRUD completo
// - Siempre asociados a un ORGANIZADOR
// - Estados: planificado, en_curso, cerrado
// ============================================================

const db = require("../db/connectionPromise");

// Helper: verificar organizador activo
async function verificarOrganizadorActivo(organizador_id) {
  const [rows] = await db.query(
    "SELECT id FROM organizadores WHERE id = ? AND activo = 1",
    [organizador_id]
  );
  return rows.length > 0;
}

// ---------------------------------------------------------------------
// 📌 GET /api/eventos
//    Lista eventos de un organizador
//    Query:
//      - organizador_id (OBLIGATORIO)
//      - estado (opcional: planificado | en_curso | cerrado)
// ---------------------------------------------------------------------
async function listarEventos(req, res) {
  try {
    const { organizador_id, estado } = req.query;

    if (!organizador_id) {
      return res
        .status(400)
        .json({ message: "El parámetro 'organizador_id' es obligatorio" });
    }

    const organizadorOk = await verificarOrganizadorActivo(organizador_id);
    if (!organizadorOk) {
      return res
        .status(404)
        .json({ message: "Organizador no encontrado o inactivo" });
    }

    let sql = `
      SELECT e.*, o.nombre AS organizador_nombre
      FROM eventos e
      INNER JOIN organizadores o ON e.organizador_id = o.id
      WHERE e.organizador_id = ?
    `;
    const params = [organizador_id];

    if (estado) {
      sql += " AND e.estado = ?";
      params.push(estado);
    }

    sql += " ORDER BY e.fecha_inicio DESC";

    const [rows] = await db.query(sql, params);
    return res.json(rows);
  } catch (error) {
    console.error("❌ Error listarEventos:", error);
    return res.status(500).json({ message: "Error al listar eventos" });
  }
}

// ---------------------------------------------------------------------
// 📌 GET /api/eventos/:id
// ---------------------------------------------------------------------
async function obtenerEventoPorId(req, res) {
  try {
    const { id } = req.params;

    const [rows] = await db.query(
      `
      SELECT e.*, o.nombre AS organizador_nombre
      FROM eventos e
      INNER JOIN organizadores o ON e.organizador_id = o.id
      WHERE e.id = ?
      `,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Evento no encontrado" });
    }

    return res.json(rows[0]);
  } catch (error) {
    console.error("❌ Error obtenerEventoPorId:", error);
    return res.status(500).json({ message: "Error al obtener el evento" });
  }
}

// ---------------------------------------------------------------------
// 📌 POST /api/eventos
//    Crea un evento
//    Body esperado:
//    {
//      "organizador_id": 1,
//      "nombre": "Fiesta Aniversario 2026",
//      "fecha_inicio": "2026-02-15 21:00:00",
//      "fecha_fin": "2026-02-16 04:00:00",  (opcional)
//      "estado": "planificado"             (opcional, default planificado)
//    }
// ---------------------------------------------------------------------
async function crearEvento(req, res) {
  try {
    const { organizador_id, nombre, fecha_inicio, fecha_fin, estado } = req.body;

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

    if (!fecha_inicio) {
      return res
        .status(400)
        .json({ message: "El campo 'fecha_inicio' es obligatorio" });
    }

    const organizadorOk = await verificarOrganizadorActivo(organizador_id);
    if (!organizadorOk) {
      return res
        .status(404)
        .json({ message: "Organizador no encontrado o inactivo" });
    }

    const estadoValido = estado || "planificado";
    const estadosPermitidos = ["planificado", "en_curso", "cerrado"];
    if (!estadosPermitidos.includes(estadoValido)) {
      return res.status(400).json({
        message:
          "El campo 'estado' debe ser 'planificado', 'en_curso' o 'cerrado'",
      });
    }

    const [result] = await db.query(
      `
      INSERT INTO eventos (organizador_id, nombre, fecha_inicio, fecha_fin, estado, observaciones)
      VALUES (?, ?, ?, ?, ?, NULL)
      `,
      [organizador_id, nombre.trim(), fecha_inicio, fecha_fin || null, estadoValido]
    );

    const nuevoId = result.insertId;

    const [rows] = await db.query(
      `
      SELECT e.*, o.nombre AS organizador_nombre
      FROM eventos e
      INNER JOIN organizadores o ON e.organizador_id = o.id
      WHERE e.id = ?
      `,
      [nuevoId]
    );

    return res.status(201).json(rows[0]);
  } catch (error) {
    console.error("❌ Error crearEvento:", error);
    return res.status(500).json({ message: "Error al crear el evento" });
  }
}

// ---------------------------------------------------------------------
// 📌 PUT /api/eventos/:id
//    Actualiza un evento
//    Body (campos opcionales):
//    {
//      "nombre": "...",
//      "fecha_inicio": "...",
//      "fecha_fin": "...",
//      "estado": "en_curso",
//      "observaciones": "texto..."
//    }
// ---------------------------------------------------------------------
async function actualizarEvento(req, res) {
  try {
    const { id } = req.params;
    const { nombre, fecha_inicio, fecha_fin, estado, observaciones } = req.body;

    const [existe] = await db.query("SELECT * FROM eventos WHERE id = ?", [id]);

    if (existe.length === 0) {
      return res.status(404).json({ message: "Evento no encontrado" });
    }

    const actual = existe[0];

    const nuevoNombre =
      typeof nombre === "string" && nombre.trim() !== ""
        ? nombre.trim()
        : actual.nombre;

    const nuevaFechaInicio =
      typeof fecha_inicio !== "undefined" ? fecha_inicio : actual.fecha_inicio;

    const nuevaFechaFin =
      typeof fecha_fin !== "undefined" ? fecha_fin : actual.fecha_fin;

    let nuevoEstado = actual.estado;
    if (typeof estado !== "undefined") {
      const estadosPermitidos = ["planificado", "en_curso", "cerrado"];
      if (!estadosPermitidos.includes(estado)) {
        return res.status(400).json({
          message:
            "El campo 'estado' debe ser 'planificado', 'en_curso' o 'cerrado'",
        });
      }
      nuevoEstado = estado;
    }

    const nuevasObservaciones =
      typeof observaciones !== "undefined"
        ? observaciones
        : actual.observaciones;

    await db.query(
      `
      UPDATE eventos
      SET nombre = ?, fecha_inicio = ?, fecha_fin = ?, estado = ?, observaciones = ?
      WHERE id = ?
      `,
      [
        nuevoNombre,
        nuevaFechaInicio,
        nuevaFechaFin,
        nuevoEstado,
        nuevasObservaciones,
        id,
      ]
    );

    const [actualizado] = await db.query(
      `
      SELECT e.*, o.nombre AS organizador_nombre
      FROM eventos e
      INNER JOIN organizadores o ON e.organizador_id = o.id
      WHERE e.id = ?
      `,
      [id]
    );

    return res.json(actualizado[0]);
  } catch (error) {
    console.error("❌ Error actualizarEvento:", error);
    return res.status(500).json({ message: "Error al actualizar el evento" });
  }
}

// ---------------------------------------------------------------------
// 📌 DELETE /api/eventos/:id
//    "Cierre" lógico del evento: estado = 'cerrado'
// ---------------------------------------------------------------------
async function cerrarEvento(req, res) {
  try {
    const { id } = req.params;

    const [existe] = await db.query("SELECT * FROM eventos WHERE id = ?", [id]);

    if (existe.length === 0) {
      return res.status(404).json({ message: "Evento no encontrado" });
    }

    await db.query(
      "UPDATE eventos SET estado = 'cerrado' WHERE id = ?",
      [id]
    );

    return res.json({
      message: "Evento cerrado (estado = 'cerrado')",
      id,
    });
  } catch (error) {
    console.error("❌ Error cerrarEvento:", error);
    return res.status(500).json({ message: "Error al cerrar el evento" });
  }
}

module.exports = {
  listarEventos,
  obtenerEventoPorId,
  crearEvento,
  actualizarEvento,
  cerrarEvento,
};
