import { useEffect } from 'react';

interface SEOProps {
  title: string;
  description?: string;
  keywords?: string;
}

export function useSEO({ title, description, keywords }: SEOProps) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = title;

    const descMeta = document.querySelector('meta[name="description"]');
    const prevDesc = descMeta?.getAttribute('content') || '';
    if (descMeta && description) {
      descMeta.setAttribute('content', description);
    }

    const keywordsMeta = document.querySelector('meta[name="keywords"]');
    const prevKeywords = keywordsMeta?.getAttribute('content') || '';
    if (keywordsMeta && keywords) {
      keywordsMeta.setAttribute('content', keywords);
    }

    // Open Graph
    const ogTitle = document.querySelector('meta[property="og:title"]');
    const prevOgTitle = ogTitle?.getAttribute('content') || '';
    if (ogTitle) {
      ogTitle.setAttribute('content', title);
    }

    const ogDesc = document.querySelector('meta[property="og:description"]');
    const prevOgDesc = ogDesc?.getAttribute('content') || '';
    if (ogDesc && description) {
      ogDesc.setAttribute('content', description);
    }

    // Twitter
    const twitterTitle = document.querySelector('meta[property="twitter:title"]');
    const prevTwitterTitle = twitterTitle?.getAttribute('content') || '';
    if (twitterTitle) {
      twitterTitle.setAttribute('content', title);
    }

    const twitterDesc = document.querySelector('meta[property="twitter:description"]');
    const prevTwitterDesc = twitterDesc?.getAttribute('content') || '';
    if (twitterDesc && description) {
      twitterDesc.setAttribute('content', description);
    }

    return () => {
      document.title = prevTitle;
      if (descMeta && prevDesc) descMeta.setAttribute('content', prevDesc);
      if (keywordsMeta && prevKeywords) keywordsMeta.setAttribute('content', prevKeywords);
      if (ogTitle && prevOgTitle) ogTitle.setAttribute('content', prevOgTitle);
      if (ogDesc && prevOgDesc) ogDesc.setAttribute('content', prevOgDesc);
      if (twitterTitle && prevTwitterTitle) twitterTitle.setAttribute('content', prevTwitterTitle);
      if (twitterDesc && prevTwitterDesc) twitterDesc.setAttribute('content', prevTwitterDesc);
    };
  }, [title, description, keywords]);
}
