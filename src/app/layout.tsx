import type { Metadata } from "next";
import { Sora } from "next/font/google";
import "./globals.scss";
import QueryProvider from "@/components/providers/QueryProvider";

const sora = Sora({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

const clientName = process.env.NEXT_PUBLIC_CLIENT_NAME ?? "Client";

export const metadata: Metadata = {
  title: {
    default: `${clientName} — AI E2E Tests`,
    template: `%s | ${clientName} — AI E2E Tests`,
  },
  description:
    "Dashboard per lanciare e monitorare test E2E eseguiti da agenti AI: configurazione run, report delle esecuzioni, bug rilevati e screenshot.",
};


export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`h-full antialiased ${sora.variable}`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
