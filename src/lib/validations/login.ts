import { z } from "zod";

/**
 * Schema condiviso per il login: usato sia dalla Server Action
 * (validazione server-side) sia dal form client-side.
 */
export const loginSchema = z.object({
    password: z
        .string()
        .min(1, "Inserisci la password."),
    // Accetta solo path relativi (no open redirect)
    next: z
        .string()
        .refine(
            (value) => value === "/" || (value.startsWith("/") && !value.startsWith("//")),
            { message: "Redirect non valido." },
        ),
});

export type LoginInput = z.infer<typeof loginSchema>;