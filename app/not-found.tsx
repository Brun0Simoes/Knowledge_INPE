import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <Card className="max-w-xl">
        <CardContent className="space-y-5 p-8 text-center">
          <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Nao encontrado</p>
          <h1 className="font-heading text-4xl text-zinc-950">Nao encontramos este conteudo</h1>
          <p className="text-sm leading-7 text-zinc-600">
            O curso ou rota solicitada nao existe mais, ou voce nao tem permissao para acessa-lo.
          </p>
          <Button asChild>
            <Link href="/dashboard">Voltar para cursos</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
