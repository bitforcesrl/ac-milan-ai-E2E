"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { loginAction, type LoginState } from "@/lib/actions/auth.actions";
import { loginSchema, type LoginInput } from "@/lib/validations/login";

const initialState: LoginState = {};

const INPUT_CLASS =
    "w-full rounded-sm border border-grey bg-white px-4 py-3.5 text-base text-black placeholder:text-dark-grey/60 focus:outline-none focus:border-dark-grey";

const BUTTON_CLASS =
    "w-full rounded-sm bg-dark-grey px-4 py-3.5 text-sm font-semibold uppercase tracking-[0.2em] text-white transition-colors hover:bg-primary disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2";

export default function LoginForm() {
    const searchParams = useSearchParams();
    const next = searchParams.get("next") ?? "/";
    const [state, formAction, isPending] = useActionState(loginAction, initialState);

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<LoginInput>({
        resolver: zodResolver(loginSchema),
        defaultValues: { password: "", next },
    });


    return (
        <form
            action={formAction}
            onSubmit={(e) => {
                e.preventDefault();
                // Cattura i dati in modo sincrono prima della validazione asincrona
                const formData = new FormData(e.currentTarget);
                // Validazione client-side con Zod; se valida, invia alla Server Action
                handleSubmit(() => formAction(formData))(e);
            }}
            className="mt-10 space-y-4"
            noValidate
        >
            <input type="hidden" name="next" value={next} />
            <div className="space-y-1">
                <input
                    id="password"
                    type="password"
                    autoFocus
                    className={INPUT_CLASS}
                    placeholder="Password"
                    aria-label="Password"
                    aria-invalid={Boolean(errors.password)}
                    {...register("password")}
                />
                {errors.password && (
                    <p className="text-sm font-medium text-red-600" role="alert">
                        {errors.password.message}
                    </p>
                )}
            </div>

            {state.error && (
                <p className="text-sm font-medium text-red-600" role="alert">
                    {state.error}
                </p>
            )}

            <button
                type="submit"
                disabled={isPending || isSubmitting}
                className={BUTTON_CLASS}
            >
                {isPending || isSubmitting ? "Accesso…" : "Accedi"}
            </button>
        </form>
    );
}