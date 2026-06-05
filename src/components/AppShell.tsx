import { useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Menu, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { visibleNavItems, ROLE_LABELS } from "@/lib/navigation";

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const { roleKeys } = useCurrentProfile();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = visibleNavItems(roleKeys);

  return (
    <nav className="flex flex-col gap-1 p-2">
      {items.map((item) => {
        const active = pathname === item.path;
        const Icon = item.icon;
        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function UserSummary({ compact = false }: { compact?: boolean }) {
  const { profile, roleKeys } = useCurrentProfile();
  const primaryRole = roleKeys.includes("super_admin") ? "super_admin" : roleKeys[0];
  const roleLabel = primaryRole ? (ROLE_LABELS[primaryRole] ?? primaryRole) : "—";
  if (!profile) return null;
  return (
    <div className={cn("flex flex-col", compact ? "text-xs" : "text-sm")}>
      <span className="font-medium text-foreground truncate">{profile.imie_nazwisko}</span>
      <span className="text-muted-foreground truncate">{roleLabel}</span>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const onLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r bg-card">
        <div className="px-4 py-4 border-b">
          <div className="text-base font-semibold leading-tight">Tropical Trade</div>
          <div className="text-xs text-muted-foreground">Platform</div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <NavList />
        </div>
        <div className="border-t p-3 flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <UserSummary compact />
          </div>
          <Button variant="ghost" size="icon" onClick={onLogout} title="Wyloguj">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 px-3 backdrop-blur md:px-6">
          {/* Mobile menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <div className="flex h-14 items-center justify-between border-b px-4">
                <span className="font-semibold">Tropical Trade</span>
                <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)} aria-label="Zamknij">
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <div className="overflow-y-auto pb-4">
                <NavList onNavigate={() => setMobileOpen(false)} />
              </div>
              <div className="border-t p-3 flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <UserSummary compact />
                </div>
                <Button variant="outline" size="sm" onClick={onLogout}>
                  <LogOut className="h-4 w-4 mr-1" /> Wyloguj
                </Button>
              </div>
            </SheetContent>
          </Sheet>

          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate">Tropical Trade Platform</div>
          </div>

          <div className="hidden sm:block min-w-0">
            <UserSummary compact />
          </div>
          <Button variant="outline" size="sm" onClick={onLogout} className="hidden md:inline-flex">
            <LogOut className="h-4 w-4 mr-1" /> Wyloguj
          </Button>
        </header>

        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
