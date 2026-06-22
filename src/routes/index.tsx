import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Boxes, HardHat, AlertTriangle, PackageCheck, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fetchMateriais, fetchObras } from "@/lib/api";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — ObraStock" },
      { name: "description", content: "Visão geral do estoque e obras ativas." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const materiaisQ = useQuery({ queryKey: ["materiais"], queryFn: fetchMateriais });
  const obrasQ = useQuery({ queryKey: ["obras"], queryFn: fetchObras });

  const materiais = materiaisQ.data ?? [];
  const obras = obrasQ.data ?? [];
  const obrasAtivas = obras.filter((o) => o.status === "Ativa");
  const itensBaixoEstoque = materiais.filter(
    (m) => m.quantidade_disponivel <= m.estoque_minimo,
  );
  const totalUnidades = materiais.reduce((sum, m) => sum + m.quantidade_disponivel, 0);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Visão geral do estoque e obras em andamento.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Itens Cadastrados"
          value={materiais.length}
          icon={Boxes}
          tone="primary"
        />
        <MetricCard
          label="Unidades em Estoque"
          value={totalUnidades.toLocaleString("pt-BR")}
          icon={PackageCheck}
          tone="success"
        />
        <MetricCard
          label="Obras Ativas"
          value={obrasAtivas.length}
          icon={HardHat}
          tone="accent"
        />
        <MetricCard
          label="Estoque Baixo"
          value={itensBaixoEstoque.length}
          icon={AlertTriangle}
          tone="destructive"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Alertas de Estoque
              </CardTitle>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/estoque">
                Ver estoque <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {itensBaixoEstoque.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Tudo certo! Nenhum item abaixo do estoque mínimo.
              </p>
            ) : (
              <ul className="divide-y">
                {itensBaixoEstoque.slice(0, 6).map((m) => (
                  <li key={m.id} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{m.nome}</p>
                      <p className="text-xs text-muted-foreground">{m.categoria}</p>
                    </div>
                    <Badge variant="destructive">
                      {m.quantidade_disponivel} / min {m.estoque_minimo}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <HardHat className="h-5 w-5 text-accent" />
              Obras Ativas
            </CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/obras">
                Gerenciar <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {obrasAtivas.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Nenhuma obra ativa. Cadastre uma para começar a distribuir materiais.
              </p>
            ) : (
              <ul className="divide-y">
                {obrasAtivas.slice(0, 6).map((o) => (
                  <li key={o.id} className="py-3 flex items-center justify-between">
                    <span className="font-medium text-sm">{o.nome}</span>
                    <Badge className="bg-success text-success-foreground hover:bg-success/90">
                      Ativa
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "primary" | "success" | "accent" | "destructive";
}) {
  const toneClass = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/15 text-success",
    accent: "bg-accent/20 text-accent-foreground",
    destructive: "bg-destructive/10 text-destructive",
  }[tone];

  return (
    <Card>
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${toneClass}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
            {label}
          </p>
          <p className="text-2xl font-bold mt-0.5 truncate">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
