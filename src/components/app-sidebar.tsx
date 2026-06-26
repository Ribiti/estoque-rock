import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, Boxes, HardHat, History, Users, LogOut, Truck, ShoppingCart } from "lucide-react";
import rockLogo from "@/assets/rock-logo.jpg.asset.json";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser, useIsAdmin, emailToUsername } from "@/lib/auth";

const baseItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Estoque Central", url: "/estoque", icon: Boxes },
  { title: "Pedidos de Compra", url: "/pedidos", icon: ShoppingCart },
  { title: "Obras", url: "/obras", icon: HardHat },
  { title: "Movimentações", url: "/movimentacoes", icon: History },
];

const adminExtraItems = [
  { title: "Usuários", url: "/usuarios", icon: Users },
  { title: "Fornecedores", url: "/fornecedores", icon: Truck },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useCurrentUser();
  const { data: isAdmin } = useIsAdmin(user?.id);

  const items = isAdmin
    ? [...baseItems, { title: "Usuários", url: "/usuarios", icon: Users }]
    : baseItems;

  const isActive = (path: string) =>
    path === "/" ? pathname === "/" : pathname.startsWith(path);

  async function handleLogout() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-sidebar-accent overflow-hidden shrink-0">
            <img src={rockLogo.url} alt="ROCK Incorporadora" className="h-full w-full object-cover" />
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-bold text-sidebar-foreground leading-tight">
              ROCK Incorporadora
            </span>
            <span className="text-xs text-sidebar-foreground/60 leading-tight">
              Controle de estoque
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <div className="px-2 py-2 group-data-[collapsible=icon]:hidden">
          <p className="text-xs text-sidebar-foreground/60">Conectado como</p>
          <p className="text-sm font-medium text-sidebar-foreground truncate">
            {emailToUsername(user?.email) || "—"}
          </p>
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout} tooltip="Sair">
              <LogOut className="h-4 w-4" />
              <span>Sair</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
