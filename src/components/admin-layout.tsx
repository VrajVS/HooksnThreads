import type { ReactNode } from "react";
import { useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import {
  Boxes,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  ExternalLink,
  KeyRound,
  LogOut,
  Menu,
  Package,
  Shield,
  ShieldCheck,
  Tag,
  Users as UsersIcon,
  X,
} from "lucide-react";

import { ChangePasswordDialog } from "@/components/change-password-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAdminAuth } from "@/context/admin-auth-context";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  to: string;
  icon: typeof Package;
  permission: string;
}

interface NavGroup {
  label: string;
  icon: typeof Package;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Inventory Module",
    icon: Boxes,
    items: [
      { label: "Products", to: "/admin/products", icon: Package, permission: "products.view" },
      { label: "Categories", to: "/admin/categories", icon: Tag, permission: "categories.view" },
    ],
  },
  {
    label: "Access Management",
    icon: ShieldCheck,
    items: [
      { label: "Users", to: "/admin/users", icon: UsersIcon, permission: "users.view" },
      { label: "Roles", to: "/admin/roles", icon: Shield, permission: "roles.view" },
    ],
  },
];

function hasPermission(admin: { is_system_role: boolean; permissions: string[] } | null, key: string) {
  if (!admin) return false;
  if (admin.is_system_role) return true;
  return admin.permissions.includes(key);
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function AdminLayout({ children }: { children: ReactNode }) {
  const { admin, loading, logout } = useAdminAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(true);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  const [openGroups, setOpenGroups] = useState<Set<string>>(
    () =>
      new Set(
        NAV_GROUPS.filter((group) =>
          group.items.some((item) => location.pathname.startsWith(item.to)),
        ).map((group) => group.label),
      ),
  );

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-zinc-100">Loading...</div>;
  }

  if (!admin) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-100">
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex h-full w-60 shrink-0 -translate-x-full flex-col justify-between overflow-y-auto bg-white px-4 pb-4 pt-2 transition-[transform,width] duration-200 lg:static lg:translate-x-0",
          mobileOpen && "translate-x-0",
          collapsed && "lg:w-20",
        )}
      >
        <div>
          <div className="relative flex items-center justify-center px-2">
            <img
              src="/images/logo-icon.png"
              alt="Hooks &amp; Threads"
              className={cn(
                "shrink-0 object-contain",
                collapsed ? "h-12 w-12" : "h-32 w-32",
              )}
            />
            {!collapsed && (
              <button
                onClick={() => setCollapsed(true)}
                aria-label="Collapse sidebar"
                className="absolute right-0 top-0 hidden h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 lg:flex"
              >
                <ChevronsLeft className="h-4 w-4" />
              </button>
            )}
            {collapsed && (
              <button
                onClick={() => setCollapsed(false)}
                aria-label="Expand sidebar"
                className="absolute -right-2 top-0 hidden h-6 w-6 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 lg:flex"
              >
                <ChevronsRight className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              className="absolute right-0 top-0 flex h-8 w-8 items-center justify-center rounded-lg hover:bg-zinc-100 lg:hidden"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <nav className="mt-8 flex flex-col gap-1">
            {NAV_GROUPS.map((group) => {
              const visibleItems = group.items.filter((item) =>
                hasPermission(admin, item.permission),
              );
              if (visibleItems.length === 0) return null;
              const open = openGroups.has(group.label);
              const groupActive = visibleItems.some((item) =>
                location.pathname.startsWith(item.to),
              );
              return (
                <div key={group.label}>
                  <button
                    onClick={() => toggleGroup(group.label)}
                    aria-expanded={open}
                    title={collapsed ? group.label : undefined}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-medium transition-colors",
                      collapsed && "justify-center",
                      groupActive
                        ? "bg-[hsl(var(--admin-accent))] text-white"
                        : "text-zinc-600 hover:bg-zinc-100",
                    )}
                  >
                    <group.icon className="h-4 w-4 shrink-0" />
                    {!collapsed && (
                      <>
                        <span className="flex-1 text-left">{group.label}</span>
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 shrink-0 transition-transform",
                            open && "rotate-180",
                          )}
                        />
                      </>
                    )}
                  </button>

                  {open && !collapsed && (
                    <div className="mt-1 flex flex-col gap-1 pl-4">
                      {visibleItems.map((item) => {
                        const active = location.pathname.startsWith(item.to);
                        return (
                          <Link
                            key={item.to}
                            to={item.to}
                            onClick={() => setMobileOpen(false)}
                            className={cn(
                              "flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium transition-colors",
                              active
                                ? "bg-[hsl(var(--admin-accent-light))] text-[hsl(var(--admin-accent))]"
                                : "text-zinc-600 hover:bg-zinc-100",
                            )}
                          >
                            <item.icon className="h-4 w-4" />
                            {item.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}

                  {collapsed &&
                    visibleItems.map((item) => {
                      const active = location.pathname.startsWith(item.to);
                      return (
                        <Link
                          key={item.to}
                          to={item.to}
                          title={item.label}
                          className={cn(
                            "mt-1 flex items-center justify-center rounded-2xl px-3 py-2.5 text-sm font-medium transition-colors",
                            active
                              ? "bg-[hsl(var(--admin-accent-light))] text-[hsl(var(--admin-accent))]"
                              : "text-zinc-600 hover:bg-zinc-100",
                          )}
                        >
                          <item.icon className="h-4 w-4" />
                        </Link>
                      );
                    })}
                </div>
              );
            })}
          </nav>
        </div>

      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-zinc-200 bg-white px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-zinc-100 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="font-brand flex items-center text-base font-semibold text-slate-900 sm:text-lg">
              <span>HOOKS</span>
              <span className="mx-[0.15em] text-[0.85em] font-medium italic text-[hsl(150_25%_55%)]">
                &amp;
              </span>
              <span>THREADS</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden items-center gap-1.5 rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 sm:inline-flex"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View storefront
            </a>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  aria-label="Account menu"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-[hsl(var(--admin-accent-light))] text-xs font-semibold text-[hsl(var(--admin-accent))] transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--admin-accent))]"
                >
                  {initials(admin.full_name)}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[14rem]">
                <DropdownMenuLabel>
                  <p className="truncate text-sm font-medium text-foreground">
                    {admin.full_name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{admin.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setChangePasswordOpen(true)}>
                  <KeyRound className="h-4 w-4" />
                  Change password
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={logout} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
                  <LogOut className="h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <main className="flex-1 overflow-y-auto px-4 pb-4 pt-3 sm:px-5 sm:pb-5 sm:pt-3">{children}</main>
      </div>

      <ChangePasswordDialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen} />
    </div>
  );
}
