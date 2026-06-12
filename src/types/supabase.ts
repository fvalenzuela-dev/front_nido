// hand-written placeholder — replace with `supabase gen types typescript`
// once a Supabase project id is available:
//   npx supabase gen types typescript --project-id TU_PROJECT_ID > src/types/supabase.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      paneles_sip: {
        Row: {
          id: string
          nombre: string
          descripcion: string | null
          espesor_mm: number
          ancho_mm: number
          largo_mm: number
          r_value: number | null
          peso_kg_m2: number | null
          precio_clp: number | null
          stock: number
          publicado: boolean
          imagenes: string[]
          archivos: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nombre: string
          descripcion?: string | null
          espesor_mm: number
          ancho_mm?: number
          largo_mm?: number
          r_value?: number | null
          peso_kg_m2?: number | null
          precio_clp?: number | null
          stock?: number
          publicado?: boolean
          imagenes?: string[]
          archivos?: string[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nombre?: string
          descripcion?: string | null
          espesor_mm?: number
          ancho_mm?: number
          largo_mm?: number
          r_value?: number | null
          peso_kg_m2?: number | null
          precio_clp?: number | null
          stock?: number
          publicado?: boolean
          imagenes?: string[]
          archivos?: string[]
          created_at?: string
          updated_at?: string
        }
      }
      casas_prefabricadas: {
        Row: {
          id: string
          nombre: string
          descripcion: string | null
          metros_cuadrados: number
          dormitorios: number | null
          banos: number | null
          precio_base_clp: number | null
          publicado: boolean
          imagenes: string[]
          planos: string[]
          especificaciones: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nombre: string
          descripcion?: string | null
          metros_cuadrados: number
          dormitorios?: number | null
          banos?: number | null
          precio_base_clp?: number | null
          publicado?: boolean
          imagenes?: string[]
          planos?: string[]
          especificaciones?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nombre?: string
          descripcion?: string | null
          metros_cuadrados?: number
          dormitorios?: number | null
          banos?: number | null
          precio_base_clp?: number | null
          publicado?: boolean
          imagenes?: string[]
          planos?: string[]
          especificaciones?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      cotizaciones: {
        Row: {
          id: string
          nombre: string
          email: string
          telefono: string | null
          tipo: 'panel' | 'casa' | 'general' | null
          mensaje: string
          producto_id: string | null
          atendido: boolean
          created_at: string
        }
        Insert: {
          id?: string
          nombre: string
          email: string
          telefono?: string | null
          tipo?: 'panel' | 'casa' | 'general' | null
          mensaje: string
          producto_id?: string | null
          atendido?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          nombre?: string
          email?: string
          telefono?: string | null
          tipo?: 'panel' | 'casa' | 'general' | null
          mensaje?: string
          producto_id?: string | null
          atendido?: boolean
          created_at?: string
        }
      }
    }
    Enums: Record<string, never>
    Functions: Record<string, never>
  }
}
