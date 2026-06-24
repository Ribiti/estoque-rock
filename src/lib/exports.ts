import ExcelJS from "exceljs";
import rockLogo from "@/assets/rock-logo.jpg.asset.json";
import type { Material, Obra, AlocacaoComMaterial, MovimentacaoComRefs } from "./api";

const BRAND = "ROCK Incorporadora";
const TAGLINE = "Controle de Estoque";

// Brand colors (ARGB)
const COLOR_PRIMARY = "FF0F3A45";       // deep teal
const COLOR_PRIMARY_DARK = "FF082229";
const COLOR_ACCENT = "FFE8A53A";        // warm amber
const COLOR_ACCENT_SOFT = "FFFBE9CC";
const COLOR_ZEBRA = "FFF4F7F8";
const COLOR_BORDER = "FFBFCBCF";
const COLOR_WHITE = "FFFFFFFF";
const COLOR_OK = "FF1E7A4D";
const COLOR_LOW = "FFB42318";
const COLOR_LOW_BG = "FFFDECEA";
const COLOR_OK_BG = "FFE7F5EE";

function formatDateBR(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("pt-BR");
}

function todayStamp() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function loadLogoBuffer(): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(rockLogo.url);
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

type Column = {
  header: string;
  key: string;
  width?: number;
  align?: "left" | "center" | "right";
  numFmt?: string;
};

type SheetSpec = {
  name: string;
  title: string;
  subtitle?: string;
  columns: Column[];
  rows: Record<string, string | number | null | undefined>[];
  statusKey?: string; // optional key to color rows
};

async function addBrandedSheet(wb: ExcelJS.Workbook, spec: SheetSpec, logo: ArrayBuffer | null) {
  const ws = wb.addWorksheet(spec.name, {
    views: [{ state: "frozen", ySplit: 6 }],
    properties: { defaultRowHeight: 18 },
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } },
  });

  const colCount = spec.columns.length;
  const lastColLetter = String.fromCharCode(64 + colCount);

  // Set column widths
  ws.columns = spec.columns.map((c) => ({ key: c.key, width: c.width ?? 18 }));

  // --- Header band (rows 1-4) ---
  ws.mergeCells(`A1:${lastColLetter}1`);
  ws.mergeCells(`A2:${lastColLetter}2`);
  ws.mergeCells(`A3:${lastColLetter}3`);
  ws.mergeCells(`A4:${lastColLetter}4`);

  const titleCell = ws.getCell("A1");
  titleCell.value = BRAND;
  titleCell.font = { name: "Calibri", size: 20, bold: true, color: { argb: COLOR_WHITE } };
  titleCell.alignment = { vertical: "middle", horizontal: "left", indent: 6 };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_PRIMARY } };
  ws.getRow(1).height = 36;

  const subCell = ws.getCell("A2");
  subCell.value = `${TAGLINE} — ${spec.title}`;
  subCell.font = { name: "Calibri", size: 12, bold: true, color: { argb: COLOR_WHITE } };
  subCell.alignment = { vertical: "middle", horizontal: "left", indent: 6 };
  subCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_PRIMARY_DARK } };
  ws.getRow(2).height = 22;

  const metaCell = ws.getCell("A3");
  metaCell.value = `${spec.subtitle ? spec.subtitle + "  •  " : ""}Gerado em ${new Date().toLocaleString("pt-BR")}`;
  metaCell.font = { name: "Calibri", size: 10, italic: true, color: { argb: COLOR_PRIMARY_DARK } };
  metaCell.alignment = { vertical: "middle", horizontal: "left", indent: 6 };
  metaCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_ACCENT_SOFT } };
  ws.getRow(3).height = 18;

  // Accent stripe
  const stripe = ws.getCell("A4");
  stripe.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_ACCENT } };
  ws.getRow(4).height = 4;

  // Logo (top-right of header band)
  if (logo) {
    const imgId = wb.addImage({ buffer: logo as ArrayBuffer, extension: "jpeg" });
    ws.addImage(imgId, {
      tl: { col: colCount - 1.05, row: 0.15 },
      ext: { width: 64, height: 64 },
      editAs: "oneCell",
    });
  }

  // Empty spacer row 5
  ws.getRow(5).height = 6;

  // --- Column headers (row 6) ---
  const headerRow = ws.getRow(6);
  spec.columns.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = c.header;
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: COLOR_WHITE } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_PRIMARY } };
    cell.alignment = { vertical: "middle", horizontal: c.align ?? "left", indent: 1 };
    cell.border = {
      top: { style: "thin", color: { argb: COLOR_PRIMARY_DARK } },
      bottom: { style: "medium", color: { argb: COLOR_ACCENT } },
      left: { style: "thin", color: { argb: COLOR_PRIMARY_DARK } },
      right: { style: "thin", color: { argb: COLOR_PRIMARY_DARK } },
    };
  });
  headerRow.height = 26;

  // --- Data rows ---
  spec.rows.forEach((r, idx) => {
    const rowNum = 7 + idx;
    const row = ws.getRow(rowNum);
    const zebra = idx % 2 === 1;
    spec.columns.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      cell.value = (r[c.key] ?? "") as string | number;
      cell.font = { name: "Calibri", size: 10, color: { argb: "FF1C2A2E" } };
      cell.alignment = { vertical: "middle", horizontal: c.align ?? "left", indent: 1, wrapText: true };
      if (c.numFmt) cell.numFmt = c.numFmt;
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: zebra ? COLOR_ZEBRA : COLOR_WHITE },
      };
      cell.border = {
        top: { style: "hair", color: { argb: COLOR_BORDER } },
        bottom: { style: "hair", color: { argb: COLOR_BORDER } },
        left: { style: "hair", color: { argb: COLOR_BORDER } },
        right: { style: "hair", color: { argb: COLOR_BORDER } },
      };
    });

    // Status coloring
    if (spec.statusKey) {
      const status = String(r[spec.statusKey] ?? "");
      const statusCol = spec.columns.findIndex((c) => c.key === spec.statusKey) + 1;
      if (statusCol > 0) {
        const cell = row.getCell(statusCol);
        const isLow = /baixo/i.test(status);
        cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: isLow ? COLOR_LOW : COLOR_OK } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: isLow ? COLOR_LOW_BG : COLOR_OK_BG } };
        cell.alignment = { vertical: "middle", horizontal: "center" };
      }
    }
    row.height = 20;
  });

  // Footer
  const footerRow = ws.getRow(7 + spec.rows.length + 1);
  ws.mergeCells(`A${footerRow.number}:${lastColLetter}${footerRow.number}`);
  const footerCell = ws.getCell(`A${footerRow.number}`);
  footerCell.value = `${BRAND}  •  Total de registros: ${spec.rows.length}`;
  footerCell.font = { name: "Calibri", size: 9, italic: true, color: { argb: COLOR_PRIMARY_DARK } };
  footerCell.alignment = { vertical: "middle", horizontal: "right", indent: 2 };
  footerCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_ACCENT_SOFT } };
  footerRow.height = 18;

  return ws;
}

async function downloadWb(wb: ExcelJS.Workbook, filename: string) {
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf as ArrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function newWb() {
  const wb = new ExcelJS.Workbook();
  wb.creator = BRAND;
  wb.company = BRAND;
  wb.created = new Date();
  return wb;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public exports

export async function exportEstoqueAtual(materiais: Material[]) {
  const logo = await loadLogoBuffer();
  const wb = newWb();
  const rows = materiais.map((m) => ({
    nome: m.nome,
    categoria: m.categoria,
    unidade: m.unidade,
    disponivel: m.quantidade_disponivel,
    minimo: m.estoque_minimo,
    status: m.quantidade_disponivel <= m.estoque_minimo ? "Baixo" : "OK",
    atualizado: formatDateBR(m.updated_at),
  }));
  await addBrandedSheet(wb, {
    name: "Estoque",
    title: "Estoque Central",
    subtitle: `${materiais.length} materiais cadastrados`,
    columns: [
      { header: "Material", key: "nome", width: 32 },
      { header: "Categoria", key: "categoria", width: 18 },
      { header: "Unidade", key: "unidade", width: 12, align: "center" },
      { header: "Qtd. Disponível", key: "disponivel", width: 16, align: "right", numFmt: "#,##0" },
      { header: "Estoque Mínimo", key: "minimo", width: 16, align: "right", numFmt: "#,##0" },
      { header: "Status", key: "status", width: 14, align: "center" },
      { header: "Atualizado em", key: "atualizado", width: 20, align: "center" },
    ],
    rows,
    statusKey: "status",
  }, logo);
  await downloadWb(wb, `${BRAND}-Estoque-${todayStamp()}.xlsx`);
}

const TIPO_LABEL: Record<string, string> = {
  entrada: "Entrada",
  saida_obra: "Saída para obra",
  retorno_obra: "Retorno da obra",
  ajuste: "Ajuste",
};

export async function exportMovimentacoes(movs: MovimentacaoComRefs[]) {
  const logo = await loadLogoBuffer();
  const wb = newWb();
  const rows = movs.map((m) => ({
    data: formatDateBR(m.created_at),
    tipo: TIPO_LABEL[m.tipo] ?? m.tipo,
    material: m.material?.nome ?? "—",
    categoria: m.material?.categoria ?? "",
    unidade: m.material?.unidade ?? "",
    quantidade: m.quantidade,
    obra: m.obra?.nome ?? "—",
    obs: m.observacao ?? "",
  }));
  await addBrandedSheet(wb, {
    name: "Movimentações",
    title: "Histórico de Movimentações",
    subtitle: `${movs.length} movimentações`,
    columns: [
      { header: "Data", key: "data", width: 20, align: "center" },
      { header: "Tipo", key: "tipo", width: 18, align: "center" },
      { header: "Material", key: "material", width: 30 },
      { header: "Categoria", key: "categoria", width: 16 },
      { header: "Un.", key: "unidade", width: 8, align: "center" },
      { header: "Quantidade", key: "quantidade", width: 14, align: "right", numFmt: "#,##0" },
      { header: "Obra", key: "obra", width: 24 },
      { header: "Observação", key: "obs", width: 32 },
    ],
    rows,
  }, logo);
  await downloadWb(wb, `${BRAND}-Movimentacoes-${todayStamp()}.xlsx`);
}

export async function exportObra(obra: Obra, alocacoes: AlocacaoComMaterial[]) {
  const logo = await loadLogoBuffer();
  const wb = newWb();

  // Resumo
  const consolidado = new Map<string, { material: string; categoria: string; unidade: string; total: number }>();
  for (const a of alocacoes) {
    const cur = consolidado.get(a.material_id);
    if (cur) cur.total += a.quantidade;
    else
      consolidado.set(a.material_id, {
        material: a.material?.nome ?? "—",
        categoria: a.material?.categoria ?? "",
        unidade: a.material?.unidade ?? "",
        total: a.quantidade,
      });
  }
  const resumoRows = Array.from(consolidado.values())
    .sort((a, b) => a.material.localeCompare(b.material))
    .map((r) => ({ material: r.material, categoria: r.categoria, unidade: r.unidade, total: r.total }));

  await addBrandedSheet(wb, {
    name: "Resumo",
    title: `Obra: ${obra.nome}`,
    subtitle: "Consolidado por material",
    columns: [
      { header: "Material", key: "material", width: 32 },
      { header: "Categoria", key: "categoria", width: 18 },
      { header: "Unidade", key: "unidade", width: 12, align: "center" },
      { header: "Quantidade Total", key: "total", width: 18, align: "right", numFmt: "#,##0" },
    ],
    rows: resumoRows,
  }, logo);

  // Histórico
  const histRows = alocacoes.map((a) => ({
    data: formatDateBR(a.data_alocacao),
    material: a.material?.nome ?? "—",
    categoria: a.material?.categoria ?? "",
    unidade: a.material?.unidade ?? "",
    quantidade: a.quantidade,
  }));
  await addBrandedSheet(wb, {
    name: "Histórico",
    title: `Obra: ${obra.nome}`,
    subtitle: "Histórico de envios",
    columns: [
      { header: "Data", key: "data", width: 20, align: "center" },
      { header: "Material", key: "material", width: 32 },
      { header: "Categoria", key: "categoria", width: 18 },
      { header: "Un.", key: "unidade", width: 8, align: "center" },
      { header: "Quantidade", key: "quantidade", width: 14, align: "right", numFmt: "#,##0" },
    ],
    rows: histRows,
  }, logo);

  const safeName = obra.nome.replace(/[^a-zA-Z0-9-_ ]/g, "").slice(0, 40);
  await downloadWb(wb, `${BRAND}-Obra-${safeName}-${todayStamp()}.xlsx`);
}
