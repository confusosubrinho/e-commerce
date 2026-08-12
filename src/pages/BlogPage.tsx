import { Link } from 'react-router-dom';
import { StoreLayout } from '@/components/store/StoreLayout';
import { useBlogPosts, useBlogSettings } from '@/hooks/useBlog';
import { Skeleton } from '@/components/ui/skeleton';
import { PageSEO } from '@/components/seo/PageSEO';
import { Calendar, ArrowRight, User, BookOpen } from 'lucide-react';
import NotFound from './NotFound';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export default function BlogPage() {
  const { data: settings, isLoading: settingsLoading } = useBlogSettings();
  const { data: posts, isLoading: postsLoading } = useBlogPosts(true);

  if (settingsLoading) {
    return (
      <StoreLayout>
        <div className="container-custom py-12">
          <Skeleton className="h-10 w-48 mx-auto mb-4" />
          <Skeleton className="h-5 w-72 mx-auto mb-10" />
          <Skeleton className="h-80 w-full rounded-2xl mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-72 rounded-xl" />
            ))}
          </div>
        </div>
      </StoreLayout>
    );
  }

  if (!settings?.is_active) {
    return <NotFound />;
  }

  const [featuredPost, ...restPosts] = posts || [];

  return (
    <StoreLayout>
      <PageSEO
        title="Blog | Vanessa Lima Shoes"
        description="Novidades, dicas de estilo e cuidados com calçados femininos em couro legítimo: leia os artigos do blog da Vanessa Lima Shoes."
        path="/blog"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'Blog',
          name: 'Blog | Vanessa Lima Shoes',
          description:
            'Novidades, dicas de estilo e cuidados com calçados femininos em couro legítimo.',
          url: 'https://vanessalimashoes.com.br/blog',
          inLanguage: 'pt-BR',
          publisher: { '@type': 'Organization', name: 'Vanessa Lima Shoes' },
          blogPost: (posts || []).slice(0, 10).map((p: any) => ({
            '@type': 'BlogPosting',
            headline: p.title,
            url: `https://vanessalimashoes.com.br/blog/${p.slug}`,
            ...(p.featured_image_url ? { image: p.featured_image_url } : {}),
            ...(p.published_at ? { datePublished: p.published_at } : {}),
            ...(p.author_name
              ? { author: { '@type': 'Person', name: p.author_name } }
              : {}),
          })),
        }}
      />

      <div className="container-custom py-10 md:py-16">
        {/* Header */}
        <div className="text-center mb-10 md:mb-14">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-3 tracking-tight">Blog</h1>
          <p className="text-muted-foreground text-base md:text-lg max-w-lg mx-auto">
            Novidades, dicas e inspirações para você
          </p>
        </div>

        {postsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-72 rounded-xl" />
            ))}
          </div>
        ) : !posts?.length ? (
          <div className="text-center py-20">
            <BookOpen className="h-16 w-16 mx-auto text-muted-foreground/20 mb-4" />
            <p className="text-lg font-medium mb-1">Nenhum post publicado ainda</p>
            <p className="text-muted-foreground">Volte em breve para conferir novidades!</p>
          </div>
        ) : (
          <div className="space-y-10 md:space-y-14">
            {/* Featured post — hero */}
            {featuredPost && (
              <Link
                to={`/blog/${featuredPost.slug}`}
                className="group block rounded-2xl overflow-hidden border bg-card hover:shadow-xl transition-shadow"
              >
                <div className="grid grid-cols-1 md:grid-cols-2">
                  <div className="aspect-[16/10] md:aspect-auto md:min-h-[320px] overflow-hidden">
                    {featuredPost.featured_image_url ? (
                      <img
                        src={featuredPost.featured_image_url}
                        alt={featuredPost.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full bg-muted flex items-center justify-center">
                        <BookOpen className="h-16 w-16 text-muted-foreground/20" />
                      </div>
                    )}
                  </div>
                  <div className="p-6 md:p-8 lg:p-10 flex flex-col justify-center">
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mb-3">
                      {featuredPost.published_at && (
                        <span className="flex items-center gap-1.5">
                          <Calendar className="h-3 w-3" />
                          {formatDate(featuredPost.published_at)}
                        </span>
                      )}
                      {featuredPost.author_name && (
                        <span className="flex items-center gap-1.5">
                          <User className="h-3 w-3" />
                          {featuredPost.author_name}
                        </span>
                      )}
                    </div>
                    <h2 className="text-xl md:text-2xl lg:text-3xl font-bold leading-tight group-hover:text-primary transition-colors mb-3 line-clamp-3">
                      {featuredPost.title}
                    </h2>
                    {featuredPost.excerpt && (
                      <p className="text-muted-foreground line-clamp-3 mb-4 text-sm md:text-base">
                        {featuredPost.excerpt}
                      </p>
                    )}
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                      Ler artigo <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </div>
                </div>
              </Link>
            )}

            {/* Rest of posts grid */}
            {restPosts.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
                {restPosts.map((post) => (
                  <Link
                    key={post.id}
                    to={`/blog/${post.slug}`}
                    className="group bg-card rounded-xl border overflow-hidden hover:shadow-lg transition-all duration-300 flex flex-col"
                  >
                    <div className="aspect-[16/10] overflow-hidden">
                      {post.featured_image_url ? (
                        <img
                          src={post.featured_image_url}
                          alt={post.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full bg-muted flex items-center justify-center">
                          <BookOpen className="h-8 w-8 text-muted-foreground/20" />
                        </div>
                      )}
                    </div>
                    <div className="p-4 sm:p-5 flex flex-col flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mb-2">
                        {post.published_at && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(post.published_at)}
                          </span>
                        )}
                        {post.author_name && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {post.author_name}
                          </span>
                        )}
                      </div>
                      <h2 className="text-base md:text-lg font-semibold leading-snug group-hover:text-primary transition-colors line-clamp-2 mb-2">
                        {post.title}
                      </h2>
                      {post.excerpt && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-3 flex-1">
                          {post.excerpt}
                        </p>
                      )}
                      <span className="inline-flex items-center gap-1 text-sm text-primary font-medium mt-auto pt-1">
                        Ler mais <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </StoreLayout>
  );
}
