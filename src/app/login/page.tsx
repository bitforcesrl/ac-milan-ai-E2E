import { Suspense } from 'react';
import LoginForm from './login-form';

export const metadata = {
  title: 'Accesso',
};

const clientName = process.env.NEXT_PUBLIC_CLIENT_NAME ?? 'Client';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white px-4">
      <div className="animate-fade-up w-full max-w-md">
        <h1 className="text-center text-3xl font-bold tracking-[0.2em] text-black uppercase">
          {clientName}
        </h1>
        <p className="text-dark-grey mt-8 text-center text-[18px] leading-7">
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
