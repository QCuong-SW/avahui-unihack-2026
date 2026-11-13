'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

interface SidebarContextValue {
  isExpanded: boolean;
  toggleSidebar: () => void;
  setIsExpanded: (expanded: boolean) => void;
  isMobileOpen: boolean;
  toggleMobile: () => void;
  closeMobile: () => void;
}

const SidebarContext = createContext<SidebarContextValue>({
  isExpanded: true,
  toggleSidebar: () => {},
  setIsExpanded: () => {},
  isMobileOpen: false,
  toggleMobile: () => {},
  closeMobile: () => {},
});

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [isMobileOpen, setIsMobileOpen] = useState<boolean>(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('avahui_sidebar_expanded');
      if (saved !== null) {
        setIsExpanded(saved === 'true');
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const toggleSidebar = () => {
    setIsExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('avahui_sidebar_expanded', String(next));
      } catch {
        // Ignore localStorage errors
      }
      return next;
    });
  };

  const toggleMobile = () => setIsMobileOpen((prev) => !prev);
  const closeMobile = () => setIsMobileOpen(false);

  return (
    <SidebarContext.Provider
      value={{
        isExpanded,
        toggleSidebar,
        setIsExpanded,
        isMobileOpen,
        toggleMobile,
        closeMobile,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}

