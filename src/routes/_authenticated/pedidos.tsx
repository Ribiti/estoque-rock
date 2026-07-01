import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Eye, Trash2, Download, ShoppingCart, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  fetchFornecedores, fetchMateriais, fetchPedidosCompra,
  formatBRL, formatPedidoNumero,
  type Material, type Fornecedor, type PedidoCompraComRefs, type PedidoStatus,
} from "@/lib/api";
import { exportPedidos } from "@/lib/exports";
import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export const Route = createFileRoute("/_authenticated/pedidos")({
  head: () => ({ meta: [{ title: "Pedidos de Compra — ROCK Incorporadora" }] }),
  component: PedidosPage,
});

const STATUS_COLORS: Record<PedidoStatus, string> = {
  "Pendente": "bg-yellow-500 text-white hover:bg-yellow-500/90",
  "Confirmado": "bg-blue-500 text-white hover:bg-blue-500/90",
  "Em Trânsito": "bg-orange-500 text-white hover:bg-orange-500/90",
  "Entregue": "bg-success text-success-foreground hover:bg-success/90",
};

const NEXT_STATUS: Record<PedidoStatus, PedidoStatus | null> = {
  "Pendente": "Confirmado",
  "Confirmado": "Em Trânsito",
  "Em Trânsito": "Entregue",
  "Entregue": null,
};

function PedidosPage() {
  const qc = useQueryClient();
  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ["pedidos_compra"], queryFn: fetchPedidosCompra,
  });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<PedidoCompraComRefs | null>(null);
  const [deleting, setDeleting] = useState<PedidoCompraComRefs | null>(null);
  const [confirmDeliver, setConfirmDeliver] = useState<PedidoCompraComRefs | null>(null);

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return pedidos.filter((p) => {
      const matchSearch = !s ||
        formatPedidoNumero(p.numero).toLowerCase().includes(s) ||
        (p.fornecedor?.nome ?? "").toLowerCase().includes(s) ||
        p.itens.some((i) => (i.material?.nome ?? "").toLowerCase().includes(s));
      const matchStatus = statusFilter === "all" || p.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [pedidos, search, statusFilter]);

  const statusMut = useMutation({
    mutationFn: async ({ pedido, status }: { pedido: PedidoCompraComRefs; status: PedidoStatus }) => {
      if (status === "Entregue") {
        const { error } = await db.rpc("entregar_pedido", { p_pedido_id: pedido.id });
        if (error) throw error;
      } else {
        const { error } = await db.from("pedidos_compra").update({ status }).eq("id", pedido.id);
        if (error) throw error;
      }
    },
    onSuccess: (_d, { status }) => {
      toast.success(status === "Entregue" ? "Pedido entregue — estoque atualizado" : `Status: ${status}`);
      qc.invalidateQueries({ queryKey: ["pedidos_compra"] });
      qc.invalidateQueries({ queryKey: ["materiais"] });
      qc.invalidateQueries({ queryKey: ["movimentacoes"] });
      setConfirmDeliver(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("pedidos_compra").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pedido excluído");
      qc.invalidateQueries({ queryKey: ["pedidos_compra"] });
      setDeleting(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Pedidos de Compra</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            {pedidos.length} {pedidos.length === 1 ? "pedido" : "pedidos"}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => {
            if (pedidos.length === 0) { toast.error("Nada para exportar"); return; }
            exportPedidos(pedidos); toast.success("Planilha gerada");
          }} className="flex-1 sm:flex-none">
            <Download className="h-4 w-4" /> Excel
          </Button>
          <Button onClick={() => setCreating(true)} className="shadow-md flex-1 sm:flex-none">
            <Plus className="h-5 w-5" /> Novo Pedido
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por número, fornecedor ou material..."
              value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="md:w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="Pendente">Pendente</SelectItem>
              <SelectItem value="Confirmado">Confirmado</SelectItem>
              <SelectItem value="Em Trânsito">Em Trânsito</SelectItem>
              <SelectItem value="Entregue">Entregue</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Previsão</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7}>
                  <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                    <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                      <ShoppingCart className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground">Nenhum pedido encontrado</p>
                  </div>
                </TableCell></TableRow>
              ) : (
                filtered.map((p) => {
                  const next = NEXT_STATUS[p.status];
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono font-semibold">{formatPedidoNumero(p.numero)}</TableCell>
                      <TableCell>{p.fornecedor?.nome ?? "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(p.data_pedido).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-sm">
                        {p.data_entrega_prevista
                          ? new Date(p.data_entrega_prevista + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={STATUS_COLORS[p.status]}>{p.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">{formatBRL(p.total)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1 items-center">
                          {next && (
                            <Button size="sm" variant="outline"
                              onClick={() => next === "Entregue"
                                ? setConfirmDeliver(p)
                                : statusMut.mutate({ pedido: p, status: next })}
                            >→ {next}</Button>
                          )}
                          <Button size="icon" variant="ghost" onClick={() => setViewing(p)} aria-label="Ver">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setDeleting(p)} aria-label="Excluir"
                            className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <NovoPedidoDialog open={creating} onOpenChange={setCreating} />

      <PedidoDetalhesDialog pedido={viewing} onOpenChange={() => setViewing(null)} />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleting && deleteMut.mutate(deleting.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmDeliver} onOpenChange={(o) => !o && setConfirmDeliver(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Marcar como Entregue?</AlertDialogTitle>
            <AlertDialogDescription>
              As quantidades de cada item do pedido serão <strong>adicionadas ao Estoque Central</strong> e registradas em Movimentações. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDeliver && statusMut.mutate({ pedido: confirmDeliver, status: "Entregue" })}
            >Confirmar entrega</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Novo Pedido

type ItemDraft = {
  material: Material;
  quantidade: number;
  preco_unitario: number;
};

function NovoPedidoDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const { data: fornecedores = [] } = useQuery({ queryKey: ["fornecedores"], queryFn: fetchFornecedores });
  const { data: materiais = [] } = useQuery({ queryKey: ["materiais"], queryFn: fetchMateriais });
  const fornecedoresAtivos = useMemo(() => fornecedores.filter((f) => f.status === "Ativo"), [fornecedores]);

  const [fornecedorId, setFornecedorId] = useState("");
  const [itens, setItens] = useState<ItemDraft[]>([]);
  const [search, setSearch] = useState("");
  const [selMatId, setSelMatId] = useState<string>("");
  const [qty, setQty] = useState<number>(1);
  const [precoEdit, setPrecoEdit] = useState<number>(0);
  const [frete, setFrete] = useState<number>(0);
  const [obs, setObs] = useState("");
  const [previsao, setPrevisao] = useState<string>("");
  const [novoMatOpen, setNovoMatOpen] = useState(false);

  const fornecedor = fornecedoresAtivos.find((f) => f.id === fornecedorId);
  const selMat = materiais.find((m) => m.id === selMatId);

  useEffect(() => {
    if (!open) {
      setFornecedorId(""); setItens([]); setSearch(""); setSelMatId("");
      setQty(1); setPrecoEdit(0); setFrete(0); setObs(""); setPrevisao("");
    }
  }, [open]);

  useEffect(() => {
    if (selMat) setPrecoEdit(Number(selMat.preco_unitario) || 0);
  }, [selMat]);

  useEffect(() => {
    if (fornecedor) {
      const d = new Date();
      d.setDate(d.getDate() + (fornecedor.tempo_entrega_dias || 0));
      setPrevisao(d.toISOString().slice(0, 10));
    }
  }, [fornecedor]);

  const filteredMats = useMemo(() => {
    if (!search) return materiais.slice(0, 8);
    const s = search.toLowerCase();
    return materiais.filter((m) => m.nome.toLowerCase().includes(s)).slice(0, 8);
  }, [materiais, search]);

  const subtotal = itens.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0);
  const total = subtotal + Number(frete || 0);

  function addItem() {
    if (!selMat) { toast.error("Selecione um material"); return; }
    if (qty <= 0) { toast.error("Quantidade deve ser > 0"); return; }
    if (precoEdit <= 0) { toast.error("Preço deve ser > 0"); return; }
    if (itens.find((i) => i.material.id === selMat.id)) {
      toast.error("Material já adicionado"); return;
    }
    setItens([...itens, { material: selMat, quantidade: qty, preco_unitario: precoEdit }]);
    setSelMatId(""); setQty(1); setPrecoEdit(0); setSearch("");
  }

  const createMut = useMutation({
    mutationFn: async () => {
      if (!fornecedorId) throw new Error("Selecione um fornecedor");
      if (itens.length === 0) throw new Error("Adicione ao menos 1 material");

      const { data: pedido, error } = await db
        .from("pedidos_compra")
        .insert({
          fornecedor_id: fornecedorId,
          data_entrega_prevista: previsao || null,
          frete,
          total,
          observacoes: obs || null,
          status: "Pendente",
        })
        .select("id")
        .single();
      if (error) throw error;

      const itensPayload = itens.map((i) => ({
        pedido_id: pedido.id,
        material_id: i.material.id,
        quantidade: i.quantidade,
        preco_unitario: i.preco_unitario,
        subtotal: i.quantidade * i.preco_unitario,
      }));
      const { error: e2 } = await db.from("pedidos_compra_itens").insert(itensPayload);
      if (e2) throw e2;
    },
    onSuccess: () => {
      toast.success("Pedido criado");
      qc.invalidateQueries({ queryKey: ["pedidos_compra"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Pedido de Compra</DialogTitle>
          <DialogDescription>Selecione fornecedor e adicione os materiais.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">


          <div>
            <label className="text-sm font-medium mb-1.5 block">Fornecedor *</label>
            <Select value={fornecedorId} onValueChange={setFornecedorId}>
              <SelectTrigger><SelectValue placeholder="Selecione um fornecedor ativo" /></SelectTrigger>
              <SelectContent>
                {fornecedoresAtivos.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">Nenhum fornecedor ativo</div>
                ) : fornecedoresAtivos.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.nome} <span className="text-muted-foreground text-xs">— {f.tempo_entrega_dias}d</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card className="p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Adicionar material</h3>
              <Button
                type="button" size="sm" variant="outline"
                onClick={() => setNovoMatOpen(true)}
                disabled={!fornecedorId}
                title={!fornecedorId ? "Selecione um fornecedor primeiro" : ""}
              >
                <Plus className="h-3.5 w-3.5" /> Cadastrar novo
              </Button>
            </div>
            <Input
              placeholder="Buscar material..."
              value={search} onChange={(e) => setSearch(e.target.value)}
            />
            {search && filteredMats.length === 0 && (
              <div className="rounded-md border border-dashed p-3 text-sm text-center space-y-2">
                <p className="text-muted-foreground">
                  Nenhum material encontrado para <strong>&ldquo;{search}&rdquo;</strong>
                </p>
                <Button
                  type="button" size="sm"
                  onClick={() => setNovoMatOpen(true)}
                  disabled={!fornecedorId}
                >
                  <Plus className="h-4 w-4" /> Cadastrar &ldquo;{search}&rdquo; no estoque
                </Button>
              </div>
            )}
            {filteredMats.length > 0 && (
              <div className="max-h-40 overflow-y-auto rounded-md border divide-y">
                {filteredMats.map((m) => (
                  <button
                    key={m.id} type="button"
                    onClick={() => setSelMatId(m.id)}
                    className={`w-full text-left px-3 py-2 text-sm flex justify-between items-center ${
                      selMatId === m.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                    }`}
                  >
                    <span className="font-medium truncate">{m.nome}</span>
                    <span className={`text-xs font-mono ${selMatId === m.id ? "" : "text-muted-foreground"}`}>
                      {formatBRL(Number(m.preco_unitario) || 0)}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {selMat && (
              <div className="grid grid-cols-3 gap-2 items-end">
                <div>
                  <label className="text-xs text-muted-foreground">Quantidade</label>
                  <Input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Preço Unit. (R$)</label>
                  <Input type="number" min={0} step="0.01" value={precoEdit}
                    onChange={(e) => setPrecoEdit(Number(e.target.value) || 0)} />
                </div>
                <Button type="button" onClick={addItem}>
                  <Plus className="h-4 w-4" /> Adicionar
                </Button>
              </div>
            )}
          </Card>

          <NovoMaterialRapidoDialog
            open={novoMatOpen}
            onOpenChange={setNovoMatOpen}
            fornecedorId={fornecedorId}
            nomeInicial={search}
            onCreated={(m) => {
              qc.setQueryData<Material[]>(["materiais"], (prev = []) => [...prev, m].sort((a, b) => a.nome.localeCompare(b.nome)));
              setSelMatId(m.id);
              setPrecoEdit(Number(m.preco_unitario) || 0);
              setSearch("");
              toast.success(`"${m.nome}" cadastrado no estoque`);
            }}
          />

          {itens.length > 0 && (
            <Card className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Preço</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itens.map((i, idx) => (
                    <TableRow key={i.material.id}>
                      <TableCell className="font-medium">{i.material.nome}</TableCell>
                      <TableCell className="text-right font-mono">{i.quantidade}</TableCell>
                      <TableCell className="text-right font-mono">{formatBRL(i.preco_unitario)}</TableCell>
                      <TableCell className="text-right font-mono">{formatBRL(i.quantidade * i.preco_unitario)}</TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost"
                          onClick={() => setItens(itens.filter((_, k) => k !== idx))}>
                          <X className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Frete / Taxa (R$)</label>
              <Input type="number" min={0} step="0.01" value={frete}
                onChange={(e) => setFrete(Number(e.target.value) || 0)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Entrega prevista</label>
              <Input type="date" value={previsao} onChange={(e) => setPrevisao(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Observações</label>
            <Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
          </div>

          <Card className="p-4 bg-muted/50">
            <div className="flex justify-between text-sm">
              <span>Subtotal</span><span className="font-mono">{formatBRL(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Frete</span><span className="font-mono">{formatBRL(frete)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold mt-2 pt-2 border-t">
              <span>TOTAL</span><span className="font-mono">{formatBRL(total)}</span>
            </div>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => createMut.mutate()} disabled={createMut.isPending}>
            {createMut.isPending ? "Criando..." : "Criar Pedido"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Detalhes

function PedidoDetalhesDialog({
  pedido, onOpenChange,
}: { pedido: PedidoCompraComRefs | null; onOpenChange: () => void }) {
  if (!pedido) return null;
  return (
    <Dialog open={!!pedido} onOpenChange={(o) => !o && onOpenChange()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            Pedido {formatPedidoNumero(pedido.numero)}
            <Badge className={STATUS_COLORS[pedido.status]}>{pedido.status}</Badge>
          </DialogTitle>
          <DialogDescription>
            {pedido.fornecedor?.nome} • Criado em {new Date(pedido.data_pedido).toLocaleString("pt-BR")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <InfoRow label="Fornecedor" value={pedido.fornecedor?.nome ?? "—"} />
            <InfoRow label="Telefone" value={pedido.fornecedor?.telefone ?? "—"} />
            <InfoRow label="Entrega Prevista"
              value={pedido.data_entrega_prevista
                ? new Date(pedido.data_entrega_prevista + "T00:00:00").toLocaleDateString("pt-BR") : "—"} />
            <InfoRow label="Entregue em"
              value={pedido.entregue_em ? new Date(pedido.entregue_em).toLocaleString("pt-BR") : "—"} />
          </div>

          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">Preço Unit.</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pedido.itens.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-medium">{i.material?.nome ?? "—"}</TableCell>
                    <TableCell className="text-right font-mono">{i.quantidade}</TableCell>
                    <TableCell className="text-right font-mono">{formatBRL(Number(i.preco_unitario))}</TableCell>
                    <TableCell className="text-right font-mono">{formatBRL(Number(i.subtotal))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <Card className="p-3 bg-muted/50 space-y-1 text-sm">
            <div className="flex justify-between"><span>Frete</span>
              <span className="font-mono">{formatBRL(Number(pedido.frete))}</span></div>
            <div className="flex justify-between text-lg font-bold pt-2 border-t">
              <span>TOTAL</span><span className="font-mono">{formatBRL(Number(pedido.total))}</span>
            </div>
          </Card>

          {pedido.observacoes && (
            <div className="text-sm">
              <p className="font-medium mb-1">Observações</p>
              <p className="text-muted-foreground whitespace-pre-wrap">{pedido.observacoes}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Cadastro rápido de material dentro do pedido

const CATEGORIAS_RAPIDAS = [
  "Hidráulica", "Elétrica", "Estrutural", "Acabamento",
  "Ferramentas", "EPI", "Pintura", "Outros",
];

const UNIDADES_RAPIDAS = ["un", "m", "m²", "m³", "kg", "L", "pç", "cx", "sc"];

function NovoMaterialRapidoDialog({
  open, onOpenChange, fornecedorId, nomeInicial, onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  fornecedorId: string;
  nomeInicial: string;
  onCreated: (m: Material) => void;
}) {
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("Outros");
  const [unidade, setUnidade] = useState("un");
  const [preco, setPreco] = useState<number>(0);
  const [estoqueMinimo, setEstoqueMinimo] = useState<number>(0);

  useEffect(() => {
    if (open) {
      setNome(nomeInicial.trim());
      setCategoria("Outros");
      setUnidade("un");
      setPreco(0);
      setEstoqueMinimo(0);
    }
  }, [open, nomeInicial]);

  const mut = useMutation({
    mutationFn: async () => {
      const nomeTrim = nome.trim();
      if (!nomeTrim) throw new Error("Nome obrigatório");
      if (!fornecedorId) throw new Error("Selecione um fornecedor primeiro");

      const { data: existing } = await db
        .from("materiais").select("id").ilike("nome", nomeTrim).maybeSingle();
      if (existing) throw new Error("Já existe um material com esse nome");

      const { data, error } = await db
        .from("materiais")
        .insert({
          nome: nomeTrim,
          categoria,
          unidade,
          preco_unitario: preco,
          estoque_minimo: estoqueMinimo,
          quantidade_disponivel: 0,
          fornecedor_id: fornecedorId,
        })
        .select("*")
        .single();
      if (error) throw error;
      return data as Material;
    },
    onSuccess: (m) => {
      onCreated(m);
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cadastrar novo material</DialogTitle>
          <DialogDescription>
            O material será adicionado ao Estoque Central com quantidade zero e vinculado ao fornecedor selecionado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Nome *</label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Categoria</label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS_RAPIDAS.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Unidade</label>
              <Select value={unidade} onValueChange={setUnidade}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNIDADES_RAPIDAS.map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Preço Unit. (R$)</label>
              <Input type="number" min={0} step="0.01" value={preco}
                onChange={(e) => setPreco(Number(e.target.value) || 0)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Estoque mínimo</label>
              <Input type="number" min={0} value={estoqueMinimo}
                onChange={(e) => setEstoqueMinimo(Number(e.target.value) || 0)} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending ? "Cadastrando..." : "Cadastrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

