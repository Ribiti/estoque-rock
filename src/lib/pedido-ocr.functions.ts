import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ItemExtraido = {
  nome: string;
  quantidade: number;
  preco_unitario: number;
  material_id: string | null; // id no estoque se casou por nome
  match_confianca: "alta" | "media" | "nenhuma";
};

export type OcrPedidoResult = {
  itens: ItemExtraido[];
  frete: number;
  fornecedor_sugerido: string | null;
  observacoes: string | null;
};

export const extrairPedidoDeImagem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { imageDataUrl: string }) => {
    if (!input?.imageDataUrl?.startsWith("data:image/")) {
      throw new Error("Imagem inválida");
    }
    return input;
  })
  .handler(async ({ data, context }): Promise<OcrPedidoResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");

    // Carrega materiais e fornecedores para dar contexto ao modelo
    const [{ data: materiais }, { data: fornecedores }] = await Promise.all([
      context.supabase.from("materiais").select("id, nome, unidade, preco_unitario"),
      context.supabase.from("fornecedores").select("nome").eq("status", "Ativo"),
    ]);

    const materiaisCatalog = (materiais ?? []).map((m) => ({
      id: m.id, nome: m.nome, unidade: m.unidade,
    }));
    const fornecedoresNomes = (fornecedores ?? []).map((f) => f.nome);

    const systemPrompt = `Você é um extrator de pedidos de compra de materiais de construção a partir de imagens (prints de sites de fornecedores, e-mails, notas).
Retorne SOMENTE um objeto JSON válido no formato:
{
  "itens": [{ "nome": string, "quantidade": number, "preco_unitario": number }],
  "frete": number,
  "fornecedor_sugerido": string | null,
  "observacoes": string | null
}
Regras:
- "quantidade" e "preco_unitario" são números (use ponto como separador decimal).
- Se não conseguir identificar preço unitário mas houver subtotal e quantidade, calcule.
- "frete" = 0 se não houver.
- "fornecedor_sugerido" deve ser um dos nomes desta lista quando possível: ${JSON.stringify(fornecedoresNomes)}. Caso contrário, use o nome que aparece na imagem ou null.
- Não invente itens. Se a imagem não tiver pedidos claros, retorne itens: [].
- Nunca retorne texto fora do JSON.`;

    const body = {
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: "Extraia os itens deste pedido:" },
            { type: "image_url", image_url: { url: data.imageDataUrl } },
          ],
        },
      ],
      response_format: { type: "json_object" },
    };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify(body),
    });

    if (res.status === 429) throw new Error("Limite de requisições da IA atingido. Tente novamente em instantes.");
    if (res.status === 402) throw new Error("Créditos da IA esgotados. Adicione créditos no workspace.");
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`IA falhou (${res.status}): ${txt.slice(0, 200)}`);
    }

    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content ?? "{}";
    let parsed: {
      itens?: { nome: string; quantidade: number; preco_unitario: number }[];
      frete?: number;
      fornecedor_sugerido?: string | null;
      observacoes?: string | null;
    } = {};
    try {
      parsed = typeof content === "string" ? JSON.parse(content) : content;
    } catch {
      throw new Error("A IA não retornou JSON válido");
    }

    const itens: ItemExtraido[] = (parsed.itens ?? []).map((raw) => {
      const nome = String(raw.nome ?? "").trim();
      const nomeLower = nome.toLowerCase();
      let match = materiaisCatalog.find((m) => m.nome.toLowerCase() === nomeLower);
      let confianca: ItemExtraido["match_confianca"] = match ? "alta" : "nenhuma";
      if (!match && nome) {
        // fuzzy simples: substring / tokens
        const tokens = nomeLower.split(/\s+/).filter((t) => t.length > 2);
        match = materiaisCatalog.find((m) => {
          const l = m.nome.toLowerCase();
          return l.includes(nomeLower) || nomeLower.includes(l) ||
            tokens.every((t) => l.includes(t));
        });
        if (match) confianca = "media";
      }
      return {
        nome,
        quantidade: Number(raw.quantidade) || 0,
        preco_unitario: Number(raw.preco_unitario) || 0,
        material_id: match?.id ?? null,
        match_confianca: confianca,
      };
    });

    return {
      itens,
      frete: Number(parsed.frete) || 0,
      fornecedor_sugerido: parsed.fornecedor_sugerido ?? null,
      observacoes: parsed.observacoes ?? null,
    };
  });
