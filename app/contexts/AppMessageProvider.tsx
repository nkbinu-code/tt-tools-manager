"use client";

import { createContext, useContext, useState } from "react";
import AppMessage from "../components/AppMessage";

const AppMessageContext = createContext<any>(null);

export function AppMessageProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [appMessage, setAppMessage] = useState<any>(null);

  return (
    <AppMessageContext.Provider value={{ setAppMessage }}>
      {children}
      <AppMessage
        message={appMessage}
        onClose={() => setAppMessage(null)}
      />
    </AppMessageContext.Provider>
  );
}

export function useAppMessage() {
  return useContext(AppMessageContext);
}