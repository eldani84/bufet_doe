// src/api/eventos.ts
// ============================================================
// 📡 API: EVENTOS
// ============================================================

import { httpGet, httpPost, httpPut, httpDelete } from "./http";
import type { Evento, EstadoEvento } from "./types";

export interface ListarEventosOptions {
  organizador_id: number;
  estado?: EstadoEvento; // opcional
}

export interface CrearEventoInput {
  organizador_id: number;
  nombre: string;
  fecha_inicio: string; // "YYYY-MM-DD HH:mm:ss"
  fecha_fin?: string | null;
  estado?: EstadoEvento;
}

export interface ActualizarEventoInput {
  nombre?: string;
  fecha_inicio?: string;
  fecha_fin?: string | null;
  estado?: EstadoEvento;
  observaciones?: string | null;
}

export function listarEventos(options: ListarEventosOptions): Promise<Evento[]> {
  const q = new URLSearchParams();
  q.set("organizador_id", String(options.organizador_id));
  if (options.estado) q.set("estado", options.estado);
  return httpGet(`/api/eventos?${q.toString()}`);
}

export function obtenerEvento(id: number): Promise<Evento> {
  return httpGet(`/api/eventos/${id}`);
}

export function crearEvento(data: CrearEventoInput): Promise<Evento> {
  return httpPost("/api/eventos", data);
}

export function actualizarEvento(id: number, data: ActualizarEventoInput): Promise<Evento> {
  return httpPut(`/api/eventos/${id}`, data);
}

// DELETE = cerrar evento (estado = 'cerrado')
export function cerrarEvento(id: number): Promise<{ message: string; id: string | number }> {
  return httpDelete(`/api/eventos/${id}`);
}
