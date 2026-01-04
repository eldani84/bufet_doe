// controllers/productosEvento.controller.js
// ============================================================
// 🎛️ CONTROLADOR: PRODUCTOS_EVENTO
// - Asocia productos a un EVENTO
// - Define precio y stock para ese evento
// - ✅ Opción A: Override opcional de subcomisión por evento
//   -> productos_evento.subcomision_destino_id (NULL = usa la del producto)
// - ✅ Fix: incluye p.imagen_url AS imagen_url (para mostrar íconos en POS)
// ============================================================

const db = require("../db/connectionPromise");

// Helpers
async function obtenerEvento(id) {
  const [rows] = await db.query("SELECT * FROM eventos WHERE id = ?", [id]);
  return rows[0] || null;
}

async function obtenerProducto(id) {
  const [rows] = await db.query("SELECT * FROM productos WHERE id = ?", [id]);
  return rows[0] || null;
}

async function obtenerSubcomision(id) {
  const [rows] = await db.query("SELECT * FROM subcomisiones WHERE id = ?", [id]);
  return rows[0] || null;
}

// Helper: SELECT base con joins (reutilizable mentalmente; lo repetimos para mantenerlo simple)
function selectProductoEventoJoin(whereSql) {
  return `
    SELECT 
      pe.*,
      p.nombre AS producto_nombre,
      p.descripcion AS producto_descripcion,
      p.categoria,
      p.imagen_url AS imagen_url,

      -- Subcomisión "por defecto" (del producto)
      s.nombre AS subcomision_nombre,

      -- ✅ Subcomisión override (del evento) + nombre
      pe.subcomision_destino_id,
      sd.nombre AS subcomision_destino_nombre,

      -- ✅ Útil para UI / liquidación (sin romper lo anterior)
      COALESCE(sd.nombre, s.nombre) AS subcomision_efectiva_nombre
    FROM productos_evento pe
    INNER JOIN productos p ON pe.producto_id = p.id
    LEFT JOIN subcomisiones s ON p.subcomision_propietaria_id = s.id
    LEFT JOIN subcomisiones sd ON pe.subcomision_destino_id = sd.id
    ${whereSql}
  `;
}

// ---------------------------------------------------------------------
// 📌 GET /api/productos-evento
//    Lista productos configurados para un evento
//    Query:
//      - evento_id (OBLIGATORIO)
//      - solo_activos=1 (opcional, default 1)
// ---------------------------------------------------------------------
async function listarProductosEvento(req, res) {
  try {
    const { evento_id, solo_activos } = req.query;

    if (!evento_id) {
      return res.status(400).json({ message: "El parámetro 'evento_id' es obligatorio" });
    }

    const evento = await obtenerEvento(evento_id);
    if (!evento) {
      return res.status(404).json({ message: "Evento no encontrado" });
    }

    let sql = selectProductoEventoJoin("WHERE pe.evento_id = ?");
    const params = [evento_id];

    if (solo_activos === undefined || solo_activos === "1") {
      sql += " AND pe.activo = 1";
    }

    sql += " ORDER BY p.nombre ASC";

    const [rows] = await db.query(sql, params);
    return res.json(rows);
  } catch (error) {
    console.error("❌ Error listarProductosEvento:", error);
    return res.status(500).json({ message: "Error al listar productos del evento" });
  }
}

// ---------------------------------------------------------------------
// 📌 GET /api/productos-evento/:id
// ---------------------------------------------------------------------
async function obtenerProductoEventoPorId(req, res) {
  try {
    const { id } = req.params;

    const sql = selectProductoEventoJoin("WHERE pe.id = ?");
    const [rows] = await db.query(sql, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "Producto_evento no encontrado" });
    }

    return res.json(rows[0]);
  } catch (error) {
    console.error("❌ Error obtenerProductoEventoPorId:", error);
    return res.status(500).json({ message: "Error al obtener el producto del evento" });
  }
}

// ---------------------------------------------------------------------
// 📌 POST /api/productos-evento
//    Asigna un producto a un EVENTO
//    Si ya existía (activo=0), lo reactiva y actualiza.
//    ✅ Opción A: acepta subcomision_destino_id (opcional)
// ---------------------------------------------------------------------
async function crearProductoEvento(req, res) {
  try {
    const {
      evento_id,
      producto_id,
      precio_venta,
      stock_inicial,
      subcomision_destino_id, // ✅ opcional
    } = req.body;

    if (!evento_id || !producto_id || typeof precio_venta === "undefined") {
      return res.status(400).json({
        message: "Los campos 'evento_id', 'producto_id' y 'precio_venta' son obligatorios",
      });
    }

    const evento = await obtenerEvento(evento_id);
    if (!evento) {
      return res.status(404).json({ message: "Evento no encontrado" });
    }

    const producto = await obtenerProducto(producto_id);
    if (!producto || !producto.activo) {
      return res.status(404).json({ message: "Producto no encontrado o inactivo" });
    }

    // Verificamos que el producto pertenezca al mismo organizador del evento
    if (Number(evento.organizador_id) !== Number(producto.organizador_id)) {
      return res.status(400).json({
        message: "El producto no pertenece al mismo organizador que el evento",
      });
    }

    // ✅ Validar subcomisión destino (si viene)
    let destinoId = null;
    if (
      subcomision_destino_id !== undefined &&
      subcomision_destino_id !== null &&
      subcomision_destino_id !== ""
    ) {
      const sc = await obtenerSubcomision(Number(subcomision_destino_id));
      if (!sc) {
        return res.status(404).json({ message: "Subcomisión destino no encontrada" });
      }
      // Asegurar que sea del mismo organizador
      if (Number(sc.organizador_id) !== Number(evento.organizador_id)) {
        return res.status(400).json({
          message: "La subcomisión destino no pertenece al mismo organizador que el evento",
        });
      }
      destinoId = Number(subcomision_destino_id);
    }

    const stockInicial = Number.isFinite(Number(stock_inicial)) ? Number(stock_inicial) : 0;

    // Buscar si ya existe el vínculo (activo 0 o 1)
    const [existente] = await db.query(
      `
      SELECT *
      FROM productos_evento
      WHERE evento_id = ? AND producto_id = ?
      LIMIT 1
      `,
      [evento_id, producto_id]
    );

    // Si existe y está activo -> error claro
    if (existente.length > 0 && Number(existente[0].activo) === 1) {
      return res.status(400).json({
        message:
          "Este producto ya está activo en el evento. Podés editarlo en lugar de crearlo de nuevo.",
      });
    }

    // Si existe pero estaba inactivo -> reactivamos y actualizamos
    if (existente.length > 0 && Number(existente[0].activo) === 0) {
      const pe = existente[0];

      await db.query(
        `
        UPDATE productos_evento
        SET precio_venta = ?,
            stock_inicial = ?,
            stock_actual = ?,
            activo = 1,
            subcomision_destino_id = ?
        WHERE id = ?
        `,
        [precio_venta, stockInicial, stockInicial, destinoId, pe.id]
      );

      const sql = selectProductoEventoJoin("WHERE pe.id = ?");
      const [rows] = await db.query(sql, [pe.id]);

      return res.status(200).json(rows[0]);
    }

    // No existe -> insert normal
    const [result] = await db.query(
      `
      INSERT INTO productos_evento
        (evento_id, producto_id, subcomision_destino_id, precio_venta, stock_inicial, stock_actual, activo)
      VALUES (?, ?, ?, ?, ?, ?, 1)
      `,
      [evento_id, producto_id, destinoId, precio_venta, stockInicial, stockInicial]
    );

    const nuevoId = result.insertId;

    const sql = selectProductoEventoJoin("WHERE pe.id = ?");
    const [rows] = await db.query(sql, [nuevoId]);

    return res.status(201).json(rows[0]);
  } catch (error) {
    console.error("❌ Error crearProductoEvento:", error);
    return res.status(500).json({ message: "Error al crear el producto del evento" });
  }
}

// ---------------------------------------------------------------------
// 📌 PUT /api/productos-evento/:id
//    Actualiza precio y/o stock de un producto en el evento
//    ✅ Opción A: permite setear subcomision_destino_id (opcional)
// ---------------------------------------------------------------------
async function actualizarProductoEvento(req, res) {
  try {
    const { id } = req.params;
    const { precio_venta, stock_inicial, stock_actual, activo, subcomision_destino_id } = req.body;

    const [existe] = await db.query("SELECT * FROM productos_evento WHERE id = ?", [id]);

    if (existe.length === 0) {
      return res.status(404).json({ message: "Producto_evento no encontrado" });
    }

    const actual = existe[0];

    const nuevoPrecio = typeof precio_venta !== "undefined" ? precio_venta : actual.precio_venta;

    const nuevoStockInicial =
      typeof stock_inicial !== "undefined" ? Number(stock_inicial) : actual.stock_inicial;

    const nuevoStockActual =
      typeof stock_actual !== "undefined" ? Number(stock_actual) : actual.stock_actual;

    let nuevoActivo = actual.activo;
    if (typeof activo !== "undefined") {
      nuevoActivo = activo ? 1 : 0;
    }

    // ✅ subcomision_destino_id:
    // - Si NO viene en el body: mantenemos el actual (no rompe nada)
    // - Si viene null: lo limpiamos (vuelve a usar la del producto)
    // - Si viene número: validamos que exista y pertenezca al organizador del evento
    let nuevoDestino = actual.subcomision_destino_id ?? null;

    if (Object.prototype.hasOwnProperty.call(req.body, "subcomision_destino_id")) {
      if (
        subcomision_destino_id === null ||
        subcomision_destino_id === "" ||
        subcomision_destino_id === undefined
      ) {
        nuevoDestino = null;
      } else {
        const evento = await obtenerEvento(actual.evento_id);
        if (!evento) return res.status(404).json({ message: "Evento no encontrado" });

        const sc = await obtenerSubcomision(Number(subcomision_destino_id));
        if (!sc) return res.status(404).json({ message: "Subcomisión destino no encontrada" });

        if (Number(sc.organizador_id) !== Number(evento.organizador_id)) {
          return res.status(400).json({
            message: "La subcomisión destino no pertenece al mismo organizador del evento",
          });
        }

        nuevoDestino = Number(subcomision_destino_id);
      }
    }

    await db.query(
      `
      UPDATE productos_evento
      SET precio_venta = ?,
          stock_inicial = ?,
          stock_actual = ?,
          activo = ?,
          subcomision_destino_id = ?
      WHERE id = ?
      `,
      [nuevoPrecio, nuevoStockInicial, nuevoStockActual, nuevoActivo, nuevoDestino, id]
    );

    const sql = selectProductoEventoJoin("WHERE pe.id = ?");
    const [actualizado] = await db.query(sql, [id]);

    return res.json(actualizado[0]);
  } catch (error) {
    console.error("❌ Error actualizarProductoEvento:", error);
    return res.status(500).json({ message: "Error al actualizar el producto del evento" });
  }
}

// ---------------------------------------------------------------------
// 📌 DELETE /api/productos-evento/:id
//    Baja lógica: activo = 0
// ---------------------------------------------------------------------
async function eliminarProductoEvento(req, res) {
  try {
    const { id } = req.params;

    const [existe] = await db.query("SELECT * FROM productos_evento WHERE id = ?", [id]);

    if (existe.length === 0) {
      return res.status(404).json({ message: "Producto_evento no encontrado" });
    }

    await db.query("UPDATE productos_evento SET activo = 0 WHERE id = ?", [id]);

    return res.json({
      message: "Producto_evento dado de baja (activo = 0)",
      id,
    });
  } catch (error) {
    console.error("❌ Error eliminarProductoEvento:", error);
    return res.status(500).json({ message: "Error al eliminar el producto del evento" });
  }
}

module.exports = {
  listarProductosEvento,
  obtenerProductoEventoPorId,
  crearProductoEvento,
  actualizarProductoEvento,
  eliminarProductoEvento,
};
