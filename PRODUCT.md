# PRODUCT.md — Sevilha Performance

Verdade de produto, escrita a partir do que já existe no repositório, nos anúncios
e nas conversas com o cliente. Não é aspiração: o que estiver aqui precisa estar
sustentado por algo que já foi publicado, medido ou decidido.

## O negócio

A Sevilha Performance é uma **consultoria de gestão para escritórios de
contabilidade**. Não vende curso nem infoproduto: vende diagnóstico e
acompanhamento de estrutura, processos, margem e time.

Duas ofertas dividem o mesmo repositório e a mesma stack, e é fácil confundi-las:

| | Sessão Estratégica | Clube da Performance |
|---|---|---|
| O que é | Diagnóstico individual de 45 min, gratuito | Mentoria em grupo, encontros semanais |
| Público | Escritórios com **mais de 10** colaboradores | Escritórios com **até 10** colaboradores |
| Páginas | `/mentoria`, `/mentoria-2` | `/`, `/pre-inscricao-2`, `/pre-inscricao-3` |
| Destino | WhatsApp para agendar a reunião | Grupo de WhatsApp / fila de vagas |
| Marca no CRM | deal prefixado `[SE]` | deal sem prefixo |

Confundir as duas é o erro mais caro do projeto: manda o público errado para a
oferta errada e ensina o Meta a buscar mais gente fora do perfil.

## Quem decide

**Dono ou sócio de escritório contábil**, tipicamente entre 35 e 55 anos, que
cresceu tecnicamente e virou gargalo da própria empresa. Chega por anúncio no
Meta, quase sempre **no celular, à noite**, cético — já viu muita "mentoria"
prometendo atalho. Audita números para viver: incoerência entre dois números da
mesma página é sinal de desleixo para ele, não detalhe.

Cargo gerencial e operacional também preenchem o formulário, mas não decidem. A
página fala com quem decide, sem hostilizar quem indica.

## O que é verdade e pode ser dito

- Sessão Estratégica: **45 minutos**, **R$ 0,00**, sem compromisso, online e ao vivo.
- Perfil atendido: escritórios com **mais de 10 colaboradores**.
- **+500 contabilidades** acompanhadas.
- **Mais de 20 anos** de mercado (o número da empresa; as biografias individuais
  têm o tempo de cada consultor).
- Consultores: Vicente Sevilha (estratégia e finanças), Bruno Silvestre
  (processos e margem), Rodrigo Pires (time e estrutura). Fotos reais em
  `/Vicente.jpeg`, `/Bruno.jpeg`, `/Rodrigo.jpeg`.
- O antes e o depois publicados: "tira folga e algo quebra", "delega e a tarefa
  volta", "fatura mais, sobra o mesmo" → "o escritório anda sem você no centro",
  "você sabe onde a margem vaza".

## O que NÃO pode ser dito

- **Não existe depoimento, logo de cliente, case ou número de resultado
  publicável.** Nada de prova social inventada: o cliente ainda vai fornecer.
- Nenhum preço âncora ("de R$ 997 por 0,00"): a sessão nunca foi cobrada, e
  âncora sobre valor que não existiu é propaganda enganosa — o Meta derruba.
- Nenhuma promessa de resultado em prazo ("dobre a margem em 90 dias").

## Compromissos de marca

- Navy `#0b1b4d` e verde `#3dd63a`, herdados de sevilhaperformance.com.br. O
  bloco verde marcando uma palavra da headline é a assinatura da marca.
- Logo em `/assets/logo-sevilha.svg`. A `/logo.png` da raiz **não** é da Sevilha.
- Português do Brasil, tratamento por "você", sem jargão de consultoria vazio.

## Restrições técnicas que moldam a página

- HTML estático numa conta **Vercel Hobby**: no máximo **12 serverless
  functions** por deploy, e o projeto usa 11. Endpoint novo derruba o deploy.
- O formulário posta em `/api/leads`, que grava no Supabase, na planilha, no RD
  Marketing, no RD CRM e dispara `Lead` e `LeadQualificado` na CAPI do Meta. Os
  campos e o `name=` de cada um são contrato: mudar quebra a integração.
- Toda página fora do rodízio `/campanha` precisa entrar em
  `PAGEVIEW_BEACON_PAGES`, `LEADS_SHEET_WRITE_PAGES` e no relatório do
  dashboard — senão o lead entra e ninguém consegue medir.
