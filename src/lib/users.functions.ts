import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const USERNAME_DOMAIN = "obrastock.local";
const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "Rock@2024";

function toEmail(username: string) {
  return `${username.trim().toLowerCase()}@${USERNAME_DOMAIN}`;
}

/**
 * Seeds the default admin user if it doesn't exist. Idempotent and safe to
 * call from the public /auth page on mount.
 */
export const seedAdmin = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const email = toEmail(ADMIN_USERNAME);

  // Check if any admin already exists
  const { data: existingRoles } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin")
    .limit(1);

  if (existingRoles && existingRoles.length > 0) {
    return { created: false };
  }

  // Find or create the admin auth user
  const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
  if (listErr) throw listErr;
  let userId = list.users.find((u) => u.email === email)?.id;

  if (!userId) {
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { username: ADMIN_USERNAME, full_name: "Administrador" },
    });
    if (createErr) throw createErr;
    userId = created.user.id;
  }

  // Ensure profile
  await supabaseAdmin
    .from("profiles")
    .upsert({ id: userId, username: ADMIN_USERNAME, full_name: "Administrador" });

  // Grant admin role
  await supabaseAdmin
    .from("user_roles")
    .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });

  return { created: true };
});

const createUserSchema = z.object({
  username: z
    .string()
    .min(3, "Mínimo 3 caracteres")
    .max(32)
    .regex(/^[a-zA-Z0-9_.-]+$/, "Use apenas letras, números, ., _ ou -"),
  full_name: z.string().trim().min(1, "Nome obrigatório").max(120),
  password: z.string().min(6, "Mínimo 6 caracteres").max(72),
  is_admin: z.boolean().optional().default(false),
});

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createUserSchema.parse(input))
  .handler(async ({ data, context }) => {
    // Verify caller is admin
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Acesso restrito a administradores");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = toEmail(data.username);

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { username: data.username.toLowerCase(), full_name: data.full_name },
    });
    if (error) throw new Error(error.message);

    await supabaseAdmin
      .from("profiles")
      .upsert({ id: created.user.id, username: data.username.toLowerCase(), full_name: data.full_name });

    if (data.is_admin) {
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: created.user.id, role: "admin" }, { onConflict: "user_id,role" });
    } else {
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: created.user.id, role: "user" }, { onConflict: "user_id,role" });
    }

    return { id: created.user.id };
  });

const deleteUserSchema = z.object({ user_id: z.string().uuid() });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => deleteUserSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Acesso restrito a administradores");
    if (data.user_id === context.userId) throw new Error("Você não pode excluir a si mesmo");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
