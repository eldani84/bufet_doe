// controllers/reportesSubcomisiones.controller.js
// ============================================================
// 📊 REPORTE: VENTAS POR SUBCOMISIÓN Y MEDIO DE PAGO
// - Pensado para liquidar al final del evento
// - Agrupa por subcomisión y medio de pago
// - Permite filtrar por fecha, caja y medio de pago
// ============================================================

const db = require("../db/connectionPromise");

// ---------------------------------------------------------------------
// 📌 GET /api/reportes/subcomisiones
// Query params:
//
//   - evento_id (OBLIGATORIO)
//   - caja_id (opcional)
//   - medio_pago (opcional: EFECTIVO, MP_QR, DEBITO, CREDITO, TRANSFERENCIA, OTRO)
//   - fecha_desde (opcional, formato 'YYYY-MM-DD')
//   - fecha_hasta (opcional, formato 'YYYY-MM-DD')
//
// Respuesta (ejemplo):
// {
//   "evento_id": 1,
//   "filtros": {...},
//   "totales_generales_por_medio": {
//     "EFECTIVO": 150000,
//     "MP_QR": 220000
//   },
//   "subcomisiones": [
//     {
//       "subcomision_id": 1,
//       "subcomision_nombre": "Fútbol",
//       "totales_por_medio": {
//         "EFECTIVO": { "monto": 80000, "cantidad_items": 120 },
//         "MP_QR": { "monto": 50000, "cantidad_items": 70 }
//       },
//       "total_subcomision": 130000,
//       "total_items": 190
//     },
//     ...
//   ]
// }
// ---------------------------------------------------------------------
async function reporteSubcomisionesEvento(req, res) {
  try {
    const { evento_id, caja_id, medio_pago, fecha_desde, fecha_hasta } =
      req.query;

    if (!evento_id) {
      return res.status(400).json({
        message: "El parámetro 'evento_id' es obligatorio",
      });
    }

    // Construimos SQL base
    let sql = `
      SELECT 
        vd.subcomision_id,
        COALESCE(s.nombre, 'SIN_SUBCOMISION') AS subcomision_nombre,
        v.medio_pago,
        SUM(vd.subtotal) AS total_monto,
        SUM(vd.cantidad) AS total_cantidad
      FROM ventas v
      INNER JOIN ventas_detalle vd ON vd.venta_id = v.id
      LEFT JOIN subcomisiones s ON vd.subcomision_id = s.id
      WHERE v.evento_id = ?
    `;
    const params = [evento_id];

    // Filtro por caja (opcional)
    if (caja_id) {
      sql += " AND v.caja_id = ?";
      params.push(caja_id);
    }

    // Filtro por medio de pago (opcional)
    if (medio_pago) {
      sql += " AND v.medio_pago = ?";
      params.push(medio_pago);
    }

    // Filtro por fecha desde/hasta (opcional)
    if (fecha_desde) {
      sql += " AND v.fecha_hora >= ?";
      params.push(`${fecha_desde} 00:00:00`);
    }

    if (fecha_hasta) {
      sql += " AND v.fecha_hora <= ?";
      params.push(`${fecha_hasta} 23:59:59`);
    }

    sql += `
      GROUP BY
        vd.subcomision_id,
        s.nombre,
        v.medio_pago
      ORDER BY
        subcomision_nombre ASC,
        v.medio_pago ASC
    `;

    const [rows] = await db.query(sql, params);

    // Estructurar respuesta
    const subMap = {};
    const totalesGeneralesPorMedio = {};

    for (const row of rows) {
      const subId = row.subcomision_id || null;
      const subNombre = row.subcomision_nombre || "SIN_SUBCOMISION";
      const medio = row.medio_pago || "DESCONOCIDO";
      const monto = Number(row.total_monto) || 0;
      const cant = Number(row.total_cantidad) || 0;

      // Inicializar subcomisión si no existe
      if (!subMap[subId ?? "NULL"]) {
        subMap[subId ?? "NULL"] = {
          subcomision_id: subId,
          subcomision_nombre: subNombre,
          totales_por_medio: {},
          total_subcomision: 0,
          total_items: 0,
        };
      }

      const sub = subMap[subId ?? "NULL"];

      if (!sub.totales_por_medio[medio]) {
        sub.totales_por_medio[medio] = {
          monto: 0,
          cantidad_items: 0,
        };
      }

      sub.totales_por_medio[medio].monto += monto;
      sub.totales_por_medio[medio].cantidad_items += cant;

      sub.total_subcomision += monto;
      sub.total_items += cant;

      // Totales generales por medio
      if (!totalesGeneralesPorMedio[medio]) {
        totalesGeneralesPorMedio[medio] = 0;
      }
      totalesGeneralesPorMedio[medio] += monto;
    }

    // Pasar de mapa a array ordenado
    const subcomisiones = Object.values(subMap).sort((a, b) =>
      (a.subcomision_nombre || "").localeCompare(b.subcomision_nombre || "")
    );

    return res.json({
      evento_id: Number(evento_id),
      filtros: {
        caja_id: caja_id ? Number(caja_id) : null,
        medio_pago: medio_pago || null,
        fecha_desde: fecha_desde || null,
        fecha_hasta: fecha_hasta || null,
      },
      totales_generales_por_medio: totalesGeneralesPorMedio,
      subcomisiones,
    });
  } catch (error) {
    console.error("❌ Error reporteSubcomisionesEvento:", error);
    return res
      .status(500)
      .json({ message: "Error al generar el reporte por subcomisiones" });
  }
}

module.exports = {
  reporteSubcomisionesEvento,
};
