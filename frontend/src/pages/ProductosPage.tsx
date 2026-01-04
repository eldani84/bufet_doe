// src/pages/ProductosPage.tsx
// ============================================================
// 🍔 PRODUCTOS - ABM (bufet_doe)
// - Incluye imagen_url y upload para ícono en POS
// ============================================================

import { useEffect, useMemo, useState } from "react";

import { listarOrganizadores } from "../api/organizadores";
import { listarSubcomisiones } from "../api/subcomisiones";
import {
  crearProducto,
  eliminarProducto,
  listarProductos,
  actualizarProducto,
  subirImagenProducto,
  type Producto,
} from "../api/productos";

import type { Organizador, Subcomision } from "../api/types";

const API = import.meta.env.VITE_API_URL;
// Base para archivos estáticos (sacamos el /api del final si existiera)
const API_BASE = API ? String(API).replace(/\/api\/?$/, "") : "";

const buildImgUrl = (relativeOrAbsolute?: string | null) => {
  const v = String(relativeOrAbsolute || "").trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  if (!API_BASE) return v;
  return `${API_BASE}${v.startsWith("/") ? "" : "/"}${v}`;
};

type FormState = {
  id?: number;
  organizador_id: number | "";
  subcomision_propietaria_id: number | "";
  nombre: string;
  descripcion: string;
  categoria: string;
  imagen_url: string; // NUEVO
  maneja_stock: boolean;
  activo: boolean;
};

const emptyForm: FormState = {
  organizador_id: "",
  subcomision_propietaria_id: "",
  nombre: "",
  descripcion: "",
  categoria: "",
  imagen_url: "",
  maneja_stock: true,
  activo: true,
};

export default function ProductosPage() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [organizadores, setOrganizadores] = useState<Organizador[]>([]);
  const [subcomisiones, setSubcomisiones] = useState<Subcomision[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);

  const [organizadorId, setOrganizadorId] = useState<number | "">("");
  const [subcomisionId, setSubcomisionId] = useState<number | "">("");
  const [incluirInactivos, setIncluirInactivos] = useState(false);
  const [q, setQ] = useState("");

  const [form, setForm] = useState<FormState>(emptyForm);
  const [modoEdicion, setModoEdicion] = useState(false);

  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [fileImagen, setFileImagen] = useState<File | null>(null);

  const limpiarMensajes = () => {
    setMensaje(null);
    setError(null);
  };

  // ----------------------------
  // Cargar organizadores
  // ----------------------------
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);

        const orgs = await listarOrganizadores();
        setOrganizadores(orgs);

        if (orgs.length === 1) {
          setOrganizadorId(orgs[0].id);
        }
      } catch (e: any) {
        setError(e?.message || "No se pudieron cargar organizadores.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ----------------------------
  // Cargar subcomisiones cuando hay organizador
  // ----------------------------
  useEffect(() => {
    (async () => {
      try {
        setSubcomisiones([]);
        setSubcomisionId("");

        if (!organizadorId) return;

        const subs = await listarSubcomisiones({
          organizador_id: Number(organizadorId),
          incluir_inactivas: true,
        });
        setSubcomisiones(subs);
      } catch (e: any) {
        setError(e?.message || "No se pudieron cargar subcomisiones.");
      }
    })();
  }, [organizadorId]);

  // ----------------------------
  // Precargar organizador en el form
  // ----------------------------
  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      organizador_id: organizadorId ? Number(organizadorId) : "",
    }));
  }, [organizadorId]);

  // ----------------------------
  // Cargar productos
  // ----------------------------
  const cargarProductos = async () => {
    if (!organizadorId) {
      setProductos([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const rows = await listarProductos({
        organizador_id: Number(organizadorId),
        subcomision_id: subcomisionId ? Number(subcomisionId) : undefined,
        incluir_inactivos: incluirInactivos,
      });

      setProductos(rows);
    } catch (e: any) {
      setError(e?.message || "No se pudieron cargar productos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarProductos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizadorId, subcomisionId, incluirInactivos]);

  // ----------------------------
  // Filtrado por texto local
  // ----------------------------
  const productosFiltrados = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return productos;

    return productos.filter((p) => {
      const nombre = String(p.nombre || "").toLowerCase();
      const cat = String(p.categoria || "").toLowerCase();
      const sub = String(p.subcomision_nombre || "").toLowerCase();
      return nombre.includes(term) || cat.includes(term) || sub.includes(term);
    });
  }, [productos, q]);

  const resetForm = () => {
    setForm({
      ...emptyForm,
      organizador_id: organizadorId ? Number(organizadorId) : "",
    });
    setModoEdicion(false);
    setFileImagen(null);
  };

  const iniciarEdicion = (p: Producto) => {
    limpiarMensajes();
    setModoEdicion(true);
    setFileImagen(null);

    setForm({
      id: p.id,
      organizador_id: p.organizador_id,
      subcomision_propietaria_id: p.subcomision_propietaria_id,
      nombre: p.nombre || "",
      descripcion: p.descripcion || "",
      categoria: p.categoria || "",
      imagen_url: String(p.imagen_url || ""),
      maneja_stock: Number(p.maneja_stock) === 1,
      activo: Number(p.activo) === 1,
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    limpiarMensajes();

    if (!form.organizador_id) {
      setError("Seleccioná un organizador.");
      return;
    }
    if (!form.subcomision_propietaria_id) {
      setError("Seleccioná una subcomisión propietaria.");
      return;
    }
    if (!form.nombre.trim()) {
      setError("El nombre del producto es obligatorio.");
      return;
    }

    try {
      setSaving(true);

      let productoGuardado: Producto | null = null;

      if (modoEdicion && form.id) {
        productoGuardado = await actualizarProducto(form.id, {
          nombre: form.nombre.trim(),
          descripcion: form.descripcion?.trim() || null,
          categoria: form.categoria?.trim() || null,
          imagen_url: form.imagen_url?.trim() ? form.imagen_url.trim() : null,
          subcomision_propietaria_id: Number(form.subcomision_propietaria_id),
          maneja_stock: form.maneja_stock,
          activo: form.activo,
        });
        setMensaje("Producto actualizado.");
      } else {
        productoGuardado = await crearProducto({
          organizador_id: Number(form.organizador_id),
          subcomision_propietaria_id: Number(form.subcomision_propietaria_id),
          nombre: form.nombre.trim(),
          descripcion: form.descripcion?.trim() || null,
          categoria: form.categoria?.trim() || null,
          imagen_url: form.imagen_url?.trim() ? form.imagen_url.trim() : null,
          maneja_stock: form.maneja_stock,
        });
        setMensaje("Producto creado.");
      }

      // Si eligió archivo, subimos imagen y actualizamos lista
      if (productoGuardado?.id && fileImagen) {
        await subirImagenProducto(productoGuardado.id, fileImagen);
        setMensaje("Producto guardado e imagen subida.");
      }

      await cargarProductos();
      resetForm();
    } catch (e: any) {
      setError(e?.message || "No se pudo guardar el producto.");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (p: Producto) => {
    limpiarMensajes();
    const ok = window.confirm(
      `¿Dar de baja el producto "${p.nombre}"?\n(Se marca activo = 0)`
    );
    if (!ok) return;

    try {
      setSaving(true);
      await eliminarProducto(p.id);
      setMensaje("Producto dado de baja.");
      await cargarProductos();
    } catch (e: any) {
      setError(e?.message || "No se pudo dar de baja el producto.");
    } finally {
      setSaving(false);
    }
  };

  const previewUrl = fileImagen ? URL.createObjectURL(fileImagen) : buildImgUrl(form.imagen_url);

  return (
    <>
      <section className="bufet-dashboard-header">
        <div className="bufet-dashboard-title">Productos</div>
        <div className="bufet-dashboard-subtitle">
          Cargá productos del bufet, asignales subcomisión propietaria y definí si manejan stock.
          Ahora también podés asignarles una imagen (ícono para POS).
        </div>
      </section>

      <section className="bufet-dashboard-grid">
        <div className="bufet-card">
          <div className="bufet-card-header">
            <div>
              <div className="bufet-card-title">
                {modoEdicion ? "Editar producto" : "Nuevo producto"}
              </div>
              <div className="bufet-card-caption">
                La subcomisión propietaria define a quién se le liquida.
              </div>
            </div>
          </div>

          {(mensaje || error) && (
            <div className="bufet-side-panel" style={{ marginBottom: 12 }} role="status">
              {mensaje && <div className="bufet-side-text">{mensaje}</div>}
              {error && (
                <div className="bufet-side-text" style={{ opacity: 1 }}>
                  {error}
                </div>
              )}
            </div>
          )}

          <form onSubmit={onSubmit} className="bufet-form">
            <div className="bufet-form-row">
              <div className="bufet-field">
                <label className="bufet-label">Organizador</label>
                <select
                  className="bufet-input"
                  value={form.organizador_id}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      organizador_id: e.target.value ? Number(e.target.value) : "",
                    }))
                  }
                  disabled={modoEdicion || organizadores.length === 1}
                >
                  <option value="">Seleccionar...</option>
                  {organizadores.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="bufet-field">
                <label className="bufet-label">Subcomisión propietaria</label>
                <select
                  className="bufet-input"
                  value={form.subcomision_propietaria_id}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      subcomision_propietaria_id: e.target.value ? Number(e.target.value) : "",
                    }))
                  }
                  disabled={!form.organizador_id}
                >
                  <option value="">Seleccionar...</option>
                  {subcomisiones.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="bufet-form-row">
              <div className="bufet-field" style={{ flex: 2 }}>
                <label className="bufet-label">Nombre</label>
                <input
                  className="bufet-input"
                  value={form.nombre}
                  onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
                  placeholder="Ej: Pancho, Coca Cola 500, Combo 1..."
                />
              </div>

              <div className="bufet-field">
                <label className="bufet-label">Categoría</label>
                <input
                  className="bufet-input"
                  value={form.categoria}
                  onChange={(e) => setForm((p) => ({ ...p, categoria: e.target.value }))}
                  placeholder="Ej: comida, bebida, combo"
                />
              </div>
            </div>

            <div className="bufet-form-row">
              <div className="bufet-field" style={{ flex: 2 }}>
                <label className="bufet-label">Descripción</label>
                <textarea
                  className="bufet-input"
                  value={form.descripcion}
                  onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))}
                  placeholder="Opcional"
                  style={{ minHeight: 64, resize: "vertical" }}
                />
              </div>

              <div className="bufet-field">
                <label className="bufet-label">Opciones</label>
                <div style={{ display: "grid", gap: 8 }}>
                  <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={form.maneja_stock}
                      onChange={(e) => setForm((p) => ({ ...p, maneja_stock: e.target.checked }))}
                    />
                    Maneja stock
                  </label>

                  <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={form.activo}
                      onChange={(e) => setForm((p) => ({ ...p, activo: e.target.checked }))}
                      disabled={!modoEdicion}
                    />
                    Activo
                  </label>
                </div>
              </div>
            </div>

            {/* Imagen */}
            <div className="bufet-form-row">
              <div className="bufet-field" style={{ flex: 2 }}>
                <label className="bufet-label">Imagen (URL opcional)</label>
                <input
                  className="bufet-input"
                  value={form.imagen_url}
                  onChange={(e) => setForm((p) => ({ ...p, imagen_url: e.target.value }))}
                  placeholder="Ej: /uploads/productos/pancho.png o https://..."
                />
                <div className="bufet-side-text" style={{ marginTop: 6, opacity: 0.85 }}>
                  Podés pegar una URL, o subir un archivo (recomendado).
                </div>
              </div>

              <div className="bufet-field">
                <label className="bufet-label">Subir archivo</label>
                <input
                  className="bufet-input"
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={(e) => setFileImagen(e.target.files?.[0] || null)}
                />
                <div className="bufet-side-text" style={{ marginTop: 6, opacity: 0.85 }}>
                  PNG/JPG/WEBP hasta 2MB.
                </div>
              </div>
            </div>

            {previewUrl && (
              <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 8 }}>
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 12,
                    background: "#fff",
                    overflow: "hidden",
                    boxShadow: "0 1px 6px rgba(0,0,0,.08)",
                    display: "grid",
                    placeItems: "center",
                  }}
                  title="Vista previa"
                >
                  <img
                    src={previewUrl}
                    alt="preview"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
                <div className="bufet-side-text" style={{ opacity: 0.9 }}>
                  Vista previa del ícono.
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <button
                type="submit"
                className="bufet-quick-card"
                style={{ padding: "10px 14px" }}
                disabled={saving}
              >
                {saving ? "Guardando..." : modoEdicion ? "Guardar cambios" : "Crear producto"}
              </button>

              {modoEdicion && (
                <button
                  type="button"
                  className="bufet-quick-card"
                  style={{ padding: "10px 14px", opacity: 0.9 }}
                  onClick={resetForm}
                  disabled={saving}
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </div>

        <aside className="bufet-side-panel">
          <div className="bufet-side-title">Filtros</div>

          <div className="bufet-field" style={{ marginTop: 12 }}>
            <label className="bufet-label">Organizador</label>
            <select
              className="bufet-input"
              value={organizadorId}
              onChange={(e) => setOrganizadorId(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">Seleccionar...</option>
              {organizadores.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="bufet-field" style={{ marginTop: 12 }}>
            <label className="bufet-label">Subcomisión</label>
            <select
              className="bufet-input"
              value={subcomisionId}
              onChange={(e) => setSubcomisionId(e.target.value ? Number(e.target.value) : "")}
              disabled={!organizadorId}
            >
              <option value="">Todas</option>
              {subcomisiones.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="bufet-field" style={{ marginTop: 12 }}>
            <label className="bufet-label">Buscar</label>
            <input
              className="bufet-input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nombre / categoría / subcomisión..."
              disabled={!organizadorId}
            />
          </div>

          <label style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12 }}>
            <input
              type="checkbox"
              checked={incluirInactivos}
              onChange={(e) => setIncluirInactivos(e.target.checked)}
              disabled={!organizadorId}
            />
            Incluir inactivos
          </label>

          <div className="bufet-side-text" style={{ marginTop: 12 }}>
            Mostrando <strong>{productosFiltrados.length}</strong> de{" "}
            <strong>{productos.length}</strong>.
          </div>
        </aside>
      </section>

      <section className="bufet-card" style={{ marginTop: 14 }}>
        <div className="bufet-card-header">
          <div>
            <div className="bufet-card-title">Listado</div>
            <div className="bufet-card-caption">
              Editá o da de baja. El stock por evento se define en “Productos del Evento”.
            </div>
          </div>
        </div>

        {loading ? (
          <div className="bufet-side-text">Cargando...</div>
        ) : !organizadorId ? (
          <div className="bufet-side-text">Seleccioná un organizador para ver productos.</div>
        ) : productosFiltrados.length === 0 ? (
          <div className="bufet-side-text">No hay productos con esos filtros.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="bufet-table">
              <thead>
                <tr>
                  <th style={{ width: 70 }}>Img</th>
                  <th>Producto</th>
                  <th>Categoría</th>
                  <th>Subcomisión</th>
                  <th>Maneja stock</th>
                  <th>Activo</th>
                  <th style={{ width: 180 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {productosFiltrados.map((p) => {
                  const img = buildImgUrl(p.imagen_url || "");
                  return (
                    <tr key={p.id} style={{ opacity: Number(p.activo) === 1 ? 1 : 0.6 }}>
                      <td>
                        {img ? (
                          <img
                            src={img}
                            alt="img"
                            style={{
                              width: 42,
                              height: 42,
                              borderRadius: 10,
                              objectFit: "cover",
                              background: "#fff",
                              boxShadow: "0 1px 6px rgba(0,0,0,.08)",
                            }}
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <span style={{ opacity: 0.6 }}>—</span>
                        )}
                      </td>
                      <td>{p.nombre}</td>
                      <td>{p.categoria || "-"}</td>
                      <td>{p.subcomision_nombre || "-"}</td>
                      <td>{Number(p.maneja_stock) === 1 ? "Sí" : "No"}</td>
                      <td>{Number(p.activo) === 1 ? "Sí" : "No"}</td>
                      <td>
                        <div style={{ display: "flex", gap: 10 }}>
                          <button
                            type="button"
                            className="bufet-quick-card"
                            style={{ padding: "8px 10px" }}
                            onClick={() => iniciarEdicion(p)}
                            disabled={saving}
                          >
                            Editar
                          </button>

                          {Number(p.activo) === 1 && (
                            <button
                              type="button"
                              className="bufet-quick-card"
                              style={{ padding: "8px 10px", opacity: 0.9 }}
                              onClick={() => onDelete(p)}
                              disabled={saving}
                            >
                              Baja
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
