import { Instagram } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface InstagramFeedProps {
  username?: string;
  posts?: string[];
}

// Default placeholder posts (can be configured from admin)
const defaultPosts = [
  'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1560343090-f0409e92791a?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?w=400&h=400&fit=crop',
];

export function InstagramFeed({ username = 'vanessalimashoes', posts = defaultPosts }: InstagramFeedProps) {
  return (
    <section className="py-12 bg-muted/30">
      <div className="container-custom">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Instagram className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold">Conheça nosso Instagram</h2>
          </div>
          <p className="text-muted-foreground">@{username}</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {posts.map((post, index) => (
            <a
              key={index}
              href={`https://instagram.com/${username}`}
              target="_blank"
              rel="noopener noreferrer"
              className="aspect-square overflow-hidden rounded-lg group relative"
            >
              <img
                src={post}
                alt={`Instagram post ${index + 1}`}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                <Instagram className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </a>
          ))}
        </div>

        <div className="text-center mt-8">
          <Button asChild variant="outline" size="lg">
            <a
              href={`https://instagram.com/${username}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2"
            >
              <Instagram className="h-5 w-5" />
              Siga-nos no Instagram
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
