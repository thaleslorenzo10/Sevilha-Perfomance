# Dashboard — novas edições de Aula e Café

Objetivo: separar Aula paga de 27/10/2026 e Café com Sevilha de 11/11/2026, preservando histórico e demais páginas.

Premissa comunicada: início das novas edições em 14/10/2026, Brasília. Campanhas reutilizadas não comprovam edição pelo nome; mostrar explicitamente separação por período de captação. A pergunta sobre o corte foi enviada ao usuário e a implementação usa esta referência inicial, ajustável se houver correção.

## Etapas e responsabilidades

1. Meta: reconhecer grupo AULA em classificação, agregados e série. Arquivos lib/meta.js, api/meta.js. Testes offline para classificação e somas.
2. Dados: endpoint agregado no modo eventos de api/stats.js, sem criar function extra. Configurar duas edições. Filtrar oferta e janela da edição antes de deduplicar; aplicar filtro de relatório depois. Ler compras Kiwify separadamente de leads e excluir reembolsos da receita paga. Falhas retornam indisponibilidade, nunca zero. Arquivos lib/eventos-dashboard*.js, lib/leads-fontes.js, lib/leads-unificados.js. Testar reinscritos, dois eventos, limites de datas, fontes falhas e reembolsos.
3. Interface: abas Aula 27/10 e Café 11/11, com indicadores e campanhas próprios. Esconder resumo global nessas abas. Preservar acesso ao histórico, informando que inclui todas as edições. Carregamento independente e protegido contra respostas atrasadas. Arquivos dashboard.html, assets/js/dash/{api,main,eventos}.js e CSS se necessário.
4. Revisão independente do conjunto, lint, testes pertinentes e validação em navegador desktop/mobile.
5. Publicação seletiva preservando o manifesto da produção atual; readback das rotas, fontes e dados agregados. Commit somente dos arquivos da tarefa.

## Contrato

GET /api/stats?modo=eventos&since=YYYY-MM-DD&until=YYYY-MM-DD retorna eventos com id, nome, data, inicio, periodo (interseção ou null), leads (payload unificado ou null), compras ({pagas,reembolsadas,receita,valor_reembolsado} ou null), erros e gerado_em.

IDs: aula-2026-10-27, cafe-2026-11-11. Café sem fonte de pagamento permanece n/d. Nenhum dado pessoal sai no payload. Não modificar campanhas, captura, banco ou automações externas.
