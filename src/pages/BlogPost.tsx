import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, Calendar, ArrowLeft, User } from 'lucide-react';
import { blogService, type IBlogPost } from '../services/blogService';
import './Blog.css';

const BlogPost: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<IBlogPost | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    blogService.getBySlug(slug).then((p) => {
      setPost(p);
      setLoading(false);
      if (p) {
        document.title = `${p.title} | Lezerv Blog`;
        const meta = document.querySelector('meta[name="description"]');
        if (meta && p.excerpt) meta.setAttribute('content', p.excerpt);
      }
    });
  }, [slug]);

  const fmt = (d: string | null) =>
    d ? new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : '';

  if (loading) return <div className="blog-page loading"><Loader2 className="animate-spin" size={30} /></div>;
  if (!post) return (
    <div className="blog-page not-found">
      <h2>Post not found</h2>
      <Link to="/blog"><span className="blog-back"><ArrowLeft size={16} /> Back to blog</span></Link>
    </div>
  );

  return (
    <div className="blog-page">
      <article className="post-article">
        <Link to="/blog" className="blog-back"><ArrowLeft size={16} /> All posts</Link>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          {post.category && <span className="post-tag">{post.category}</span>}
          <h1 className="post-title">{post.title}</h1>
          <div className="post-meta">
            <span><User size={14} /> {post.author}</span>
            <span><Calendar size={14} /> {fmt(post.published_at || post.created_at)}</span>
          </div>
          {post.cover_image_url && (
            <div className="post-cover"><img src={post.cover_image_url} alt={post.title} /></div>
          )}
          <div className="post-content" dangerouslySetInnerHTML={{ __html: post.content || '' }} />
        </motion.div>
      </article>
    </div>
  );
};

export default BlogPost;
