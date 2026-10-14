# Aula de Gestão Operacional — retomada em 14/10/2026

Pedido: nova aula em 27/10/2026 às 19h30 Brasília, página restaurada e Meta reativada com R$ 200/dia no total.

## Publicado e verificado

Página: https://sevilha-perfomance.vercel.app/aula-gestao-operacional/
Checkout Kiwify cGv131E aberto, R$ 27 à vista. Inscrições/veiculação encerram 27/10 às 17h30. Ocupação96%, vendas antigas e urgência vencida retiradas.

Produção final dpl_GXonqds9YqrGoARA4rbLQGnuEW6K READY e alias público confirmado. Pacote preservou 355 arquivos da produção anterior sem mudanças, alterou 5 e adicionou 7 do fluxo aula. Último ajuste removeu 2 linhas em branco do formulário, sem mudança comportamental. Fonte reconciliada com publicação atual 77e090f; não restauramos branch antiga integralmente.

Backend isolado preserva consultoria, salva lead antes do checkout, registra recibos e reutiliza event_id entre Pixel/CAPI. Webhook Kiwify restaurado com assinatura e Purchase/dedupe. Retry de captura pode retomar integrações não confirmadas. Nenhum lembrete/e-mail/WhatsApp automático foi ativado, nenhuma compra ou lead real simulado.

## Meta

| Campanha | ID | Configuração |
|---|---|---|
| Público quente |120253257675000526|ACTIVE/ACTIVE, R$ 100/dia|
| Público frio |120253257675140526|ACTIVE/ACTIVE, R$ 100/dia|

Dois conjuntos ACTIVE/ACTIVE, término27/10 às 17h30, Purchase no pixel657178423444244. V02/V03 Bruno, quatro anúncios configuradosACTIVE; último readback: três effectiveACTIVE e umPENDING_REVIEW (120253272650840526). Nomes históricos de campanhas preservados para não romper cruzamentoUTM. Textos/títulos públicos atualizados; URLs limpas e quatro macros no campo url_tags. Doze anúncios antigos destas campanhas ficaramPAUSED; outras campanhasAULA permanecemPAUSED. Nenhuma campanhaSE foi alterada.

53 públicosHOT utilizáveis e mesmas exclusõesCOLD;13 públicos indisponíveis retirados. Vídeos revisados por frames e transcrição local, sem data/preço antigo. Orçamento nominal totalR$ 200/dia: configuração não é garantia de gasto diário exato ou prova de entrega/compras. Substituição real deUTM após clique de usuário ainda não observada.

API impôs limites613/17 durante preparação; campanhas permaneceramPAUSED. Script passou a respeitar intervalo por objeto e retries limitados para erros explícitos, sem repetir timeout incerto. Verificação final retomada por modo somente leitura antes da ativação.

## Verificação

- 7 testes backend aula + 3 frontend passaram; duas suítes consultoria passaram.
- Desktop1440x900 e mobile390x844, modal2passos, Escape, screenshots inspecionados; sem overflow, imagens quebradas ou errosJS; axe0violações/33passes local e produção.
- ArquivosHTML/JS públicos conferidos byte a byte com fonte; API inválida rejeitada400 e webhook sem assinatura401. Consultoria/mentoria/obrigado200.
- Banco: tabelas sevilha_leads (integracoes), sevilha_compras_aula (inclui crm_status), sevilha_eventos_enviados acessíveis. Envs de aula existentes emprodução; nenhum segredo publicado.
- Build Next14 subprojeto passou. Lint direcionado0erros/6warnings; lint da branchbase tem26erros anteriores, incluindo12 emtracking inalterados pela linha adicionada. Biome5warnings anteriores. Nenhuma regra foi relaxada. Após integração no checkout principal, npm run lint passou com zero erros (avisos existentes); npm run lint:biome passou com cinco avisos. Os dez testes da aula passaram novamente. Configurações locais e trabalho anterior preservados.

Evidências: aula-retomada-publicacao-20261027.json, aula-retomada-meta-plan-20261027.json, aula-retomada-meta-audit-20261027.json, aula-retomada-meta-final-20261027.json e evidencias/aula-20261027/.

Graphify não foi atualizado: o binário não está disponível no Linux desta sessão. Nenhuma memória foi gravada.
