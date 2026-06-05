import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CurrentProfile {
  uzytkownik_id: string;
  imie_nazwisko: string;
  email: string;
  status: string;
  klucze_rol: string[];
}

interface Ctx {
  profile: CurrentProfile | null;
  roleKeys: string[];
  loading: boolean;
}

const ProfileContext = createContext<Ctx>({ profile: null, roleKeys: [], loading: true });

export function CurrentProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<CurrentProfile | null>(null);
  const [roleKeys, setRoleKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: prof }, { data: roles }] = await Promise.all([
        supabase.rpc("my_profile"),
        supabase.rpc("my_role_keys"),
      ]);
      if (cancelled) return;
      if (prof && Array.isArray(prof) && prof.length > 0) setProfile(prof[0] as CurrentProfile);
      if (roles) setRoleKeys(roles as string[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ProfileContext.Provider value={{ profile, roleKeys, loading }}>{children}</ProfileContext.Provider>
  );
}

export function useCurrentProfile() {
  return useContext(ProfileContext);
}

export function useRoleKeys() {
  return useContext(ProfileContext).roleKeys;
}
