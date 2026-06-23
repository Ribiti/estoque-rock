import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import rockLogo from "@/assets/rock-logo.jpg.asset.json";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { usernameToEmail } from "@/lib/auth";
import { seedAdmin } from "@/lib/users.functions";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entrar — ROCK Incorporadora" },
      { name: "description", content: "Acesse sua conta no ROCK Incorporadora." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const seed = useServerFn(seedAdmin);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
    // Idempotent: creates admin user once if no admin exists
    seed().catch((e) => console.warn("seedAdmin:", e));
  }, [navigate, seed]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: usernameToEmail(username),
      password,
    });
    setLoading(false);
    if (error) {
      toast.error("Usuário ou senha inválidos");
      return;
    }
    toast.success("Bem-vindo!");
    navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md p-8">
        <div className="flex flex-col items-center gap-3 mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-accent text-accent-foreground">
            <Hammer className="h-6 w-6" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold">ROCK Incorporadora</h1>
            <p className="text-sm text-muted-foreground">
              Controle de estoque para construtoras
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Usuário</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              autoComplete="username"
              autoFocus
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar"}
          </Button>
        </form>

        <p className="mt-6 text-xs text-center text-muted-foreground">
          Novos usuários são cadastrados pelo administrador.
        </p>
      </Card>
    </div>
  );
}
