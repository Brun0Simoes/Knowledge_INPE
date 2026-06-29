import { ExternalLink } from "lucide-react";

import { withBasePath } from "@/lib/base-path";

const institutionalLinks = [
  {
    title: "Interface Moodle",
    description: "Ambiente principal de cursos e atividades educacionais.",
    href: "https://moodle.cptec.inpe.br/",
    imageSrc: withBasePath("/brand/logo-moodle.png"),
    imageAlt: "Moodle",
  },
  {
    title: "Interface DSAT",
    description: "Produtos e visualizações da Divisão de Satélites.",
    href: "https://www.cptec.inpe.br/dsat/",
    imageSrc: "https://www.cptec.inpe.br/dsat/img/dsat.png",
    imageAlt: "DSAT",
  },
  {
    title: "VLab Internacional",
    description: "Página internacional do Laboratório Virtual da OMM.",
    href: "https://wmo-sat.info/vlab/",
    imageSrc: withBasePath("/brand/logo-vlab.png"),
    imageAlt: "VLab",
  },
  {
    title: "Interface DISSM",
    description: "Divisão de Satélites e Sensores Meteorológicos do CPTEC/INPE.",
    href: "https://satelite.cptec.inpe.br/home/index.jsp",
    imageSrc: withBasePath("/brand/logo-dissm.png"),
    imageAlt: "DISSM",
  },
];

export function InstitutionalLinksSection() {
  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">
            Acesso institucional
          </p>
          <h2 className="font-heading text-3xl text-zinc-950 dark:text-zinc-100">
            Plataformas relacionadas
          </h2>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {institutionalLinks.map((item) => (
          <a
            className="group flex min-h-[178px] flex-col justify-between rounded-[28px] border border-zinc-200/80 bg-white/78 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-600/30 hover:shadow-[0_24px_70px_-46px_rgba(15,23,42,0.5)] dark:border-white/10 dark:bg-[#102132]/86"
            href={item.href}
            key={item.href}
            rel="noreferrer"
            target="_blank"
          >
            <span className="flex items-start justify-between gap-4">
              <span className="flex h-16 max-w-[150px] items-center">
                <img
                  alt={item.imageAlt}
                  className="max-h-16 max-w-full object-contain"
                  decoding="async"
                  src={item.imageSrc}
                />
              </span>
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 transition group-hover:border-teal-500 group-hover:text-teal-700 dark:border-white/10 dark:bg-[#0b1724] dark:text-zinc-200">
                <ExternalLink className="h-4 w-4" />
              </span>
            </span>

            <span className="space-y-2">
              <span className="block font-heading text-xl text-zinc-950 dark:text-zinc-100">
                {item.title}
              </span>
              <span className="block text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                {item.description}
              </span>
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
