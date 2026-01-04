// controllers/cajaMovimientos.controller.js
// ============================================================
// 🎛️ CONTROLADOR: MOVIMIENTOS DE CAJA
// - Ingresos manuales y retiros
// - Impactan en el cálculo de efectivo teórico
// ============================================================


const db = require("../db/connectionPromise");

async function obtenerSesion(id) {
  const [rows] = await db.query("SELECT * FROM caja_sesiones WHERE id = ?", [id]);
  return rows[0] || null;
}

// ---------------------------------------------------------------------
// 📌 GET /api/caja-movimientos
//    Lista movimientos
//    Query:
//      - caja_sesion_id (recomendado para filtrar)
// ---------------------------------------------------------------------
async function listarMovimientosCaja(req, res) {
  try {
    const { caja_sesion_id } = req.query;

    let sql = `
      SELECT 
        cm.*,
        cs.caja_id,
        cs.evento_id
      FROM caja_movimientos cm
      INNER JOIN caja_sesiones cs ON cm.caja_sesion_id = cs.id
      WHERE 1 = 1
    `;
    const params = [];

    if (caja_sesion_id) {
      sql += " AND cm.caja_sesion_id = ?";
      params.push(caja_sesion_id);
    }

    sql += " ORDER BY cm.fecha_hora ASC";

    const [rows] = await db.query(sql, params);
    return res.json(rows);
  } catch (error) {
    console.error("❌ Error listarMovimientosCaja:", error);
    return res
      .status(500)
      .json({ message: "Error al listar movimientos de caja" });
  }
}

// ---------------------------------------------------------------------
// 📌 POST /api/caja-movimientos
//    Crea un movimiento (INGRESO_MANUAL o RETIRO)
//    Body esperado:
//    {
//      "caja_sesion_id": 1,
//      "tipo": "INGRESO_MANUAL" | "RETIRO",
//      "medio": "EFECTIVO",
//      "monto": 5000,
//      "descripcion": "Ingreso de cambio"
//    }
// ---------------------------------------------------------------------
async function crearMovimientoCaja(req, res) {
  try {
    const { caja_sesion_id, tipo, medio, monto, descripcion } = req.body;

    if (!caja_sesion_id || !tipo || !monto) {
      return res.status(400).json({
        message:
          "Los campos 'caja_sesion_id', 'tipo' y 'monto' son obligatorios",
      });
    }

    const tiposPermitidos = ["INGRESO_MANUAL", "RETIRO"];
    if (!tiposPermitidos.includes(tipo)) {
      return res.status(400).json({
        message: "El campo 'tipo' debe ser 'INGRESO_MANUAL' o 'RETIRO'",
      });
    }

    const medioValido = medio || "EFECTIVO";

    const sesion = await obtenerSesion(caja_sesion_id);
    if (!sesion) {
      return res.status(404).json({ message: "Sesión de caja no encontrada" });
    }

    if (sesion.estado !== "abierta") {
      return res.status(400).json({
        message:
          "No se pueden registrar movimientos en una sesión de caja cerrada",
      });
    }

    const montoNum = Number(monto);
    if (!Number.isFinite(montoNum) || montoNum <= 0) {
      return res.status(400).json({
        message: "El campo 'monto' debe ser un número mayor que cero",
      });
    }

    const ahora = new Date();

    const [result] = await db.query(
      `
      INSERT INTO caja_movimientos
        (caja_sesion_id, tipo, medio, monto, fecha_hora, descripcion)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [caja_sesion_id, tipo, medioValido, montoNum, ahora, descripcion || null]
    );

    const nuevoId = result.insertId;

    const [rows] = await db.query(
      `
      SELECT 
        cm.*,
        cs.caja_id,
        cs.evento_id
      FROM caja_movimientos cm
      INNER JOIN caja_sesiones cs ON cm.caja_sesion_id = cs.id
      WHERE cm.id = ?
      `,
      [nuevoId]
    );

    return res.status(201).json(rows[0]);
  } catch (error) {
    console.error("❌ Error crearMovimientoCaja:", error);
    return res
      .status(500)
      .json({ message: "Error al crear el movimiento de caja" });
  }
}

module.exports = {
  listarMovimientosCaja,
  crearMovimientoCaja,
};
