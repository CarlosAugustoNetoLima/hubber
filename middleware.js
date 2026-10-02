import { rewrite } from '@vercel/edge';

const REELS = {
  host: 'reels.hubbermarketing.com',
  prefixo: '/reels',
  rotas: {
  '/': '/reels/index.html',
  '/pt': '/reels/pt/index.html',
  '/pt/': '/reels/pt/index.html',
  '/privacy': '/reels/privacy/index.html',
  '/privacy/': '/reels/privacy/index.html',
  '/pt/privacidade': '/reels/pt/privacidade/index.html',
  '/pt/privacidade/': '/reels/pt/privacidade/index.html',
  '/robots.txt': '/reels/robots.txt',
  '/sitemap.xml': '/reels/sitemap.xml',
  '/llms.txt': '/reels/llms.txt',
  },
};

/* Briefings dos clientes: página privada, sem indexação, três telas. */
const BRIEFING = {
  host: 'briefing.hubbermarketing.com',
  prefixo: '/briefing',
  rotas: {
  '/': '/briefing/index.html',
  '/marca': '/briefing/marca/index.html',
  '/marca/': '/briefing/marca/index.html',
  '/site': '/briefing/site/index.html',
  '/site/': '/briefing/site/index.html',
  '/robots.txt': '/briefing/robots.txt',
  },
};

const SITES = [REELS, BRIEFING];

/* Só o domínio principal redireciona o caminho antigo para o subdomínio. Em
   preview (*.vercel.app) e em domínio ainda não apontado, a página precisa abrir
   no próprio endereço, senão o redirecionamento leva a um host que não existe. */
const PRINCIPAL = ['hubbermarketing.com', 'www.hubbermarketing.com'];

export const config = {
  matcher: [
    '/',
    '/pt',
    '/pt/',
    '/privacy',
    '/privacy/',
    '/pt/privacidade',
    '/pt/privacidade/',
    '/robots.txt',
    '/sitemap.xml',
    '/llms.txt',
    '/marca',
    '/marca/',
    '/site',
    '/site/',
    '/reels',
    '/reels/:caminho*',
    '/briefing',
    '/briefing/:caminho*',
  ],
};

export default function middleware(requisicao) {
  const url = new URL(requisicao.url);
  const host = requisicao.headers.get('host');

  const dono = SITES.find((s) => s.host === host);
  if (dono) {
    const destino = dono.rotas[url.pathname];
    if (!destino) return;
    url.pathname = destino;
    return rewrite(url);
  }

  // No domínio principal, o caminho do subdomínio vai para o endereço próprio.
  if (!PRINCIPAL.includes(host)) return;
  for (const s of SITES) {
    if (url.pathname === s.prefixo || url.pathname.startsWith(`${s.prefixo}/`)) {
      const resto = url.pathname.slice(s.prefixo.length) || '/';
      return Response.redirect(`https://${s.host}${resto}${url.search}`, 308);
    }
  }
}
