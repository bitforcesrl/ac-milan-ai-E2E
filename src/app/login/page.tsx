import { Suspense } from "react";
import LoginForm from "./login-form";

export const metadata = {
    title: "Accesso",
};

const clientName = process.env.NEXT_PUBLIC_CLIENT_NAME ?? "Client";

export default function LoginPage() {
    return (
        <main className="flex min-h-screen flex-col items-center justify-center bg-white px-4">
            <div className="w-full max-w-md animate-fade-up">
                <h1 className="text-center text-3xl font-bold uppercase tracking-[0.2em] text-black">
                    {clientName}
                </h1>
                <p className="mt-8 text-center text-[18px] leading-7 text-dark-grey">
                    Questa dashboard è protetta da password.
                    <br />
                    Inserisci la password per accedere.
                </p>
                <Suspense>
                    <LoginForm />
                </Suspense>
            </div>
        </main>
    );
}