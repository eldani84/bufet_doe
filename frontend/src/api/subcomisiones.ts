// src/api/subcomisiones.ts
// ============================================================
// 📡 API: SUBCOMISIONES
// ============================================================

import { httpGet, httpPost, httpPut, httpDelete } from "./http";
import type { Subcomision } from "./types";

export interface ListarSubcomisionesOptions {
  organizador_id: number;
  incluir_inactivas?: boolean;
}

export interface CrearSubcomisionInput {
  organizador_id: number;
  nombre: string;
  descripcion?: string;
}

export interface ActualizarSubcomisionInput {
  nombre?: string;
  descripcion?: string | null;
  activo?: boolean;
}

export function listarSubcomisiones(
  options: ListarSubcomisionesOptions
): Promise<Subcomision[]> {
  const { organizador_id, incluir_inactivas } = options;
  const q = new URLSearchParams();
  q.set("organizador_id", String(organizador_id));
  if (incluir_inactivas) q.set("incluir_inactivas", "1");
  return httpGet(`/api/subcomisiones?${q.toString()}`);
}

export function obtenerSubcomision(id: number): Promise<Subcomision> {
  return httpGet(`/api/subcomisiones/${id}`);
}

export function crearSubcomision(data: CrearSubcomisionInput): Promise<Subcomision> {
  return httpPost("/api/subcomisiones", data);
}

export function actualizarSubcomision(
  id: number,
  data: ActualizarSubcomisionInput
): Promise<Subcomision> {
  return httpPut(`/api/subcomisiones/${id}`, data);
}

export function eliminarSubcomision(id: number): Promise<{ message: string; id: string | number }> {
  return httpDelete(`/api/subcomisiones/${id}`);
}
