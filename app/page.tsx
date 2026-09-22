import Link from "next/link";
import TriggerPipelineButton from "./trigger-pipeline-button";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col gap-10 py-24 px-8 bg-white dark:bg-black sm:px-16">
        <div className="flex flex-col gap-4">
          <h1 className="text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
            AC Milan — AI E2E Tests
          </h1>
          <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Questa dashboard gestisce i test end-to-end del personalizzatore di
            maglie dell'e-commerce Shopify di AC Milan. I test vengono
            eseguiti da agenti AI (via browser MCP) su diverse combinazioni di
            browser e viewport, simulando un utente reale lungo tutto il flusso
            di personalizzazione e acquisto: selezione taglia, nome e patch sul
            personalizzatore React della PDP, aggiunta al carrello e verifica
            della coerenza tra selezione e carrello.
          </p>
          <p className="text-base leading-7 text-zinc-600 dark:text-zinc-400">
            Al termine di ogni run, i report strutturati (JSON) e gli screenshot
            vengono caricati su Azure Blob Storage e sono consultabili nella
            sezione{" "}
            <Link
              href="/reports"
              className="font-medium text-zinc-950 underline underline-offset-4 dark:text-zinc-50"
            >
              Reports
            </Link>
            , dove è possibile analizzare l'esito di ogni test, i bug
            rilevati e gli errori console/network.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold text-black dark:text-zinc-50">
            Azioni
          </h2>
          <div className="flex flex-col gap-4 text-base font-medium sm:flex-row sm:items-center">
            <Link
              href="/reports"
              className="flex h-12 items-center justify-center rounded-full border border-solid border-black/[.08] px-6 transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
            >
              📊 Vai ai Reports
            </Link>
            <TriggerPipelineButton />
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-500">
            Il pulsante avvia la pipeline E2E su Azure DevOps tramite REST API
            (richiede le variabili d'ambiente AZURE_DEVOPS_*).
          </p>
        </div>
      </main>
    </div>
  );
}
