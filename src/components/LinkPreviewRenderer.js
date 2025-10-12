"use client";
import React from 'react';
import { LinkPreview } from './ui/link-preview';
import { linkMappings } from '../utils/linkMappings';

export default function LinkPreviewRenderer({ text, className = "" }) {
  if (!text) return <span className={className}>{text}</span>;

  // Parse the HTML string to extract links
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/html');
  const links = doc.querySelectorAll('a[href]');
  
  if (links.length === 0) {
    // No links found, return the original text
    return <span className={className}>{text}</span>;
  }

  // Create a mapping of link data
  const linkData = Array.from(links).map(link => ({
    href: link.getAttribute('href'),
    text: link.textContent,
    originalHTML: link.outerHTML
  }));

  // Replace each link with a placeholder
  let processedText = text;
  linkData.forEach((link, index) => {
    const placeholder = `__LINK_PLACEHOLDER_${index}__`;
    processedText = processedText.replace(link.originalHTML, placeholder);
  });

  // Split the text by placeholders and create React elements
  const parts = processedText.split(/(__LINK_PLACEHOLDER_\d+__)/);
  
  // Function to get the appropriate image based on URL using centralized mappings
  const getImageForUrl = (url) => {
    // Find the mapping that matches this URL
    const mapping = Object.values(linkMappings).find(data => data.url === url);
    return mapping ? mapping.image : '/images/4sight.png'; // Default fallback
  };

  const elements = parts.map((part, index) => {
    const linkMatch = part.match(/__LINK_PLACEHOLDER_(\d+)__/);
    if (linkMatch) {
      const linkIndex = parseInt(linkMatch[1]);
      const link = linkData[linkIndex];
      return (
        <LinkPreview
          key={`link-${index}`}
          url={link.href}
          imageSrc={getImageForUrl(link.href)}
          isStatic={true}
          className="text-blue-400 hover:text-blue-300 underline font-bold"
        >
          {link.text}
        </LinkPreview>
      );
    }
    return part;
  });

  return <span className={className}>{elements}</span>;
}
