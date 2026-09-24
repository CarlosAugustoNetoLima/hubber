/**
 * De onde o lead veio, no formato que o card do CRM guarda. Serve às duas LPs
 * que mandam origem, o reels e a Connect.
 *
 * As UTMs viram dois campos: a campanha de um lado, o criativo do outro. O
 * fbclid vai inteiro, porque cortado ele não casa com nada na Meta, e o formato
 * é conferido para não levar qualquer coisa da URL para dentro do CRM. Quem
 * desativou a medição já não manda o fbclid: a página tira antes de enviar.
 */
export function origemDoLead(body) {
  const o = body.origem && typeof body.origem === 'object' ? body.origem : {};
  const juntar = (...partes) => partes
    .filter(Boolean).map((v) => String(v).slice(0, 100)).join(' · ');
  const clique = typeof o.fbclid === 'string' ? o.fbclid.trim() : '';
  return {
    campanha: juntar(o.utm_source, o.utm_medium, o.utm_campaign),
    criativo: juntar(o.utm_content, o.utm_term),
    clique: /^[\w.-]{10,500}$/.test(clique) ? clique : '',
  };
}
