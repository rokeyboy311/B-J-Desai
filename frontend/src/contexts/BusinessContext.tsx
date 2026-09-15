import React, { createContext, useContext, useState, useEffect } from "react";
import { apiFetch } from "../lib/api";
import { useAuth } from "./AuthContext";

export interface Business {
  id: number;
  businessName: string;
  legalName?: string | null;
  gstin?: string | null;
  pan?: string | null;
  state: string;
  city?: string | null;
  address?: string | null;
  mobile?: string | null;
  invoicePrefix: string;
  financialYear: string;
}

export interface LocationItem {
  id: number;
  businessId?: number | null;
  name: string;
  city?: string | null;
  state: string;
  gstin?: string | null;
}

interface BusinessContextType {
  businesses: Business[];
  activeBusiness: Business | null;
  locations: LocationItem[];
  activeLocationId: number | "ALL";
  loading: boolean;
  financialYear: string;
  setActiveBusiness: (b: Business) => void;
  setActiveLocationId: (id: number | "ALL") => void;
  refreshBusinesses: () => Promise<void>;
  refreshLocations: () => Promise<void>;
}

const BusinessContext = createContext<BusinessContextType | undefined>(undefined);

export function BusinessProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [activeBusiness, setActiveBusinessState] = useState<Business | null>(null);
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [activeLocationId, setActiveLocationId] = useState<number | "ALL">("ALL");
  const [loading, setLoading] = useState(true);

  // Compute Indian Financial Year (e.g. 2025-2026)
  const now = new Date();
  const currentMonth = now.getMonth(); // 0 = Jan, 3 = Apr
  const currentYear = now.getFullYear();
  const startYr = currentMonth >= 3 ? currentYear : currentYear - 1;
  const financialYear = `${startYr}-${startYr + 1}`;

  const fetchBusinesses = async () => {
    if (!user) {
      setBusinesses([]);
      setActiveBusinessState(null);
      setLoading(false);
      return;
    }

    try {
      const data: Business[] = await apiFetch("/businesses");
      setBusinesses(data || []);

      const savedId = localStorage.getItem("active_business_id");
      let current = data.find((b) => String(b.id) === savedId);
      if (!current && data.length > 0) {
        current = data[0];
        localStorage.setItem("active_business_id", String(current.id));
      }
      setActiveBusinessState(current || null);
    } catch (err) {
      console.error("Failed to load businesses:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLocations = async () => {
    if (!user) {
      setLocations([]);
      return;
    }

    try {
      const data: LocationItem[] = await apiFetch("/locations");
      setLocations(data || []);
    } catch (err) {
      console.error("Failed to load locations:", err);
    }
  };

  const setActiveBusiness = (b: Business) => {
    setActiveBusinessState(b);
    localStorage.setItem("active_business_id", String(b.id));
    fetchLocations();
  };

  useEffect(() => {
    fetchBusinesses();
    fetchLocations();
  }, [user]);

  return (
    <BusinessContext.Provider
      value={{
        businesses,
        activeBusiness,
        locations,
        activeLocationId,
        loading,
        financialYear,
        setActiveBusiness,
        setActiveLocationId,
        refreshBusinesses: fetchBusinesses,
        refreshLocations: fetchLocations,
      }}
    >
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusiness() {
  const context = useContext(BusinessContext);
  if (!context) {
    throw new Error("useBusiness must be used within a BusinessProvider");
  }
  return context;
}
