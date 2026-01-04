// controllers/cajas.controller.js
// ============================================================
// 🎛️ CONTROLADOR: CAJAS
// - ABM de cajas por evento
// - Usa baja lógica con campo "activo"
// ============================================================

const db = require("../db/connectionPromise");

// Helper: obtener evento
async function obtenerEvento(id) {
  const [rows] = await db.query("SELECT id, nombre FROM eventos WHERE id = ?", [
    id,
  ]);
  return rows[0] || null;
}

// Helper: obtener caja
async function obtenerCaja(id) {
  const [rows] = await db.query("SELECT * FROM cajas WHERE id = ?", [id]);
  return rows[0] || null;
}

// ============================================================
// 📌 GET /api/cajas
//    Query opcionales:
//      - evento_id
//      - activo (1 | 0)
// ============================================================
async function listarCajas(req, res) {
  try {
    const { evento_id, activo } = req.query;

    let sql = `
      SELECT 
        c.*,
        e.nombre AS evento_nombre
      FROM cajas c
      INNER JOIN eventos e ON c.evento_id = e.id
      WHERE 1 = 1
    `;
    const params = [];

    if (evento_id) {
      sql += " AND c.evento_id = ?";
      params.push(evento_id);
    }

    if (typeof activo !== "undefined" && activo !== "") {
      sql += " AND c.activo = ?";
      params.push(Number(activo) ? 1 : 0);
    }

    sql += " ORDER BY e.fecha_inicio DESC, c.nombre ASC";

    const [rows] = await db.query(sql, params);
    return res.json(rows);
  } catch (error) {
    console.error("❌ Error listarCajas:", error);
    return res.status(500).json({ message: "Error al listar cajas" });
  }
}

// ============================================================
// 📌 GET /api/cajas/:id
// ============================================================
async function obtenerCajaPorId(req, res) {
  try {
    const { id } = req.params;

    const [rows] = await db.query(
      `
      SELECT 
        c.*,
        e.nombre AS evento_nombre
      FROM cajas c
      INNER JOIN eventos e ON c.evento_id = e.id
      WHERE c.id = ?
      `,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Caja no encontrada" });
    }

    return res.json(rows[0]);
  } catch (error) {
    console.error("❌ Error obtenerCajaPorId:", error);
    return res.status(500).json({ message: "Error al obtener la caja" });
  }
}

// ============================================================
// 📌 POST /api/cajas
//    Body esperado:
//    {
//      "evento_id": 1,
//      "nombre": "Caja Principal",
//      "descripcion": "Puesto principal",
//      "activo": true
//    }
// ============================================================
async function crearCaja(req, res) {
  try {
    const { evento_id, nombre, descripcion, activo } = req.body;

    if (!evento_id) {
      return res
        .status(400)
        .json({ message: "El campo 'evento_id' es obligatorio" });
    }
    if (!nombre || !String(nombre).trim()) {
      return res
        .status(400)
        .json({ message: "El campo 'nombre' es obligatorio" });
    }

    const evento = await obtenerEvento(evento_id);
    if (!evento) {
      return res.status(404).json({ message: "Evento no encontrado" });
    }

    const nombreTrim = String(nombre).trim();
    const descTrim =
      typeof descripcion === "string" && descripcion.trim()
        ? descripcion.trim()
        : null;
    const activoVal =
      typeof activo === "boolean"
        ? activo
          ? 1
          : 0
        : typeof activo !== "undefined"
        ? Number(activo)
          ? 1
          : 0
        : 1;

    const [result] = await db.query(
      `
      INSERT INTO cajas (evento_id, nombre, descripcion, activo)
      VALUES (?, ?, ?, ?)
      `,
      [evento_id, nombreTrim, descTrim, activoVal]
    );

    const nuevoId = result.insertId;

    const [rows] = await db.query(
      `
      SELECT 
        c.*,
        e.nombre AS evento_nombre
      FROM cajas c
      INNER JOIN eventos e ON c.evento_id = e.id
      WHERE c.id = ?
      `,
      [nuevoId]
    );

    return res.status(201).json(rows[0]);
  } catch (error) {
    console.error("❌ Error crearCaja:", error);
    return res.status(500).json({ message: "Error al crear la caja" });
  }
}

// ============================================================
// 📌 PUT /api/cajas/:id
//    Body posible:
//    {
//      "evento_id": 1,   // opcional (normalmente no se cambia)
//      "nombre": "Caja Principal",
//      "descripcion": "Puesto 1",
//      "activo": false
//    }
// ============================================================
async function actualizarCaja(req, res) {
  try {
    const { id } = req.params;
    const { evento_id, nombre, descripcion, activo } = req.body;

    const caja = await obtenerCaja(id);
    if (!caja) {
      return res.status(404).json({ message: "Caja no encontrada" });
    }

    const fields = [];
    const params = [];

    if (typeof evento_id !== "undefined") {
      const evento = await obtenerEvento(evento_id);
      if (!evento) {
        return res.status(404).json({ message: "Evento no encontrado" });
      }
      fields.push("evento_id = ?");
      params.push(evento_id);
    }

    if (typeof nombre !== "undefined") {
      if (!String(nombre).trim()) {
        return res
          .status(400)
          .json({ message: "El campo 'nombre' no puede estar vacío" });
      }
      fields.push("nombre = ?");
      params.push(String(nombre).trim());
    }

    if (typeof descripcion !== "undefined") {
      const descTrim =
        typeof descripcion === "string" && descripcion.trim()
          ? descripcion.trim()
          : null;
      fields.push("descripcion = ?");
      params.push(descTrim);
    }

    if (typeof activo !== "undefined") {
      const activoVal =
        typeof activo === "boolean"
          ? activo
            ? 1
            : 0
          : Number(activo)
          ? 1
          : 0;
      fields.push("activo = ?");
      params.push(activoVal);
    }

    if (fields.length === 0) {
      return res
        .status(400)
        .json({ message: "No hay cambios para actualizar" });
    }

    params.push(id);

    await db.query(`UPDATE cajas SET ${fields.join(", ")} WHERE id = ?`, params);

    const [rows] = await db.query(
      `
      SELECT 
        c.*,
        e.nombre AS evento_nombre
      FROM cajas c
      INNER JOIN eventos e ON c.evento_id = e.id
      WHERE c.id = ?
      `,
      [id]
    );

    return res.json(rows[0]);
  } catch (error) {
    console.error("❌ Error actualizarCaja:", error);
    return res.status(500).json({ message: "Error al actualizar la caja" });
  }
}

// ============================================================
// 📌 DELETE /api/cajas/:id
//    Baja lógica (activo = 0)
//    NO permite desactivar si hay sesiones abiertas.
// ============================================================
async function eliminarCaja(req, res) {
  try {
    const { id } = req.params;

    const caja = await obtenerCaja(id);
    if (!caja) {
      return res.status(404).json({ message: "Caja no encontrada" });
    }

    // Verificar que no haya sesiones de caja abiertas
    const [sesionesAbiertas] = await db.query(
      `
      SELECT id 
      FROM caja_sesiones 
      WHERE caja_id = ? AND estado = 'abierta'
      `,
      [id]
    );

    if (sesionesAbiertas.length > 0) {
      return res.status(400).json({
        message:
          "No se puede desactivar la caja porque tiene al menos una sesión abierta.",
      });
    }

    await db.query(
      `
      UPDATE cajas
      SET activo = 0
      WHERE id = ?
      `,
      [id]
    );

    return res.json({ message: "Caja desactivada correctamente" });
  } catch (error) {
    console.error("❌ Error eliminarCaja:", error);
    return res.status(500).json({ message: "Error al desactivar la caja" });
  }
}

module.exports = {
  listarCajas,
  obtenerCajaPorId,
  crearCaja,
  actualizarCaja,
  eliminarCaja,
};
