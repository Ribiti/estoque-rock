import * as XLSX from "xlsx";
import type { Material, Obra, AlocacaoComMaterial } from "./api";
import type { MovimentacaoComRefs } from "./api";

const BRAND = "ROCK Incorporadora";

function formatDateBR(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("pt-BR");
}

function autoWidth(rows: (string | number)[][], header: string[]) {
  const widths = header.map((h, i) => {
    const max = rows.reduce(
      (m, r) => Math.max(m, String(r[i] ?? "").length),
      h.length,
    );
    return { wch: Math.min(Math.max(max + 2, 10), 50) };
  });
  return widths;
}

function buildSheet(title: string, header: string[], rows: (string | number)[][]) {
  const aoa: (string | number)[][] = [
    [BRAND],
    [title],
    [`Gerado em: ${new Date().toLocaleString("pt-BR")}`],
    [],
    header,
    ...rows,
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = autoWidth(rows, header);
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: header.length - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: header.length - 1 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: header.length - 1 } },
  ];
  // Freeze header row
  ws["!freeze"] = { xSplit: 0, ySplit: 5 };
  // Style the title and header (xlsx basic styling)
  const styleTitle = { font: { bold: true, sz: 16 }, alignment: { horizontal: "center" } };
  const styleSub = { font: { italic: true, sz: 11 }, alignment: { horizontal: "center" } };
  const styleHeader = {
    font: { bold: true, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "1F4F58" } },
    alignment: { horizontal: "center" },
  };
  const a1 = ws["A1"]; if (a1) (a1 as any).s = styleTitle;
  const a2 = ws["A2"]; if (a2) (a2 as any).s = styleTitle;
  const a3 = ws["A3"]; if (a3) (a3 as any).s = styleSub;
  for (let c = 0; c < header.length; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: 4, c })];
    if (cell) (cell as any).s = styleHeader;
  }
  return ws;
}

function downloadWorkbook(wb: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(wb, filename);
}

function todayStamp() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function exportEstoqueAtual(materiais: Material[]) {
  const header = ["Material", "Categoria", "Unidade", "Qtd. Disponível", "Estoque Mínimo", "Status", "Atualizado em"];
  const rows = materiais.map((m) => [
    m.nome,
    m.categoria,
    m.unidade,
    m.quantidade_disponivel,
    m.estoque_minimo,
    m.quantidade_disponivel <= m.estoque_minimo ? "Baixo" : "OK",
    formatDateBR(m.updated_at),
  ]);
  const ws = buildSheet("Estoque Central", header, rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Estoque");
  downloadWorkbook(wb, `${BRAND}-Estoque-${todayStamp()}.xlsx`);
}

const TIPO_LABEL: Record<string, string> = {
  entrada: "Entrada",
  saida_obra: "Saída para obra",
  retorno_obra: "Retorno da obra",
  ajuste: "Ajuste",
};

export function exportMovimentacoes(movs: MovimentacaoComRefs[]) {
  const header = ["Data", "Tipo", "Material", "Categoria", "Unidade", "Quantidade", "Obra", "Observação"];
  const rows = movs.map((m) => [
    formatDateBR(m.created_at),
    TIPO_LABEL[m.tipo] ?? m.tipo,
    m.material?.nome ?? "—",
    m.material?.categoria ?? "",
    m.material?.unidade ?? "",
    m.quantidade,
    m.obra?.nome ?? "—",
    m.observacao ?? "",
  ]);
  const ws = buildSheet("Histórico de Movimentações", header, rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Movimentações");
  downloadWorkbook(wb, `${BRAND}-Movimentacoes-${todayStamp()}.xlsx`);
}

export function exportObra(obra: Obra, alocacoes: AlocacaoComMaterial[]) {
  // Sheet 1: Resumo por material (consolidado)
  const consolidadoMap = new Map<string, { material: string; categoria: string; unidade: string; total: number }>();
  for (const a of alocacoes) {
    const key = a.material_id;
    const cur = consolidadoMap.get(key);
    if (cur) {
      cur.total += a.quantidade;
    } else {
      consolidadoMap.set(key, {
        material: a.material?.nome ?? "—",
        categoria: a.material?.categoria ?? "",
        unidade: a.material?.unidade ?? "",
        total: a.quantidade,
      });
    }
  }
  const resumoHeader = ["Material", "Categoria", "Unidade", "Quantidade Total"];
  const resumoRows = Array.from(consolidadoMap.values())
    .sort((a, b) => a.material.localeCompare(b.material))
    .map((r) => [r.material, r.categoria, r.unidade, r.total]);
  const wsResumo = buildSheet(`Obra: ${obra.nome} — Resumo`, resumoHeader, resumoRows);

  // Sheet 2: Histórico de envios
  const histHeader = ["Data", "Material", "Categoria", "Unidade", "Quantidade"];
  const histRows = alocacoes.map((a) => [
    formatDateBR(a.data_alocacao),
    a.material?.nome ?? "—",
    a.material?.categoria ?? "",
    a.material?.unidade ?? "",
    a.quantidade,
  ]);
  const wsHist = buildSheet(`Obra: ${obra.nome} — Histórico de envios`, histHeader, histRows);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");
  XLSX.utils.book_append_sheet(wb, wsHist, "Histórico");
  const safeName = obra.nome.replace(/[^a-zA-Z0-9-_ ]/g, "").slice(0, 40);
  downloadWorkbook(wb, `${BRAND}-Obra-${safeName}-${todayStamp()}.xlsx`);
}
