import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Pencil, Trash2, Truck, Download } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

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
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { fetchFornecedores, type Fornecedor } from "@/lib/api";
import { exportFornecedores } from "@/lib/exports";
import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export const Route = createFileRoute("/_authenticated/fornecedores")({
  head: () => ({ meta: [{ title: "Fornecedores — ROCK Incorporadora" }] }),
  component: FornecedoresPage,
});

const phoneRegex = /^\(\d{2}\)\s9\d{4}-\d{4}$/;
const cnpjRegex = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/;

const schema = z.object({
  nome: z.string().trim().min(1, "Obrigatório").max(120),
  telefone: z.string().regex(phoneRegex, "Formato: (XX) 9XXXX-XXXX"),
  tempo_entrega_dias: z.coerce.number().int().min(0),
  endereco: z.string().max(200).optional().or(z.literal("")),
  cnpj: z.string().optional().or(z.literal("")).refine(
    (v) => !v || cnpjRegex.test(v),
    "Formato: 00.000.000/0000-00",
  ),
  status: z.enum(["Ativo", "Inativo"]),
  observacoes: z.string().max(500).optional().or(z.literal("")),
});
type FormValues = z.infer<typeof schema>;

function formatPhone(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
function formatCNPJ(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function FornecedoresPage() {
  const qc = useQueryClient();
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["fornecedores"], queryFn: fetchFornecedores,
  });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editing, setEditing] = useState<Fornecedor | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Fornecedor | null>(null);

  const filtered = useMemo(
    () => items.filter((f) =>
      f.nome.toLowerCase().includes(search.toLowerCase()) &&
      (statusFilter === "all" || f.status === statusFilter),
    ),
    [items, search, statusFilter],
  );

  const deleteMut = useMutation({
    mutationFn: async (f: Fornecedor) => {
      // Soft delete: marca como inativo (preserva histórico de pedidos)
      const { error } = await supabase
        .from("fornecedores" as never)
        .update({ status: "Inativo" })
        .eq("id", f.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fornecedor marcado como inativo");
      qc.invalidateQueries({ queryKey: ["fornecedores"] });
      setDeleting(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Fornecedores</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            {items.length} {items.length === 1 ? "fornecedor cadastrado" : "fornecedores cadastrados"}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => {
              if (items.length === 0) { toast.error("Nada para exportar"); return; }
              exportFornecedores(items);
              toast.success("Planilha gerada");
            }}
            className="flex-1 sm:flex-none"
          >
            <Download className="h-4 w-4" /> Excel
          </Button>
          <Button onClick={() => setCreating(true)} className="shadow-md flex-1 sm:flex-none">
            <Plus className="h-5 w-5" /> Novo Fornecedor
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
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="md:w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="Ativo">Ativos</SelectItem>
              <SelectItem value="Inativo">Inativos</SelectItem>
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
                <TableHead>Telefone</TableHead>
                <TableHead className="text-right">Entrega (dias)</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5}>
                  <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                    <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                      <Truck className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground">Nenhum fornecedor encontrado</p>
                  </div>
                </TableCell></TableRow>
              ) : (
                filtered.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.nome}</TableCell>
                    <TableCell className="font-mono text-sm">{f.telefone}</TableCell>
                    <TableCell className="text-right font-mono">{f.tempo_entrega_dias}</TableCell>
                    <TableCell className="text-center">
                      {f.status === "Ativo" ? (
                        <Badge className="bg-success text-success-foreground hover:bg-success/90">Ativo</Badge>
                      ) : (
                        <Badge variant="secondary">Inativo</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => setEditing(f)} aria-label="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setDeleting(f)} aria-label="Inativar"
                          className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <FornecedorDialog
        open={creating || !!editing}
        onOpenChange={(o) => { if (!o) { setCreating(false); setEditing(null); } }}
        fornecedor={editing}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Inativar fornecedor?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleting?.nome}</strong> será marcado como Inativo. O histórico de pedidos e materiais vinculados é preservado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleting && deleteMut.mutate(deleting)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >Inativar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FornecedorDialog({
  open, onOpenChange, fornecedor,
}: { open: boolean; onOpenChange: (o: boolean) => void; fornecedor: Fornecedor | null }) {
  const qc = useQueryClient();
  const isEdit = !!fornecedor;

  const form = useForm<Form>({
    resolver: zodResolver(schema),
    values: fornecedor ? {
      nome: fornecedor.nome,
      telefone: fornecedor.telefone,
      tempo_entrega_dias: fornecedor.tempo_entrega_dias,
      endereco: fornecedor.endereco ?? "",
      cnpj: fornecedor.cnpj ?? "",
      status: fornecedor.status,
      observacoes: fornecedor.observacoes ?? "",
    } : {
      nome: "", telefone: "", tempo_entrega_dias: 3,
      endereco: "", cnpj: "", status: "Ativo", observacoes: "",
    },
  });

  const mut = useMutation({
    mutationFn: async (v: Form) => {
      const payload = {
        nome: v.nome.trim(),
        telefone: v.telefone,
        tempo_entrega_dias: v.tempo_entrega_dias,
        endereco: v.endereco || null,
        cnpj: v.cnpj || null,
        status: v.status,
        observacoes: v.observacoes || null,
      };
      if (isEdit && fornecedor) {
        const { error } = await supabase.from("fornecedores" as never).update(payload).eq("id", fornecedor.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("fornecedores" as never).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Fornecedor atualizado" : "Fornecedor cadastrado");
      qc.invalidateQueries({ queryKey: ["fornecedores"] });
      onOpenChange(false);
      form.reset();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Fornecedor" : "Novo Fornecedor"}</DialogTitle>
          <DialogDescription>Preencha os dados do fornecedor.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mut.mutate(v))} className="space-y-4">
            <FormField control={form.control} name="nome" render={({ field }) => (
              <FormItem>
                <FormLabel>Nome do Fornecedor *</FormLabel>
                <FormControl><Input placeholder="Ex: Construtora Silva" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="telefone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone *</FormLabel>
                  <FormControl><Input placeholder="(11) 91234-5678" {...field}
                    onChange={(e) => field.onChange(formatPhone(e.target.value))} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="tempo_entrega_dias" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tempo de Entrega (dias) *</FormLabel>
                  <FormControl><Input type="number" min={0} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="cnpj" render={({ field }) => (
                <FormItem>
                  <FormLabel>CNPJ</FormLabel>
                  <FormControl><Input placeholder="00.000.000/0000-00" {...field}
                    onChange={(e) => field.onChange(formatCNPJ(e.target.value))} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="Ativo">Ativo</SelectItem>
                      <SelectItem value="Inativo">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="endereco" render={({ field }) => (
              <FormItem>
                <FormLabel>Endereço</FormLabel>
                <FormControl><Input placeholder="Rua, número, cidade" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="observacoes" render={({ field }) => (
              <FormItem>
                <FormLabel>Observações</FormLabel>
                <FormControl><Textarea rows={3} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
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
