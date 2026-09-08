import type { VercelRequest } from "@vercel/node";
import { getSupabaseAdmin } from "./supabase.js";

export async function requireAdmin(request: VercelRequest) {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer "))
    throw Object.assign(new Error("Authentication required."), { status: 401 });
  const supabase = getSupabaseAdmin();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(header.slice(7));
  if (error || !user)
    throw Object.assign(new Error("Your session has expired."), {
      status: 401,
    });
  const { data: admin } = await supabase
    .from("admin_users")
    .select("id,email,role")
    .eq("id", user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (
    !admin ||
    (process.env.ADMIN_EMAIL &&
      user.email?.toLowerCase() !== process.env.ADMIN_EMAIL.toLowerCase())
  )
    throw Object.assign(new Error("Administrator access is required."), {
      status: 403,
    });
  return { supabase, user, admin };
}

export const safeError = (error: unknown) => {
  const status =
    typeof error === "object" && error && "status" in error
      ? Number(error.status)
      : 500;
  return {
    status,
    message:
      status < 500 && error instanceof Error
        ? error.message
        : "The request could not be completed.",
  };
};
