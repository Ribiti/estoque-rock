import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, History, ArrowDownToLine, ArrowUpFromLine, RotateCcw, Settings2, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { fetchMovimentacoes, type MovimentacaoTipo } from "@/lib/api";
import { exportMovimentacoes } from "@/lib/exports";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/movimentacoes")({
  head: () => ({ meta: [{ title: "Movimentações — ROCK Incorporadora" }] }),
  component: MovimentacoesPage,
});

const TIPO_META: Record<MovimentacaoTipo, { label: string; className: string; icon: React.ComponentType<{ className?: string }> }> = {
  entrada: { label: "Entrada", className: "bg-success text-success-foreground hover:bg-success/90", icon: ArrowDownToLine },
  saida_obra: { label: "Saída p/ obra", className: "bg-primary text-primary-foreground hover:bg-primary/90", icon: ArrowUpFromLine },
  retorno_obra: { label: "Retorno", className: "bg-accent text-accent-foreground hover:bg-accent/90", icon: RotateCcw },
  ajuste: { label: "Ajuste", className: "bg-muted text-foreground hover:bg-muted/90", icon: Settings2 },
};

function MovimentacoesPage() {
  const { data: movs = [], isLoading } = useQuery({
    queryKey: ["movimentacoes"], queryFn: fetchMovimentacoes,
  });

  const [search, setSearch] = useState("");
  const [tipoFilter, setTipoFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    return movs.filter((m) => {
      const matchSearch =
        !search ||
        m.material?.nome.toLowerCase().includes(search.toLowerCase()) ||
        m.obra?.nome.toLowerCase().includes(search.toLowerCase());
      const matchTipo = tipoFilter === "all" || m.tipo === tipoFilter;
      return matchSearch && matchTipo;
    });
  }, [movs, search, tipoFilter]);

  function handleExport() {
    if (filtered.length === 0) {
      toast.error("Nenhuma movimentação para exportar");
      return;
    }
    exportMovimentacoes(filtered);
    toast.success("Planilha gerada");
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Movimentações de Estoque</h1>
          <p className="text-muted-foreground mt-1">
            Histórico completo de entradas, saídas para obras e retornos.
          </p>
        </div>
        <Button onClick={handleExport} className="shadow-md">
          <Download className="h-4 w-4" /> Exportar Excel
        </Button>
      </div>

      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por material ou obra..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={tipoFilter} onValueChange={setTipoFilter}>
            <SelectTrigger className="md:w-56"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="entrada">Entrada</SelectItem>
              <SelectItem value="saida_obra">Saída p/ obra</SelectItem>
              <SelectItem value="retorno_obra">Retorno</SelectItem>
              <SelectItem value="ajuste">Ajuste</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Material</TableHead>
                <TableHead>Obra</TableHead>
                <TableHead className="text-right">Quantidade</TableHead>
                <TableHead>Observação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                        <History className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <p className="text-muted-foreground">Nenhuma movimentação registrada ainda.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((m) => {
                  const meta = TIPO_META[m.tipo];
                  const Icon = meta.icon;
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {new Date(m.created_at).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell>
                        <Badge className={`gap-1 ${meta.className}`}>
                          <Icon className="h-3 w-3" /> {meta.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{m.material?.nome ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{m.obra?.nome ?? "—"}</TableCell>
                      <TableCell className="text-right font-mono">
                        {m.quantidade} {m.material?.unidade}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{m.observacao ?? ""}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
