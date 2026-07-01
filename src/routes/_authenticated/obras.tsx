import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, HardHat, Send, Package, CheckCircle2, Trash2, Download, PackagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  alocarMaterial, fetchAlocacoesPorObra, fetchMateriais, fetchObras,
  type Obra,
} from "@/lib/api";
import { exportObra } from "@/lib/exports";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/obras")({
  head: () => ({ meta: [{ title: "Obras — ROCK Incorporadora" }] }),
  component: ObrasPage,
});

function ObrasPage() {
  const qc = useQueryClient();
  const { data: obras = [], isLoading } = useQuery({ queryKey: ["obras"], queryFn: fetchObras });
  const obrasAtivas = useMemo(() => obras.filter((o) => o.status === "Ativa"), [obras]);

  const [activeObraId, setActiveObraId] = useState<string | null>(null);
  const [creatingObra, setCreatingObra] = useState(false);

  useEffect(() => {
    if (!activeObraId && obrasAtivas.length > 0) setActiveObraId(obrasAtivas[0].id);
    if (activeObraId && !obrasAtivas.find((o) => o.id === activeObraId)) {
      setActiveObraId(obrasAtivas[0]?.id ?? null);
    }
  }, [obrasAtivas, activeObraId]);

  const concluirMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("obras").update({ status: "Concluída" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Obra marcada como concluída");
      qc.invalidateQueries({ queryKey: ["obras"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const activeObra = obrasAtivas.find((o) => o.id === activeObraId) ?? null;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Controle por Obras</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Envie materiais do estoque central para cada obra.
          </p>
        </div>
      </div>

      {isLoading ? (
        <Card className="p-12 text-center text-muted-foreground">Carregando...</Card>
      ) : obrasAtivas.length === 0 ? (
        <Card className="p-12 flex flex-col items-center text-center gap-4">
          <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center">
            <HardHat className="h-10 w-10 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-semibold">Nenhuma obra ativa</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Cadastre uma obra para começar a alocar materiais.
            </p>
          </div>
          <Button onClick={() => setCreatingObra(true)}>
            <Plus className="h-4 w-4" /> Nova Obra
          </Button>
        </Card>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {obrasAtivas.map((o) => (
              <button
                key={o.id}
                onClick={() => setActiveObraId(o.id)}
                className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors border ${
                  activeObraId === o.id
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-card text-foreground border-border hover:bg-muted"
                }`}
              >
                {o.nome}
              </button>
            ))}
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCreatingObra(true)}
              aria-label="Nova obra"
              className="shrink-0 border-dashed"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {activeObra && (
            <ObraPanel obra={activeObra} onConcluir={() => concluirMut.mutate(activeObra.id)} />
          )}
        </>
      )}

      <NovaObraDialog
        open={creatingObra}
        onOpenChange={setCreatingObra}
        onCreated={(id) => setActiveObraId(id)}
      />
    </div>
  );
}

function ObraPanel({ obra, onConcluir }: { obra: Obra; onConcluir: () => void }) {
  const qc = useQueryClient();
  const { data: alocacoes = [], isLoading } = useQuery({
    queryKey: ["alocacoes", obra.id],
    queryFn: () => fetchAlocacoesPorObra(obra.id),
  });
  const [alocarOpen, setAlocarOpen] = useState(false);
  const [loteOpen, setLoteOpen] = useState(false);

  const removerMut = useMutation({
    mutationFn: async (alocacao: { id: string; material_id: string; quantidade: number }) => {
      // Devolve quantidade ao estoque e remove alocação
      const { data: mat, error: e1 } = await supabase
        .from("materiais").select("quantidade_disponivel").eq("id", alocacao.material_id).maybeSingle();
      if (e1) throw e1;
      const { error: e2 } = await supabase
        .from("materiais")
        .update({ quantidade_disponivel: (mat?.quantidade_disponivel ?? 0) + alocacao.quantidade })
        .eq("id", alocacao.material_id);
      if (e2) throw e2;
      const { error: e3 } = await supabase.from("alocacoes").delete().eq("id", alocacao.id);
      if (e3) throw e3;
      // Registrar movimentação de retorno
      await supabase.from("movimentacoes").insert({
        material_id: alocacao.material_id,
        obra_id: obra.id,
        tipo: "retorno_obra",
        quantidade: alocacao.quantidade,
        observacao: `Retorno da obra ${obra.nome}`,
      });
    },
    onSuccess: () => {
      toast.success("Alocação revertida ao estoque");
      qc.invalidateQueries({ queryKey: ["alocacoes", obra.id] });
      qc.invalidateQueries({ queryKey: ["materiais"] });
      qc.invalidateQueries({ queryKey: ["movimentacoes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <div className="p-4 sm:p-5 flex flex-col gap-3 border-b">
        <div className="min-w-0">
          <h2 className="text-lg sm:text-xl font-semibold truncate">{obra.nome}</h2>
          <p className="text-sm text-muted-foreground">
            {alocacoes.length} {alocacoes.length === 1 ? "alocação registrada" : "alocações registradas"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (alocacoes.length === 0) { toast.error("Nenhum envio para exportar"); return; }
              exportObra(obra, alocacoes);
              toast.success("Planilha gerada");
            }}
          >
            <Download className="h-4 w-4" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={onConcluir}>
            <CheckCircle2 className="h-4 w-4" /> Concluir
          </Button>
          <Button size="sm" variant="outline" onClick={() => setLoteOpen(true)} className="ml-auto">
            <PackagePlus className="h-4 w-4" /> Envio em Lote
          </Button>
          <Button size="sm" onClick={() => setAlocarOpen(true)} className="shadow-md">
            <Send className="h-4 w-4" /> Enviar Material
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Material</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-right">Quantidade</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : alocacoes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                    <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                      <Package className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Nenhum material enviado ainda</h3>
                      <p className="text-sm text-muted-foreground mt-1">Clique em "Enviar Material" para alocar itens do estoque.</p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              alocacoes.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.material?.nome ?? "—"}</TableCell>
                  <TableCell>
                    {a.material?.categoria && <Badge variant="secondary">{a.material.categoria}</Badge>}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {a.quantidade} {a.material?.unidade}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(a.data_alocacao).toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="icon" variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => removerMut.mutate({ id: a.id, material_id: a.material_id, quantidade: a.quantidade })}
                      aria-label="Reverter alocação"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AlocarMaterialDialog open={alocarOpen} onOpenChange={setAlocarOpen} obra={obra} />
      <EnvioLoteDialog open={loteOpen} onOpenChange={setLoteOpen} obra={obra} />
    </Card>
  );
}

const alocSchema = z.object({
  material_id: z.string().min(1, "Selecione um material"),
  quantidade: z.coerce.number().int().positive("Quantidade deve ser > 0"),
});
type AlocForm = z.infer<typeof alocSchema>;

function AlocarMaterialDialog({
  open, onOpenChange, obra,
}: { open: boolean; onOpenChange: (o: boolean) => void; obra: Obra }) {
  const qc = useQueryClient();
  const { data: materiais = [] } = useQuery({ queryKey: ["materiais"], queryFn: fetchMateriais });
  const [search, setSearch] = useState("");

  const form = useForm<AlocForm>({
    resolver: zodResolver(alocSchema),
    defaultValues: { material_id: "", quantidade: 1 },
  });

  useEffect(() => { if (!open) { form.reset({ material_id: "", quantidade: 1 }); setSearch(""); } }, [open, form]);

  const selectedId = form.watch("material_id");
  const selected = materiais.find((m) => m.id === selectedId);

  const filteredMats = useMemo(
    () => materiais.filter((m) => m.nome.toLowerCase().includes(search.toLowerCase())),
    [materiais, search],
  );

  const mut = useMutation({
    mutationFn: async (v: AlocForm) => {
      const mat = materiais.find((m) => m.id === v.material_id);
      if (!mat) throw new Error("Material não encontrado");
      if (v.quantidade > mat.quantidade_disponivel) {
        throw new Error(`Estoque insuficiente. Disponível: ${mat.quantidade_disponivel} ${mat.unidade}`);
      }
      await alocarMaterial({ obra_id: obra.id, material_id: v.material_id, quantidade: v.quantidade });
    },
    onSuccess: () => {
      toast.success("Material enviado para a obra");
      qc.invalidateQueries({ queryKey: ["alocacoes", obra.id] });
      qc.invalidateQueries({ queryKey: ["materiais"] });
      qc.invalidateQueries({ queryKey: ["movimentacoes"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enviar material para {obra.nome}</DialogTitle>
          <DialogDescription>Selecione um item do estoque central e informe a quantidade.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mut.mutate(v))} className="space-y-4">



            <FormField control={form.control} name="material_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Buscar material</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Digite o nome do material..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    autoFocus
                  />
                </FormControl>
                <div className="mt-2 max-h-56 overflow-y-auto rounded-md border divide-y">
                  {filteredMats.length === 0 ? (
                    <div className="p-3 text-sm text-muted-foreground text-center">
                      Nenhum material encontrado
                    </div>
                  ) : (
                    filteredMats.map((m) => {
                      const disabled = m.quantidade_disponivel === 0;
                      const active = field.value === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          disabled={disabled}
                          onClick={() => field.onChange(m.id)}
                          className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-3 transition-colors ${
                            active
                              ? "bg-primary text-primary-foreground"
                              : "hover:bg-muted"
                          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
                        >
                          <span className="font-medium truncate">{m.nome}</span>
                          <span className={`font-mono text-xs whitespace-nowrap ${active ? "" : "text-muted-foreground"}`}>
                            {m.quantidade_disponivel} {m.unidade}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
                <FormMessage />
              </FormItem>
            )} />


            {selected && (
              <div className="rounded-md bg-muted p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Disponível em estoque</span>
                  <span className="font-mono font-semibold">{selected.quantidade_disponivel} {selected.unidade}</span>
                </div>
              </div>
            )}

            <FormField control={form.control} name="quantidade" render={({ field }) => (
              <FormItem>
                <FormLabel>Quantidade a enviar</FormLabel>
                <FormControl>
                  <Input type="number" min={1} max={selected?.quantidade_disponivel ?? undefined} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={mut.isPending}>
                {mut.isPending ? "Enviando..." : "Confirmar envio"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

const obraSchema = z.object({ nome: z.string().trim().min(1, "Obrigatório").max(120) });
type ObraForm = z.infer<typeof obraSchema>;

function NovaObraDialog({
  open, onOpenChange, onCreated,
}: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (id: string) => void }) {
  const qc = useQueryClient();
  const form = useForm<ObraForm>({ resolver: zodResolver(obraSchema), defaultValues: { nome: "" } });

  const mut = useMutation({
    mutationFn: async (v: ObraForm) => {
      const { data, error } = await supabase
        .from("obras").insert({ nome: v.nome, status: "Ativa" }).select("id").single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      toast.success("Obra criada");
      qc.invalidateQueries({ queryKey: ["obras"] });
      form.reset();
      onOpenChange(false);
      onCreated(id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova Obra</DialogTitle>
          <DialogDescription>Cadastre uma obra ativa para receber materiais.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mut.mutate(v))} className="space-y-4">
            <FormField control={form.control} name="nome" render={({ field }) => (
              <FormItem>
                <FormLabel>Nome da obra</FormLabel>
                <FormControl><Input placeholder="Ex: Edifício Alpha" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={mut.isPending}>
                {mut.isPending ? "Criando..." : "Criar obra"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Envio em Lote

type LoteItem = {
  material_id: string;
  nome: string;
  unidade: string;
  disponivel: number;
  quantidade: number;
};

function EnvioLoteDialog({
  open, onOpenChange, obra,
}: { open: boolean; onOpenChange: (o: boolean) => void; obra: Obra }) {
  const qc = useQueryClient();
  const { data: materiais = [] } = useQuery({ queryKey: ["materiais"], queryFn: fetchMateriais });
  const [search, setSearch] = useState("");
  const [itens, setItens] = useState<LoteItem[]>([]);

  useEffect(() => { if (!open) { setSearch(""); setItens([]); } }, [open]);

  const disponiveis = useMemo(() => {
    const s = search.toLowerCase();
    return materiais
      .filter((m) => !itens.find((i) => i.material_id === m.id))
      .filter((m) => !s || m.nome.toLowerCase().includes(s))
      .slice(0, 8);
  }, [materiais, search, itens]);

  function addItem(m: typeof materiais[number]) {
    if (m.quantidade_disponivel <= 0) { toast.error(`${m.nome} sem estoque`); return; }
    setItens([...itens, {
      material_id: m.id, nome: m.nome, unidade: m.unidade,
      disponivel: m.quantidade_disponivel, quantidade: 1,
    }]);
    setSearch("");
  }

  function updateQty(id: string, q: number) {
    setItens(itens.map((i) => i.material_id === id ? { ...i, quantidade: q } : i));
  }

  function removeItem(id: string) {
    setItens(itens.filter((i) => i.material_id !== id));
  }

  const mut = useMutation({
    mutationFn: async () => {
      if (itens.length === 0) throw new Error("Adicione ao menos 1 material");
      for (const i of itens) {
        if (i.quantidade <= 0) throw new Error(`Quantidade inválida para ${i.nome}`);
        if (i.quantidade > i.disponivel) {
          throw new Error(`${i.nome}: estoque insuficiente (disp: ${i.disponivel})`);
        }
      }
      for (const i of itens) {
        await alocarMaterial({
          obra_id: obra.id, material_id: i.material_id, quantidade: i.quantidade,
        });
      }
    },
    onSuccess: () => {
      toast.success(`${itens.length} ${itens.length === 1 ? "material enviado" : "materiais enviados"} para ${obra.nome}`);
      qc.invalidateQueries({ queryKey: ["alocacoes", obra.id] });
      qc.invalidateQueries({ queryKey: ["materiais"] });
      qc.invalidateQueries({ queryKey: ["movimentacoes"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Envio em Lote — {obra.nome}</DialogTitle>
          <DialogDescription>
            Adicione vários materiais de uma só vez. Cada item é validado contra o estoque disponível.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Card className="p-3 space-y-2">
            <label className="text-sm font-medium">Adicionar material</label>
            <Input placeholder="Buscar por nome..." value={search} onChange={(e) => setSearch(e.target.value)} />
            {disponiveis.length > 0 && (
              <div className="max-h-40 overflow-y-auto rounded-md border divide-y">
                {disponiveis.map((m) => (
                  <button
                    key={m.id} type="button"
                    disabled={m.quantidade_disponivel === 0}
                    onClick={() => addItem(m)}
                    className="w-full text-left px-3 py-2 text-sm flex justify-between items-center hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="font-medium truncate">{m.nome}</span>
                    <span className="text-xs font-mono text-muted-foreground">
                      {m.quantidade_disponivel} {m.unidade}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </Card>

          {itens.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              Nenhum item selecionado ainda.
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material</TableHead>
                    <TableHead className="text-right">Disponível</TableHead>
                    <TableHead className="w-32">Quantidade</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itens.map((i) => {
                    const invalid = i.quantidade <= 0 || i.quantidade > i.disponivel;
                    return (
                      <TableRow key={i.material_id}>
                        <TableCell className="font-medium">{i.nome}</TableCell>
                        <TableCell className="text-right font-mono text-sm text-muted-foreground">
                          {i.disponivel} {i.unidade}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number" min={1} max={i.disponivel}
                            value={i.quantidade}
                            onChange={(e) => updateQty(i.material_id, Number(e.target.value) || 0)}
                            className={invalid ? "border-destructive" : ""}
                          />
                        </TableCell>
                        <TableCell>
                          <Button size="icon" variant="ghost" onClick={() => removeItem(i.material_id)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || itens.length === 0}>
            {mut.isPending ? "Enviando..." : `Enviar ${itens.length} ${itens.length === 1 ? "item" : "itens"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

