"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Wrench,
  Users,
  CalendarDays,
  Wallet,
  ShoppingCart,
  BarChart3,
  ReceiptText,
  Bell,
  Settings,
  LogOut,
} from "lucide-react";

const mainMenu = [
  { name: "Dashboard", href: "/", icon: Home, color: "#0057ff" },
  { name: "Tools", href: "/tools", icon: Wrench, color: "#00b84a" },
  { name: "Customers", href: "/customers", icon: Users, color: "#8b2cff" },
  { name: "Rentals", href: "/rentals", icon: CalendarDays, color: "#ff7a00" },
  { name: "Payments", href: "/payments", icon: Wallet, color: "#00bcd4" },
  { name: "Sales & Inventory", href: "/sales", icon: ShoppingCart, color: "#ff2d75" },
  { name: "Service", href: "/service", icon: Wrench, color: "#00bcd4" },
  { name: "Reports", href: "/reports", icon: BarChart3, color: "#8b2cff" },
];

const otherMenu = [
  { name: "Expenses", href: "/expenses", icon: ReceiptText, color: "#ff7a00" },
  { name: "Reminders", href: "/reminders", icon: Bell, color: "#8b2cff" },
  { name: "Settings", href: "/settings", icon: Settings, color: "#23c000" },
];

export default function Sidebar() {
  const pathname = usePathname();

  function active(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  async function handleLogout() {
    await fetch("/api/logout", {
      method: "POST",
    });

    window.location.href = "/login";
  }

  return (
    <aside className="modern-sidebar">
      <div className="brand-vertical">
        <div className="brand-icon">
          <Wrench size={24} />
        </div>

        <h2>
          T&T Tools
          <br />
          Manager
        </h2>
      </div>

      <div className="menu-section">
        <p>MAIN</p>

        {mainMenu.map((item) => {
          const Icon = item.icon;
          const isActive = active(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={isActive ? "menu-link active" : "menu-link"}
            >
              <Icon size={22} color={isActive ? "#ffffff" : item.color} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </div>

      <div className="menu-section other">
        <p>OTHERS</p>

        {otherMenu.map((item) => {
          const Icon = item.icon;
          const isActive = active(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={isActive ? "menu-link active" : "menu-link"}
            >
              <Icon size={22} color={isActive ? "#ffffff" : item.color} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </div>

      <div className="sidebar-bottom">
        <div className="admin-card">
          <div className="admin-avatar">B</div>

          <div>
            <strong>Admin</strong>
            <small>T&T Tools</small>
          </div>
        </div>

        <div className="logout-link" onClick={handleLogout}>
          <LogOut size={21} color="#ff2d55" />
          <span>Logout</span>
        </div>
      </div>
    </aside>
  );
}