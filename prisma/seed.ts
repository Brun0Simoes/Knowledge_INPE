import { hash } from "bcryptjs";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import {
  CourseEventType,
  CourseImageSource,
  CourseStatus,
  NotificationType,
  PrismaClient,
  UserRole,
} from "@prisma/client";

import { ensureDatabaseSchema } from "./sqlite";

const sqliteUrl = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const seededPrisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: sqliteUrl }),
});

async function main() {
  ensureDatabaseSchema();

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

  const adminPasswordHash = await hash("Admin12345", 12);
  const userPasswordHash = await hash("Usuario12345", 12);

  const admin = await seededPrisma.user.create({
    data: {
      name: "Equipe Editorial INPE",
      email: "admin@inpe.local",
      passwordHash: adminPasswordHash,
      role: UserRole.ADMIN,
      notificationOptIn: false,
    },
  });

  const users = await Promise.all([
    seededPrisma.user.create({
      data: {
        name: "Ana Costa",
        email: "ana@inpe.local",
        passwordHash: userPasswordHash,
        notificationOptIn: false,
      },
    }),
    seededPrisma.user.create({
      data: {
        name: "Bruno Lima",
        email: "bruno@inpe.local",
        passwordHash: userPasswordHash,
        notificationOptIn: false,
      },
    }),
    seededPrisma.user.create({
      data: {
        name: "Carla Menezes",
        email: "carla@inpe.local",
        passwordHash: userPasswordHash,
        notificationOptIn: false,
      },
    }),
    seededPrisma.user.create({
      data: {
        name: "Diego Arantes",
        email: "diego@inpe.local",
        passwordHash: userPasswordHash,
        notificationOptIn: false,
      },
    }),
  ]);

  const [ana, bruno, carla, diego] = users;

  const courseA = await seededPrisma.course.create({
    data: {
      slug: "observacao-da-terra-com-satelites-operacionais",
      title: "Observacao da Terra com satelites operacionais",
      summary:
        "Panorama introdutorio sobre sensores remotos, imageamento orbital e leitura de dados para monitoramento atmosferico e ambiental.",
      description:
        "Curso voltado para quem deseja entender como sensores embarcados em satelites operacionais produzem insumos para previsao e monitoramento.\n\nA trilha apresenta conceitos de orbita, resolucao espacial, bandas espectrais e interpretacao aplicada aos cenarios do CPTEC/INPE.\n\nAo final, o participante consegue navegar por produtos satelitais e reconhecer o potencial de cada sensor no apoio a decisoes meteorologicas.",
      externalUrl: "https://moodle.cptec.inpe.br/",
      status: CourseStatus.PUBLISHED,
      isFeatured: true,
      authorId: admin.id,
      publishedAt: new Date("2026-03-10T12:00:00.000Z"),
      images: {
        create: [
          {
            source: CourseImageSource.UPLOAD,
            url: "/seed/satelite.svg",
            alt: "Ilustracao de satelite e sensores",
            sortOrder: 0,
          },
        ],
      },
    },
  });

  const courseB = await seededPrisma.course.create({
    data: {
      slug: "modelagem-climatica-e-eventos-extremos",
      title: "Modelagem climatica e eventos extremos",
      summary:
        "Leitura aplicada de modelos atmosfericos e padroes de extremos, com foco em interpretacao de cenarios e incertezas.",
      description:
        "Esta trilha conecta fundamentos de dinamica atmosferica com o uso de modelos numericos para leitura de cenarios extremos.\n\nO participante percorre os conceitos de forcantes, anomalias, rodadas de previsao e sinais de risco em produtos operacionais.\n\nA abordagem privilegia contexto, comparacao entre safras de simulacao e traducao para tomada de decisao.",
      externalUrl: "https://moodle.cptec.inpe.br/",
      status: CourseStatus.PUBLISHED,
      isFeatured: false,
      authorId: admin.id,
      publishedAt: new Date("2026-03-16T12:00:00.000Z"),
      images: {
        create: [
          {
            source: CourseImageSource.UPLOAD,
            url: "/seed/clima.svg",
            alt: "Ilustracao de modelagem climatica",
            sortOrder: 0,
          },
        ],
      },
    },
  });

  const courseC = await seededPrisma.course.create({
    data: {
      slug: "auroras-ionosfera-e-previsao-do-tempo-espacial",
      title: "Auroras, ionosfera e previsao do tempo espacial",
      summary:
        "Introducao aos impactos do Sol no ambiente espacial terrestre, com leitura de indices e sinais de atividade geomagnetica.",
      description:
        "Curso introdutorio sobre os mecanismos que conectam atividade solar, magnetosfera e ionosfera.\n\nA trilha aborda eventos solares, indices geomagneticos e sinais observacionais utilizados em previsao de tempo espacial.\n\nO foco e oferecer repertorio para interpretar alertas, acompanhar produtos operacionais e situar o tema no ecossistema cientifico do INPE.",
      externalUrl: "https://moodle.cptec.inpe.br/",
      status: CourseStatus.PUBLISHED,
      isFeatured: false,
      authorId: admin.id,
      publishedAt: new Date("2026-03-20T12:00:00.000Z"),
      images: {
        create: [
          {
            source: CourseImageSource.UPLOAD,
            url: "/seed/aurora.svg",
            alt: "Ilustracao de aurora e ionosfera",
            sortOrder: 0,
          },
        ],
      },
    },
  });

  const courseD = await seededPrisma.course.create({
    data: {
      slug: "orbita-clima-e-dados-para-missoes-de-observacao",
      title: "Orbita, clima e dados para missoes de observacao",
      summary:
        "Rascunho editorial para integrar conceitos de orbita, plataformas e leitura de dados em cursos futuros.",
      description:
        "Rascunho interno que combina fundamentos de orbita, cobertura temporal e uso de dados para missoes cientificas.\n\nEle serve como base para validar layout, cadastro e publicacao.",
      externalUrl: "https://moodle.cptec.inpe.br/",
      status: CourseStatus.DRAFT,
      isFeatured: false,
      authorId: admin.id,
      images: {
        create: [
          {
            source: CourseImageSource.UPLOAD,
            url: "/seed/orbita.svg",
            alt: "Ilustracao editorial de orbita e dados",
            sortOrder: 0,
          },
        ],
      },
    },
  });

  await seededPrisma.courseLike.createMany({
    data: [
      { courseId: courseA.id, userId: ana.id },
      { courseId: courseA.id, userId: bruno.id },
      { courseId: courseA.id, userId: diego.id },
      { courseId: courseB.id, userId: ana.id },
      { courseId: courseB.id, userId: carla.id },
      { courseId: courseC.id, userId: bruno.id },
      { courseId: courseC.id, userId: diego.id },
    ],
  });

  await seededPrisma.courseReview.createMany({
    data: [
      {
        courseId: courseA.id,
        userId: ana.id,
        rating: 5,
        body: "Boa introducao para quem precisa conectar sensores, operacao e interpretacao de dados.",
      },
      {
        courseId: courseA.id,
        userId: bruno.id,
        rating: 4,
        body: "Conteudo objetivo e bem amarrado com a rotina de monitoramento.",
      },
      {
        courseId: courseB.id,
        userId: carla.id,
        rating: 5,
        body: "Otimo equilibrio entre teoria e leitura de cenarios extremos.",
      },
      {
        courseId: courseC.id,
        userId: diego.id,
        rating: 4,
        body: "Boa visao geral de tempo espacial e seus indicadores operacionais.",
      },
    ],
  });

  await seededPrisma.courseComment.createMany({
    data: [
      {
        courseId: courseA.id,
        userId: ana.id,
        body: "Gostei do recorte aplicado e das conexoes com produtos operacionais.",
      },
      {
        courseId: courseA.id,
        userId: diego.id,
        body: "A navegacao ficou clara e o acesso ao Moodle esta direto.",
      },
      {
        courseId: courseB.id,
        userId: carla.id,
        body: "Seria interessante adicionar uma trilha complementar sobre comunicacao de risco.",
      },
      {
        courseId: courseC.id,
        userId: bruno.id,
        body: "Curso muito bom para equipes que precisam de vocabulario comum sobre tempo espacial.",
      },
    ],
  });

  const eventRows = [
    ...buildEvents(courseA.id, [ana.id, bruno.id, diego.id], 18, 9),
    ...buildEvents(courseB.id, [ana.id, carla.id], 14, 6),
    ...buildEvents(courseC.id, [bruno.id, diego.id], 11, 4),
    ...buildEvents(courseD.id, [admin.id], 2, 0),
  ];

  await seededPrisma.courseEvent.createMany({
    data: eventRows,
  });

  const launchNotification = await seededPrisma.notification.create({
    data: {
      type: NotificationType.COURSE_PUBLISHED,
      title: "Novo curso publicado",
      body: `${courseA.title} foi publicado na knowledge.`,
      href: `/courses/${courseA.slug}`,
      courseId: courseA.id,
      createdById: admin.id,
      createdAt: new Date("2026-03-10T12:05:00.000Z"),
    },
  });

  const insightNotification = await seededPrisma.notification.create({
    data: {
      type: NotificationType.COURSE_PUBLISHED,
      title: "Novo curso publicado",
      body: `${courseB.title} foi publicado na knowledge.`,
      href: `/courses/${courseB.slug}`,
      courseId: courseB.id,
      createdById: admin.id,
      createdAt: new Date("2026-03-16T12:05:00.000Z"),
    },
  });

  await seededPrisma.userNotification.createMany({
    data: [
      {
        notificationId: launchNotification.id,
        userId: admin.id,
        readAt: new Date("2026-03-10T13:00:00.000Z"),
        createdAt: new Date("2026-03-10T12:05:00.000Z"),
      },
      {
        notificationId: launchNotification.id,
        userId: ana.id,
        readAt: new Date("2026-03-10T14:00:00.000Z"),
        createdAt: new Date("2026-03-10T12:05:00.000Z"),
      },
      { notificationId: launchNotification.id, userId: bruno.id, createdAt: new Date("2026-03-10T12:05:00.000Z") },
      { notificationId: launchNotification.id, userId: carla.id, createdAt: new Date("2026-03-10T12:05:00.000Z") },
      { notificationId: launchNotification.id, userId: diego.id, createdAt: new Date("2026-03-10T12:05:00.000Z") },
      { notificationId: insightNotification.id, userId: admin.id, createdAt: new Date("2026-03-16T12:05:00.000Z") },
      { notificationId: insightNotification.id, userId: ana.id, createdAt: new Date("2026-03-16T12:05:00.000Z") },
      {
        notificationId: insightNotification.id,
        userId: bruno.id,
        readAt: new Date("2026-03-16T14:00:00.000Z"),
        createdAt: new Date("2026-03-16T12:05:00.000Z"),
      },
      { notificationId: insightNotification.id, userId: carla.id, createdAt: new Date("2026-03-16T12:05:00.000Z") },
      { notificationId: insightNotification.id, userId: diego.id, createdAt: new Date("2026-03-16T12:05:00.000Z") },
    ],
  });

  console.log("Seed concluido.");
  console.log("Admin: admin@inpe.local / Admin12345");
  console.log("Usuario: ana@inpe.local / Usuario12345");
  console.log("Draft disponivel:", courseD.title);
}

function buildEvents(courseId: string, userIds: string[], views: number, clicks: number) {
  const rows: Array<{
    courseId: string;
    userId: string;
    type: CourseEventType;
    createdAt: Date;
  }> = [];

  for (let index = 0; index < views; index += 1) {
    rows.push({
      courseId,
      userId: userIds[index % userIds.length],
      type: CourseEventType.VIEW,
      createdAt: new Date(Date.now() - index * 1000 * 60 * 60 * 10),
    });
  }

  for (let index = 0; index < clicks; index += 1) {
    rows.push({
      courseId,
      userId: userIds[index % userIds.length],
      type: CourseEventType.CLICK_EXTERNAL,
      createdAt: new Date(Date.now() - index * 1000 * 60 * 60 * 14),
    });
  }

  return rows;
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await seededPrisma.$disconnect();
  });
