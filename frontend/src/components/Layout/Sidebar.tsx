import { NavLink } from "@/components/NavLink";
import { Home, Route, LayoutDashboard, Database, BusFront } from "lucide-react";
import { cn } from "@/lib/utils";

export const Sidebar = () => {
  const navItems = [
    {
      title: "Home",
      icon: Home,
      href: "/home",
    },
    {
      title: "Manage Routes",
      icon: Route,
      href: "/",
    },
    {
      title: "Bus Dashboard",
      icon: LayoutDashboard,
      href: "/dashboard",
    },
  ];

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-sidebar-border bg-sidebar transition-all duration-300">
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-primary">
          <BusFront className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-sidebar-foreground">MoveInSync</h1>
          <p className="text-xs text-muted-foreground">Shuttle Management</p>
        </div>
      </div>

      <nav className="space-y-1 p-4">
        {navItems.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            end
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground transition-all hover:bg-sidebar-accent"
            activeClassName="bg-sidebar-accent text-sidebar-primary"
          >
            <item.icon className="h-5 w-5" />
            <span>{item.title}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};
