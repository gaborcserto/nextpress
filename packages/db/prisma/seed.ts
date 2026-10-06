import "dotenv/config";

import { developmentPages, developmentTaxonomies, serializeDevelopmentContent } from "./development-content";
import { PageLayout, PageType, PublishStatus } from "../generated/prisma/client";
import { prisma } from "../src/client";
import { assertDevelopmentSeedAllowed } from "../src/development-seed-policy";

assertDevelopmentSeedAllowed(process.env);

async function ensureDevelopmentContent() {
  for (const taxonomy of developmentTaxonomies) {
    const idOwner = await prisma.taxonomy.findUnique({ where: { id: taxonomy.id }, select: { slug: true } });
    const slugOwner = await prisma.taxonomy.findUnique({ where: { slug: taxonomy.slug }, select: { id: true } });
    if (idOwner && idOwner.slug !== taxonomy.slug) {
      throw new Error(`Development seed taxonomy ID is already owned: ${taxonomy.id}`);
    }
    if (slugOwner && slugOwner.id !== taxonomy.id) {
      throw new Error(`Development seed taxonomy slug is already owned: ${taxonomy.slug}`);
    }
    await prisma.taxonomy.upsert({
      where: { id: taxonomy.id },
      create: taxonomy,
      update: { type: taxonomy.type, slug: taxonomy.slug, name: taxonomy.name },
    });
  }

  for (const page of developmentPages) {
    const idOwner = await prisma.page.findUnique({ where: { id: page.id }, select: { slug: true } });
    const slugOwner = await prisma.page.findUnique({ where: { slug: page.slug }, select: { id: true } });
    if (idOwner && idOwner.slug !== page.slug) {
      throw new Error(`Development seed content ID is already owned: ${page.id}`);
    }
    if (slugOwner && slugOwner.id !== page.id) {
      throw new Error(`Development seed content slug is already owned: ${page.slug}`);
    }
    const serialized = serializeDevelopmentContent(page);
    const values = {
      type: page.type === "POST" ? PageType.POST : PageType.PAGE,
      layout: PageLayout.STANDARD,
      status: page.status === "PUBLISHED" ? PublishStatus.PUBLISHED : PublishStatus.DRAFT,
      slug: page.slug,
      title: page.title,
      excerpt: serialized.excerpt,
      content: serialized.content,
      publishedAt: page.publishedAt,
      inHeaderMenu: false,
      inFooterMenu: false,
    };
    const taxonomies = {
      create: page.taxonomies.map((slug) => ({ taxonomy: { connect: { slug } } })),
    };

    await prisma.page.upsert({
      where: { id: page.id },
      create: { id: page.id, ...values, taxonomies },
      update: { ...values, taxonomies: { deleteMany: {}, ...taxonomies } },
    });
  }
}

ensureDevelopmentContent()
  .then(() => {
    console.log(`Seed OK: ${developmentPages.length} development pages/posts and ${developmentTaxonomies.length} tags`);
  })
  .catch(() => {
    console.error("Development content seeding failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
