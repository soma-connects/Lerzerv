import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, Calendar, ArrowRight, Newspaper } from 'lucide-react';
import { blogService, type IBlogPost } from '../services/blogService';
import './Blog.css';

const Blog: React.FC = () => {
  const [posts, setPosts] = useState<IBlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'Lezerv Blog | Home service tips & events in Lagos, Abuja & Port Harcourt';
    blogService.listPublished().then((p) => { setPosts(p); setLoading(false); });
  }, []);

  const fmt = (d: string | null) =>
    d ? new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : '';

  return (
    <div className="blog-page">
      <div className="blog-hero">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="blog-hero-inner">
          <span className="blog-eyebrow"><Newspaper size={15} /> Lezerv Blog</span>
          <h1>News, events & home-service tips</h1>
          <p>Updates from Lezerv and helpful guides for keeping your home running across Lagos, Abuja and Port Harcourt.</p>
        </motion.div>
      </div>

      <div className="blog-body">
        {loading ? (
          <div className="blog-empty"><Loader2 className="animate-spin" size={28} /></div>
        ) : posts.length === 0 ? (
          <div className="blog-empty">
            <Newspaper size={36} style={{ opacity: 0.3 }} />
            <h3>No posts yet</h3>
            <p>Check back soon for events and updates.</p>
          </div>
        ) : (
          <div className="blog-grid">
            {posts.map((p) => (
              <motion.article key={p.id} className="blog-card" whileHover={{ y: -4 }}>
                <Link to={`/blog/${p.slug}`} className="blog-card-link">
                  <div className="blog-cover">
                    {p.cover_image_url
                      ? <img src={p.cover_image_url} alt={p.title} loading="lazy" />
                      : <div className="blog-cover-fallback"><Newspaper size={28} /></div>}
                    {p.category && <span className="blog-tag">{p.category}</span>}
                  </div>
                  <div className="blog-card-body">
                    <h2>{p.title}</h2>
                    {p.excerpt && <p className="blog-excerpt">{p.excerpt}</p>}
                    <div className="blog-card-foot">
                      <span className="blog-date"><Calendar size={13} /> {fmt(p.published_at)}</span>
                      <span className="blog-read">Read <ArrowRight size={14} /></span>
                    </div>
                  </div>
                </Link>
              </motion.article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Blog;
