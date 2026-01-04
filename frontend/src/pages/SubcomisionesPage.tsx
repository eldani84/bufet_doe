// src/pages/SubcomisionesPage.tsx
// ============================================================
// 🧩 ABM SUBCOMISIONES - BUFET_DOE
// - Siempre asociado a un ORGANIZADOR
// - Selector de organizador (obligatorio)
// - Listado + búsqueda + alta + edición + baja lógica + reactivar
// ============================================================

import { useEffect, useMemo, useState } from "react";
import "../styles/BufetUI.css";

import type { Organizador, Subcomision } from "../api/types";
import { listarOrganizadores } from "../api/organizadores";
import {
  listarSubcomisiones,
  crearSubcomision,
  actualizarSubcomision,
  eliminarSubcomision,
} from "../api/subcomisiones";

function normalizeText(v: unknown) {
  return String(v ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function isEmpty(v: unknown) {
  return v === null || typeof v === "undefined" || String(v).trim() === "";
}

function clampStr(v: string, max: number) {
  const s = String(v ?? "");
  return s.length > max ? s.slice(0, max) : s;
}

type FormState = {
  nombre: string;
  descripcion: string;
};

const emptyForm: FormState = { nombre: "", descripcion: "" };

export default function SubcomisionesPage() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Organizador
  const [orgs, setOrgs] = useState<Organizador[]>([]);
  const [orgId, setOrgId] = useState<number | "">("");

  // Subcomisiones
  const [subs, setSubs] = useState<Subcomision[]>([]);
  const [verInactivas, setVerInactivas] = useState(false);
  const [search, setSearch] = useState("");

  // Alta
  const [formAlta, setFormAlta] = useState<FormState>(emptyForm);

  // Edición (modal)
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [formEdit, setFormEdit] = useState<FormState>(emptyForm);
  const [editActivo, setEditActivo] = useState(true);

  // ------------------------------
  // Cargar organizadores (activos)
  // ------------------------------
  async function cargarOrganizadores() {
    try {
      setError("");
      const rows = await listarOrganizadores(); // por defecto activos
      setOrgs(Array.isArray(rows) ? rows : []);
      // Auto-selección: si hay 1 solo, lo elige
      if (rows?.length === 1) setOrgId(rows[0].id);
    } catch (e: any) {
      setError(e?.message || "Error al cargar organizadores");
    }
  }

  // ------------------------------
  // Cargar subcomisiones del organizador seleccionado
  // ------------------------------
  async function cargarSubcomisiones() {
    if (!orgId) {
      setSubs([]);
      return;
    }

    try {
      setError("");
      setSuccess("");
      setLoading(true);

      const rows = await listarSubcomisiones({
        organizador_id: Number(orgId),
        incluir_inactivas: verInactivas,
      });

      setSubs(Array.isArray(rows) ? rows : []);
    } catch (e: any) {
      setError(e?.message || "Error al cargar subcomisiones");
      setSubs([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarOrganizadores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    cargarSubcomisiones();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, verInactivas]);

  // ------------------------------
  // Búsqueda
  // ------------------------------
  const filtered = useMemo(() => {
    const q = normalizeText(search);
    if (!q) return subs;

    return subs.filter((s) => {
      const hay = normalizeText(`${s.nombre} ${s.descripcion ?? ""}`);
      return hay.includes(q);
    });
  }, [subs, search]);

  // ------------------------------
  // Validación
  // ------------------------------
  function validarForm(f: FormState): string | null {
    const nombre = String(f.nombre ?? "").trim();
    if (!orgId) return "Debés seleccionar un organizador.";
    if (!nombre) return "El nombre es obligatorio.";
    if (nombre.length > 100) return "El nombre no puede superar 100 caracteres.";
    return null;
  }

  // ------------------------------
  // Crear
  // ------------------------------
  async function onCrear(e: React.FormEvent) {
    e.preventDefault();
    try {
      setError("");
      setSuccess("");

      const err = validarForm(formAlta);
      if (err) return setError(err);

      setSaving(true);

      await crearSubcomision({
        organizador_id: Number(orgId),
        nombre: clampStr(formAlta.nombre.trim(), 100),
        descripcion: isEmpty(formAlta.descripcion)
          ? undefined
          : formAlta.descripcion.trim(),
      });

      setFormAlta(emptyForm);
      setSuccess("Subcomisión creada correctamente.");
      await cargarSubcomisiones();
    } catch (e: any) {
      setError(e?.message || "Error al crear subcomisión");
    } finally {
      setSaving(false);
    }
  }

  // ------------------------------
  // Abrir/cerrar edición
  // ------------------------------
  function abrirEdicion(s: Subcomision) {
    setError("");
    setSuccess("");
    setEditId(s.id);
    setFormEdit({
      nombre: s.nombre ?? "",
      descripcion: s.descripcion ?? "",
    });
    setEditActivo(Boolean(s.activo));
    setEditOpen(true);
  }

  function cerrarEdicion() {
    setEditOpen(false);
    setEditId(null);
    setFormEdit(emptyForm);
    setEditActivo(true);
  }

  // ------------------------------
  // Guardar edición
  // ------------------------------
  async function onGuardarEdicion(e: React.FormEvent) {
    e.preventDefault();
    if (!editId) return;

    try {
      setError("");
      setSuccess("");

      const err = validarForm(formEdit);
      if (err) return setError(err);

      setSaving(true);

      await actualizarSubcomision(editId, {
        nombre: clampStr(formEdit.nombre.trim(), 100),
        descripcion: isEmpty(formEdit.descripcion)
          ? null
          : formEdit.descripcion.trim(),
        activo: editActivo,
      });

      setSuccess("Subcomisión actualizada correctamente.");
      cerrarEdicion();
      await cargarSubcomisiones();
    } catch (e: any) {
      setError(e?.message || "Error al actualizar subcomisión");
    } finally {
      setSaving(false);
    }
  }

  // ------------------------------
  // Desactivar / Activar
  // ------------------------------
  async function onDesactivar(s: Subcomision) {
    const ok = window.confirm(`¿Dar de baja (desactivar) "${s.nombre}"?`);
    if (!ok) return;

    try {
      setError("");
      setSuccess("");
      setSaving(true);

      await eliminarSubcomision(s.id);

      setSuccess("Subcomisión dada de baja (activo = 0).");
      await cargarSubcomisiones();
    } catch (e: any) {
      setError(e?.message || "Error al desactivar subcomisión");
    } finally {
      setSaving(false);
    }
  }

  async function onActivar(s: Subcomision) {
    try {
      setError("");
      setSuccess("");
      setSaving(true);

      await actualizarSubcomision(s.id, { activo: true });

      setSuccess("Subcomisión reactivada correctamente.");
      await cargarSubcomisiones();
    } catch (e: any) {
      setError(e?.message || "Error al reactivar subcomisión");
    } finally {
      setSaving(false);
    }
  }

  // ------------------------------
  // UI
  // ------------------------------
  return (
    <div className="bufet-page">
      <div className="bufet-header">
        <div>
          <h1 className="bufet-title">Subcomisiones</h1>
          <p className="bufet-subtitle">
            Seleccioná un organizador para administrar sus subcomisiones.
          </p>
        </div>

        <div className="bufet-header-actions">
          <label className="bufet-toggle">
            <input
              type="checkbox"
              checked={verInactivas}
              onChange={(e) => setVerInactivas(e.target.checked)}
              disabled={!orgId}
            />
            <span>Ver inactivas</span>
          </label>

          <button className="bufet-btn" onClick={cargarSubcomisiones} disabled={loading || !orgId}>
            {loading ? "Cargando..." : "Actualizar"}
          </button>
        </div>
      </div>

      {(error || success) && (
        <div className="bufet-messages">
          {error && <div className="bufet-alert bufet-alert-error">{error}</div>}
          {success && (
            <div className="bufet-alert bufet-alert-success">{success}</div>
          )}
        </div>
      )}

      {/* Selector de organizador */}
      <div className="bufet-card">
        <div className="bufet-card-header">
          <div>
            <div className="bufet-card-title">Organizador</div>
            <div className="bufet-card-caption">
              Las subcomisiones siempre dependen de un organizador.
            </div>
          </div>
        </div>

        <div className="bufet-grid">
          <div className="bufet-field bufet-field-full">
            <label>Seleccionar organizador *</label>
            <select
              value={orgId}
              onChange={(e) => setOrgId(e.target.value ? Number(e.target.value) : "")}
              style={{
                borderRadius: 10,
                border: "1px solid rgba(148, 163, 184, 0.55)",
                padding: "0.45rem 0.6rem",
                fontSize: "0.85rem",
                background: "rgba(15, 23, 42, 0.75)",
                color: "inherit",
                outline: "none",
              }}
            >
              <option value="">— Elegir organizador —</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Alta */}
      <div className="bufet-card">
        <h2 className="bufet-card-title">Nueva subcomisión</h2>

        <form className="bufet-form" onSubmit={onCrear}>
          <div className="bufet-grid">
            <div className="bufet-field">
              <label>Nombre *</label>
              <input
                value={formAlta.nombre}
                onChange={(e) => setFormAlta((p) => ({ ...p, nombre: e.target.value }))}
                maxLength={100}
                placeholder="Ej: Fútbol / Hockey / Buffet / etc."
                disabled={!orgId}
              />
            </div>

            <div className="bufet-field">
              <label>Descripción</label>
              <input
                value={formAlta.descripcion}
                onChange={(e) => setFormAlta((p) => ({ ...p, descripcion: e.target.value }))}
                placeholder="Opcional"
                disabled={!orgId}
              />
            </div>
          </div>

          <div className="bufet-form-actions">
            <button className="bufet-btn-primary" type="submit" disabled={saving || !orgId}>
              {saving ? "Guardando..." : "Crear"}
            </button>
            <button
              className="bufet-btn"
              type="button"
              onClick={() => setFormAlta(emptyForm)}
              disabled={saving || !orgId}
            >
              Limpiar
            </button>
          </div>
        </form>
      </div>

      {/* Listado */}
      <div className="bufet-card">
        <div className="bufet-card-header">
          <h2 className="bufet-card-title">Listado</h2>

          <div className="bufet-list-controls">
            <input
              className="bufet-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre / descripción..."
              disabled={!orgId}
            />
            <span className="bufet-badge">
              {filtered.length} registro{filtered.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        <div className="bufet-table-wrap">
          <table className="bufet-table">
            <thead>
              <tr>
                <th style={{ width: 80 }}>ID</th>
                <th>Nombre</th>
                <th>Descripción</th>
                <th style={{ width: 110 }}>Estado</th>
                <th style={{ width: 220 }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {!orgId ? (
                <tr>
                  <td colSpan={5} style={{ padding: 16 }}>
                    Seleccioná un organizador para ver subcomisiones.
                  </td>
                </tr>
              ) : loading ? (
                <tr>
                  <td colSpan={5} style={{ padding: 16 }}>
                    Cargando...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 16 }}>
                    No hay subcomisiones para mostrar.
                  </td>
                </tr>
              ) : (
                filtered.map((s) => {
                  const activo = Boolean(s.activo);
                  return (
                    <tr key={s.id} className={!activo ? "bufet-row-muted" : ""}>
                      <td>{s.id}</td>
                      <td>{s.nombre}</td>
                      <td className="bufet-ellipsis">{s.descripcion || "-"}</td>
                      <td>
                        <span className={activo ? "bufet-pill ok" : "bufet-pill off"}>
                          {activo ? "Activa" : "Inactiva"}
                        </span>
                      </td>
                      <td>
                        <div className="bufet-actions">
                          <button className="bufet-btn" onClick={() => abrirEdicion(s)} disabled={saving}>
                            Editar
                          </button>

                          {activo ? (
                            <button className="bufet-btn-danger" onClick={() => onDesactivar(s)} disabled={saving}>
                              Desactivar
                            </button>
                          ) : (
                            <button className="bufet-btn-primary" onClick={() => onActivar(s)} disabled={saving}>
                              Activar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal edición */}
      {editOpen && (
        <div className="bufet-modal-overlay" onMouseDown={cerrarEdicion}>
          <div className="bufet-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="bufet-modal-header">
              <h3>Editar subcomisión</h3>
              <button className="bufet-btn" onClick={cerrarEdicion}>
                Cerrar
              </button>
            </div>

            <form onSubmit={onGuardarEdicion} className="bufet-form">
              <div className="bufet-grid">
                <div className="bufet-field">
                  <label>Nombre *</label>
                  <input
                    value={formEdit.nombre}
                    onChange={(e) => setFormEdit((p) => ({ ...p, nombre: e.target.value }))}
                    maxLength={100}
                  />
                </div>

                <div className="bufet-field">
                  <label>Descripción</label>
                  <input
                    value={formEdit.descripcion}
                    onChange={(e) => setFormEdit((p) => ({ ...p, descripcion: e.target.value }))}
                    placeholder="Opcional"
                  />
                </div>

                <div className="bufet-field bufet-field-full">
                  <label className="bufet-toggle">
                    <input
                      type="checkbox"
                      checked={editActivo}
                      onChange={(e) => setEditActivo(e.target.checked)}
                    />
                    <span>Activa</span>
                  </label>
                </div>
              </div>

              <div className="bufet-form-actions">
                <button className="bufet-btn-primary" type="submit" disabled={saving}>
                  {saving ? "Guardando..." : "Guardar cambios"}
                </button>
                <button className="bufet-btn" type="button" onClick={cerrarEdicion} disabled={saving}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
