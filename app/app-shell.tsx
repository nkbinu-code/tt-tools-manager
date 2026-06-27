"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./sidebar";
import { Menu, Bell, CalendarDays } from "lucide-react";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <div className="app-shell">
      <Sidebar />

      <div className="main-area">
        <header className="topbar">
          <button className="top-icon" type="button">
            <Menu size={24} />
          </button>

          <div className="topbar-right">
            <button className="top-icon notification" type="button">
              <Bell size={24} />
              <span>3</span>
            </button>

            <button className="top-icon" type="button">
              <CalendarDays size={24} />
            </button>
          </div>
        </header>

        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}