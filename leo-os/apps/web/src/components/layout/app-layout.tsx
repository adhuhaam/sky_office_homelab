import React from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  UploadCloud,
  FileSignature,
  Users,
  UserCog,
  Building,
  Building2,
  Wallet,
  Receipt,
  KeyRound,
  Settings,
  ShieldCheck,
  LogOut,
  CircleUserRound,
  DollarSign,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth";
import { BrandLogo } from "@/components/brand-logo";
import { PwaInstallButton } from "@/components/pwa-provider";

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  roles?: string[];
};

const ALL_NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/upload", label: "Process Document", icon: UploadCloud, roles: ["superuser", "admin", "company"] },
  { href: "/master-list", label: "Master List", icon: Users, roles: ["superuser", "admin", "company", "client", "agent"] },
  { href: "/companies", label: "Companies", icon: Building2, roles: ["superuser", "admin", "company"] },
  { href: "/clients", label: "Clients", icon: Building, roles: ["superuser", "admin"] },
  { href: "/loa", label: "Letter of Appointment", icon: FileSignature, roles: ["superuser", "admin", "company"] },
  { href: "/expenses", label: "Expenses", icon: Wallet, roles: ["superuser", "admin"] },
  { href: "/salary", label: "Salary", icon: DollarSign, roles: ["superuser", "admin", "employee"] },
  { href: "/billing", label: "Invoices & Quotes", icon: Receipt, roles: ["superuser", "admin", "company", "client"] },
  { href: "/passwords", label: "Passwords", icon: KeyRound, roles: ["superuser", "admin"] },
  { href: "/users", label: "User Management", icon: UserCog, roles: ["superuser", "admin"] },
  { href: "/permissions", label: "Permissions", icon: ShieldCheck, roles: ["superuser"] },
  { href: "/settings", label: "Settings", icon: Settings, roles: ["superuser"] },
];

function BrandMark({ size = "default" }: { size?: "default" | "small" }) {
  return (
    <BrandLogo
      context="dark"
      size={size === "small" ? "sidebar-small" : "sidebar"}
    />
  );
}

function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { isMobile, setOpenMobile } = useSidebar();
  const role = user?.role ?? null;

  const handleNavClick = () => {
    if (isMobile) setOpenMobile(false);
  };

  const visibleItems = ALL_NAV_ITEMS.filter(
    (item) => !item.roles || (role && item.roles.includes(role)),
  );

  const overviewItems = visibleItems.filter((i) => i.href === "/");
  const operationsItems = visibleItems.filter((i) =>
    ["/upload", "/master-list", "/companies", "/clients", "/loa", "/expenses", "/salary", "/billing", "/passwords"].includes(i.href),
  );
  const adminItems = visibleItems.filter((i) => i.href === "/users" || i.href === "/permissions");
  const systemItems = visibleItems.filter((i) => i.href === "/settings");

  const groups = [
    { group: "Overview", items: overviewItems },
    { group: "Operations", items: operationsItems },
    ...(adminItems.length > 0 ? [{ group: "Admin", items: adminItems }] : []),
    ...(systemItems.length > 0 ? [{ group: "System", items: systemItems }] : []),
  ].filter((g) => g.items.length > 0);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-3 py-4 border-b border-sidebar-border">
        <BrandMark />
      </SidebarHeader>

      <SidebarContent>
        {groups.map(({ group, items }) => (
          <SidebarGroup key={group}>
            <SidebarGroupLabel className="text-[10px] font-mono uppercase tracking-[0.15em]">
              {group}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map(({ href, label, icon: Icon }) => {
                  const active =
                    href === "/"
                      ? location === "/"
                      : location === href ||
                        (href === "/master-list" && location === "/passports");
                  return (
                    <SidebarMenuItem key={href}>
                      <SidebarMenuButton asChild isActive={active} tooltip={label}>
                        <Link href={href} onClick={handleNavClick}>
                          <Icon className="h-4 w-4" />
                          <span>{label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        {role && (
          <Link
            href="/profile"
            onClick={handleNavClick}
            className="px-2 py-1 flex items-center gap-2 rounded-md hover:bg-sidebar-accent/50 transition group"
          >
            <CircleUserRound className="h-3.5 w-3.5 text-sidebar-foreground/50 group-hover:text-sidebar-foreground transition" />
            <span className="text-[10px] font-mono uppercase tracking-wider text-sidebar-foreground/50 group-hover:text-sidebar-foreground transition">
              {role}
            </span>
          </Link>
        )}
        <PwaInstallButton className="w-full mb-1" />
        <button
          onClick={() => logout()}
          className="w-full flex items-center justify-center gap-2 rounded-md px-3 py-2 text-[12px] font-medium text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-app-shell min-h-svh">
        <header className="flex md:hidden items-center gap-3 px-4 py-3 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-30">
          <SidebarTrigger className="h-8 w-8" />
          <BrandMark size="small" />
        </header>
        <div className="flex-1 overflow-auto p-4 md:p-8 lg:p-10 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
