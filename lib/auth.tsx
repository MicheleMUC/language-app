import { createContext, useContext, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";

type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

const DEV_USER = {
  id: "a797391f-74d0-44ac-b9ed-e85df6488bfe",
  email: "mi.schmidt.muc@gmail.com",
  aud: "authenticated",
  created_at: "",
  app_metadata: {},
  user_metadata: {},
} as User;

export function AuthProvider({ children }: { children: ReactNode }) {
  const signIn = async () => {};
  const signUp = async () => {};
  const signOut = async () => {};

  return (
    <AuthContext.Provider value={{ user: DEV_USER, session: null, loading: false, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
