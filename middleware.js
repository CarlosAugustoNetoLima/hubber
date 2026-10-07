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

/* Briefings dos clientes: páginas privadas, sem indexação, em português e em
   inglês (/en). Os caminhos do inglês também existem no site principal, onde o
   middleware não encontra dono e deixa passar. */
const BRIEFING = {
  host: 'briefing.hubbermarketing.com',
  prefixo: '/briefing',
  rotas: {
  '/': '/briefing/index.html',
  '/marca': '/briefing/marca/index.html',
  '/marca/': '/briefing/marca/index.html',
  '/site': '/briefing/site/index.html',
  '/site/': '/briefing/site/index.html',
  '/onboarding': '/briefing/onboarding/index.html',
  '/onboarding/': '/briefing/onboarding/index.html',
  '/designer': '/briefing/designer/index.html',
  '/designer/': '/briefing/designer/index.html',
  '/en': '/briefing/en/index.html',
  '/en/': '/briefing/en/index.html',
  '/en/brand': '/briefing/en/brand/index.html',
  '/en/brand/': '/briefing/en/brand/index.html',
  '/en/website': '/briefing/en/website/index.html',
  '/en/website/': '/briefing/en/website/index.html',
  '/en/onboarding': '/briefing/en/onboarding/index.html',
  '/en/onboarding/': '/briefing/en/onboarding/index.html',
  '/en/designer': '/briefing/en/designer/index.html',
  '/en/designer/': '/briefing/en/designer/index.html',
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
    '/onboarding',
    '/onboarding/',
    '/designer',
    '/designer/',
    '/en',
    '/en/',
    '/en/brand',
    '/en/brand/',
    '/en/website',
    '/en/website/',
    '/en/onboarding',
    '/en/onboarding/',
    '/en/designer',
    '/en/designer/',
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
    /* Nos briefings, página sem a barra final ganha a barra: os links da página
       são relativos (../, brand/) e, sem ela, /en/brand mandaria "All briefs"
       para a lista em português e os cards de /en para endereços que não existem. */
    if (dono === BRIEFING && !url.pathname.endsWith('/') && !url.pathname.includes('.')) {
      return Response.redirect(`https://${host}${url.pathname}/${url.search}`, 308);
    }
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
