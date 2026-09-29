"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface NavbarVisibilityContextValue {
  isNavbarHidden: boolean;
  setNavbarHidden: (hidden: boolean) => void;
}

const NavbarVisibilityContext = createContext<NavbarVisibilityContextValue>({
  isNavbarHidden: false,
  setNavbarHidden: () => {},
});

export function NavbarVisibilityProvider({ children }: { children: ReactNode }) {
  const [isNavbarHidden, setHidden] = useState(false);

  const stableSetNavbarHidden = useCallback((hidden: boolean) => {
    setHidden(hidden);
  }, []);

  return (
    <NavbarVisibilityContext.Provider
      value={{ isNavbarHidden, setNavbarHidden: stableSetNavbarHidden }}
    >
      {children}
    </NavbarVisibilityContext.Provider>
  );
}

export function useNavbarVisibility() {
  return useContext(NavbarVisibilityContext);
}
