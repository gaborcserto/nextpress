import Link from "next/link";

import styles from "./page.module.css";
import { PostList } from "@/components/public-content/PostList";
import { Container } from "@/components/public-ui/Container";
import { getPublishedPosts } from "@/lib/content/public-content.server";
import { getPublicSiteSettings } from "@/lib/settings/public-site-settings.server";

export default async function Home() {
  const [settings, posts] = await Promise.all([getPublicSiteSettings(), getPublishedPosts(5)]);

  return (
    <Container className={styles.home}>
      <section className={styles.intro} aria-labelledby="home-title">
        <h1 id="home-title">{settings.siteName}</h1>
        <p>{settings.siteDescription}</p>
      </section>
      <section className={styles.latest} aria-labelledby="latest-title">
        <div className={styles.sectionHeading}>
          <h2 id="latest-title">Latest posts</h2>
          <Link href="/posts">All posts</Link>
        </div>
        <PostList posts={posts} />
      </section>
    </Container>
  );
}
