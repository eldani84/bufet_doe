// src/pages/CajasPage.tsx
// ============================================================
// 🧮 CAJAS - ABM (BUFET_DOE)
// - Cajas siempre asociadas a un EVENTO
// - Alta / edición / activar / desactivar
// - Filtros por organizador, evento y estado (activo/inactivo)
// ============================================================

import { useEffect, useMemo, useState } from "react";
import "../styles/BufetUI.css";

import type { Evento, Organizador } from "../api/types";
import { listarEventos } from "../api/eventos";
import { listarOrganizadores } from "../api/organizadores";

import {
  listarCajas,
  crearCaja,
  actualizarCaja,
  eliminarCaja,
  type Caja,
} from "../api/cajas";

function normalizeText(v: unknown) {
  return String(v ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

type FormAlta = {
  evento_id: number | "";
  nombre: string;
  descripcion: string;
  activo: boolean;
};

type FormEdit = {
  id: number | null;
  evento_id: number | "";
  nombre: string;
  descripcion: string;
  activo: boolean;
};

const emptyAlta: FormAlta = {
  evento_id: "",
  nombre: "",
  descripcion: "",
  activo: true,
};

export default function CajasPage() {
  // Organizadores + eventos
  const [organizadores, setOrganizadores] = useState<Organizador[]>([]);
  const [orgId, setOrgId] = useState<number | "">("");
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [eventoFiltroId, setEventoFiltroId] = useState<number | "">("");
  const [activoFiltro, setActivoFiltro] = useState<"" | "1" | "0">("");

  const [cajas, setCajas] = useState<Caja[]>([]);
  const [search, setSearch] = useState("");

  const [alta, setAlta] = useState<FormAlta>(emptyAlta);
  const [editOpen, setEditOpen] = useState(false);
  const [edit, setEdit] = useState<FormEdit>({
    id: null,
    evento_id: "",
    nombre: "",
    descripcion: "",
    activo: true,
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  // ============================================================
  // Cargar organizadores
  // ============================================================
  async function cargarOrganizadores() {
    try {
      setError("");
      const rows = await listarOrganizadores();
      const lista = Array.isArray(rows) ? rows : [];
      setOrganizadores(lista);

      // Si hay un solo organizador, lo seleccionamos
      if (lista.length === 1) {
        setOrgId(lista[0].id);
      }
    } catch (e: any) {
      setError(e?.message || "Error al cargar organizadores");
    }
  }

  // ============================================================
  // Cargar eventos según organizador seleccionado
  // ============================================================
  async function cargarEventos() {
    if (!orgId) {
      setEventos([]);
      setEventoFiltroId("");
      // También reseteamos el alta
      setAlta((p) => ({ ...p, evento_id: "" }));
      return;
    }

    try {
      setError("");
      const rows = await listarEventos({
        organizador_id: Number(orgId),
      });
      const lista = Array.isArray(rows) ? rows : [];
      setEventos(lista);

      // Si solo hay un evento para este organizador, lo preseleccionamos
      if (lista.length === 1) {
        const ev = lista[0];
        setEventoFiltroId(ev.id);
        setAlta((p) => ({ ...p, evento_id: ev.id }));
      } else {
        // Si había un evento seleccionado que ya no pertenece, lo limpiamos
        setEventoFiltroId((prev) =>
          prev && lista.some((e) => e.id === prev) ? prev : ""
        );
        setAlta((p) => ({
          ...p,
          evento_id:
            p.evento_id && lista.some((e) => e.id === p.evento_id)
              ? p.evento_id
              : "",
        }));
      }
    } catch (e: any) {
      setError(e?.message || "Error al cargar eventos");
      setEventos([]);
      setEventoFiltroId("");
      setAlta((p) => ({ ...p, evento_id: "" }));
    }
  }

  // ============================================================
  // Cargar cajas
  // ============================================================
  async function cargarCajas() {
    try {
      setError("");
      setInfo("");
      setLoading(true);

      const params: { evento_id?: number; activo?: number } = {};
      if (eventoFiltroId) params.evento_id = Number(eventoFiltroId);
      if (activoFiltro !== "") params.activo = Number(activoFiltro);

      const rows = await listarCajas(params);
      setCajas(Array.isArray(rows) ? rows : []);
    } catch (e: any) {
      setError(e?.message || "Error al cargar cajas");
      setCajas([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarOrganizadores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    cargarEventos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  useEffect(() => {
    cargarCajas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventoFiltroId, activoFiltro]);

  const filtered = useMemo(() => {
    const q = normalizeText(search);
    if (!q) return cajas;
    return cajas.filter((c) => {
      const hay = normalizeText(
        `${c.nombre} ${c.descripcion ?? ""} ${
          c.evento_nombre ?? ""
        } ${c.id} ${c.evento_id}`
      );
      return hay.includes(q);
    });
  }, [cajas, search]);

  // ============================================================
  // Alta
  // ============================================================
  function validarAlta(): string | null {
    if (!alta.evento_id) return "Seleccioná un evento para la caja.";
    if (!alta.nombre.trim()) return "El nombre de la caja es obligatorio.";
    return null;
  }

  async function onCrear(e: React.FormEvent) {
    e.preventDefault();
    const v = validarAlta();
    if (v) {
      setError(v);
      return;
    }

    try {
      setError("");
      setInfo("");
      setSaving(true);

      await crearCaja({
        evento_id: Number(alta.evento_id),
        nombre: alta.nombre.trim(),
        descripcion: alta.descripcion.trim() || null,
        activo: alta.activo,
      });

      setAlta((p) => ({
        ...emptyAlta,
        // mantené el mismo evento si está seleccionado
        evento_id: p.evento_id || eventoFiltroId || "",
      }));

      setInfo("Caja creada correctamente.");
      await cargarCajas();
    } catch (e: any) {
      setError(e?.message || "Error al crear la caja");
    } finally {
      setSaving(false);
    }
  }

  // ============================================================
  // Edición
  // ============================================================
  function abrirEdicion(c: Caja) {
    setError("");
    setInfo("");
    setEdit({
      id: c.id,
      evento_id: c.evento_id,
      nombre: c.nombre,
      descripcion: c.descripcion ?? "",
      activo: !!c.activo,
    });
    setEditOpen(true);
  }

  function cerrarEdicionModal() {
    setEditOpen(false);
    setEdit({
      id: null,
      evento_id: "",
      nombre: "",
      descripcion: "",
      activo: true,
    });
  }

  async function onGuardarEdicion(e: React.FormEvent) {
    e.preventDefault();
    if (!edit.id) return;

    if (!edit.evento_id) {
      setError("Seleccioná un evento para la caja.");
      return;
    }
    if (!edit.nombre.trim()) {
      setError("El nombre de la caja es obligatorio.");
      return;
    }

    try {
      setError("");
      setInfo("");
      setSaving(true);

      await actualizarCaja(edit.id, {
        evento_id: Number(edit.evento_id),
        nombre: edit.nombre.trim(),
        descripcion: edit.descripcion.trim() || null,
        activo: edit.activo,
      });

      setInfo("Caja actualizada correctamente.");
      cerrarEdicionModal();
      await cargarCajas();
    } catch (e: any) {
      setError(e?.message || "Error al actualizar la caja");
    } finally {
      setSaving(false);
    }
  }

  // ============================================================
  // Activar / desactivar
  // ============================================================
  async function onToggleActiva(c: Caja) {
    if (!c.id) return;
    const nuevaActiva = !Boolean(c.activo);

    try {
      setError("");
      setInfo("");
      setSaving(true);

      if (!nuevaActiva) {
        // Desactivar → usamos la API de "eliminar" (baja lógica)
        await eliminarCaja(c.id);
        setInfo("Caja desactivada correctamente.");
      } else {
        await actualizarCaja(c.id, { activo: true });
        setInfo("Caja activada correctamente.");
      }

      await cargarCajas();
    } catch (e: any) {
      setError(e?.message || "Error al cambiar el estado de la caja");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bufet-container">
      <div style={{ marginBottom: "0.6rem" }}>
        <div style={{ fontSize: "1.1rem", fontWeight: 600 }}>Cajas</div>
        <div className="bufet-subtitle">
          Configurá las cajas de cada evento. Luego, las sesiones de caja
          (apertura/cierre) usan estas cajas.
        </div>
      </div>

      {error && <div className="bufet-error">{error}</div>}
      {info && <div className="bufet-info">{info}</div>}

      {/* Filtros superiores */}
      <div className="bufet-card-form" style={{ marginTop: "0.7rem" }}>
        <div className="bufet-form-grid">
          {/* Organizador */}
          <div className="bufet-field">
            <div className="bufet-label">Organizador</div>
            <select
              className="bufet-select"
              value={orgId}
              onChange={(e) =>
                setOrgId(e.target.value ? Number(e.target.value) : "")
              }
            >
              <option value="">— Todos / elegir —</option>
              {organizadores.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Evento */}
          <div className="bufet-field">
            <div className="bufet-label">Evento</div>
            <select
              className="bufet-select"
              value={eventoFiltroId}
              onChange={(e) =>
                setEventoFiltroId(
                  e.target.value ? Number(e.target.value) : ""
                )
              }
              disabled={!orgId || eventos.length === 0}
            >
              <option value="">— Todos los eventos —</option>
              {eventos.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Estado */}
          <div className="bufet-field">
            <div className="bufet-label">Estado</div>
            <select
              className="bufet-select"
              value={activoFiltro}
              onChange={(e) => setActivoFiltro(e.target.value as any)}
            >
              <option value="">Todas</option>
              <option value="1">Activas</option>
              <option value="0">Inactivas</option>
            </select>
          </div>

          {/* Buscar */}
          <div className="bufet-field">
            <div className="bufet-label">Buscar</div>
            <input
              className="bufet-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nombre / evento / descripción..."
            />
          </div>
        </div>

        <div className="bufet-actions">
          <button
            className="btn-secondary"
            type="button"
            onClick={cargarCajas}
            disabled={loading}
          >
            {loading ? "Cargando..." : "Actualizar"}
          </button>
        </div>
      </div>

      {/* Layout form + tabla */}
      <div className="bufet-layout" style={{ marginTop: "1rem" }}>
        {/* Alta */}
        <div className="bufet-card-form">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
            }}
          >
            <div>
              <div style={{ fontSize: "0.95rem", fontWeight: 600 }}>
                Crear caja
              </div>
              <div className="bufet-subtitle">
                Cada caja pertenece a un evento y se usa en las sesiones de
                caja.
              </div>
            </div>
          </div>

          <form
            onSubmit={onCrear}
            className="bufet-form-grid"
            style={{ marginTop: "0.7rem" }}
          >
            <div className="bufet-field">
              <div className="bufet-label">Organizador</div>
              <select
                className="bufet-select"
                value={orgId}
                onChange={(e) =>
                  setOrgId(e.target.value ? Number(e.target.value) : "")
                }
              >
                <option value="">— Elegir organizador —</option>
                {organizadores.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="bufet-field">
              <div className="bufet-label">Evento *</div>
              <select
                className="bufet-select"
                value={alta.evento_id}
                onChange={(e) =>
                  setAlta((p) => ({
                    ...p,
                    evento_id: e.target.value
                      ? Number(e.target.value)
                      : "",
                  }))
                }
                disabled={!orgId || eventos.length === 0}
              >
                <option value="">— Elegir evento —</option>
                {eventos.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="bufet-field">
              <div className="bufet-label">Nombre *</div>
              <input
                className="bufet-input"
                value={alta.nombre}
                onChange={(e) =>
                  setAlta((p) => ({ ...p, nombre: e.target.value }))
                }
                maxLength={100}
              />
            </div>

            <div className="bufet-field">
              <div className="bufet-label">Descripción</div>
              <input
                className="bufet-input"
                value={alta.descripcion}
                onChange={(e) =>
                  setAlta((p) => ({ ...p, descripcion: e.target.value }))
                }
                placeholder="Opcional: ubicación, notas..."
              />
            </div>

            <div className="bufet-field">
              <div className="bufet-label">Activa</div>
              <select
                className="bufet-select"
                value={alta.activo ? "1" : "0"}
                onChange={(e) =>
                  setAlta((p) => ({ ...p, activo: e.target.value === "1" }))
                }
              >
                <option value="1">Sí</option>
                <option value="0">No</option>
              </select>
            </div>

            <div className="bufet-actions">
              <button className="btn-primary" type="submit" disabled={saving}>
                {saving ? "Guardando..." : "Crear"}
              </button>
              <button
                className="btn-ghost"
                type="button"
                onClick={() =>
                  setAlta((p) => ({
                    ...emptyAlta,
                    evento_id: p.evento_id || eventoFiltroId || "",
                  }))
                }
                disabled={saving}
              >
                Limpiar
              </button>
            </div>
          </form>
        </div>

        {/* Tabla */}
        <div className="bufet-card-table">
          <div className="bufet-card-header">
            <div>
              <div className="bufet-card-title">Listado de cajas</div>
              <div className="bufet-card-caption">
                {filtered.length} caja(s)
              </div>
            </div>
          </div>

          <div className="bufet-table-wrapper">
            <table className="bufet-table">
              <thead>
                <tr>
                  <th style={{ width: 70 }}>ID</th>
                  <th>Evento</th>
                  <th>Nombre</th>
                  <th>Descripción</th>
                  <th style={{ width: 110 }}>Estado</th>
                  <th style={{ width: 360 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6}>Cargando...</td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6}>No hay cajas para mostrar.</td>
                  </tr>
                ) : (
                  filtered.map((c) => {
                    const activa = Boolean(c.activo);
                    return (
                      <tr key={c.id}>
                        <td>{c.id}</td>
                        <td>{c.evento_nombre || c.evento_id}</td>
                        <td>{c.nombre}</td>
                        <td>{c.descripcion || "—"}</td>
                        <td>
                          <span
                            className="bufet-tag"
                            style={{
                              background: activa
                                ? "rgba(34,197,94,0.16)"
                                : "rgba(148,163,184,0.16)",
                              color: activa
                                ? "var(--bufet-success)"
                                : "var(--bufet-text-secondary)",
                            }}
                          >
                            {activa ? "Activa" : "Inactiva"}
                          </span>
                        </td>
                        <td>
                          <div
                            style={{
                              display: "flex",
                              gap: "0.4rem",
                              flexWrap: "wrap",
                            }}
                          >
                            <button
                              className="btn-secondary"
                              type="button"
                              onClick={() => abrirEdicion(c)}
                              disabled={saving}
                            >
                              Editar
                            </button>

                            <button
                              className={activa ? "btn-danger" : "btn-primary"}
                              type="button"
                              onClick={() => onToggleActiva(c)}
                              disabled={saving}
                            >
                              {activa ? "Desactivar" : "Activar"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Modal edición */}
          {editOpen && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.55)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 9999,
                padding: "1rem",
              }}
              onMouseDown={cerrarEdicionModal}
            >
              <div
                className="bufet-card-form"
                style={{ width: "min(720px, 100%)" }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "0.75rem",
                    alignItems: "center",
                  }}
                >
                  <div style={{ fontSize: "0.95rem", fontWeight: 600 }}>
                    Editar caja
                  </div>
                  <button
                    className="btn-ghost"
                    type="button"
                    onClick={cerrarEdicionModal}
                    disabled={saving}
                  >
                    Cerrar
                  </button>
                </div>

                <form
                  onSubmit={onGuardarEdicion}
                  style={{ marginTop: "0.75rem" }}
                >
                  <div className="bufet-form-grid">
                    <div className="bufet-field">
                      <div className="bufet-label">Organizador</div>
                      <select
                        className="bufet-select"
                        value={orgId}
                        onChange={(e) =>
                          setOrgId(
                            e.target.value ? Number(e.target.value) : ""
                          )
                        }
                      >
                        <option value="">— Elegir organizador —</option>
                        {organizadores.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.nombre}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="bufet-field">
                      <div className="bufet-label">Evento *</div>
                      <select
                        className="bufet-select"
                        value={edit.evento_id}
                        onChange={(e) =>
                          setEdit((p) => ({
                            ...p,
                            evento_id: e.target.value
                              ? Number(e.target.value)
                              : "",
                          }))
                        }
                        disabled={!orgId || eventos.length === 0}
                      >
                        <option value="">— Elegir evento —</option>
                        {eventos.map((ev) => (
                          <option key={ev.id} value={ev.id}>
                            {ev.nombre}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="bufet-field">
                      <div className="bufet-label">Nombre *</div>
                      <input
                        className="bufet-input"
                        value={edit.nombre}
                        onChange={(e) =>
                          setEdit((p) => ({
                            ...p,
                            nombre: e.target.value,
                          }))
                        }
                        maxLength={100}
                      />
                    </div>

                    <div className="bufet-field">
                      <div className="bufet-label">Descripción</div>
                      <input
                        className="bufet-input"
                        value={edit.descripcion}
                        onChange={(e) =>
                          setEdit((p) => ({
                            ...p,
                            descripcion: e.target.value,
                          }))
                        }
                        placeholder="Opcional"
                      />
                    </div>

                    <div className="bufet-field">
                      <div className="bufet-label">Activa</div>
                      <select
                        className="bufet-select"
                        value={edit.activo ? "1" : "0"}
                        onChange={(e) =>
                          setEdit((p) => ({
                            ...p,
                            activo: e.target.value === "1",
                          }))
                        }
                      >
                        <option value="1">Sí</option>
                        <option value="0">No</option>
                      </select>
                    </div>
                  </div>

                  <div className="bufet-actions">
                    <button
                      className="btn-primary"
                      type="submit"
                      disabled={saving || !edit.id}
                    >
                      {saving ? "Guardando..." : "Guardar"}
                    </button>
                    <button
                      className="btn-secondary"
                      type="button"
                      onClick={cerrarEdicionModal}
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
      </div>
    </div>
  );
}
