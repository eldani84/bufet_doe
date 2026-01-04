// src/pages/OrganizadoresPage.tsx
// ============================================================
// 🧑‍💼 ABM ORGANIZADORES - BUFET_DOE
// - Listado + búsqueda + alta + edición + baja lógica + reactivar
// - Activos por defecto, opción "Ver inactivos"
// - UI simple, moderna y preparada para escalar
// ============================================================

import { useEffect, useMemo, useState } from "react";
import "../styles/BufetUI.css";

import type { Organizador } from "../api/types";
import {
  crearOrganizador,
  actualizarOrganizador,
  eliminarOrganizador,
} from "../api/organizadores";
import { httpGet } from "../api/http";

// ------------------------------
// Helpers
// ------------------------------
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
  cuit_cuil: string;
};

const emptyForm: FormState = {
  nombre: "",
  descripcion: "",
  cuit_cuil: "",
};

export default function OrganizadoresPage() {
  // ------------------------------
  // Estado principal
  // ------------------------------
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");

  const [data, setData] = useState<Organizador[]>([]);
  const [verInactivos, setVerInactivos] = useState<boolean>(false);
  const [search, setSearch] = useState<string>("");

  // Alta
  const [formAlta, setFormAlta] = useState<FormState>(emptyForm);

  // Edición (modal interno)
  const [editOpen, setEditOpen] = useState<boolean>(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [formEdit, setFormEdit] = useState<FormState>(emptyForm);
  const [editActivo, setEditActivo] = useState<boolean>(true);

  // ------------------------------
  // Cargar organizadores
  // ------------------------------
  async function cargar() {
    try {
      setError("");
      setSuccess("");
      setLoading(true);

      const path = verInactivos
        ? "/api/organizadores?incluir_inactivos=1"
        : "/api/organizadores";

      const rows = await httpGet<Organizador[]>(path);
      setData(Array.isArray(rows) ? rows : []);
    } catch (e: any) {
      setError(e?.message || "Error al cargar organizadores");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verInactivos]);

  // ------------------------------
  // Filtro por búsqueda
  // ------------------------------
  const filtered = useMemo(() => {
    const q = normalizeText(search);
    if (!q) return data;

    return data.filter((o) => {
      const haystack = normalizeText(
        `${o.nombre} ${o.cuit_cuil ?? ""} ${o.descripcion ?? ""}`
      );
      return haystack.includes(q);
    });
  }, [data, search]);

  // ------------------------------
  // Validación simple
  // ------------------------------
  function validarForm(f: FormState): string | null {
    const nombre = String(f.nombre ?? "").trim();
    if (!nombre) return "El nombre es obligatorio.";
    if (nombre.length > 150) return "El nombre no puede superar 150 caracteres.";
    if (String(f.cuit_cuil ?? "").length > 20)
      return "El CUIT/CUIL no puede superar 20 caracteres.";
    return null;
  }

  // ------------------------------
  // Alta
  // ------------------------------
  async function onCrear(e: React.FormEvent) {
    e.preventDefault();
    try {
      setError("");
      setSuccess("");

      const err = validarForm(formAlta);
      if (err) {
        setError(err);
        return;
      }

      setSaving(true);

      const payload = {
        nombre: clampStr(formAlta.nombre.trim(), 150),
        descripcion: isEmpty(formAlta.descripcion)
          ? undefined
          : formAlta.descripcion.trim(),
        cuit_cuil: isEmpty(formAlta.cuit_cuil)
          ? undefined
          : clampStr(formAlta.cuit_cuil.trim(), 20),
      };

      await crearOrganizador(payload);

      setFormAlta(emptyForm);
      setSuccess("Organizador creado correctamente.");
      await cargar();
    } catch (e: any) {
      setError(e?.message || "Error al crear organizador");
    } finally {
      setSaving(false);
    }
  }

  // ------------------------------
  // Abrir edición
  // ------------------------------
  function abrirEdicion(o: Organizador) {
    setError("");
    setSuccess("");
    setEditId(o.id);
    setFormEdit({
      nombre: o.nombre ?? "",
      descripcion: o.descripcion ?? "",
      cuit_cuil: o.cuit_cuil ?? "",
    });
    setEditActivo(Boolean(o.activo));
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
      if (err) {
        setError(err);
        return;
      }

      setSaving(true);

      const payload = {
        nombre: clampStr(formEdit.nombre.trim(), 150),
        descripcion: isEmpty(formEdit.descripcion)
          ? null
          : formEdit.descripcion.trim(),
        cuit_cuil: isEmpty(formEdit.cuit_cuil)
          ? null
          : clampStr(formEdit.cuit_cuil.trim(), 20),
        activo: editActivo,
      };

      await actualizarOrganizador(editId, payload);

      setSuccess("Organizador actualizado correctamente.");
      cerrarEdicion();
      await cargar();
    } catch (e: any) {
      setError(e?.message || "Error al actualizar organizador");
    } finally {
      setSaving(false);
    }
  }

  // ------------------------------
  // Baja lógica / Reactivar
  // ------------------------------
  async function onDesactivar(o: Organizador) {
    const ok = window.confirm(
      `¿Dar de baja (desactivar) al organizador "${o.nombre}"?`
    );
    if (!ok) return;

    try {
      setError("");
      setSuccess("");
      setSaving(true);

      await eliminarOrganizador(o.id);

      setSuccess("Organizador dado de baja (activo = 0).");
      await cargar();
    } catch (e: any) {
      setError(e?.message || "Error al desactivar organizador");
    } finally {
      setSaving(false);
    }
  }

  async function onActivar(o: Organizador) {
    try {
      setError("");
      setSuccess("");
      setSaving(true);

      await actualizarOrganizador(o.id, { activo: true });

      setSuccess("Organizador reactivado correctamente.");
      await cargar();
    } catch (e: any) {
      setError(e?.message || "Error al reactivar organizador");
    } finally {
      setSaving(false);
    }
  }

  // ------------------------------
  // Render
  // ------------------------------
  return (
    <div className="bufet-page">
      <div className="bufet-header">
        <div>
          <h1 className="bufet-title">Organizadores</h1>
          <p className="bufet-subtitle">
            ABM completo (alta, edición, baja lógica y reactivación)
          </p>
        </div>

        <div className="bufet-header-actions">
          <label className="bufet-toggle">
            <input
              type="checkbox"
              checked={verInactivos}
              onChange={(e) => setVerInactivos(e.target.checked)}
            />
            <span>Ver inactivos</span>
          </label>

          <button className="bufet-btn" onClick={cargar} disabled={loading}>
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

      {/* Alta */}
      <div className="bufet-card">
        <h2 className="bufet-card-title">Nuevo organizador</h2>

        <form className="bufet-form" onSubmit={onCrear}>
          <div className="bufet-grid">
            <div className="bufet-field">
              <label>Nombre *</label>
              <input
                value={formAlta.nombre}
                onChange={(e) =>
                  setFormAlta((p) => ({ ...p, nombre: e.target.value }))
                }
                maxLength={150}
                placeholder="Ej: Comisión Bufet Principal"
              />
            </div>

            <div className="bufet-field">
              <label>CUIT / CUIL</label>
              <input
                value={formAlta.cuit_cuil}
                onChange={(e) =>
                  setFormAlta((p) => ({ ...p, cuit_cuil: e.target.value }))
                }
                maxLength={20}
                placeholder="Opcional"
              />
            </div>

            <div className="bufet-field bufet-field-full">
              <label>Descripción</label>
              <textarea
                value={formAlta.descripcion}
                onChange={(e) =>
                  setFormAlta((p) => ({ ...p, descripcion: e.target.value }))
                }
                placeholder="Opcional"
                rows={2}
              />
            </div>
          </div>

          <div className="bufet-form-actions">
            <button className="bufet-btn-primary" type="submit" disabled={saving}>
              {saving ? "Guardando..." : "Crear"}
            </button>
            <button
              className="bufet-btn"
              type="button"
              onClick={() => setFormAlta(emptyForm)}
              disabled={saving}
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
              placeholder="Buscar por nombre / CUIT / descripción..."
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
                <th style={{ width: 160 }}>CUIT/CUIL</th>
                <th>Descripción</th>
                <th style={{ width: 110 }}>Estado</th>
                <th style={{ width: 220 }}>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: 16 }}>
                    Cargando...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 16 }}>
                    No hay organizadores para mostrar.
                  </td>
                </tr>
              ) : (
                filtered.map((o) => {
                  const activo = Boolean(o.activo);
                  return (
                    <tr key={o.id} className={!activo ? "bufet-row-muted" : ""}>
                      <td>{o.id}</td>
                      <td>{o.nombre}</td>
                      <td>{o.cuit_cuil || "-"}</td>
                      <td className="bufet-ellipsis">
                        {o.descripcion || "-"}
                      </td>
                      <td>
                        <span className={activo ? "bufet-pill ok" : "bufet-pill off"}>
                          {activo ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td>
                        <div className="bufet-actions">
                          <button
                            className="bufet-btn"
                            onClick={() => abrirEdicion(o)}
                            disabled={saving}
                          >
                            Editar
                          </button>

                          {activo ? (
                            <button
                              className="bufet-btn-danger"
                              onClick={() => onDesactivar(o)}
                              disabled={saving}
                            >
                              Desactivar
                            </button>
                          ) : (
                            <button
                              className="bufet-btn-primary"
                              onClick={() => onActivar(o)}
                              disabled={saving}
                            >
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
          <div
            className="bufet-modal"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="bufet-modal-header">
              <h3>Editar organizador</h3>
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
                    onChange={(e) =>
                      setFormEdit((p) => ({ ...p, nombre: e.target.value }))
                    }
                    maxLength={150}
                  />
                </div>

                <div className="bufet-field">
                  <label>CUIT / CUIL</label>
                  <input
                    value={formEdit.cuit_cuil}
                    onChange={(e) =>
                      setFormEdit((p) => ({ ...p, cuit_cuil: e.target.value }))
                    }
                    maxLength={20}
                  />
                </div>

                <div className="bufet-field bufet-field-full">
                  <label>Descripción</label>
                  <textarea
                    value={formEdit.descripcion}
                    onChange={(e) =>
                      setFormEdit((p) => ({ ...p, descripcion: e.target.value }))
                    }
                    rows={3}
                  />
                </div>

                <div className="bufet-field bufet-field-full">
                  <label className="bufet-toggle">
                    <input
                      type="checkbox"
                      checked={editActivo}
                      onChange={(e) => setEditActivo(e.target.checked)}
                    />
                    <span>Activo</span>
                  </label>
                </div>
              </div>

              <div className="bufet-form-actions">
                <button
                  className="bufet-btn-primary"
                  type="submit"
                  disabled={saving}
                >
                  {saving ? "Guardando..." : "Guardar cambios"}
                </button>

                <button
                  className="bufet-btn"
                  type="button"
                  onClick={cerrarEdicion}
                  disabled={saving}
                >
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
