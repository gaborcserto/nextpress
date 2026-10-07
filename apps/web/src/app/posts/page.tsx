import Link from "next/link";
import { redirect } from "next/navigation";

import styles from "./page.module.css";
import { LoadMorePostList } from "@/components/public-content/LoadMorePostList";
import postListStyles from "@/components/public-content/post-list.module.css";
import { PostList } from "@/components/public-content/PostList";
import { Container } from "@/components/public-ui/Container";
import { getMaxPostsPage, parsePostsPage } from "@/lib/content/post-archive";
import { getPublishedPosts } from "@/lib/content/public-content.server";
import { getPublicSiteSettings } from "@/lib/settings/public-site-settings.server";

type PostsPageProps = {
  searchParams: Promise<{ page?: string | string[] }>;
};

export default async function PostsPage({ searchParams }: PostsPageProps) {
  const { page: pageParam } = await searchParams;
  const settings = await getPublicSiteSettings();
  const page = parsePostsPage(pageParam, settings.postsPerPage);
  const { posts, hasMore } = await getPublishedPosts({
    limit: settings.postsPerPage,
    offset: (page - 1) * settings.postsPerPage,
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
        {settings.postListingMode === "LOAD_MORE" && posts.length > 0
          ? <LoadMorePostList
              key={`${page}:${posts.map(({ slug }) => slug).join(",")}`}
              posts={posts}
              page={page}
              hasMore={hasMore}
              postsPerPage={settings.postsPerPage}
            />
          : <PostList posts={posts} />}
      </section>
      {posts.length === 0 || settings.postListingMode === "LOAD_MORE" ? null : (
        <nav className={postListStyles.archiveNavigation} aria-label="Post archive pages">
          {page > 1 ? <Link href={page === 2 ? "/posts" : `/posts?page=${page - 1}`}>Previous page</Link> : <span aria-hidden="true" />}
          <p>Page <span aria-current="page">{page}</span></p>
          {hasMore && page < getMaxPostsPage(settings.postsPerPage)
            ? <Link href={`/posts?page=${page + 1}`}>Next page</Link>
            : <span aria-hidden="true" />}
        </nav>
      )}
    </Container>
  );
}
