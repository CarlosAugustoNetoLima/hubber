import { rewrite } from '@vercel/edge';

const HOST = 'reels.hubbermarketing.com';
const PREFIXO = '/reels';

const ROTAS = {
  '/': '/reels/index.html',
  '/pt': '/reels/pt/index.html',
  '/pt/': '/reels/pt/index.html',
  '/robots.txt': '/reels/robots.txt',
  '/sitemap.xml': '/reels/sitemap.xml',
  '/llms.txt': '/reels/llms.txt',
};

export const config = {
  matcher: [
    '/',
    '/pt',
    '/pt/',
    '/robots.txt',
    '/sitemap.xml',
    '/llms.txt',
    '/reels',
    '/reels/:caminho*',
  ],
};

export default function middleware(requisicao) {
  const url = new URL(requisicao.url);

  if (requisicao.headers.get('host') === HOST) {
    const destino = ROTAS[url.pathname];
    if (!destino) return;
    url.pathname = destino;
    return rewrite(url);
  }

  if (url.pathname === PREFIXO || url.pathname.startsWith(`${PREFIXO}/`)) {
    const resto = url.pathname.slice(PREFIXO.length) || '/';
    return Response.redirect(`https://${HOST}${resto}${url.search}`, 308);
  }
}
