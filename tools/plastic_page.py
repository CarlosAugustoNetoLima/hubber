#!/usr/bin/env python3
"""
Gera a LP /plastic/ (EN, principal) e /plastic/pt/ (PT) a partir de UMA fonte
de copy, para as duas línguas nunca divergirem em estrutura.

    python3 tools/plastic_page.py && python3 build.py

Copy revisada contra as regras do pedido: sem preço, sem garantia de pacientes,
consultas ou faturamento; clientes brasileiros apresentados como brasileiros;
resultados dos médicos não atribuídos à Hubber; a página confirma o recebimento
do pedido e nunca diz que uma reunião foi marcada.

Depoimentos: tools/plastic_testimonials.json (transcrição + tradução fiel).
Enquanto a dublagem não for aprovada, a página usa o vídeo ORIGINAL em
português com legenda em inglês.
"""
import html
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
E = html.escape

# Cabeçalho idêntico ao das outras páginas: o <script> inline tem hash na CSP.
HEAD_SCRIPT = """<script>
(function(){var h=document.documentElement;h.classList.add('has-js');
if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches){h.classList.add('has-motion');
window.setTimeout(function(){if(!h.classList.contains('motion-ready')){h.classList.remove('has-motion');}},1500);}})();
</script>"""

LOGO = re.search(r'(<svg xmlns="http://www.w3.org/2000/svg" viewBox="91.50.*?</svg>)',
                 (ROOT / 'partials/header.html').read_text(encoding='utf8'), re.S).group(1)
LOGO = LOGO.replace('hubber-logo-title-hdr', 'hubber-logo-title-pl')

IMG = '/assets/img/plastic'
VID = '/assets/video/plastic'

CLIENTS = [
    # (nome, linha descritiva EN, PT, handle). Dados públicos dos perfis.
    ('Dr. Luiz Cruz', '', '', 'drluizcruz'),
    ('Dr. Ícaro Samuel', 'Lipo HD · Dream Clinic', 'Lipo HD · Dream Clinic', 'dricarosamuel'),
    ('Dr. Seung Lee', 'Plastic surgeon', 'Cirurgião plástico', 'dr.seung'),
    ('Dr. Antonio Melo', 'Plastic surgeon', 'Cirurgião plástico', 'drantoniomelo'),
    ('Human Clinic', '', '', 'humanclinicbr'),
]

WORK = [
    # (arquivo, legenda EN, PT, aviso EN, PT) — vídeos originais em português, produzidos pela Hubber.
    ('work-ad-creative', 'Ad creative: the surgeon on camera', 'Criativo de anúncio: o cirurgião na câmera',
     'Contains surgical footage', 'Contém imagens de cirurgia'),
    ('work-or-technique', 'In the operating room: a technique, explained', 'No centro cirúrgico: uma técnica, explicada',
     'Contains surgical footage and partial nudity', 'Contém imagens de cirurgia e nudez parcial'),
    ('work-patient-journey', 'A patient’s journey, narrated by the surgeon', 'A jornada de uma paciente, narrada pelo cirurgião',
     'Contains surgical footage and body images', 'Contém imagens de cirurgia e do corpo da paciente'),
    ('work-procedure', 'Procedure and results content', 'Conteúdo de procedimento e resultado',
     'Contains surgical footage and partial nudity', 'Contém imagens de cirurgia e nudez parcial'),
]

C = {
 'en': dict(
  lang='en-US', path='/plastic/', other='/plastic/pt/',
  title='Marketing for Plastic Surgery Practices in the U.S. | Hubber',
  desc='Hubber Agency connects content, ads, landing pages and lead tracking for plastic surgery practices in the U.S. Talk through your growth plan with Nicolas Palma.',
  og_title='Marketing for plastic surgery practices | Hubber Agency',
  skip='Skip to content', top_cta='Talk to Nicolas', lang_label='Language',
  eyebrow='Hubber Agency · For plastic surgery practices in the U.S.',
  h1='Patients research the surgeon <mark class="hl">long before they book</mark> the consultation.',
  lead='We connect what they find along the way, from your content and ads to your website and the first reply, so the trust you have built shows up at every step and taking the next one feels easy.',
  cta="Talk through your practice’s growth plan", cta2='See how we work',
  note='A 30-minute conversation with Nicolas Palma, specific to your practice. No cost.',
  hero_alt='Nicolas Palma, founder of Hubber, speaking on stage with a microphone.',
  hero_cap='Nicolas Palma, founder of Hubber.',
  proof_label='Who we work with',
  proof_h2='We already do this work for plastic surgeons, <mark class="hl">in Brazil.</mark>',
  proof_intro='These practices are Hubber clients. Their reputation, audience and clinical results are their own work; we are part of the team behind the marketing. In the U.S. we apply that experience with adaptation: a different market, different patients and different rules.',
  country='Brazil',
  stat100='100+', stat100_t='plastic surgeons have worked with Hubber in Brazil',
  work_label='Content we produce',
  work_h2='We film on site, <mark class="hl">at the practice.</mark>',
  work_intro='A few pieces Hubber filmed and edited for plastic surgeons in Brazil, in Portuguese. Some contain surgical footage, so nothing plays until you click.',
  work_play='Play',
  testi_h3='In their words',
  testi_note='Original in Portuguese, with English subtitles.',
  testi_play='Play testimonial',
  testi_playing='Playing testimonial',
  testi_read='Read the full transcript',
  testi_orig='Original (Portuguese)', testi_tr='English translation',
  testi_pending='',
  prob_label='The problem',
  prob_h2='Most practices don’t lose patients to a competitor. <mark class="hl">They lose them along the way.</mark>',
  journey=[
   ('Discovery', 'A potential patient sees a reel or an ad. If it looks like everyone else’s, they keep scrolling.'),
   ('Trust', 'They check your profile, your results and your reviews. Gaps here cost more than a weak ad.'),
   ('Contact', 'They send a message or fill out a form. If the reply takes a day, they may already be talking to another practice.'),
   ('Consultation', 'Someone books. Nobody knows which campaign, post or page brought them, so the budget keeps going to guesses.'),
  ],
  prob_close='When content, ads, website and follow-up are run by people who never talk to each other, each one can look fine on its own report while opportunities fall through the gaps.',
  scope_label='What Hubber Agency does',
  scope_h2='One team for the path from first impression to <mark class="hl">booked consultation.</mark>',
  scope_intro='Included according to the scope we agree on with your practice.',
  scope=[
   ('Paid media strategy and management', 'Meta and Google campaigns built around your procedures, your market and the patients you want to attract.'),
   ('Content planning and production', 'Content that shows your expertise and your practice, including on-site filming at the practice, planned with you and produced within the agreed scope.'),
   ('Website and landing pages', 'Pages that answer what patients ask before they reach out, and make the next step obvious.'),
   ('Lead source tracking', 'You see where each lead came from and how it moved forward, so budget decisions rest on data.'),
   ('Pipeline and first follow-up', 'A clear pipeline, alerts for new leads, scheduling and basic follow-up, so no inquiry sits unanswered.'),
   ('Ongoing reviews and optimization', 'Regular reviews of what is working, and adjustments based on what we learn together.'),
  ],
  scope_fine='Scope is defined per practice and written into the contract. Complex CRM migrations, full conversational AI agents, AI phone calls and custom integrations are scoped separately. We do not promise leads, consultations, revenue or return.',
  split_label='Who does what',
  split_h2='We bring the patient to the conversation. <mark class="hl">Your team leads it from there.</mark>',
  us_h='Hubber', us=[
   'Strategy, campaigns and media budget management',
   'Content plan and production within scope',
   'Website and landing pages',
   'Lead source tracking and reporting',
   'Pipeline setup, new-lead alerts and basic follow-up',
   'Regular reviews and optimization',
  ],
  them_h='Your practice', them=[
   'Conversations with patients: calls, messages and questions',
   'Patient care and all clinical communication',
   'Scheduling and running consultations',
   'Closing: quotes, financing and surgery booking',
   'Approving content and campaigns, and providing access',
   'Telling us what happens after each consultation',
  ],
  split_fine='We never discuss medical decisions with patients. Clinical information stays with your team.',
  steps_label='How we start',
  steps_h2='Four steps, <mark class="hl">in this order.</mark>',
  steps=[
   ('Diagnostic', 'We review your current presence, accounts, website and how leads are handled today.'),
   ('Priorities', 'We agree on what comes first, what we will measure and what is in scope.'),
   ('Activation', 'With your access and approvals, we set up tracking, pages and campaigns. Nothing goes live without your sign-off.'),
   ('Optimization', 'We review results with you on a regular cadence and adjust.'),
  ],
  steps_fine='We work inside accounts that belong to your practice. You keep ownership of ad accounts, pages, domain and data.',
  nic_label='Who you will talk to',
  nic_h2='Nicolas Palma, <mark class="hl">founder of Hubber.</mark>',
  nic_p=['Nicolas leads Hubber’s work with plastic surgery practices and has spoken to more than 300 plastic surgeons about how patients find, evaluate and choose a surgeon.',
         'The first conversation is with him, about your practice, not a generic presentation.'],
  stat='300+', stat_t='plastic surgeons have heard Nicolas speak',
  photos=[('stage-auditorium', 'Nicolas Palma speaking to a full auditorium.', 'On stage, Brazil.'),
          ('stage-talk', 'Nicolas Palma presenting with a microphone.', 'Presenting a talk.'),
          ('stage-group', 'Nicolas Palma on stage with two other speakers, audience behind them.', 'After a talk.')],
  faq_label='Questions', faq_h2='Before you reach out.',
  faq=[
   ('Do you guarantee patients or revenue?', 'No. We are responsible for the marketing structure and its execution: campaigns, content, pages, tracking and first follow-up. Results depend on many factors, including your market, your offer and how your team handles each conversation. We commit to the work, the cadence and being transparent about what the numbers show.'),
   ('Your clients are in Brazil. Why the U.S.?', 'Our experience comes from working with plastic surgeons in Brazil. In the U.S. we apply it with adaptation to a different market, platforms, competition and rules. We do not promise to replicate any Brazilian result.'),
   ('Who will work on our account?', 'A dedicated Hubber team, with Nicolas involved in the strategy. Our team is based in Brazil and works in U.S. time zones.'),
   ('What happens after I send the form?', 'We confirm we received it and reply by email to find a time. The call takes about 30 minutes: we look at your current presence, understand your goals and point out the priorities we see. It is not a full marketing plan, and there is no obligation.'),
   ('Do you need patient data?', 'No. Marketing does not require patient medical information, and this form only asks for business contact details.'),
  ],
  fin_label='Next step',
  fin_h2='Talk through your practice’s <mark class="hl">growth plan.</mark>',
  fin_p='In about 30 minutes we look at how your practice shows up today, understand what you want to achieve and point out the priorities we would tackle first.',
  fin_list=['A look at your current presence: content, ads, website and response', 'Your goals for the next months', 'The priorities we see, and whether Hubber Agency is a fit'],
  form_h='Request the conversation',
  f=dict(nome='Full name', email='Work email', telefone='Phone', clinica='Practice name', site='Website or Instagram',
         local='City and state', funcao='Your role', objetivo='Main goal', detalhe='Anything we should know?',
         optional='(optional)', choose='Choose one',
         detalhe_ph='Procedures you focus on, current marketing, what is not working. Please do not include patient information.',
         consent='I agree that Hubber may use this information to contact me about this request. See our <a href="/en/privacy/">Privacy Policy</a>.',
         submit='Request the conversation',
         after='We will confirm receipt and reply by email to schedule. Sending this form does not book a meeting.'),
  roles=[('surgeon-owner', 'Surgeon and practice owner'), ('practice-owner', 'Owner or partner (non-surgeon)'),
         ('practice-manager', 'Practice manager'), ('marketing', 'Marketing lead'), ('other', 'Other')],
  goals=[('consultations', 'More qualified consultations'), ('authority', 'Stronger authority and online presence'),
         ('ads', 'Ads that attract the right patients'), ('website', 'A website and landing pages that convert'),
         ('tracking', 'Knowing where patients come from'), ('other', 'Something else')],
  foot='© 2026 Hubber. Part of Grupo Cinnamon.', privacy='Privacy', privacy_href='/en/privacy/', terms='Terms', terms_href='/en/terms/',
 ),
 'pt': dict(
  lang='pt-BR', path='/plastic/pt/', other='/plastic/',
  title='Marketing para clínicas de cirurgia plástica nos EUA | Hubber',
  desc='A Hubber Agency conecta conteúdo, anúncios, landing pages e mensuração de leads para clínicas de cirurgia plástica nos EUA. Converse com Nicolas Palma.',
  og_title='Marketing para clínicas de cirurgia plástica | Hubber Agency',
  skip='Pular para o conteúdo', top_cta='Falar com o Nicolas', lang_label='Idioma',
  eyebrow='Hubber Agency · Para clínicas de cirurgia plástica nos EUA',
  h1='O paciente pesquisa o cirurgião <mark class="hl">muito antes de marcar</mark> a consulta.',
  lead='Nós conectamos o que ele encontra pelo caminho, do seu conteúdo e dos anúncios ao site e à primeira resposta, para que a confiança que você construiu apareça em cada etapa e dar o próximo passo fique fácil.',
  cta='Conversar sobre o plano de crescimento da clínica', cta2='Ver como trabalhamos',
  note='Uma conversa de 30 minutos com Nicolas Palma, específica para a sua clínica. Sem custo.',
  hero_alt='Nicolas Palma, fundador da Hubber, palestrando com microfone no palco.',
  hero_cap='Nicolas Palma, fundador da Hubber.',
  proof_label='Com quem trabalhamos',
  proof_h2='Já fazemos esse trabalho para cirurgiões plásticos, <mark class="hl">no Brasil.</mark>',
  proof_intro='Estas clínicas são clientes da Hubber. A reputação, a audiência e os resultados clínicos são trabalho delas; nós fazemos parte do time por trás do marketing. Nos EUA, aplicamos essa experiência com adaptação: outro mercado, outros pacientes e outras regras.',
  country='Brasil',
  stat100='100+', stat100_t='cirurgiões plásticos já trabalharam com a Hubber no Brasil',
  work_label='Conteúdo que produzimos',
  work_h2='Gravamos presencialmente, <mark class="hl">na clínica.</mark>',
  work_intro='Algumas peças que a Hubber gravou e editou para cirurgiões plásticos no Brasil. Algumas contêm imagens de cirurgia, por isso nada toca até você clicar.',
  work_play='Assistir',
  testi_h3='Nas palavras deles',
  testi_note='Original em português.',
  testi_play='Assistir ao depoimento',
  testi_playing='Reproduzindo depoimento',
  testi_read='Ler a transcrição completa',
  testi_orig='Original (português)', testi_tr='Tradução em inglês',
  testi_pending='',
  prob_label='O problema',
  prob_h2='A maioria das clínicas não perde pacientes para um concorrente. <mark class="hl">Perde pelo caminho.</mark>',
  journey=[
   ('Descoberta', 'O potencial paciente vê um reel ou um anúncio. Se parece igual ao de todo mundo, ele segue rolando.'),
   ('Confiança', 'Ele confere seu perfil, seus resultados e suas avaliações. Lacunas aqui custam mais do que um anúncio fraco.'),
   ('Contato', 'Ele manda mensagem ou preenche um formulário. Se a resposta demora um dia, talvez já esteja conversando com outra clínica.'),
   ('Consulta', 'Alguém agenda. Ninguém sabe qual campanha, post ou página trouxe essa pessoa, e a verba continua indo para palpites.'),
  ],
  prob_close='Quando conteúdo, anúncios, site e atendimento ficam com pessoas que não conversam entre si, cada parte pode parecer bem no próprio relatório enquanto as oportunidades escapam entre elas.',
  scope_label='O que a Hubber Agency faz',
  scope_h2='Um time para o caminho entre a primeira impressão e <mark class="hl">a consulta marcada.</mark>',
  scope_intro='Incluído conforme o escopo que combinamos com a sua clínica.',
  scope=[
   ('Estratégia e gestão de mídia paga', 'Campanhas no Meta e no Google pensadas para os seus procedimentos, o seu mercado e os pacientes que você quer atrair.'),
   ('Planejamento e produção de conteúdo', 'Conteúdo que mostra a sua expertise e a sua clínica, com captação presencial na clínica, planejado com você e produzido dentro do escopo combinado.'),
   ('Site e landing pages', 'Páginas que respondem o que o paciente pergunta antes de entrar em contato e deixam o próximo passo óbvio.'),
   ('Mensuração da origem dos leads', 'Você vê de onde veio cada lead e como ele avançou, e as decisões de verba passam a se apoiar em dados.'),
   ('Pipeline e primeiro acompanhamento', 'Um pipeline claro, aviso de novos leads, agendamento e follow-up básico, para nenhum contato ficar sem resposta.'),
   ('Revisões e otimização contínua', 'Revisões periódicas do que está funcionando e ajustes a partir do que aprendemos juntos.'),
  ],
  scope_fine='O escopo é definido por clínica e registrado no contrato. Migração complexa de CRM, agentes conversacionais completos, ligações com IA e integrações personalizadas têm escopo separado. Não prometemos leads, consultas, faturamento nem retorno.',
  split_label='Quem faz o quê',
  split_h2='Nós trazemos o paciente até a conversa. <mark class="hl">Sua equipe conduz a partir dali.</mark>',
  us_h='Hubber', us=[
   'Estratégia, campanhas e gestão da verba de mídia',
   'Plano e produção de conteúdo dentro do escopo',
   'Site e landing pages',
   'Mensuração e relatório da origem dos leads',
   'Montagem do pipeline, aviso de novos leads e follow-up básico',
   'Revisões periódicas e otimização',
  ],
  them_h='Sua clínica', them=[
   'Conversas com pacientes: ligações, mensagens e dúvidas',
   'Atendimento e toda a comunicação clínica',
   'Agendamento e realização das consultas',
   'Fechamento: orçamento, financiamento e marcação da cirurgia',
   'Aprovar conteúdos e campanhas, e liberar acessos',
   'Contar para nós o que acontece depois de cada consulta',
  ],
  split_fine='Nunca discutimos decisões médicas com pacientes. A informação clínica fica com a sua equipe.',
  steps_label='Como começamos',
  steps_h2='Quatro etapas, <mark class="hl">nesta ordem.</mark>',
  steps=[
   ('Diagnóstico', 'Revisamos sua presença atual, contas, site e como os leads são atendidos hoje.'),
   ('Prioridades', 'Combinamos o que vem primeiro, o que vamos medir e o que entra no escopo.'),
   ('Ativação', 'Com seus acessos e aprovações, configuramos mensuração, páginas e campanhas. Nada vai ao ar sem o seu ok.'),
   ('Otimização', 'Revisamos os resultados com você numa cadência fixa e ajustamos.'),
  ],
  steps_fine='Trabalhamos dentro de contas que pertencem à sua clínica. Contas de anúncio, páginas, domínio e dados continuam seus.',
  nic_label='Com quem você vai conversar',
  nic_h2='Nicolas Palma, <mark class="hl">fundador da Hubber.</mark>',
  nic_p=['Nicolas lidera o trabalho da Hubber com clínicas de cirurgia plástica e já falou para mais de 300 cirurgiões plásticos sobre como o paciente encontra, avalia e escolhe um cirurgião.',
         'A primeira conversa é com ele, sobre a sua clínica, e não uma apresentação genérica.'],
  stat='300+', stat_t='cirurgiões plásticos já assistiram a uma palestra do Nicolas',
  photos=[('stage-auditorium', 'Nicolas Palma palestrando para um auditório cheio.', 'No palco, Brasil.'),
          ('stage-talk', 'Nicolas Palma apresentando com microfone.', 'Durante uma palestra.'),
          ('stage-group', 'Nicolas Palma no palco com outros dois palestrantes, com a plateia ao fundo.', 'Depois de uma palestra.')],
  faq_label='Perguntas', faq_h2='Antes de entrar em contato.',
  faq=[
   ('Vocês garantem pacientes ou faturamento?', 'Não. Somos responsáveis pela estrutura de marketing e pela execução: campanhas, conteúdo, páginas, mensuração e primeiro acompanhamento. O resultado depende de muitos fatores, entre eles o seu mercado, a sua oferta e como a sua equipe conduz cada conversa. Nosso compromisso é com o trabalho, a cadência e a transparência sobre o que os números mostram.'),
   ('Seus clientes estão no Brasil. Por que os EUA?', 'Nossa experiência vem do trabalho com cirurgiões plásticos no Brasil. Nos EUA, aplicamos essa experiência com adaptação a outro mercado, outras plataformas, outra concorrência e outras regras. Não prometemos repetir nenhum resultado brasileiro.'),
   ('Quem vai trabalhar na nossa conta?', 'Um time dedicado da Hubber, com o Nicolas envolvido na estratégia. Nossa equipe fica no Brasil e trabalha no fuso dos EUA.'),
   ('O que acontece depois que eu envio o formulário?', 'Confirmamos o recebimento e respondemos por e-mail para encontrar um horário. A conversa dura cerca de 30 minutos: olhamos sua presença atual, entendemos seus objetivos e apontamos as prioridades que enxergamos. Não é um plano de marketing completo, e não há compromisso.'),
   ('Vocês precisam de dados de pacientes?', 'Não. O marketing não precisa de informação médica de pacientes, e este formulário só pede dados de contato comercial.'),
  ],
  fin_label='Próximo passo',
  fin_h2='Converse sobre o <mark class="hl">plano de crescimento da clínica.</mark>',
  fin_p='Em cerca de 30 minutos olhamos como a sua clínica aparece hoje, entendemos o que você quer alcançar e apontamos as prioridades que atacaríamos primeiro.',
  fin_list=['Uma leitura da sua presença atual: conteúdo, anúncios, site e atendimento', 'Seus objetivos para os próximos meses', 'As prioridades que enxergamos, e se a Hubber Agency faz sentido'],
  form_h='Pedir a conversa',
  f=dict(nome='Nome completo', email='E-mail profissional', telefone='Telefone', clinica='Nome da clínica', site='Site ou Instagram',
         local='Cidade e estado', funcao='Sua função', objetivo='Objetivo principal', detalhe='Algo que devemos saber?',
         optional='(opcional)', choose='Escolha uma opção',
         detalhe_ph='Procedimentos em que você foca, marketing atual, o que não está funcionando. Não inclua informações de pacientes.',
         consent='Autorizo a Hubber a usar estes dados para entrar em contato sobre este pedido. Veja a <a href="/privacidade/">Política de Privacidade</a>.',
         submit='Pedir a conversa',
         after='Vamos confirmar o recebimento e responder por e-mail para agendar. Enviar este formulário não marca uma reunião.'),
  roles=[('surgeon-owner', 'Cirurgião(ã) e dono(a) da clínica'), ('practice-owner', 'Dono(a) ou sócio(a), não cirurgião'),
         ('practice-manager', 'Gestor(a) da clínica'), ('marketing', 'Responsável por marketing'), ('other', 'Outra')],
  goals=[('consultations', 'Mais consultas qualificadas'), ('authority', 'Autoridade e presença digital mais fortes'),
         ('ads', 'Anúncios que trazem o paciente certo'), ('website', 'Site e landing pages que convertem'),
         ('tracking', 'Saber de onde vêm os pacientes'), ('other', 'Outro objetivo')],
  foot='© 2026 Hubber. Uma empresa do Grupo Cinnamon.', privacy='Privacidade', privacy_href='/privacidade/', terms='Termos', terms_href='/termos/',
 ),
}


def testimonials(k, t):
    p = ROOT / 'tools/plastic_testimonials.json'
    if not p.exists():
        return ''
    items = json.loads(p.read_text(encoding='utf8'))
    out = []
    for it in items:
        orig = ''.join(f'<p>{E(x)}</p>' for x in it['pt'])
        tr = ''.join(f'<p>{E(x)}</p>' for x in it['en'])
        cap = f' data-captions="{VID}/{it["id"]}.en.vtt" data-captions-lang="en" data-captions-label="English"' if k == 'en' else ''
        who = it['who'][k]
        role = it['role'][k]
        out.append(f'''      <figure class="pl-testi pl-reveal">
        <button class="pl-testi__player" type="button" data-video="{VID}/{it["id"]}.mp4"{cap} data-playing-label="{E(t["testi_playing"])}"
          style="background-image:url('{VID}/{it["id"]}-poster.webp')" aria-label="{E(t["testi_play"])}: {E(who)}">
          <span class="pl-testi__play"><i aria-hidden="true"></i>{E(t["testi_play"])}</span>
        </button>
        <figcaption>
          <p class="pl-testi__who">{E(who)}</p>
          <p class="pl-testi__role t-small">{E(role)}</p>
          <p class="pl-testi__note pl-mono">{E(t["testi_note"])}</p>
          <details>
            <summary>{E(t["testi_read"])}</summary>
            <div class="pl-testi__text"><div><h4>{E(t["testi_orig"])}</h4>{orig}</div><div><h4>{E(t["testi_tr"])}</h4>{tr}</div></div>
          </details>
        </figcaption>
      </figure>''')
    return f'''
    <h3 class="pl-label t-label t-accent" style="margin-top:clamp(56px,7vw,104px)">{E(t["testi_h3"])}</h3>
    <div class="pl-testis" style="margin-top:var(--s24)">
{chr(10).join(out)}
    </div>'''


def work_items(k, t):
    out = []
    for vid, cen, cpt, wen, wpt in WORK:
        cap, warn = (cen, wen) if k == 'en' else (cpt, wpt)
        out.append(f'''      <figure class="pl-work__item pl-reveal">
        <button class="pl-testi__player pl-work__player" type="button" data-video="{VID}/{vid}.mp4" data-playing-label="{E(cap)}"
          style="background-image:url('{VID}/{vid}-poster.webp')" aria-label="{E(t["work_play"])}: {E(cap)}. {E(warn)}.">
          <span class="pl-work__warn pl-mono">{E(warn)}</span>
          <span class="pl-testi__play"><i aria-hidden="true"></i>{E(t["work_play"])}</span>
        </button>
        <figcaption class="t-small">{E(cap)}</figcaption>
      </figure>''')
    return '\n'.join(out)


def page(k):
    t = C[k]
    f = t['f']
    other_lang = 'PT' if k == 'en' else 'EN'
    clients = '\n'.join(
        f'      <li><a href="https://www.instagram.com/{h}/" rel="noopener" target="_blank">'
        f'<span class="pl-names__name">{E(n)}</span></a>'
        f'<span class="pl-names__meta">{E((en if k == "en" else pt) + " · ") if en else ""}@{E(h)}</span>'
        f'<span class="pl-names__meta pl-mono">{E(t["country"])}</span></li>'
        for n, en, pt, h in CLIENTS)
    path = '\n'.join(
        f'      <li><span class="pl-path__n">{i:02d}</span><span class="pl-path__stage">{E(a)}</span><p class="pl-path__text">{E(b)}</p></li>'
        for i, (a, b) in enumerate(t['journey'], 1))
    scope = '\n'.join(f'        <li class="pl-reveal"><h3>{E(a)}</h3><p>{E(b)}</p></li>' for a, b in t['scope'])
    us = '\n'.join(f'          <li>{E(x)}</li>' for x in t['us'])
    them = '\n'.join(f'          <li>{E(x)}</li>' for x in t['them'])
    steps = '\n'.join(
        f'      <li class="pl-reveal"><span class="pl-steps__n">{i:02d}</span><h3>{E(a)}</h3><p>{E(b)}</p></li>'
        for i, (a, b) in enumerate(t['steps'], 1))
    dims = [('lg', 1200, 1080), ('sm', 900, 563), ('sm', 900, 563)]
    photos = '\n'.join(
        f'        <figure><img src="{IMG}/{n}-{dims[i][0]}.webp" alt="{E(alt)}" loading="lazy" decoding="async"'
        f' width="{dims[i][1]}" height="{dims[i][2]}"><figcaption class="pl-mono">{E(cap)}</figcaption></figure>'
        for i, (n, alt, cap) in enumerate(t['photos']))
    nic_p = '\n'.join(f'      <p class="pl-intro">{E(p)}</p>' for p in t['nic_p'])
    faq = '\n'.join(
        f'      <details>\n        <summary>{E(q)}</summary>\n        <div class="faq__a"><p class="t-body">{E(a)}</p></div>\n      </details>'
        for q, a in t['faq'])
    fin_list = '\n'.join(f'        <li>{E(x)}</li>' for x in t['fin_list'])
    opt = lambda pairs: '\n'.join(f'              <option value="{v}">{E(lbl)}</option>' for v, lbl in pairs)

    def field(name, label, typ='text', required=True, full=False, auto='', extra=''):
        o = '' if required else f' <span>{E(f["optional"])}</span>'
        req = ' required aria-required="true"' if required else ''
        ac = f' autocomplete="{auto}"' if auto else ''
        return (f'          <div class="pl-field{" pl-field--full" if full else ""}">'
                f'<label for="f-{name}">{E(label)}{o}</label>'
                f'<input id="f-{name}" name="{name}" type="{typ}"{req}{ac}{extra} aria-describedby="e-{name}">'
                f'<p class="pl-field__err" id="e-{name}" data-err="{name}" aria-live="polite"></p></div>')

    def select(name, label, pairs):
        return (f'          <div class="pl-field"><label for="f-{name}">{E(label)}</label>'
                f'<select id="f-{name}" name="{name}" required aria-required="true" aria-describedby="e-{name}">'
                f'<option value="">{E(f["choose"])}</option>\n{opt(pairs)}</select>'
                f'<p class="pl-field__err" id="e-{name}" data-err="{name}" aria-live="polite"></p></div>')

    canonical = f'https://hubbermarketing.com{t["path"]}'
    schema = json.dumps({
        "@context": "https://schema.org", "@type": "Service",
        "name": "Hubber Agency for plastic surgery practices" if k == 'en' else "Hubber Agency para clínicas de cirurgia plástica",
        "serviceType": "Marketing for plastic surgery practices",
        "provider": {"@type": "Organization", "name": "Hubber", "url": "https://hubbermarketing.com/"},
        "areaServed": "US", "url": canonical,
    }, ensure_ascii=False, indent=2)

    return f'''<!doctype html>
<html lang="{t["lang"]}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
{HEAD_SCRIPT}
<title>{E(t["title"])}</title>
<meta name="description" content="{E(t["desc"])}">
<meta name="robots" content="noindex, nofollow">
<link rel="icon" type="image/svg+xml" href="/assets/brand/favicon.svg">
<link rel="canonical" href="{canonical}">
<link rel="alternate" hreflang="en-US" href="https://hubbermarketing.com/plastic/">
<link rel="alternate" hreflang="pt-BR" href="https://hubbermarketing.com/plastic/pt/">
<link rel="alternate" hreflang="x-default" href="https://hubbermarketing.com/plastic/">
<meta property="og:title" content="{E(t["og_title"])}">
<meta property="og:description" content="{E(t["desc"])}">
<meta property="og:url" content="{canonical}">
<meta property="og:image" content="https://hubbermarketing.com{IMG}/stage-auditorium-lg.webp">
<meta property="og:type" content="website">
<meta property="og:locale" content="{t["lang"].replace("-", "_")}">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">
{schema}
</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preload" href="/assets/fonts/946-latin-wide-3.DEV-PREVIEW.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@100..125,300..700&family=JetBrains+Mono:wght@400;500;700&display=swap">
<link rel="stylesheet" href="/css/fonts.css">
<link rel="stylesheet" href="/css/tokens.css">
<link rel="stylesheet" href="/css/base.css">
<link rel="stylesheet" href="/css/layout.css">
<link rel="stylesheet" href="/css/components.css">
<link rel="stylesheet" href="/css/pages/plastic.css">
<link rel="preload" as="image" href="{IMG}/stage-keynote-sm.webp" fetchpriority="high">
</head>
<body data-surface="ink" class="pl">

<a class="skip" href="#main">{E(t["skip"])}</a>

<header class="pl-top" data-surface="ink">
  <div class="wrap pl-top__in">
    <a class="pl-top__logo" href="{t["path"]}" aria-label="Hubber">{LOGO}</a>
    <div class="pl-top__end">
      <nav class="pl-lang" aria-label="{E(t["lang_label"])}">
        <a href="/plastic/" lang="en-US" hreflang="en-US"{' aria-current="page"' if k == 'en' else ''}>EN</a><span aria-hidden="true">/</span><a href="/plastic/pt/" lang="pt-BR" hreflang="pt-BR"{' aria-current="page"' if k == 'pt' else ''}>PT</a>
      </nav>
      <a class="btn btn--primary" href="#contact">{E(t["top_cta"])}</a>
    </div>
  </div>
</header>

<main id="main">

<section class="pl-hero" data-surface="ink" aria-labelledby="hero-title">
  <div class="wrap pl-hero__grid">
    <div>
      <p class="t-label t-accent">{E(t["eyebrow"])}</p>
      <h1 class="pl-h1" id="hero-title">{t["h1"]}</h1>
      <p class="pl-hero__lead">{E(t["lead"])}</p>
      <div class="pl-hero__actions">
        <a class="btn btn--primary" href="#contact">{E(t["cta"])}</a>
        <a class="pl-link" href="#work">{E(t["cta2"])}</a>
      </div>
      <p class="pl-hero__note pl-mono">{E(t["note"])}</p>
    </div>
    <figure class="pl-hero__fig">
      <img src="{IMG}/stage-keynote-sm.webp" srcset="{IMG}/stage-keynote-sm.webp 900w, {IMG}/stage-keynote-lg.webp 1080w" sizes="(max-width: 900px) 90vw, 36vw" alt="{E(t["hero_alt"])}" width="900" height="996" fetchpriority="high" decoding="async">
      <figcaption class="pl-mono">{E(t["hero_cap"])}</figcaption>
    </figure>
  </div>
</section>

<section class="pl-sec" data-surface="light" aria-labelledby="proof-title">
  <div class="wrap">
    <p class="pl-label t-label t-accent">{E(t["proof_label"])}</p>
    <h2 class="pl-h2 pl-reveal" id="proof-title">{t["proof_h2"]}</h2>
    <p class="pl-intro">{E(t["proof_intro"])}</p>
    <p class="pl-stat"><span class="pl-stat__n">{E(t["stat100"])}</span><span class="pl-stat__t">{E(t["stat100_t"])}</span></p>
    <ul class="pl-names" role="list">
{clients}
    </ul>{testimonials(k, t)}
  </div>
</section>

<section class="pl-sec" data-surface="ink" aria-labelledby="problem-title">
  <div class="wrap">
    <p class="pl-label t-label t-accent">{E(t["prob_label"])}</p>
    <h2 class="pl-h2 pl-reveal" id="problem-title">{t["prob_h2"]}</h2>
    <ol class="pl-path" role="list">
{path}
    </ol>
    <p class="pl-close pl-reveal">{E(t["prob_close"])}</p>
  </div>
</section>

<section class="pl-sec" id="work" data-surface="light" aria-labelledby="scope-title">
  <div class="wrap pl-scope">
    <div class="pl-scope__head">
      <p class="pl-label t-label t-accent">{E(t["scope_label"])}</p>
      <h2 class="pl-h2" id="scope-title">{t["scope_h2"]}</h2>
      <p class="pl-intro">{E(t["scope_intro"])}</p>
    </div>
    <div>
      <ul class="pl-rows" role="list">
{scope}
      </ul>
      <p class="pl-fine">{E(t["scope_fine"])}</p>
    </div>
  </div>
</section>

<section class="pl-sec" data-surface="ink" aria-labelledby="work-title">
  <div class="wrap">
    <p class="pl-label t-label t-accent">{E(t["work_label"])}</p>
    <h2 class="pl-h2 pl-reveal" id="work-title">{t["work_h2"]}</h2>
    <p class="pl-intro">{E(t["work_intro"])}</p>
    <div class="pl-work">
{work_items(k, t)}
    </div>
  </div>
</section>

<section class="pl-sec" data-surface="light" aria-labelledby="split-title">
  <div class="wrap">
    <p class="pl-label t-label t-accent">{E(t["split_label"])}</p>
    <h2 class="pl-h2 pl-reveal" id="split-title">{t["split_h2"]}</h2>
    <div class="pl-split">
      <div class="pl-split__us">
        <h3>{E(t["us_h"])}</h3>
        <ul role="list">
{us}
        </ul>
      </div>
      <div>
        <h3>{E(t["them_h"])}</h3>
        <ul role="list">
{them}
        </ul>
      </div>
    </div>
    <p class="pl-fine">{E(t["split_fine"])}</p>
  </div>
</section>

<section class="pl-sec" data-surface="ink" aria-labelledby="steps-title">
  <div class="wrap">
    <p class="pl-label t-label t-accent">{E(t["steps_label"])}</p>
    <h2 class="pl-h2 pl-reveal" id="steps-title">{t["steps_h2"]}</h2>
    <ol class="pl-steps" role="list">
{steps}
    </ol>
    <p class="pl-fine">{E(t["steps_fine"])}</p>
  </div>
</section>

<section class="pl-sec" data-surface="light" aria-labelledby="nic-title">
  <div class="wrap pl-founder">
    <div class="pl-mosaic">
{photos}
    </div>
    <div>
      <p class="pl-label t-label t-accent">{E(t["nic_label"])}</p>
      <h2 class="pl-h2" id="nic-title">{t["nic_h2"]}</h2>
{nic_p}
      <p class="pl-stat"><span class="pl-stat__n">{E(t["stat"])}</span><span class="pl-stat__t">{E(t["stat_t"])}</span></p>
    </div>
  </div>
</section>

<section class="pl-sec" data-surface="ink" aria-labelledby="faq-title">
  <div class="wrap">
    <p class="pl-label t-label t-accent">{E(t["faq_label"])}</p>
    <h2 class="pl-h2" id="faq-title">{E(t["faq_h2"])}</h2>
    <div class="faq">
{faq}
    </div>
  </div>
</section>

<section class="pl-sec" id="contact" data-surface="brand" aria-labelledby="final-title">
  <div class="wrap pl-cta">
    <div>
      <p class="pl-label t-label">{E(t["fin_label"])}</p>
      <h2 class="pl-h2" id="final-title">{t["fin_h2"]}</h2>
      <p class="pl-intro" style="color:inherit;opacity:.9">{E(t["fin_p"])}</p>
      <ul class="pl-cta__list" role="list">
{fin_list}
      </ul>
    </div>
    <form class="pl-form" data-clinic-form action="/api/clinic-lead" method="post" novalidate>
      <h3>{E(t["form_h"])}</h3>
      <input type="hidden" name="idioma" value="{t["lang"]}">
      <div class="pl-hp" aria-hidden="true"><label for="f-website_extra">Leave empty</label><input id="f-website_extra" name="website_extra" type="text" tabindex="-1" autocomplete="off"></div>
      <div class="pl-fields">
{field("nome", f["nome"], auto="name")}
{field("email", f["email"], "email", auto="email")}
{field("telefone", f["telefone"], "tel", required=False, auto="tel")}
{field("clinica", f["clinica"], auto="organization")}
{field("site", f["site"], required=False, auto="url")}
{field("local", f["local"], auto="address-level1")}
{select("funcao", f["funcao"], t["roles"])}
{select("objetivo", f["objetivo"], t["goals"])}
          <div class="pl-field pl-field--full"><label for="f-detalhe">{E(f["detalhe"])} <span>{E(f["optional"])}</span></label><textarea id="f-detalhe" name="detalhe" maxlength="1000" placeholder="{E(f["detalhe_ph"])}"></textarea></div>
          <div class="pl-check"><input id="f-consentimento" name="consentimento" type="checkbox" value="sim" required aria-describedby="e-consentimento"><label for="f-consentimento">{f["consent"]}</label><p class="pl-field__err" id="e-consentimento" data-err="consentimento" aria-live="polite" style="grid-column:2"></p></div>
      </div>
      <button class="btn btn--primary pl-form__submit" type="submit">{E(f["submit"])}</button>
      <p class="pl-form__after">{E(f["after"])}</p>
      <p class="pl-form__status" data-form-status role="status" aria-live="polite" tabindex="-1"></p>
    </form>
  </div>
</section>

</main>

<footer class="pl-foot" data-surface="ink">
  <div class="wrap pl-foot__in">
    <p>{E(t["foot"])}</p>
    <p><a href="{t["privacy_href"]}">{E(t["privacy"])}</a> · <a href="{t["terms_href"]}">{E(t["terms"])}</a></p>
  </div>
</footer>

<script type="module" src="/js/plastic.js"></script>
<script defer src="/js/highlight.js"></script>
</body>
</html>
'''


if __name__ == '__main__':
    for k, rel in (('en', 'src/plastic/index.html'), ('pt', 'src/plastic/pt/index.html')):
        p = ROOT / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(page(k), encoding='utf8')
        print('ok', rel)
