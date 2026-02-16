/**
 * One-time migration: Extract blog posts from src/data/blogPosts.ts
 * and write them to data/blog-posts.json for server-side storage.
 *
 * Run: node scripts/migrate-blog-posts.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

// Read the TypeScript source
const tsContent = fs.readFileSync(path.join(rootDir, 'src/data/blogPosts.ts'), 'utf-8');

// Extract the BLOG_POSTS array (everything between the first [ and the matching ];)
const arrayStart = tsContent.indexOf('export const BLOG_POSTS');
const bracketStart = tsContent.indexOf('[', arrayStart);
const bracketEnd = tsContent.lastIndexOf('];');
const arrayStr = tsContent.slice(bracketStart, bracketEnd + 1);

// The array content uses template literals and JS object syntax — evaluate it
const posts = eval(arrayStr);

// Augment each post with server-side fields
const now = new Date().toISOString();
const migrated = posts.map((post, i) => ({
  id: `migrated-${i + 1}`,
  ...post,
  status: 'published',
  createdAt: new Date(post.date + 'T00:00:00Z').toISOString(),
  updatedAt: now,
}));

// Write output
const outputDir = path.join(rootDir, 'data');
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

const outputPath = path.join(outputDir, 'blog-posts.json');
fs.writeFileSync(outputPath, JSON.stringify(migrated, null, 2));

console.log(`Migrated ${migrated.length} blog posts to ${outputPath}`);
migrated.forEach(p => console.log(`  - [${p.status}] ${p.title} (${p.slug})`));
