import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Pencil, Trash2, Package, AlertTriangle, Download } from "lucide-react";
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
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  Pagination, PaginationContent, PaginationItem, PaginationLink,
  PaginationNext, PaginationPrevious,
} from "@/components/ui/pagination";
import { fetchMateriais, type Material } from "@/lib/api";
import { exportEstoqueAtual } from "@/lib/exports";
import { supabase } from "@/integrations/supabase/client";

const CATEGORIAS = ["Hidráulica", "Elétrica", "Alvenaria", "Acabamento", "Estrutura", "Ferramentas", "Outros"];
const UNIDADES = ["Unidade", "Metro", "Kg", "Saco", "Litro", "Caixa", "Pacote"];

const materialSchema = z.object({
  nome: z.string().trim().min(1, "Obrigatório").max(120),
  categoria: z.string().min(1, "Obrigatório"),
  unidade: z.string().min(1, "Obrigatório"),
  quantidade_disponivel: z.coerce.number().int().min(0, "Deve ser ≥ 0"),
  estoque_minimo: z.coerce.number().int().min(0, "Deve ser ≥ 0"),
});
type MaterialForm = z.infer<typeof materialSchema>;

export const Route = createFileRoute("/_authenticated/estoque")({
  head: () => ({ meta: [{ title: "Estoque Central — ROCK Incorporadora" }] }),
  component: EstoquePage,
});

const PAGE_SIZE = 15;

function EstoquePage() {
  const qc = useQueryClient();
  const { data: materiais = [], isLoading } = useQuery({
    queryKey: ["materiais"], queryFn: fetchMateriais,
  });

  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Material | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Material | null>(null);

  const filtered = useMemo(() => {
    return materiais.filter((m) => {
      const matchSearch = m.nome.toLowerCase().includes(search.toLowerCase());
      const matchCat = filterCat === "all" || m.categoria === filterCat;
      return matchSearch && matchCat;
    });
  }, [materiais, search, filterCat]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const categorias = useMemo(
    () => Array.from(new Set([...CATEGORIAS, ...materiais.map((m) => m.categoria)])).sort(),
    [materiais],
  );

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("materiais").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Material excluído");
      qc.invalidateQueries({ queryKey: ["materiais"] });
      setDeleting(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Estoque Central</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            {materiais.length} {materiais.length === 1 ? "item cadastrado" : "itens cadastrados"}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => {
              if (materiais.length === 0) { toast.error("Nenhum item para exportar"); return; }
              exportEstoqueAtual(materiais);
              toast.success("Planilha gerada");
            }}
            className="flex-1 sm:flex-none"
          >
            <Download className="h-4 w-4" /> <span className="hidden xs:inline">Exportar </span>Excel
          </Button>
          <Button onClick={() => setCreating(true)} className="shadow-md flex-1 sm:flex-none">
            <Plus className="h-5 w-5" /> Novo Item
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9"
            />
          </div>
          <Select value={filterCat} onValueChange={(v) => { setFilterCat(v); setPage(1); }}>
            <SelectTrigger className="md:w-56"><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {categorias.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead className="text-right">Disponível</TableHead>
                <TableHead className="text-right">Mínimo</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <EmptyState onCreate={() => setCreating(true)} hasFilter={!!search || filterCat !== "all"} />
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((m) => {
                  const baixo = m.quantidade_disponivel <= m.estoque_minimo;
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.nome}</TableCell>
                      <TableCell><Badge variant="secondary">{m.categoria}</Badge></TableCell>
                      <TableCell className="text-muted-foreground">{m.unidade}</TableCell>
                      <TableCell className="text-right font-mono">{m.quantidade_disponivel}</TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">{m.estoque_minimo}</TableCell>
                      <TableCell className="text-center">
                        {baixo ? (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" /> Baixo
                          </Badge>
                        ) : (
                          <Badge className="bg-success text-success-foreground hover:bg-success/90">OK</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => setEditing(m)} aria-label="Editar">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setDeleting(m)} aria-label="Excluir"
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
        {totalPages > 1 && (
          <div className="p-3 border-t">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className={safePage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
                <PaginationItem>
                  <PaginationLink isActive>{safePage}</PaginationLink>
                </PaginationItem>
                <PaginationItem><span className="px-2 text-sm text-muted-foreground">de {totalPages}</span></PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className={safePage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </Card>

      <MaterialFormDialog
        open={creating || !!editing}
        onOpenChange={(o) => { if (!o) { setCreating(false); setEditing(null); } }}
        material={editing}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir material?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. <strong>{deleting?.nome}</strong> será removido do estoque.
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
    </div>
  );
}

function EmptyState({ onCreate, hasFilter }: { onCreate: () => void; hasFilter: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
      <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center">
        <Package className="h-10 w-10 text-muted-foreground" />
      </div>
      {hasFilter ? (
        <>
          <p className="text-muted-foreground">Nenhum material corresponde aos filtros.</p>
        </>
      ) : (
        <>
          <div>
            <h3 className="font-semibold">Nenhum material cadastrado ainda</h3>
            <p className="text-sm text-muted-foreground mt-1">Clique em "Novo Item" para começar a montar seu estoque.</p>
          </div>
          <Button onClick={onCreate}><Plus className="h-4 w-4" /> Novo Item</Button>
        </>
      )}
    </div>
  );
}

function MaterialFormDialog({
  open, onOpenChange, material,
}: { open: boolean; onOpenChange: (o: boolean) => void; material: Material | null }) {
  const qc = useQueryClient();
  const isEdit = !!material;

  const form = useForm<MaterialForm>({
    resolver: zodResolver(materialSchema),
    values: material ? {
      nome: material.nome,
      categoria: material.categoria,
      unidade: material.unidade,
      quantidade_disponivel: material.quantidade_disponivel,
      estoque_minimo: material.estoque_minimo,
    } : {
      nome: "", categoria: "", unidade: "",
      quantidade_disponivel: 0, estoque_minimo: 0,
    },
  });



  const mut = useMutation({
    retry: (failureCount, error: unknown) => {
      const msg = (error as Error)?.message?.toLowerCase() ?? "";
      const isNetwork = msg.includes("network") || msg.includes("fetch") || msg.includes("failed to fetch");
      return isNetwork && failureCount < 3;
    },
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 4000),
    mutationFn: async (values: MaterialForm) => {
      // Garante que a sessão esteja válida antes de enviar (evita NetworkError em token expirado)
      await supabase.auth.getSession();
      const payload = {
        nome: values.nome.trim(),
        categoria: values.categoria,
        unidade: values.unidade,
        quantidade_disponivel: Number(values.quantidade_disponivel) || 0,
        estoque_minimo: Number(values.estoque_minimo) || 0,
      };
      if (isEdit && material) {
        const { error } = await supabase.from("materiais").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", material.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("materiais").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Material atualizado" : "Material cadastrado");
      qc.invalidateQueries({ queryKey: ["materiais"] });
      onOpenChange(false);
      form.reset();
    },
    onError: (e: unknown) => toast.error((e as Error)?.message ?? "Erro ao salvar"),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setSugestao(null); onOpenChange(o); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Material" : "Novo Material"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Atualize os dados do material." : "Adicione um novo item ao estoque central."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mut.mutate(v))} className="space-y-4">
            <FormField control={form.control} name="nome" render={({ field }) => (
              <FormItem>
                <FormLabel>Nome</FormLabel>
                <div className="flex gap-2">
                  <FormControl><Input placeholder="Ex: Tubo Soldável 25mm" {...field} onChange={(e) => { field.onChange(e); setSugestao(null); }} /></FormControl>
                  <Button
                    type="button" variant="outline" size="icon"
                    title="Verificar com IA"
                    disabled={iaMut.isPending || !field.value?.trim()}
                    onClick={() => iaMut.mutate(field.value.trim())}
                  >
                    <Sparkles className={`h-4 w-4 ${iaMut.isPending ? "animate-pulse" : ""}`} />
                  </Button>
                </div>
                <FormMessage />
                {sugestao && (sugestao.houve_correcao || sugestao.duplicado_id) && (
                  <div className="mt-2 rounded-md border p-3 space-y-2 bg-muted/40">
                    {sugestao.duplicado_id ? (
                      <>
                        <div className="flex items-start gap-2 text-sm">
                          <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                          <div>
                            <p className="font-medium">Possível duplicata detectada</p>
                            <p className="text-muted-foreground">
                              Já existe: <span className="font-medium text-foreground">{sugestao.duplicado_nome}</span>
                            </p>
                            {sugestao.explicacao && <p className="text-xs text-muted-foreground mt-1">{sugestao.explicacao}</p>}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => setSugestao(null)}>
                            <X className="h-3 w-3" /> Cadastrar mesmo assim
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-start gap-2 text-sm">
                          <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                          <div>
                            <p className="font-medium">Sugestão de correção</p>
                            <p className="text-muted-foreground">
                              <span className="line-through">{field.value}</span> →{" "}
                              <span className="font-medium text-foreground">{sugestao.nome_corrigido}</span>
                            </p>
                            {sugestao.explicacao && <p className="text-xs text-muted-foreground mt-1">{sugestao.explicacao}</p>}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button type="button" size="sm" onClick={() => { field.onChange(sugestao.nome_corrigido); setSugestao(null); }}>
                            <Check className="h-3 w-3" /> Usar sugestão
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => setSugestao(null)}>
                            <X className="h-3 w-3" /> Ignorar
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="categoria" render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoria</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="unidade" render={({ field }) => (
                <FormItem>
                  <FormLabel>Unidade</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {UNIDADES.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="quantidade_disponivel" render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantidade</FormLabel>
                  <FormControl><Input type="number" min={0} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="estoque_minimo" render={({ field }) => (
                <FormItem>
                  <FormLabel>Estoque mínimo</FormLabel>
                  <FormControl><Input type="number" min={0} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={mut.isPending}>
                {mut.isPending ? "Salvando..." : isEdit ? "Salvar" : "Cadastrar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
