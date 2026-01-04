// controllers/ventas.controller.js
// ============================================================
// 🎛️ CONTROLADOR: VENTAS
// - POS / ventas por evento
// - Control de stock
// - ✅ Subcomisión EFECTIVA (override por evento)
// ============================================================

const db = require("../db/connectionPromise");

// ============================================================
// Helpers
// ============================================================
async function obtenerSesionCaja(id) {
  const [rows] = await db.query("SELECT * FROM caja_sesiones WHERE id = ?", [id]);
  return rows[0] || null;
}

async function obtenerCaja(id) {
  const [rows] = await db.query("SELECT * FROM cajas WHERE id = ?", [id]);
  return rows[0] || null;
}

async function obtenerUsuario(id) {
  const [rows] = await db.query("SELECT * FROM usuarios WHERE id = ?", [id]);
  return rows[0] || null;
}

/**
 * ⚠️ CLAVE:
 * Traemos la subcomisión EFECTIVA:
 * - Si productos_evento.subcomision_destino_id existe → usar esa
 * - Si no → usar productos.subcomision_propietaria_id
 */
async function obtenerProductoEventoConProducto(producto_evento_id) {
  const [rows] = await db.query(
    `
    SELECT 
      pe.*,
      p.nombre AS producto_nombre,
      p.descripcion AS producto_descripcion,
      p.categoria,
      p.maneja_stock,

      -- 🔑 subcomisión efectiva
      COALESCE(pe.subcomision_destino_id, p.subcomision_propietaria_id) AS subcomision_efectiva_id
    FROM productos_evento pe
    INNER JOIN productos p ON pe.producto_id = p.id
    WHERE pe.id = ?
    `,
    [producto_evento_id]
  );
  return rows[0] || null;
}

// ============================================================
// GET /api/ventas
// ============================================================
async function listarVentas(req, res) {
  try {
    const {
      evento_id,
      caja_id,
      caja_sesion_id,
      medio_pago,
      fecha_desde,
      fecha_hasta,
    } = req.query;

    if (!evento_id) {
      return res.status(400).json({
        message: "El parámetro 'evento_id' es obligatorio",
      });
    }

    let sql = `
      SELECT 
        v.*,
        c.nombre AS caja_nombre,
        u.nombre AS usuario_nombre
      FROM ventas v
      INNER JOIN cajas c ON v.caja_id = c.id
      INNER JOIN usuarios u ON v.usuario_id = u.id
      WHERE v.evento_id = ?
    `;
    const params = [evento_id];

    if (caja_id) {
      sql += " AND v.caja_id = ?";
      params.push(caja_id);
    }

    if (caja_sesion_id) {
      sql += " AND v.caja_sesion_id = ?";
      params.push(caja_sesion_id);
    }

    if (medio_pago) {
      sql += " AND v.medio_pago = ?";
      params.push(medio_pago);
    }

    if (fecha_desde) {
      sql += " AND v.fecha_hora >= ?";
      params.push(`${fecha_desde} 00:00:00`);
    }

    if (fecha_hasta) {
      sql += " AND v.fecha_hora <= ?";
      params.push(`${fecha_hasta} 23:59:59`);
    }

    sql += " ORDER BY v.fecha_hora DESC";

    const [rows] = await db.query(sql, params);
    return res.json(rows);
  } catch (error) {
    console.error("❌ Error listarVentas:", error);
    return res.status(500).json({ message: "Error al listar ventas" });
  }
}

// ============================================================
// GET /api/ventas/:id
// ============================================================
async function obtenerVentaPorId(req, res) {
  try {
    const { id } = req.params;

    const [ventaRows] = await db.query(
      `
      SELECT 
        v.*,
        c.nombre AS caja_nombre,
        u.nombre AS usuario_nombre
      FROM ventas v
      INNER JOIN cajas c ON v.caja_id = c.id
      INNER JOIN usuarios u ON v.usuario_id = u.id
      WHERE v.id = ?
      `,
      [id]
    );

    if (ventaRows.length === 0) {
      return res.status(404).json({ message: "Venta no encontrada" });
    }

    const venta = ventaRows[0];

    const [detalles] = await db.query(
      `
      SELECT 
        vd.*,
        p.nombre AS producto_nombre,
        p.categoria,
        s.nombre AS subcomision_nombre
      FROM ventas_detalle vd
      INNER JOIN productos p ON vd.producto_id = p.id
      LEFT JOIN subcomisiones s ON vd.subcomision_id = s.id
      WHERE vd.venta_id = ?
      ORDER BY vd.id ASC
      `,
      [id]
    );

    return res.json({ venta, detalles });
  } catch (error) {
    console.error("❌ Error obtenerVentaPorId:", error);
    return res.status(500).json({ message: "Error al obtener la venta" });
  }
}

// ============================================================
// POST /api/ventas
// ============================================================
async function crearVenta(req, res) {
  const connection = await db.getConnection();

  try {
    const {
      evento_id,
      caja_id,
      caja_sesion_id,
      usuario_id,
      medio_pago,
      observaciones,
      referencia_pago,
      items,
    } = req.body;

    if (!evento_id || !caja_id || !caja_sesion_id || !usuario_id) {
      connection.release();
      return res.status(400).json({
        message:
          "Los campos 'evento_id', 'caja_id', 'caja_sesion_id' y 'usuario_id' son obligatorios",
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      connection.release();
      return res.status(400).json({
        message: "Debe incluir al menos un ítem en 'items'",
      });
    }

    const mediosPermitidos = [
      "EFECTIVO",
      "MP_QR",
      "DEBITO",
      "CREDITO",
      "TRANSFERENCIA",
      "OTRO",
    ];
    if (!medio_pago || !mediosPermitidos.includes(medio_pago)) {
      connection.release();
      return res.status(400).json({
        message: "Medio de pago inválido",
      });
    }

    const sesion = await obtenerSesionCaja(caja_sesion_id);
    if (!sesion || sesion.estado !== "abierta") {
      connection.release();
      return res.status(400).json({
        message: "La sesión de caja no está abierta o no existe",
      });
    }

    if (sesion.caja_id !== caja_id || sesion.evento_id !== evento_id) {
      connection.release();
      return res.status(400).json({
        message: "La sesión de caja no corresponde a la caja o evento",
      });
    }

    const usuario = await obtenerUsuario(usuario_id);
    if (!usuario || !usuario.activo) {
      connection.release();
      return res.status(404).json({
        message: "Usuario no encontrado o inactivo",
      });
    }

    const caja = await obtenerCaja(caja_id);
    if (!caja || !caja.activo) {
      connection.release();
      return res.status(404).json({
        message: "Caja no encontrada o inactiva",
      });
    }

    await connection.beginTransaction();

    let totalVenta = 0;
    const detallesPreparados = [];

    for (const item of items) {
      const { producto_evento_id, cantidad } = item;

      if (!producto_evento_id || !cantidad) {
        throw new Error("Cada ítem debe tener producto_evento_id y cantidad");
      }

      const cantNum = Number(cantidad);
      if (!Number.isFinite(cantNum) || cantNum <= 0) {
        throw new Error("Cantidad inválida");
      }

      const pe = await obtenerProductoEventoConProducto(producto_evento_id);
      if (!pe || !pe.activo) {
        throw new Error("Producto del evento inválido o inactivo");
      }

      if (pe.evento_id !== evento_id) {
        throw new Error("Producto no pertenece al evento");
      }

      const precioUnit = Number(pe.precio_venta);
      const subtotal = precioUnit * cantNum;

      if (pe.maneja_stock) {
        if (Number(pe.stock_actual) < cantNum) {
          throw new Error(
            `Stock insuficiente para '${pe.producto_nombre}'`
          );
        }
      }

      totalVenta += subtotal;

      detallesPreparados.push({
        producto_evento_id,
        producto_id: pe.producto_id,
        subcomision_id: pe.subcomision_efectiva_id, // 🔑 AQUÍ
        cantidad: cantNum,
        precio_unitario: precioUnit,
        subtotal,
        maneja_stock: pe.maneja_stock,
      });
    }

    const ahora = new Date();

    const [ventaResult] = await connection.query(
      `
      INSERT INTO ventas
        (evento_id, caja_id, caja_sesion_id, usuario_id, fecha_hora, medio_pago, total, referencia_pago, observaciones)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        evento_id,
        caja_id,
        caja_sesion_id,
        usuario_id,
        ahora,
        medio_pago,
        totalVenta,
        referencia_pago || null,
        observaciones || null,
      ]
    );

    const ventaId = ventaResult.insertId;

    for (const det of detallesPreparados) {
      await connection.query(
        `
        INSERT INTO ventas_detalle
          (venta_id, producto_evento_id, producto_id, subcomision_id, cantidad, precio_unitario, subtotal)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          ventaId,
          det.producto_evento_id,
          det.producto_id,
          det.subcomision_id,
          det.cantidad,
          det.precio_unitario,
          det.subtotal,
        ]
      );

      if (det.maneja_stock) {
        await connection.query(
          `
          UPDATE productos_evento
          SET stock_actual = stock_actual - ?
          WHERE id = ?
          `,
          [det.cantidad, det.producto_evento_id]
        );
      }
    }

    await connection.commit();
    connection.release();

    return res.status(201).json({ id: ventaId });
  } catch (error) {
    console.error("❌ Error crearVenta:", error.message || error);

    try {
      await connection.rollback();
    } catch (_) {}

    connection.release();
    return res.status(500).json({ message: error.message || "Error al crear la venta" });
  }
}

module.exports = {
  listarVentas,
  obtenerVentaPorId,
  crearVenta,
};
