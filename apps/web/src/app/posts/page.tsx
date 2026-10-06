import Link from "next/link";
import { redirect } from "next/navigation";

import styles from "./page.module.css";
import { PostList } from "@/components/public-content/PostList";
import { Container } from "@/components/public-ui/Container";
import { MAX_POSTS_PAGE, parsePostsPage, POSTS_PER_PAGE } from "@/lib/content/post-archive";
import { getPublishedPosts } from "@/lib/content/public-content.server";

type PostsPageProps = {
  searchParams: Promise<{ page?: string | string[] }>;
};

export default async function PostsPage({ searchParams }: PostsPageProps) {
  const { page: pageParam } = await searchParams;
  const page = parsePostsPage(pageParam);
  const { posts, hasMore } = await getPublishedPosts({
    limit: POSTS_PER_PAGE,
    offset: (page - 1) * POSTS_PER_PAGE,
  });

  if (page > 1 && posts.length === 0) redirect("/posts");

  return (
    <Container className={styles.archive}>
      <header className={styles.intro}>
        <h1>Posts</h1>
        <p>Writing from the publication.</p>
      </header>
      <section aria-labelledby="archive-list-title">
        <h2 className={styles.listHeading} id="archive-list-title">Recent posts</h2>
        <PostList posts={posts} />
      </section>
      <nav className={styles.pagination} aria-label="Post archive pages">
        {page > 1 ? <Link href={page === 2 ? "/posts" : `/posts?page=${page - 1}`}>Previous page</Link> : <span aria-hidden="true" />}
        <p>Page <span aria-current="page">{page}</span></p>
        {hasMore && page < MAX_POSTS_PAGE
          ? <Link href={`/posts?page=${page + 1}`}>Next page</Link>
          : <span aria-hidden="true" />}
      </nav>
    </Container>
  );
}
