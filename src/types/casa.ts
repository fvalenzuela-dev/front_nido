export interface CasaPrefabricada {
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
  especificaciones: Record<string, unknown> | null
  created_at: string
  updated_at: string
}
