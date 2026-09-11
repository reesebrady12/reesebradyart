import { supabase } from "./supabase";
export async function adminApi<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const { data } = await supabase!.auth.getSession();
  if (!data.session) throw new Error("Your session has expired.");
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.session.access_token}`,
      ...options.headers,
    },
  });
  if (response.status === 204) return undefined as T;
  const body = await response.json();
  if (!response.ok) {
    const error = Object.assign(
      new Error(
        typeof body.error === "string" ? body.error : "Request failed.",
      ),
      { status: response.status },
    );
    if (body.fields && typeof body.fields === "object")
      Object.assign(error, { fields: body.fields });
    throw error;
  }
  return body;
}
