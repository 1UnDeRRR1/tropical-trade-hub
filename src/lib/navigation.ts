import {
  LayoutDashboard,
  Truck,
  Route as RouteIcon,
  Warehouse,
  ShoppingCart,
  Users,
  FileText,
  Wallet,
  BarChart3,
  UserCog,
  Building2,
  Ship,
  Settings,
  Bell,
} from "lucide-react";
import type { ComponentType } from "react";

export interface NavItem {
  path: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  roles: string[]; // role keys allowed; super_admin always allowed
}

export const NAV_ITEMS: NavItem[] = [
  { path: "/panel", label: "Panel główny", icon: LayoutDashboard, roles: ["kierownik", "asystent_kierownika", "import_manager", "sales_manager", "logistyk", "magazynier", "fakturowanie", "export_manager"] },
  { path: "/dostawy", label: "Dostawy", icon: Truck, roles: ["kierownik", "asystent_kierownika", "import_manager", "logistyk", "magazynier"] },
  { path: "/logistyka", label: "Logistyka", icon: RouteIcon, roles: ["kierownik", "asystent_kierownika", "import_manager", "logistyk"] },
  { path: "/magazyn", label: "Magazyn", icon: Warehouse, roles: ["kierownik", "asystent_kierownika", "import_manager", "sales_manager", "magazynier"] },
  { path: "/sprzedaz", label: "Sprzedaż", icon: ShoppingCart, roles: ["kierownik", "asystent_kierownika", "sales_manager"] },
  { path: "/klienci", label: "Klienci", icon: Users, roles: ["kierownik", "asystent_kierownika", "sales_manager", "fakturowanie"] },
  { path: "/fakturowanie", label: "Fakturowanie", icon: FileText, roles: ["kierownik", "asystent_kierownika", "fakturowanie"] },
  { path: "/rozliczenia", label: "Rozliczenia", icon: Wallet, roles: ["kierownik", "asystent_kierownika", "fakturowanie"] },
  { path: "/raporty", label: "Raporty", icon: BarChart3, roles: ["kierownik", "asystent_kierownika", "import_manager", "sales_manager", "logistyk", "magazynier", "fakturowanie"] },
  { path: "/uzytkownicy", label: "Użytkownicy", icon: UserCog, roles: [] },
  { path: "/dostawcy", label: "Dostawcy", icon: Building2, roles: ["kierownik", "asystent_kierownika", "import_manager"] },
  { path: "/przewoznicy", label: "Przewoźnicy", icon: Ship, roles: ["kierownik", "asystent_kierownika", "logistyk"] },
  { path: "/ustawienia", label: "Ustawienia", icon: Settings, roles: [] },
  { path: "/powiadomienia", label: "Powiadomienia", icon: Bell, roles: ["kierownik", "asystent_kierownika", "import_manager", "sales_manager", "logistyk", "magazynier", "fakturowanie", "export_manager"] },
];

export const ROLE_LABELS: Record<string, string> = {
  super_admin: "Superadministrator",
  kierownik: "Kierownik",
  asystent_kierownika: "Asystent kierownika",
  import_manager: "Import manager",
  sales_manager: "Menedżer sprzedaży",
  magazynier: "Magazynier",
  fakturowanie: "Fakturowanie",
  logistyk: "Logistyk",
  export_manager: "Export manager",
};

export function canAccess(path: string, roleKeys: string[]): boolean {
  if (roleKeys.includes("super_admin")) return true;
  const item = NAV_ITEMS.find((i) => i.path === path);
  if (!item) return false;
  return item.roles.some((r) => roleKeys.includes(r));
}

export function visibleNavItems(roleKeys: string[]): NavItem[] {
  if (roleKeys.includes("super_admin")) return NAV_ITEMS;
  return NAV_ITEMS.filter((i) => i.roles.some((r) => roleKeys.includes(r)));
}
