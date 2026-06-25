import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";

import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const InputSchema = z.object({
  nome: z.string().trim().min(1).max(200),
  existentes: z.array(z.object({ id: z.string(), nome: z.string() })).max(500),
});

const OutputSchema = z.object({
  nome_corrigido: z.string().describe("Nome do material com grafia, acentuação e capitalização corretas em português brasileiro do setor de construção civil. Mantém especificações técnicas (medidas, bitolas)."),
  houve_correcao: z.boolean().describe("true se nome_corrigido difere do nome digitado"),
  duplicado_id: z.string().nullable().describe("ID do material existente que representa o MESMO item (mesma especificação), ou null"),
  duplicado_nome: z.string().nullable(),
  explicacao: z.string().describe("Explicação curta em pt-BR (máx 1 frase) da correção ou da duplicata detectada. Vazio se nada a relatar."),
});

export const verificarMaterialIA = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3-flash-preview");

    const lista = data.existentes.map((m) => `- [${m.id}] ${m.nome}`).join("\n") || "(nenhum)";

    const { experimental_output } = await generateText({
      model,
      experimental_output: Output.object({ schema: OutputSchema }),
      system:
        "Você é um assistente especialista em materiais de construção civil no Brasil. " +
        "Corrija erros de digitação, acentuação e capitalização em nomes de materiais (ex: 'tubi soldavl 25mm' -> 'Tubo Soldável 25mm'). " +
        "Preserve especificações (medidas, bitolas, marcas). " +
        "Detecte duplicatas comparando com a lista de itens já cadastrados, considerando variações de grafia, abreviações e sinônimos. " +
        "Só marque duplicado_id se for claramente o MESMO produto (mesma especificação técnica).",
      prompt:
        `Nome digitado pelo usuário: "${data.nome}"\n\n` +
        `Materiais já cadastrados:\n${lista}\n\n` +
        `Analise e retorne o JSON estruturado.`,
    });

    return experimental_output;
  });
