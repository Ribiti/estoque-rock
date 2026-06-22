import { supabase } from "@/integrations/supabase/client";

export type Material = {
  id: string;
  nome: string;
  categoria: string;
  unidade: string;
  quantidade_disponivel: number;
  estoque_minimo: number;
  created_at: string;
  updated_at: string;
};

export type Obra = {
  id: string;
  nome: string;
  status: "Ativa" | "Concluída";
  created_at: string;
};

export type Alocacao = {
  id: string;
  obra_id: string;
  material_id: string;
  quantidade: number;
  data_alocacao: string;
};

export type AlocacaoComMaterial = Alocacao & { material: Material | null };

export async function fetchMateriais(): Promise<Material[]> {
  const { data, error } = await supabase
    .from("materiais")
    .select("*")
    .order("nome");
  if (error) throw error;
  return (data ?? []) as Material[];
}

export async function fetchObras(): Promise<Obra[]> {
  const { data, error } = await supabase
    .from("obras")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Obra[];
}

export async function fetchAlocacoesPorObra(obraId: string): Promise<AlocacaoComMaterial[]> {
  const { data, error } = await supabase
    .from("alocacoes")
    .select("*, material:materiais(*)")
    .eq("obra_id", obraId)
    .order("data_alocacao", { ascending: false });
  if (error) throw error;
  return (data ?? []) as AlocacaoComMaterial[];
}

export async function alocarMaterial(params: {
  obra_id: string;
  material_id: string;
  quantidade: number;
}) {
  const { data, error } = await supabase.rpc("alocar_material", {
    p_obra_id: params.obra_id,
    p_material_id: params.material_id,
    p_quantidade: params.quantidade,
  });
  if (error) throw error;
  return data as string;
}
