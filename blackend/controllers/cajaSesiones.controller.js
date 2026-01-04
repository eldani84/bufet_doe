// controllers/cajaSesiones.controller.js
// ============================================================
// 🎛️ CONTROLADOR: SESIONES DE CAJA (APERTURA / CIERRE / RESUMEN)
// - Una sesión = un turno de caja de un usuario en un evento
// - Ahora soporta "usar saldo de la última sesión cerrada"
//   como monto inicial de efectivo.
// ============================================================

const db = require("../db/connectionPromise");

// Helpers
async function obtenerCaja(id) {
  const [rows] = await db.query("SELECT * FROM cajas WHERE id = ?", [id]);
  return rows[0] || null;
}

async function obtenerUsuario(id) {
  const [rows] = await db.query("SELECT * FROM usuarios WHERE id = ?", [id]);
  return rows[0] || null;
}

async function obtenerSesion(id) {
  const [rows] = await db.query(
    "SELECT * FROM caja_sesiones WHERE id = ?",
    [id]
  );
  return rows[0] || null;
}

// ---------------------------------------------------------------------
// 🔧 Helper: calcular resumen de una sesión de caja (solo EFECTIVO)
//      - monto_inicial_efectivo
//      + ventas EFECTIVO (ventas.caja_sesion_id)
//      + ingresos_manual EFECTIVO (caja_movimientos)
//      - retiros EFECTIVO (caja_movimientos)
// ---------------------------------------------------------------------
async function calcularResumenSesionCajaRaw(sesion) {
  const sesionId = sesion.id;

  // 1) Ventas en efectivo de esta sesión
  const [ventasEfectivoRows] = await db.query(
    `
    SELECT COALESCE(SUM(total), 0) AS total_efectivo
    FROM ventas
    WHERE caja_sesion_id = ? AND medio_pago = 'EFECTIVO'
    `,
    [sesionId]
  );
  const totalVentasEfectivo =
    Number(ventasEfectivoRows[0].total_efectivo) || 0;

  // 2) Movimientos de caja (solo EFECTIVO)
  const [movsRows] = await db.query(
    `
    SELECT 
      COALESCE(SUM(CASE WHEN tipo = 'INGRESO_MANUAL' THEN monto ELSE 0 END), 0) AS total_ingresos,
      COALESCE(SUM(CASE WHEN tipo = 'RETIRO' THEN monto ELSE 0 END), 0) AS total_retiros
    FROM caja_movimientos
    WHERE caja_sesion_id = ? AND medio = 'EFECTIVO'
    `,
    [sesionId]
  );

  const totalIngresos = Number(movsRows[0].total_ingresos) || 0;
  const totalRetiros = Number(movsRows[0].total_retiros) || 0;

  const montoInicial = Number(sesion.monto_inicial_efectivo) || 0;

  const montoTeorico =
    montoInicial + totalVentasEfectivo + totalIngresos - totalRetiros;

  return {
    id: sesion.id,
    caja_id: sesion.caja_id,
    evento_id: sesion.evento_id,
    usuario_id: sesion.usuario_id,
    estado: sesion.estado,
    fecha_apertura: sesion.fecha_apertura,
    fecha_cierre: sesion.fecha_cierre,
    monto_inicial_efectivo: montoInicial,
    total_ventas_efectivo: totalVentasEfectivo,
    total_ingresos_efectivo: totalIngresos,
    total_retiros_efectivo: totalRetiros,
    monto_teorico_efectivo: montoTeorico,
    monto_declarado_efectivo:
      sesion.monto_declarado_efectivo != null
        ? Number(sesion.monto_declarado_efectivo)
        : null,
    diferencia_efectivo:
      sesion.diferencia_efectivo != null
        ? Number(sesion.diferencia_efectivo)
        : null,
  };
}

// ---------------------------------------------------------------------
// 📌 GET /api/caja-sesiones
//    Lista sesiones de caja
// ---------------------------------------------------------------------
async function listarSesionesCaja(req, res) {
  try {
    const { evento_id, caja_id, usuario_id, estado } = req.query;

    let sql = `
      SELECT 
        cs.*,
        c.nombre AS caja_nombre,
        e.nombre AS evento_nombre,
        u.nombre AS usuario_nombre
      FROM caja_sesiones cs
      INNER JOIN cajas c   ON cs.caja_id = c.id
      INNER JOIN eventos e ON cs.evento_id = e.id
      INNER JOIN usuarios u ON cs.usuario_id = u.id
      WHERE 1 = 1
    `;
    const params = [];

    if (evento_id) {
      sql += " AND cs.evento_id = ?";
      params.push(evento_id);
    }

    if (caja_id) {
      sql += " AND cs.caja_id = ?";
      params.push(caja_id);
    }

    if (usuario_id) {
      sql += " AND cs.usuario_id = ?";
      params.push(usuario_id);
    }

    if (estado) {
      sql += " AND cs.estado = ?";
      params.push(estado);
    }

    sql += " ORDER BY cs.fecha_apertura DESC";

    const [rows] = await db.query(sql, params);
    return res.json(rows);
  } catch (error) {
    console.error("❌ Error listarSesionesCaja:", error);
    return res
      .status(500)
      .json({ message: "Error al listar sesiones de caja" });
  }
}

// ---------------------------------------------------------------------
// 📌 GET /api/caja-sesiones/:id
// ---------------------------------------------------------------------
async function obtenerSesionCajaPorId(req, res) {
  try {
    const { id } = req.params;

    const [rows] = await db.query(
      `
      SELECT 
        cs.*,
        c.nombre AS caja_nombre,
        e.nombre AS evento_nombre,
        u.nombre AS usuario_nombre
      FROM caja_sesiones cs
      INNER JOIN cajas c   ON cs.caja_id = c.id
      INNER JOIN eventos e ON cs.evento_id = e.id
      INNER JOIN usuarios u ON cs.usuario_id = u.id
      WHERE cs.id = ?
      `,
      [id]
    );

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ message: "Sesión de caja no encontrada" });
    }

    return res.json(rows[0]);
  } catch (error) {
    console.error("❌ Error obtenerSesionCajaPorId:", error);
    return res
      .status(500)
      .json({ message: "Error al obtener la sesión de caja" });
  }
}

// ---------------------------------------------------------------------
// 📌 GET /api/caja-sesiones/:id/resumen
//    Resumen en tiempo real de una sesión (solo EFECTIVO)
// ---------------------------------------------------------------------
async function obtenerResumenSesionCaja(req, res) {
  try {
    const { id } = req.params;

    const sesion = await obtenerSesion(id);
    if (!sesion) {
      return res
        .status(404)
        .json({ message: "Sesión de caja no encontrada" });
    }

    const resumen = await calcularResumenSesionCajaRaw(sesion);
    return res.json(resumen);
  } catch (error) {
    console.error("❌ Error obtenerResumenSesionCaja:", error);
    return res
      .status(500)
      .json({ message: "Error al obtener el resumen de la sesión de caja" });
  }
}

// ---------------------------------------------------------------------
// 📌 POST /api/caja-sesiones/apertura
//    Abre una nueva sesión de caja
//    Body esperado:
//    {
//      "caja_id": 1,
//      "usuario_id": 1,
//      "evento_id": 1,           // (opcional, se valida con la caja)
//      "monto_inicial_efectivo": 10000,
//      "usar_saldo_anterior": true | false   // 👈 NUEVO (opcional)
//    }
// ---------------------------------------------------------------------
async function abrirSesionCaja(req, res) {
  try {
    const {
      caja_id,
      usuario_id,
      monto_inicial_efectivo,
      evento_id,
      usar_saldo_anterior,
    } = req.body;

    if (!caja_id || !usuario_id) {
      return res.status(400).json({
        message: "Los campos 'caja_id' y 'usuario_id' son obligatorios",
      });
    }

    const caja = await obtenerCaja(caja_id);
    if (!caja || !caja.activo) {
      return res
        .status(404)
        .json({ message: "Caja no encontrada o inactiva" });
    }

    // Si se envía evento_id desde el front, validar que coincida
    if (
      typeof evento_id !== "undefined" &&
      Number(evento_id) !== Number(caja.evento_id)
    ) {
      return res.status(400).json({
        message: "La caja seleccionada no pertenece al evento indicado.",
      });
    }

    const usuario = await obtenerUsuario(usuario_id);
    if (!usuario || !usuario.activo) {
      return res
        .status(404)
        .json({ message: "Usuario no encontrado o inactivo" });
    }

    // Verificar que no haya otra sesión abierta para esa caja
    const [sesionesAbiertas] = await db.query(
      `
      SELECT id FROM caja_sesiones
      WHERE caja_id = ? AND estado = 'abierta'
      `,
      [caja_id]
    );

    if (sesionesAbiertas.length > 0) {
      return res.status(400).json({
        message:
          "Ya existe una sesión de caja abierta para esta caja. Debe cerrarse antes de abrir una nueva.",
      });
    }

    // ----------------------------------------------------------
    // 🧮 Determinar montoInicial:
    // - Si usar_saldo_anterior === true:
    //     usar monto_declarado_efectivo (o monto_teorico_efectivo)
    //     de la última sesión CERRADA de esa caja.
    // - Si no, usar el valor manual ingresado o 0.
    // ----------------------------------------------------------
    let montoInicial;

    if (usar_saldo_anterior === true) {
      const [ultimas] = await db.query(
        `
        SELECT *
        FROM caja_sesiones
        WHERE caja_id = ?
          AND estado = 'cerrada'
        ORDER BY fecha_cierre DESC
        LIMIT 1
        `,
        [caja_id]
      );

      if (ultimas.length > 0) {
        const ultima = ultimas[0];

        const declarado =
          ultima.monto_declarado_efectivo != null
            ? Number(ultima.monto_declarado_efectivo)
            : null;

        const teorico =
          ultima.monto_teorico_efectivo != null
            ? Number(ultima.monto_teorico_efectivo)
            : 0;

        if (declarado !== null && !Number.isNaN(declarado)) {
          montoInicial = declarado;
        } else {
          montoInicial = teorico;
        }
      } else {
        // No hay sesión cerrada previa: fallback al valor manual
        montoInicial =
          typeof monto_inicial_efectivo !== "undefined"
            ? Number(monto_inicial_efectivo)
            : 0;
      }
    } else {
      // Comportamiento tradicional: usar el valor ingresado
      montoInicial =
        typeof monto_inicial_efectivo !== "undefined"
          ? Number(monto_inicial_efectivo)
          : 0;
    }

    if (!Number.isFinite(montoInicial)) {
      montoInicial = 0;
    }

    const ahora = new Date();

    const [result] = await db.query(
      `
      INSERT INTO caja_sesiones
        (caja_id, usuario_id, evento_id, fecha_apertura, monto_inicial_efectivo, estado)
      VALUES (?, ?, ?, ?, ?, 'abierta')
      `,
      [caja_id, usuario_id, caja.evento_id, ahora, montoInicial]
    );

    const nuevoId = result.insertId;

    const [rows] = await db.query(
      `
      SELECT 
        cs.*,
        c.nombre AS caja_nombre,
        e.nombre AS evento_nombre,
        u.nombre AS usuario_nombre
      FROM caja_sesiones cs
      INNER JOIN cajas c   ON cs.caja_id = c.id
      INNER JOIN eventos e ON cs.evento_id = e.id
      INNER JOIN usuarios u ON cs.usuario_id = u.id
      WHERE cs.id = ?
      `,
      [nuevoId]
    );

    return res.status(201).json(rows[0]);
  } catch (error) {
    console.error("❌ Error abrirSesionCaja:", error);
    return res
      .status(500)
      .json({ message: "Error al abrir la sesión de caja" });
  }
}

// ---------------------------------------------------------------------
// 📌 POST /api/caja-sesiones/:id/cierre
//    Cierra una sesión de caja
//    Body esperado:
//    {
//      "monto_declarado_efectivo": 50000
//    }
// ---------------------------------------------------------------------
async function cerrarSesionCaja(req, res) {
  try {
    const { id } = req.params;
    const { monto_declarado_efectivo } = req.body;

    if (typeof monto_declarado_efectivo === "undefined") {
      return res.status(400).json({
        message: "El campo 'monto_declarado_efectivo' es obligatorio",
      });
    }

    const sesion = await obtenerSesion(id);
    if (!sesion) {
      return res
        .status(404)
        .json({ message: "Sesión de caja no encontrada" });
    }

    if (sesion.estado === "cerrada") {
      return res
        .status(400)
        .json({ message: "La sesión de caja ya está cerrada" });
    }

    const sesionId = sesion.id;

    // Reutilizamos el mismo cálculo que el resumen
    const resumen = await calcularResumenSesionCajaRaw(sesion);

    const montoTeorico = resumen.monto_teorico_efectivo;
    const montoInicial = resumen.monto_inicial_efectivo;
    const totalVentasEfectivo = resumen.total_ventas_efectivo;
    const totalIngresos = resumen.total_ingresos_efectivo;
    const totalRetiros = resumen.total_retiros_efectivo;

    const montoDeclarado = Number(monto_declarado_efectivo) || 0;
    const diferencia = montoDeclarado - montoTeorico;

    const ahora = new Date();

    await db.query(
      `
      UPDATE caja_sesiones
      SET 
        fecha_cierre = ?,
        monto_declarado_efectivo = ?,
        monto_teorico_efectivo = ?,
        diferencia_efectivo = ?,
        estado = 'cerrada'
      WHERE id = ?
      `,
      [ahora, montoDeclarado, montoTeorico, diferencia, sesionId]
    );

    const [actualizada] = await db.query(
      `
      SELECT 
        cs.*,
        c.nombre AS caja_nombre,
        e.nombre AS evento_nombre,
        u.nombre AS usuario_nombre
      FROM caja_sesiones cs
      INNER JOIN cajas c   ON cs.caja_id = c.id
      INNER JOIN eventos e ON cs.evento_id = e.id
      INNER JOIN usuarios u ON cs.usuario_id = u.id
      WHERE cs.id = ?
      `,
      [sesionId]
    );

    return res.json({
      ...actualizada[0],
      resumen_calculo: {
        monto_inicial_efectivo: montoInicial,
        totalVentasEfectivo,
        totalIngresos,
        totalRetiros,
        montoTeorico,
        montoDeclarado,
        diferencia,
      },
    });
  } catch (error) {
    console.error("❌ Error cerrarSesionCaja:", error);
    return res
      .status(500)
      .json({ message: "Error al cerrar la sesión de caja" });
  }
}

module.exports = {
  listarSesionesCaja,
  obtenerSesionCajaPorId,
  obtenerResumenSesionCaja,
  abrirSesionCaja,
  cerrarSesionCaja,
};
