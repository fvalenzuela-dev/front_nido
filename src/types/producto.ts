export interface PanelSIP {
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
