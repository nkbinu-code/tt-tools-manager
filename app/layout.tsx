import "./globals.css";
import AppShell from "./app-shell";
import { AppMessageProvider } from "./contexts/AppMessageProvider";

export const metadata = {
  title: "T&T Tools Manager",
  description: "T&T Tools Business Management System",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AppMessageProvider>
          <AppShell>{children}</AppShell>
        </AppMessageProvider>
      </body>
    </html>
  );
}