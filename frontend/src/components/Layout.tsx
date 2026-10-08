import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Tags,
  BookOpen,
  Ticket,
  Settings,
  LogOut,
  MessageCircle,
} from "lucide-react";
import { HiOutlineSparkles } from "react-icons/hi2";
import { useAuth } from "../auth/AuthContext";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/classify", label: "Classify", icon: Tags },
  { to: "/knowledge", label: "Knowledge", icon: BookOpen },
  { to: "/chat", label: "Ask Assistant", icon: MessageCircle },
  { to: "/tickets", label: "Tickets", icon: Ticket },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isChat = location.pathname === "/chat";

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div
      className={`flex flex-col md:flex-row ${isChat ? "h-screen overflow-hidden" : "min-h-screen"}`}
    >
      <aside className="md:w-[17.5rem] shrink-0 md:sticky md:top-0 md:h-screen flex flex-col border-b md:border-b-0 md:border-r border-[var(--border)] bg-white/80 backdrop-blur-xl shadow-[var(--shadow-sm)]">
        <div className="relative overflow-hidden px-5 py-6 [background:var(--grad-brand)] text-white">
          <div className="glow-orb absolute -right-6 -top-8 size-28 rounded-full bg-[var(--orange)]/30 blur-2xl" />
          <div className="glow-orb absolute -left-8 bottom-0 size-24 rounded-full bg-[var(--light-blue)]/40 blur-2xl" />
          <div className="relative flex items-center gap-3">
            <div className="grid place-items-center size-11 rounded-2xl bg-white/15 border border-white/25 backdrop-blur">
              <HiOutlineSparkles className="size-5 text-[var(--orange-soft)]" />
            </div>
            <div>
              <p className="brand-font text-xl leading-tight">SupportDesk</p>
              <p className="text-xs text-white/80 font-medium tracking-wide">
                AI Ticket Console
              </p>
            </div>
          </div>
        </div>

        <nav className="flex md:flex-col gap-1 px-3 py-4 overflow-x-auto md:flex-1">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                [
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all",
                  isActive
                    ? "bg-[var(--light-blue-soft)] text-[var(--blue)] shadow-[inset_3px_0_0_0_var(--orange)]"
                    : "text-[var(--muted)] hover:bg-[var(--light-blue-soft)]/70 hover:text-[var(--blue)]",
                ].join(" ")
              }
            >
              <Icon className="size-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto px-3 py-4 border-t border-[var(--border)] bg-[var(--light-blue-soft)]/50">
          <div className="px-3 mb-3">
            <p className="text-sm font-bold text-[var(--ink)] truncate">
              {user?.name}
            </p>
            <p className="text-xs text-[var(--muted)] truncate">{user?.email}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-[var(--blue)] hover:bg-white transition-colors"
          >
            <LogOut className="size-4" />
            Sign out
          </button>
        </div>
      </aside>

      <main
        className={[
          "flex-1 w-full mx-auto animate-rise",
          isChat
            ? "max-w-6xl h-full min-h-0 overflow-hidden px-4 py-4 md:px-8 md:py-5 flex flex-col"
            : "max-w-6xl px-4 py-6 md:px-8 md:py-9",
        ].join(" ")}
      >
        <Outlet />
      </main>
    </div>
  );
}
