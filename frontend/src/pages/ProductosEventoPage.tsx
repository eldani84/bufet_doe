// src/pages/ProductosEventoPage.tsx
// ============================================================
// 🧾 PRODUCTOS DEL EVENTO - BUFET_DOE (productos_evento)
// - Selecciona evento por URL /eventos/:eventoId/productos
// - Lista productos activos/inactivos en el evento
// - Permite asignar producto + precio + stock inicial
// - Permite editar precio/stock/activo
// - ✅ Opción A: Override opcional de subcomisión por evento
//   -> subcomision_destino_id (NULL = usa la del producto)
// ============================================================

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "../styles/BufetUI.css";

import { obtenerEvento } from "../api/eventos";
import { listarProductos, type Producto } from "../api/productos";
import { listarSubcomisiones } from "../api/subcomisiones";
import type { Subcomision } from "../api/types";

import {
  listarProductosEvento,
  crearProductoEvento,
  actualizarProductoEvento,
  eliminarProductoEvento,
  type ProductoEvento,
} from "../api/productosEvento";

type FormAlta = {
  producto_id: number | "";
  precio_venta: string;
  stock_inicial: string;
  // ✅ nuevo (opcional)
  subcomision_destino_id: number | "" | null;
};

const emptyAlta: FormAlta = {
  producto_id: "",
  precio_venta: "",
  stock_inicial: "0",
  subcomision_destino_id: "",
};

export default function ProductosEventoPage() {
  const navigate = useNavigate();
  const { eventoId } = useParams();

  const evento_id = Number(eventoId);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [eventoNombre, setEventoNombre] = useState<string>("");
  const [organizadorId, setOrganizadorId] = useState<number | null>(null);

  const [catalogo, setCatalogo] = useState<Producto[]>([]);
  const [items, setItems] = useState<ProductoEvento[]>([]);

  // ✅ subcomisiones disponibles para override por evento
  const [subcomisiones, setSubcomisiones] = useState<Subcomision[]>([]);

  const [incluirInactivos, setIncluirInactivos] = useState(false);
  const [q, setQ] = useState("");

  const [alta, setAlta] = useState<FormAlta>(emptyAlta);

  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const limpiarMensajes = () => {
    setError(null);
    setInfo(null);
  };

  const cargarTodo = async () => {
    if (!Number.isFinite(evento_id) || evento_id <= 0) {
      setError("Evento inválido en la URL.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const ev = await obtenerEvento(evento_id);
      setEventoNombre(ev?.nombre || `Evento #${evento_id}`);
      setOrganizadorId(ev?.organizador_id ?? null);

      // Catálogo de productos del organizador del evento
      if (ev?.organizador_id) {
        const prods = await listarProductos({
          organizador_id: Number(ev.organizador_id),
          incluir_inactivos: true,
        });
        setCatalogo(prods);

        // ✅ subcomisiones del organizador (para override)
        const subs = await listarSubcomisiones({
          organizador_id: Number(ev.organizador_id),
          incluir_inactivas: true,
        });
        setSubcomisiones(Array.isArray(subs) ? subs : []);
      } else {
        setCatalogo([]);
        setSubcomisiones([]);
      }

      // Productos del evento
      const rows = await listarProductosEvento({
        evento_id,
        solo_activos: !incluirInactivos,
      });
      setItems(rows);
    } catch (e: any) {
      setError(e?.message || "No se pudo cargar la configuración del evento.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarTodo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evento_id, incluirInactivos]);

  const disponiblesParaAsignar = useMemo(() => {
    // Evitar ofrecer productos que ya están activos en el evento (por UX)
    const activosEnEvento = new Set(
      items.filter((x) => Number(x.activo) === 1).map((x) => x.producto_id)
    );

    return catalogo
      .filter((p) => Number(p.activo) === 1)
      .filter((p) => !activosEnEvento.has(p.id))
      .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre)));
  }, [catalogo, items]);

  const filtrados = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return items;

    return items.filter((it: any) => {
      const n = String(it.producto_nombre || "").toLowerCase();
      const c = String(it.categoria || "").toLowerCase();

      // ✅ si backend ya devuelve efectivo/destino, filtramos por eso también
      const s1 = String(it.subcomision_nombre || "").toLowerCase();
      const s2 = String(it.subcomision_destino_nombre || "").toLowerCase();
      const s3 = String(it.subcomision_efectiva_nombre || "").toLowerCase();

      return (
        n.includes(term) ||
        c.includes(term) ||
        s1.includes(term) ||
        s2.includes(term) ||
        s3.includes(term)
      );
    });
  }, [items, q]);

  const onCrear = async (e: React.FormEvent) => {
    e.preventDefault();
    limpiarMensajes();

    if (!evento_id) {
      setError("Evento inválido.");
      return;
    }
    if (!alta.producto_id) {
      setError("Seleccioná un producto.");
      return;
    }

    const precio = Number(String(alta.precio_venta).replace(",", "."));
    if (!Number.isFinite(precio) || precio <= 0) {
      setError("Ingresá un precio válido (> 0).");
      return;
    }

    const stockIni = Number(String(alta.stock_inicial).replace(",", "."));
    const stockInicial = Number.isFinite(stockIni)
      ? Math.max(0, Math.trunc(stockIni))
      : 0;

    // ✅ normalizar destino: "" => null, number => number, null => null
    const destino =
      alta.subcomision_destino_id === "" || alta.subcomision_destino_id === undefined
        ? null
        : alta.subcomision_destino_id === null
        ? null
        : Number(alta.subcomision_destino_id);

    try {
      setSaving(true);
      await crearProductoEvento({
        evento_id,
        producto_id: Number(alta.producto_id),
        precio_venta: precio,
        stock_inicial: stockInicial,
        // ✅ nuevo (opcional)
        subcomision_destino_id: destino,
      });

      setInfo("Producto asignado al evento.");
      setAlta(emptyAlta);
      await cargarTodo();
    } catch (e: any) {
      setError(e?.message || "No se pudo asignar el producto al evento.");
    } finally {
      setSaving(false);
    }
  };

  const onToggleActivo = async (it: ProductoEvento) => {
    limpiarMensajes();
    try {
      setSaving(true);
      await actualizarProductoEvento(it.id, {
        activo: Number((it as any).activo) !== 1,
      });
      await cargarTodo();
    } catch (e: any) {
      setError(e?.message || "No se pudo actualizar el estado.");
    } finally {
      setSaving(false);
    }
  };

  const onGuardarInline = async (
    it: ProductoEvento,
    precio_venta: number,
    stock_inicial: number,
    stock_actual: number,
    subcomision_destino_id: number | null
  ) => {
    limpiarMensajes();
    try {
      setSaving(true);
      await actualizarProductoEvento((it as any).id, {
        precio_venta,
        stock_inicial,
        stock_actual,
        // ✅ nuevo
        subcomision_destino_id,
      });
      setInfo("Actualizado.");
      await cargarTodo();
    } catch (e: any) {
      setError(e?.message || "No se pudo actualizar.");
    } finally {
      setSaving(false);
    }
  };

  const onEliminar = async (it: ProductoEvento) => {
    limpiarMensajes();
    const ok = window.confirm(
      `¿Dar de baja este producto del evento?\n${(it as any).producto_nombre || "Producto"}\n(Se marca activo = 0)`
    );
    if (!ok) return;

    try {
      setSaving(true);
      await eliminarProductoEvento((it as any).id);
      setInfo("Producto del evento dado de baja.");
      await cargarTodo();
    } catch (e: any) {
      setError(e?.message || "No se pudo dar de baja.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bufet-container">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: "1.1rem", fontWeight: 600 }}>Productos del Evento</div>
          <div className="bufet-subtitle">
            Evento: <strong>{eventoNombre}</strong> (ID {evento_id})
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-secondary" type="button" onClick={() => navigate("/eventos")} disabled={saving}>
            Volver a eventos
          </button>
          <button className="btn-secondary" type="button" onClick={cargarTodo} disabled={loading || saving}>
            {loading ? "Cargando..." : "Actualizar"}
          </button>
        </div>
      </div>

      {(error || info) && (
        <div style={{ marginTop: 12 }}>
          {error && <div className="bufet-error">{error}</div>}
          {info && <div className="bufet-info">{info}</div>}
        </div>
      )}

      <div className="bufet-layout" style={{ marginTop: "1rem" }}>
        {/* Alta */}
        <div className="bufet-card-form">
          <div>
            <div style={{ fontSize: "0.95rem", fontWeight: 600 }}>Asignar producto al evento</div>
            <div className="bufet-subtitle">Define precio de venta y stock inicial para este día.</div>
          </div>

          <form onSubmit={onCrear} className="bufet-form-grid" style={{ marginTop: "0.7rem" }}>
            <div className="bufet-field">
              <div className="bufet-label">Producto *</div>
              <select
                className="bufet-select"
                value={alta.producto_id}
                onChange={(e) => setAlta((p) => ({ ...p, producto_id: e.target.value ? Number(e.target.value) : "" }))}
                disabled={loading || saving || !organizadorId}
              >
                <option value="">— Elegir producto —</option>
                {disponiblesParaAsignar.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} {p.subcomision_nombre ? `• ${p.subcomision_nombre}` : ""}
                  </option>
                ))}
              </select>
              <div className="bufet-subtitle" style={{ marginTop: 6 }}>
                Solo se muestran productos <strong>activos</strong> que todavía no están activos en este evento.
              </div>
            </div>

            <div className="bufet-field">
              <div className="bufet-label">Precio venta *</div>
              <input
                className="bufet-input"
                value={alta.precio_venta}
                onChange={(e) => setAlta((p) => ({ ...p, precio_venta: e.target.value }))}
                placeholder="Ej: 3000"
                inputMode="decimal"
                disabled={loading || saving}
              />
            </div>

            <div className="bufet-field">
              <div className="bufet-label">Stock inicial</div>
              <input
                className="bufet-input"
                value={alta.stock_inicial}
                onChange={(e) => setAlta((p) => ({ ...p, stock_inicial: e.target.value }))}
                placeholder="0"
                inputMode="numeric"
                disabled={loading || saving}
              />
            </div>

            {/* ✅ NUEVO: Destino (override) */}
            <div className="bufet-field">
              <div className="bufet-label">Destino (liquidación)</div>
              <select
                className="bufet-select"
                value={alta.subcomision_destino_id ?? ""}
                onChange={(e) =>
                  setAlta((p) => ({
                    ...p,
                    subcomision_destino_id: e.target.value ? Number(e.target.value) : "",
                  }))
                }
                disabled={loading || saving || !organizadorId}
              >
                <option value="">Usar la del producto</option>
                {subcomisiones.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
              <div className="bufet-subtitle" style={{ marginTop: 6 }}>
                Opcional. Si elegís un destino, <strong>no cambia el producto</strong>; solo aplica a este evento.
              </div>
            </div>

            <div className="bufet-actions">
              <button className="btn-primary" type="submit" disabled={saving || loading || !organizadorId}>
                {saving ? "Guardando..." : "Asignar"}
              </button>
              <button className="btn-ghost" type="button" onClick={() => setAlta(emptyAlta)} disabled={saving || loading}>
                Limpiar
              </button>
            </div>
          </form>
        </div>

        {/* Filtros */}
        <div className="bufet-card-form">
          <div style={{ fontSize: "0.95rem", fontWeight: 600 }}>Filtros</div>

          <div className="bufet-field" style={{ marginTop: 12 }}>
            <div className="bufet-label">Buscar</div>
            <input
              className="bufet-input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nombre / categoría / subcomisión..."
              disabled={loading}
            />
          </div>

          <label style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12 }}>
            <input
              type="checkbox"
              checked={incluirInactivos}
              onChange={(e) => setIncluirInactivos(e.target.checked)}
              disabled={loading}
            />
            Incluir inactivos
          </label>

          <div className="bufet-subtitle" style={{ marginTop: 12 }}>
            Mostrando <strong>{filtrados.length}</strong> de <strong>{items.length}</strong>.
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="bufet-card-table" style={{ marginTop: "1rem" }}>
        <div className="bufet-card-header">
          <div>
            <div className="bufet-card-title">Productos configurados</div>
            <div className="bufet-card-caption">Precio, stock y destino específicos del evento.</div>
          </div>
        </div>

        <div className="bufet-table-wrapper">
          <table className="bufet-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th style={{ width: 200 }}>Destino</th>
                <th style={{ width: 140 }}>Precio</th>
                <th style={{ width: 120 }}>Stock ini</th>
                <th style={{ width: 120 }}>Stock act</th>
                <th style={{ width: 110 }}>Activo</th>
                <th style={{ width: 260 }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7}>Cargando...</td>
                </tr>
              ) : filtrados.length === 0 ? (
                <tr>
                  <td colSpan={7}>No hay productos configurados para este evento.</td>
                </tr>
              ) : (
                filtrados.map((it) => {
                  return (
                    <ProductoEventoRow
                      key={(it as any).id}
                      it={it as any}
                      saving={saving}
                      subcomisiones={subcomisiones}
                      onToggleActivo={() => onToggleActivo(it as any)}
                      onEliminar={() => onEliminar(it as any)}
                      onGuardar={(precio, si, sa, destino) =>
                        onGuardarInline(it as any, precio, si, sa, destino)
                      }
                    />
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ProductoEventoRow(props: {
  it: any; // ProductoEvento extendido con nombres
  saving: boolean;
  subcomisiones: Subcomision[];
  onToggleActivo: () => void;
  onEliminar: () => void;
  onGuardar: (
    precio_venta: number,
    stock_inicial: number,
    stock_actual: number,
    subcomision_destino_id: number | null
  ) => void;
}) {
  const { it, saving, subcomisiones, onToggleActivo, onEliminar, onGuardar } = props;

  const [precio, setPrecio] = useState(String(it.precio_venta ?? ""));
  const [stockIni, setStockIni] = useState(String(it.stock_inicial ?? 0));
  const [stockAct, setStockAct] = useState(String(it.stock_actual ?? 0));

  // ✅ destino editable por fila
  const [destino, setDestino] = useState<number | "">(
    it.subcomision_destino_id ? Number(it.subcomision_destino_id) : ""
  );

  useEffect(() => {
    setPrecio(String(it.precio_venta ?? ""));
    setStockIni(String(it.stock_inicial ?? 0));
    setStockAct(String(it.stock_actual ?? 0));
    setDestino(it.subcomision_destino_id ? Number(it.subcomision_destino_id) : "");
  }, [it.id, it.precio_venta, it.stock_inicial, it.stock_actual, it.subcomision_destino_id]);

  const isActivo = Number(it.activo) === 1;

  const guardar = () => {
    const p = Number(String(precio).replace(",", "."));
    const si = Number(String(stockIni).replace(",", "."));
    const sa = Number(String(stockAct).replace(",", "."));

    if (!Number.isFinite(p) || p <= 0) {
      alert("Precio inválido.");
      return;
    }

    const siInt = Number.isFinite(si) ? Math.max(0, Math.trunc(si)) : 0;
    const saInt = Number.isFinite(sa) ? Math.max(0, Math.trunc(sa)) : 0;

    const destinoId = destino === "" ? null : Number(destino);

    onGuardar(p, siInt, saInt, destinoId);
  };

  // ✅ nombres para mostrar (sin depender 100% del backend)
  const destinoNombre =
    it.subcomision_destino_nombre ||
    (destino !== "" ? subcomisiones.find((s) => s.id === Number(destino))?.nombre : "") ||
    "";

  const efectivaNombre =
    it.subcomision_efectiva_nombre || destinoNombre || it.subcomision_nombre || "—";

  return (
    <tr style={{ opacity: isActivo ? 1 : 0.6 }}>
      <td>
        <div style={{ display: "grid", gap: 2 }}>
          <div style={{ fontWeight: 600 }}>{it.producto_nombre || "—"}</div>
          <div className="bufet-subtitle">
            {it.categoria ? `${it.categoria}` : "Sin categoría"}
            {it.subcomision_nombre ? ` • base: ${it.subcomision_nombre}` : ""}
          </div>
        </div>
      </td>

      <td>
        <div style={{ display: "grid", gap: 6 }}>
          <select
            className="bufet-select"
            value={destino}
            onChange={(e) => setDestino(e.target.value ? Number(e.target.value) : "")}
            disabled={saving}
          >
            <option value="">Usar la del producto</option>
            {subcomisiones.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>

          <div className="bufet-subtitle" style={{ marginTop: -2 }}>
            Efectiva: <strong>{efectivaNombre}</strong>
          </div>
        </div>
      </td>

      <td>
        <input
          className="bufet-input"
          value={precio}
          onChange={(e) => setPrecio(e.target.value)}
          disabled={saving}
        />
      </td>

      <td>
        <input
          className="bufet-input"
          value={stockIni}
          onChange={(e) => setStockIni(e.target.value)}
          disabled={saving}
          inputMode="numeric"
        />
      </td>

      <td>
        <input
          className="bufet-input"
          value={stockAct}
          onChange={(e) => setStockAct(e.target.value)}
          disabled={saving}
          inputMode="numeric"
        />
      </td>

      <td>
        <span
          className="bufet-tag"
          style={{
            background: isActivo ? "rgba(56, 189, 248, 0.16)" : "rgba(148,163,184,0.16)",
          }}
        >
          {isActivo ? "Sí" : "No"}
        </span>
      </td>

      <td>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn-primary" type="button" onClick={guardar} disabled={saving}>
            Guardar
          </button>
          <button className="btn-secondary" type="button" onClick={onToggleActivo} disabled={saving}>
            {isActivo ? "Desactivar" : "Activar"}
          </button>
          <button className="btn-danger" type="button" onClick={onEliminar} disabled={saving || !isActivo}>
            Baja
          </button>
        </div>
      </td>
    </tr>
  );
}
