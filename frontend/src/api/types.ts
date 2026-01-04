// src/api/types.ts
// ============================================================
// 🧾 Tipos compartidos del sistema BUFET_DOE (frontend)
// ============================================================

export type ActivoFlag = 0 | 1;

export interface Organizador {
  id: number;
  nombre: string;
  descripcion: string | null;
  cuit_cuil: string | null;
  activo: ActivoFlag;
}

export interface Subcomision {
  id: number;
  organizador_id: number;
  nombre: string;
  descripcion: string | null;
  activo: ActivoFlag;
}

export type EstadoEvento = "planificado" | "en_curso" | "cerrado";

export interface Evento {
  id: number;
  organizador_id: number;
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  estado: EstadoEvento;
  observaciones: string | null;

  organizador_nombre?: string;
}
