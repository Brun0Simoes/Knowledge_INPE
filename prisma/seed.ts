import { randomBytes } from "crypto";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { CourseImageSource, CourseStatus, PrismaClient, UserRole } from "@prisma/client";
import { hash } from "bcryptjs";

import { ensureDatabaseSchema } from "./sqlite";

const sqliteUrl = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const seededPrisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: sqliteUrl }),
});

const adminAccounts = [
  {
    name: "Diego Souza",
    email: "diego.souza@inpe.br",
  },
  {
    name: "Diego R. M. Souza",
    email: "diego.rmsouza@gmail.com",
  },
] as const;

const courseData = {
  slug: "minicurso-processamento-e-visualizacao-de-dados-de-queimadas-2026",
  title: "Minicurso: Processamento e visualizacao de dados de Queimadas 2026",
  summary:
    "Minicurso teorico e pratico sobre analise de focos de calor por satelite, usando Python, Google Colab, dados do INPE e Google Earth Engine.",
  description:
    "Com abordagem teorica e pratica, o minicurso apresenta conceitos e praticas para analise de focos de calor detectados por satelites. Os participantes aprenderao a utilizar Python e Google Colab para acessar, processar e visualizar informacoes reais do banco de dados do INPE e do Google Earth Engine, desenvolvendo habilidades aplicadas ao monitoramento de queimadas.\n\nConteudo programatico:\n- Introducao a estimativa de queimadas por satelite\n- Bases de dados INPE e Google Earth Engine\n- Risco de fogo e produtos derivados\n- Manipulacao de dados CSV\n- Visualizacao e analise com Python\n\nObjetivos:\n- Compreender a deteccao de queimadas por satelites e seus fundamentos\n- Acessar e analisar dados de focos de calor de queimadas\n- Aprender como mapear e calcular areas queimadas utilizando dados Sentinel-2\n- Aplicar Python no processamento de dados\n- Gerar visualizacoes e interpretar dados do INPE e Google Earth Engine\n\nPublico-alvo: estudantes de Graduacao e Pos-Graduacao, pesquisadores, profissionais de empresa, corpo de bombeiros e defesas civis.\n\nInformacoes: 29, 30 e 31 de julho de 2026, das 08:30 as 12:00 h. Minicurso virtual pela Plataforma RNP. 150 vagas.\n\nRequisitos: conta de e-mail Gmail para uso do Google Colab e conta no Google Earth Engine.",
  externalUrl: "https://forms.gle/dg2LD34tRh42DpQ49",
  startsAt: new Date("2026-07-29T08:30:00-03:00"),
  endsAt: new Date("2026-07-31T12:00:00-03:00"),
  publishedAt: new Date("2026-05-13T21:40:42.738Z"),
  imageUrl:
    "/uploads/courses/minicurso-processamento-e-visualizacao-de-dados-de-queimadas-2026-a46bd962-1fe3-440e-ac7e-39de006dbf1b.jpg",
} as const;

function createPassword() {
  return randomBytes(18).toString("base64url");
}

async function main() {
  ensureDatabaseSchema();

  await seededPrisma.passwordResetCode.deleteMany();
  await seededPrisma.userNotification.deleteMany();
  await seededPrisma.notification.deleteMany();
  await seededPrisma.emailBatchRecipient.deleteMany();
  await seededPrisma.emailBatch.deleteMany();
  await seededPrisma.courseComment.deleteMany();
  await seededPrisma.courseReview.deleteMany();
  await seededPrisma.courseLike.deleteMany();
  await seededPrisma.courseEvent.deleteMany();
  await seededPrisma.courseImage.deleteMany();
  await seededPrisma.course.deleteMany();
  await seededPrisma.session.deleteMany();
  await seededPrisma.account.deleteMany();
  await seededPrisma.user.deleteMany();

  const createdAdmins: Array<{ id: string; email: string; password: string }> = [];

  for (const account of adminAccounts) {
    const password = createPassword();
    const passwordHash = await hash(password, 12);
    const user = await seededPrisma.user.create({
      data: {
        name: account.name,
        email: account.email,
        passwordHash,
        role: UserRole.ADMIN,
      },
    });

    createdAdmins.push({ id: user.id, email: user.email, password });
  }

  const primaryAdmin = createdAdmins[0];

  if (!primaryAdmin) {
    throw new Error("Configure ao menos um administrador para executar o seed.");
  }

  await seededPrisma.course.create({
    data: {
      slug: courseData.slug,
      title: courseData.title,
      summary: courseData.summary,
      description: courseData.description,
      externalUrl: courseData.externalUrl,
      status: CourseStatus.PUBLISHED,
      isFeatured: true,
      startsAt: courseData.startsAt,
      endsAt: courseData.endsAt,
      publishedAt: courseData.publishedAt,
      authorId: primaryAdmin.id,
      images: {
        create: [
          {
            source: CourseImageSource.UPLOAD,
            url: courseData.imageUrl,
            alt: `${courseData.title} - imagem de capa`,
            sortOrder: 0,
          },
        ],
      },
    },
  });

  console.log("Seed concluido.");
  console.log("Senhas administrativas geradas para este ambiente:");
  for (const admin of createdAdmins) {
    console.log(`${admin.email}: ${admin.password}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await seededPrisma.$disconnect();
  });
