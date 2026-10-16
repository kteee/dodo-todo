import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export interface Account {
  id: string;
  name: string;
  email: string;
  initial: string;
  picture?: string;
}

export type AuthState =
  | { mode: "local"; status: "in"; account: Account }
  | { mode: "cloud"; status: "loading" | "out"; account: null }
  | { mode: "cloud"; status: "in"; account: Account };

const LOCAL_ACCOUNT: Account = { id: "local", name: "로컬 모드", email: "이 브라우저에만 저장돼요", initial: "나" };

function toAccount(u: User): Account {
  const m = u.user_metadata ?? {};
  const name: string = m.full_name || m.name || u.email || "사용자";
  return {
    id: u.id,
    name,
    email: u.email ?? "",
    initial: name.trim().charAt(0) || "?",
    picture: m.avatar_url || m.picture || undefined,
  };
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>(
    supabase ? { mode: "cloud", status: "loading", account: null } : { mode: "local", status: "in", account: LOCAL_ACCOUNT },
  );

  useEffect(() => {
    if (!supabase) return;
    const apply = (u: User | null | undefined) =>
      setState((prev) => {
        // 토큰 갱신 때마다 같은 사용자로 다시 그리지 않게
        if (u && prev.status === "in" && prev.account.id === u.id) return prev;
        return u ? { mode: "cloud", status: "in", account: toAccount(u) } : { mode: "cloud", status: "out", account: null };
      });
    supabase.auth.getSession().then(({ data }) => apply(data.session?.user));
    const { data } = supabase.auth.onAuthStateChange((_e, session) => apply(session?.user));
    return () => data.subscription.unsubscribe();
  }, []);

  return state;
}

export function signIn() {
  return supabase?.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
}

export function signOut() {
  return supabase?.auth.signOut();
}
