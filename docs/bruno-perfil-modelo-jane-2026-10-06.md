# Bruno: visitas ao perfil no modelo Jane Sol

Pedido: usar o mesmo formato de visitas ao perfil das campanhas de conteúdo da Jane Sol. A comparação ao vivo identificou uma diferença que a primeira conferência não cobriu: Bruno usava `VISIT_INSTAGRAM_PROFILE`, destino `UNDEFINED` e criativos sem CTA explícito. Jane usa `PROFILE_VISIT`, destino `INSTAGRAM_PROFILE`, Página no objeto promovido e CTA `VIEW_INSTAGRAM_PROFILE`.

A Meta rejeitou a validação da mudança no conjunto antigo (100/1885090). A criação de conjunto novo e três criativos com o formato pedido passou por `validate_only`. Foram criados pausados, conferidos independentemente e ativados após pausar o conjunto antigo. Mesma campanha `120253414357780526`, orçamento R$40/dia, três posts, público, nomes, UTMs e posicionamentos exclusivos Instagram preservados. Nenhuma mudança em Jane, Aula ou captação de sessão estratégica.

Novo conjunto `120253424615860526`: `PROFILE_VISIT`, `INSTAGRAM_PROFILE`, Página Bruno `106292094924513`; Instagram Bruno `17841446823336862`. Novos anúncios `120253424617660526`, `120253424620210526`, `120253424620870526`. Conjunto antigo `120253414358070526` pausado. Os anúncios antigos permanecem subordinados ao conjunto pausado e não veiculam por ele.

Journal sanitizado: [bruno-perfil-alteracao-2026-10-06.json](bruno-perfil-alteracao-2026-10-06.json), com before/payload/readback, 7 criações e 5 alterações de status. Os asserts de configuração passaram; aprovação/estado efetivo dos anúncios é informado separadamente no journal, sem confundir com entrega.

Readback final às 11h10min30s BRT: campanha e conjunto novo ACTIVE/ACTIVE, antigo PAUSED/PAUSED; anúncio `120253424620210526` ACTIVE/ACTIVE, os outros dois ACTIVE/PENDING_REVIEW. Uma leitura adicional agregada de controladores recebeu limite de API 17/2446079 e foi interrompida sem retries. A revisão independente confirmou o escopo e os campos da troca; os dois anúncios aguardam aprovação, sem prova de resultados de visitas nesta tarefa.

Referência de campos: [SDK oficial Meta — AdSet](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/adset.py). Nenhuma mudança de código ou frontend de produção; lint/typecheck/build da aplicação não se aplicam à alteração de configuração Meta.
