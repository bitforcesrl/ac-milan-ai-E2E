import Link from "next/link";
import { BarChart2 } from "@deemlol/next-icons";
import PageHeader from "@/components/PageHeader";
import RunningPipelineBanner from "@/components/RunningPipelineBanner";
import PipelineForm from "@/components/home/PipelineForm";

const OUTLINE_BUTTON_CLASS =
  "flex items-center justify-center gap-2 rounded-full border border-primary px-5 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2";

/**
 * Home page (Server Component). Tutta la logica interattiva del form
 * è delegata al client component foglia `PipelineForm`.
 */
export default function Home() {
  return (
    <div className="flex flex-col flex-1 bg-white">
      <PageHeader
        title={`${process.env.NEXT_PUBLIC_CLIENT_NAME ?? "Client"} — AI E2E Tests`}
        description="Test automatici del personalizzatore di maglie dell’e-commerce, eseguiti da agenti AI come fossero utenti reali. Ogni run produce un report con esiti, bug e screenshot."
        actions={
          <Link href="/reports" className={OUTLINE_BUTTON_CLASS}>
            <BarChart2 size={18} />
            Reports
          </Link>
        }
      />
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 pt-8 pb-24">
        <RunningPipelineBanner />
        <PipelineForm />
      </main>
    </div>
  );
}
