import { supabase } from "@/integrations/supabase/client";

export type Material = {
  id: string;
  nome: string;
  categoria: string;
  unidade: string;
  quantidade_disponivel: number;
  estoque_minimo: number;
  fornecedor_id: string | null;
  preco_unitario: number;
  created_at: string;
  updated_at: string;
};

export type Fornecedor = {
  id: string;
  nome: string;
  telefone: string;
  tempo_entrega_dias: number;
  endereco: string | null;
  cnpj: string | null;
  status: "Ativo" | "Inativo";
  observacoes: string | null;
  created_at: string;
  updated_at: string;
};

export type PedidoStatus = "Pendente" | "Confirmado" | "Em Trânsito" | "Entregue";

export type PedidoCompra = {
  id: string;
  numero: number;
  fornecedor_id: string;
  status: PedidoStatus;
  data_pedido: string;
  data_entrega_prevista: string | null;
  frete: number;
  total: number;
  observacoes: string | null;
  entregue_em: string | null;
  created_at: string;
  updated_at: string;
};

export type PedidoItem = {
  id: string;
  pedido_id: string;
  material_id: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
};

export type PedidoCompraComRefs = PedidoCompra & {
  fornecedor: Fornecedor | null;
  itens: (PedidoItem & { material: Material | null })[];
};

export async function fetchFornecedores(): Promise<Fornecedor[]> {
  const { data, error } = await supabase
    .from("fornecedores" as never)
    .select("*")
    .order("nome");
  if (error) throw error;
  return (data ?? []) as Fornecedor[];
}

export async function fetchPedidosCompra(): Promise<PedidoCompraComRefs[]> {
  const { data, error } = await supabase
    .from("pedidos_compra" as never)
    .select("*, fornecedor:fornecedores(*), itens:pedidos_compra_itens(*, material:materiais(*))")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as PedidoCompraComRefs[];
}

export function formatPedidoNumero(n: number): string {
  return `#${String(n).padStart(3, "0")}`;
}

export function formatBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

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

export type MovimentacaoTipo = "entrada" | "saida_obra" | "retorno_obra" | "ajuste";

export type Movimentacao = {
  id: string;
  material_id: string;
  obra_id: string | null;
  tipo: MovimentacaoTipo;
  quantidade: number;
  observacao: string | null;
  usuario_id: string | null;
  created_at: string;
};

export type MovimentacaoComRefs = Movimentacao & {
  material: Material | null;
  obra: Obra | null;
};

export async function fetchMovimentacoes(): Promise<MovimentacaoComRefs[]> {
  const { data, error } = await supabase
    .from("movimentacoes")
    .select("*, material:materiais(*), obra:obras(*)")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw error;
  return (data ?? []) as MovimentacaoComRefs[];
}

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
