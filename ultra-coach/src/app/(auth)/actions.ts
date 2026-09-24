"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSession, destroySession, hashPassword, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db";

export type AuthState = { error?: string } | undefined;

const signupSchema = z.object({
  name: z.string().trim().min(1, "Ton prénom").max(60),
  email: z.string().trim().toLowerCase().email("Email invalide"),
  password: z.string().min(8, "8 caractères minimum").max(200),
});

export async function signup(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };
  const { name, email, password } = parsed.data;
  if (await db.user.findUnique({ where: { email } })) return { error: "Un compte existe déjà avec cet email." };
  const user = await db.user.create({ data: { name, email, passwordHash: await hashPassword(password) } });
  await createSession(user.id, (await headers()).get("user-agent"));
  redirect("/onboarding");
}

export async function login(_: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const user = await db.user.findUnique({ where: { email } });
  // Même message dans les deux cas : on ne révèle pas si l'email existe.
  if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Email ou mot de passe incorrect." };
  }
  await createSession(user.id, (await headers()).get("user-agent"));
  redirect("/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
