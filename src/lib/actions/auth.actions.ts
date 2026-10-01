"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
    SESSION_COOKIE_NAME,
    SESSION_TTL_HOURS,
    createSessionToken,
    verifyPassword,
} from "@/lib/auth";
import { loginSchema, type LoginInput } from "@/lib/validations/login";

export type LoginState = { error?: string };

export async function loginAction(
    _prevState: LoginState,
    formData: FormData,
): Promise<LoginState> {
    // Validazione Zod dell'input (schema condiviso con il client)
    const parsed = loginSchema.safeParse({
        password: String(formData.get("password") ?? ""),
        next: String(formData.get("next") ?? "/") || "/",
    });

    if (!parsed.success) {
        return { error: parsed.error.issues[0]?.message ?? "Dati non validi." };
    }

    const { password, next }: LoginInput = parsed.data;

    const isValid = await verifyPassword(password);
    if (!isValid) {
        return { error: "Password non corretta." };
    }

    const token = await createSessionToken();
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: SESSION_TTL_HOURS * 60 * 60,
    });

    redirect(next);
}