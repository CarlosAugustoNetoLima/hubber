import { rewrite } from '@vercel/edge';

const HOST = 'reels.hubbermarketing.com';

const ROTAS = {
  '/': '/reels/index.html',
  '/pt': '/reels/pt/index.html',
  '/pt/': '/reels/pt/index.html',
  '/robots.txt': '/reels/robots.txt',
  '/sitemap.xml': '/reels/sitemap.xml',
  '/llms.txt': '/reels/llms.txt',
};

export const config = {
  matcher: ['/', '/pt', '/pt/', '/robots.txt', '/sitemap.xml', '/llms.txt'],
};

export default function middleware(requisicao) {
  if (requisicao.headers.get('host') !== HOST) return;

  const url = new URL(requisicao.url);
  const destino = ROTAS[url.pathname];
  if (!destino) return;

  url.pathname = destino;
  return rewrite(url);
}
