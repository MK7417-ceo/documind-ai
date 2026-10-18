import { NavLink } from "react-router-dom";
import ThemeToggle from "./ThemeToggle";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: "🏠" },
  { to: "/chat", label: "Chat", icon: "💬" },
  { to: "/settings", label: "Settings", icon: "⚙️" },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

/**
 * App sidebar for authenticated pages.
 * Desktop: fixed column. Mobile: slide-over drawer with overlay.
 */
export default function Sidebar({ open, onClose }: SidebarProps) {
  return (
    <>
      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 z-30 bg-navy-950/60 backdrop-blur-sm transition-opacity lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 -translate-x-full flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0 dark:border-slate-800 dark:bg-navy-950 ${
          open ? "translate-x-0" : ""
        }`}
        aria-label="Primary navigation"
      >
        <div className="flex h-16 items-center gap-2.5 border-b border-slate-200 px-5 dark:border-slate-800">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 text-lg text-white"
            aria-hidden="true"
          >
            🧠
          </span>
          <div>
            <p className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
              DocuMind AI
            </p>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Ask your documents
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="ml-auto rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden dark:text-slate-300 dark:hover:bg-navy-800"
          >
            ✕
          </button>
        </div>

        <nav className="flex-1 space-y-1 p-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                  isActive
                    ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-navy-800"
                }`
              }
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-200 p-4 dark:border-slate-800">
          <div className="flex items-center justify-between rounded-xl bg-slate-100 px-4 py-3 dark:bg-navy-900">
            <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
              Appearance
            </span>
            <ThemeToggle />
          </div>
          <NavLink
            to="/"
            className="mt-3 flex items-center gap-2 px-2 text-xs font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            ← Back to landing page
          </NavLink>
        </div>
      </aside>
    </>
  );
}
