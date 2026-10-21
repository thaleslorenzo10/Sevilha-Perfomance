# Café — correção de encaminhamento ao RD CRM, 21/10/2026

## Escopo autorizado

Corrigir o destino dos próximos cadastros do Café e das oportunidades das nove
pessoas da edição de 11/11 já registradas desde 14/10, com recorte em Brasília.

## Aplicado

- CRM: Evento Café com Sevilha → Inscritos.
- Etapa: `6a948509574ae80025eda69a`; funil: `6a948509574ae80025eda696`.
- Campanha RD: Conversão LP Café com Sevilha (`6a95f013f08ed30001166b7f`).
- Novas oportunidades têm identificação `[CAFE]`.
- Marketing mantém seu payload anterior, para não acionar outro fluxo nativo.
- Outras ofertas, anúncios, públicos, orçamentos e páginas foram preservados.

## Reconciliação dos contatos existentes

Nove emails únicos correspondem a onze inscrições e onze oportunidades já
existentes. Cada oportunidade foi identificada pelo vínculo ao contato e criação
até cinco segundos da respectiva inscrição (diferenças observadas: 314–1829 ms).

As onze oportunidades foram atualizadas por ID, sem novo POST de criação nem
exclusão. Leitura posterior confirmou etapa Inscritos, funil Café e campanha RD
corretos em 11/11. Todos os vínculos aos nove contatos foram conferidos novamente.
Nomes e campos personalizados permaneceram iguais. Outros negócios dos mesmos
contatos foram preservados. Não foi alterada a edição antiga.

## Publicação e validação

- Deployment: `dpl_ABUzRDMvv4qYSb9ifpPw8aqjEBhk`, READY, alias de produção
  `https://sevilha-perfomance.vercel.app` confirmado por leitura na Vercel.
- Os 376 arquivos de origem foram comparados: somente
  `lib/lead-integracoes.js` mudou em produção; conteúdo publicado igual ao local.
- GET da página `/cafe-com-sevilha`: HTTP 200.
- Quatro testes de regressão Café passaram, com fetch simulado sem envio real.
- Seis scripts offline existentes passaram: consultoria-crm-resposta,
  consultoria-leads, aula-backend, leads-capi, leads-fontes e sessao-estrategica.
- `npm run lint`: sem erros; avisos existentes. `npm run lint:biome`: sem erros,
  cinco avisos existentes. Raiz estática não possui build canônico.
- Revisão independente: sem bloqueadores.
- Graphify não pôde atualizar o grafo: comando ausente no runtime Linux.

Não foi feita inscrição artificial. O encaminhamento dos próximos cadastros está
publicado e testado por simulação; a primeira nova inscrição real ainda será a
prova de execução completa após a publicação.
