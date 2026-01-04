// src/pages/EventosPage.tsx
// ============================================================
// 📅 EVENTOS - BUFET_DOE
// - Siempre asociado a un ORGANIZADOR
// - Estados: planificado | en_curso | cerrado
// - Crear / Editar / Cerrar (DELETE) / Reabrir (PUT)
// - + Configurar productos del evento (productos_evento)
// - + POS Ventas por evento (/eventos/:eventoId/ventas)
// ============================================================

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/BufetUI.css";

import type { Evento, EstadoEvento, Organizador } from "../api/types";
import { listarOrganizadores } from "../api/organizadores";
import {
  listarEventos,
  crearEvento,
  actualizarEvento,
  cerrarEvento,
} from "../api/eventos";

function normalizeText(v: unknown) {
  return String(v ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

// Convierte "YYYY-MM-DDTHH:mm" -> "YYYY-MM-DD HH:mm:ss"
function toMySQLDatetime(dtLocal: string): string {
  if (!dtLocal) return "";
  const [date, time] = dtLocal.split("T");
  if (!date || !time) return "";
  return `${date} ${time}:00`;
}

// Convierte "YYYY-MM-DD HH:mm:ss" -> "YYYY-MM-DDTHH:mm"
function fromMySQLDatetime(mysqlDt: string | null | undefined): string {
  if (!mysqlDt) return "";
  const s = String(mysqlDt);
  const cleaned = s.includes("T") ? s : s.replace(" ", "T");
  return cleaned.slice(0, 16);
}

function formatShort(mysqlDt: string | null | undefined): string {
  if (!mysqlDt) return "-";
  const s = String(mysqlDt).replace("T", " ");
  return s.slice(0, 16);
}

type FormAlta = {
  nombre: string;
  fecha_inicio_local: string;
  fecha_fin_local: string;
  estado: EstadoEvento;
};

type FormEdit = {
  nombre: string;
  fecha_inicio_local: string;
  fecha_fin_local: string;
  estado: EstadoEvento;
  observaciones: string;
};

const emptyAlta: FormAlta = {
  nombre: "",
  fecha_inicio_local: "",
  fecha_fin_local: "",
  estado: "planificado",
};

export default function EventosPage() {
  const navigate = useNavigate();

  const [orgs, setOrgs] = useState<Organizador[]>([]);
  const [orgId, setOrgId] = useState<number | "">("");

  const [estadoFiltro, setEstadoFiltro] = useState<"" | EstadoEvento>("");
  const [search, setSearch] = useState("");

  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const [alta, setAlta] = useState<FormAlta>(emptyAlta);

  // edición
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [edit, setEdit] = useState<FormEdit>({
    nombre: "",
    fecha_inicio_local: "",
    fecha_fin_local: "",
    estado: "planificado",
    observaciones: "",
  });

  async function cargarOrganizadores() {
    try {
      setError("");
      const rows = await listarOrganizadores();
      setOrgs(Array.isArray(rows) ? rows : []);
      if (rows?.length === 1) setOrgId(rows[0].id);
    } catch (e: any) {
      setError(e?.message || "Error al cargar organizadores");
    }
  }

  async function cargarEventos() {
    if (!orgId) {
      setEventos([]);
      return;
    }
    try {
      setError("");
      setInfo("");
      setLoading(true);

      const rows = await listarEventos({
        organizador_id: Number(orgId),
        estado: estadoFiltro || undefined,
      });

      setEventos(Array.isArray(rows) ? rows : []);
    } catch (e: any) {
      setError(e?.message || "Error al cargar eventos");
      setEventos([]);
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
  }, [orgId, estadoFiltro]);

  const filtered = useMemo(() => {
    const q = normalizeText(search);
    if (!q) return eventos;
    return eventos.filter((ev) => {
      const hay = normalizeText(
        `${ev.nombre} ${ev.estado} ${ev.observaciones ?? ""}`
      );
      return hay.includes(q);
    });
  }, [eventos, search]);

  function validarAlta(): string | null {
    if (!orgId) return "Seleccioná un organizador.";
    if (!alta.nombre.trim()) return "El nombre es obligatorio.";
    if (!alta.fecha_inicio_local) return "La fecha de inicio es obligatoria.";
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

      await crearEvento({
        organizador_id: Number(orgId),
        nombre: alta.nombre.trim(),
        fecha_inicio: toMySQLDatetime(alta.fecha_inicio_local),
        fecha_fin: alta.fecha_fin_local
          ? toMySQLDatetime(alta.fecha_fin_local)
          : null,
        estado: alta.estado,
      });

      setAlta(emptyAlta);
      setInfo("Evento creado correctamente.");
      await cargarEventos();
    } catch (e: any) {
      setError(e?.message || "Error al crear evento");
    } finally {
      setSaving(false);
    }
  }

  function abrirEdicion(ev: Evento) {
    setError("");
    setInfo("");
    setEditId(ev.id);
    setEdit({
      nombre: ev.nombre ?? "",
      fecha_inicio_local: fromMySQLDatetime(ev.fecha_inicio),
      fecha_fin_local: fromMySQLDatetime(ev.fecha_fin),
      estado: ev.estado,
      observaciones: ev.observaciones ?? "",
    });
    setEditOpen(true);
  }

  function cerrarEdicionModal() {
    setEditOpen(false);
    setEditId(null);
  }

  async function onGuardarEdicion(e: React.FormEvent) {
    e.preventDefault();
    if (!editId) return;

    if (!orgId) {
      setError("Seleccioná un organizador.");
      return;
    }
    if (!edit.nombre.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    if (!edit.fecha_inicio_local) {
      setError("La fecha de inicio es obligatoria.");
      return;
    }

    try {
      setError("");
      setInfo("");
      setSaving(true);

      await actualizarEvento(editId, {
        nombre: edit.nombre.trim(),
        fecha_inicio: toMySQLDatetime(edit.fecha_inicio_local),
        fecha_fin: edit.fecha_fin_local
          ? toMySQLDatetime(edit.fecha_fin_local)
          : null,
        estado: edit.estado,
        observaciones: edit.observaciones?.trim()
          ? edit.observaciones.trim()
          : null,
      });

      setInfo("Evento actualizado correctamente.");
      cerrarEdicionModal();
      await cargarEventos();
    } catch (e: any) {
      setError(e?.message || "Error al actualizar evento");
    } finally {
      setSaving(false);
    }
  }

  async function onCerrar(ev: Evento) {
    const ok = window.confirm(
      `¿Cerrar el evento "${ev.nombre}"?\nQuedará estado = 'cerrado'.`
    );
    if (!ok) return;

    try {
      setError("");
      setInfo("");
      setSaving(true);
      await cerrarEvento(ev.id);
      setInfo("Evento cerrado correctamente.");
      await cargarEventos();
    } catch (e: any) {
      setError(e?.message || "Error al cerrar evento");
    } finally {
      setSaving(false);
    }
  }

  async function onReabrir(ev: Evento) {
    try {
      setError("");
      setInfo("");
      setSaving(true);

      await actualizarEvento(ev.id, { estado: "planificado" });

      setInfo("Evento reabierto (estado = planificado).");
      await cargarEventos();
    } catch (e: any) {
      setError(e?.message || "Error al reabrir evento");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bufet-container">
      <div style={{ marginBottom: "0.6rem" }}>
        <div style={{ fontSize: "1.1rem", fontWeight: 600 }}>Eventos</div>
        <div className="bufet-subtitle">
          Administrá eventos por organizador. Estados: planificado / en_curso /
          cerrado.
        </div>
      </div>

      {error && <div className="bufet-error">{error}</div>}
      {info && <div className="bufet-info">{info}</div>}

      {/* Selector + filtros */}
      <div className="bufet-card-form" style={{ marginTop: "0.7rem" }}>
        <div className="bufet-form-grid">
          <div className="bufet-field">
            <div className="bufet-label">Organizador *</div>
            <select
              className="bufet-select"
              value={orgId}
              onChange={(e) =>
                setOrgId(e.target.value ? Number(e.target.value) : "")
              }
            >
              <option value="">— Elegir organizador —</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="bufet-field">
            <div className="bufet-label">Filtrar por estado</div>
            <select
              className="bufet-select"
              value={estadoFiltro}
              onChange={(e) => setEstadoFiltro((e.target.value as any) || "")}
              disabled={!orgId}
            >
              <option value="">Todos</option>
              <option value="planificado">Planificado</option>
              <option value="en_curso">En curso</option>
              <option value="cerrado">Cerrado</option>
            </select>
          </div>

          <div className="bufet-field">
            <div className="bufet-label">Buscar</div>
            <input
              className="bufet-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nombre / estado / observaciones..."
              disabled={!orgId}
            />
          </div>
        </div>

        <div className="bufet-actions">
          <button
            className="btn-secondary"
            type="button"
            onClick={cargarEventos}
            disabled={!orgId || loading}
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
                Crear evento
              </div>
              <div className="bufet-subtitle">
                Se crea asociado al organizador seleccionado.
              </div>
            </div>
          </div>

          <form
            onSubmit={onCrear}
            className="bufet-form-grid"
            style={{ marginTop: "0.7rem" }}
          >
            <div className="bufet-field">
              <div className="bufet-label">Nombre *</div>
              <input
                className="bufet-input"
                value={alta.nombre}
                onChange={(e) =>
                  setAlta((p) => ({ ...p, nombre: e.target.value }))
                }
                maxLength={150}
                disabled={!orgId}
              />
            </div>

            <div className="bufet-field">
              <div className="bufet-label">Fecha inicio *</div>
              <input
                className="bufet-input"
                type="datetime-local"
                value={alta.fecha_inicio_local}
                onChange={(e) =>
                  setAlta((p) => ({
                    ...p,
                    fecha_inicio_local: e.target.value,
                  }))
                }
                disabled={!orgId}
              />
            </div>

            <div className="bufet-field">
              <div className="bufet-label">Fecha fin</div>
              <input
                className="bufet-input"
                type="datetime-local"
                value={alta.fecha_fin_local}
                onChange={(e) =>
                  setAlta((p) => ({ ...p, fecha_fin_local: e.target.value }))
                }
                disabled={!orgId}
              />
            </div>

            <div className="bufet-field">
              <div className="bufet-label">Estado</div>
              <select
                className="bufet-select"
                value={alta.estado}
                onChange={(e) =>
                  setAlta((p) => ({
                    ...p,
                    estado: e.target.value as EstadoEvento,
                  }))
                }
                disabled={!orgId}
              >
                <option value="planificado">Planificado</option>
                <option value="en_curso">En curso</option>
                <option value="cerrado">Cerrado</option>
              </select>
            </div>

            <div className="bufet-actions">
              <button
                className="btn-primary"
                type="submit"
                disabled={!orgId || saving}
              >
                {saving ? "Guardando..." : "Crear"}
              </button>
              <button
                className="btn-ghost"
                type="button"
                onClick={() => setAlta(emptyAlta)}
                disabled={!orgId || saving}
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
              <div className="bufet-card-title">Listado de eventos</div>
              <div className="bufet-card-caption">
                {orgId ? `${filtered.length} evento(s)` : "Seleccioná un organizador"}
              </div>
            </div>
          </div>

          <div className="bufet-table-wrapper">
            <table className="bufet-table">
              <thead>
                <tr>
                  <th style={{ width: 70 }}>ID</th>
                  <th>Nombre</th>
                  <th style={{ width: 170 }}>Inicio</th>
                  <th style={{ width: 170 }}>Fin</th>
                  <th style={{ width: 120 }}>Estado</th>
                  <th style={{ width: 520 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {!orgId ? (
                  <tr>
                    <td colSpan={6}>Seleccioná un organizador para ver eventos.</td>
                  </tr>
                ) : loading ? (
                  <tr>
                    <td colSpan={6}>Cargando...</td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6}>No hay eventos para mostrar.</td>
                  </tr>
                ) : (
                  filtered.map((ev) => {
                    const estado = ev.estado;
                    return (
                      <tr key={ev.id}>
                        <td>{ev.id}</td>
                        <td>{ev.nombre}</td>
                        <td>{formatShort(ev.fecha_inicio)}</td>
                        <td>{formatShort(ev.fecha_fin)}</td>
                        <td>
                          <span
                            className="bufet-tag"
                            style={{
                              background:
                                estado === "cerrado"
                                  ? "rgba(248, 113, 113, 0.18)"
                                  : estado === "en_curso"
                                  ? "rgba(56, 189, 248, 0.16)"
                                  : "rgba(148, 163, 184, 0.16)",
                              color:
                                estado === "cerrado"
                                  ? "var(--bufet-danger)"
                                  : estado === "en_curso"
                                  ? "var(--bufet-accent)"
                                  : "var(--bufet-text-secondary)",
                            }}
                          >
                            {estado}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                            <button
                              className="btn-secondary"
                              type="button"
                              onClick={() => abrirEdicion(ev)}
                              disabled={saving}
                            >
                              Editar
                            </button>

                            <button
                              className="btn-secondary"
                              type="button"
                              onClick={() => navigate(`/eventos/${ev.id}/productos`)}
                              disabled={saving}
                              title="Configurar qué productos se venden en este evento"
                            >
                              Configurar productos
                            </button>

                            {/* ✅ NUEVO: POS Ventas */}
                            <button
                              className="btn-primary"
                              type="button"
                              onClick={() => navigate(`/eventos/${ev.id}/ventas`)}
                              disabled={saving}
                              title="Abrir POS de ventas para este evento"
                            >
                              POS Ventas
                            </button>

                            {estado !== "cerrado" ? (
                              <button
                                className="btn-danger"
                                type="button"
                                onClick={() => onCerrar(ev)}
                                disabled={saving}
                              >
                                Cerrar
                              </button>
                            ) : (
                              <button
                                className="btn-primary"
                                type="button"
                                onClick={() => onReabrir(ev)}
                                disabled={saving}
                              >
                                Reabrir
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

          {/* Modal edición simple */}
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
                    Editar evento
                  </div>
                  <button
                    className="btn-ghost"
                    type="button"
                    onClick={cerrarEdicionModal}
                  >
                    Cerrar
                  </button>
                </div>

                <form onSubmit={onGuardarEdicion} style={{ marginTop: "0.75rem" }}>
                  <div className="bufet-form-grid">
                    <div className="bufet-field">
                      <div className="bufet-label">Nombre *</div>
                      <input
                        className="bufet-input"
                        value={edit.nombre}
                        onChange={(e) =>
                          setEdit((p) => ({ ...p, nombre: e.target.value }))
                        }
                        maxLength={150}
                      />
                    </div>

                    <div className="bufet-field">
                      <div className="bufet-label">Fecha inicio *</div>
                      <input
                        className="bufet-input"
                        type="datetime-local"
                        value={edit.fecha_inicio_local}
                        onChange={(e) =>
                          setEdit((p) => ({
                            ...p,
                            fecha_inicio_local: e.target.value,
                          }))
                        }
                      />
                    </div>

                    <div className="bufet-field">
                      <div className="bufet-label">Fecha fin</div>
                      <input
                        className="bufet-input"
                        type="datetime-local"
                        value={edit.fecha_fin_local}
                        onChange={(e) =>
                          setEdit((p) => ({
                            ...p,
                            fecha_fin_local: e.target.value,
                          }))
                        }
                      />
                    </div>

                    <div className="bufet-field">
                      <div className="bufet-label">Estado</div>
                      <select
                        className="bufet-select"
                        value={edit.estado}
                        onChange={(e) =>
                          setEdit((p) => ({
                            ...p,
                            estado: e.target.value as EstadoEvento,
                          }))
                        }
                      >
                        <option value="planificado">Planificado</option>
                        <option value="en_curso">En curso</option>
                        <option value="cerrado">Cerrado</option>
                      </select>
                    </div>

                    <div className="bufet-field">
                      <div className="bufet-label">Observaciones</div>
                      <textarea
                        className="bufet-textarea"
                        value={edit.observaciones}
                        onChange={(e) =>
                          setEdit((p) => ({
                            ...p,
                            observaciones: e.target.value,
                          }))
                        }
                        placeholder="Opcional"
                      />
                    </div>
                  </div>

                  <div className="bufet-actions">
                    <button
                      className="btn-primary"
                      type="submit"
                      disabled={saving || !editId}
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
