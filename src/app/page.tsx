import Link from "next/link";
import { BarChart2 } from "@deemlol/next-icons";
import PageHeader from "@/components/PageHeader";
import RunningPipelineBanner from "@/components/RunningPipelineBanner";
import PipelineForm from "@/components/home/PipelineForm";


/**
 * Home page (Server Component). Tutta la logica interattiva del form
 * è delegata al client component foglia `PipelineForm`.
 */
export default function Home() {
  return (
    <div className="flex flex-col flex-1 bg-white">
      <PageHeader
        title="AI E2E Tests"
        actions={
          <Link href="/reports">
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
