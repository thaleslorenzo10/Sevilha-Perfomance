-- Teste transacional: não conserva pedidos, não chama integrações.
begin;
do $$
declare b jsonb; r jsonb;
begin
  b := jsonb_build_object('order_id','offline-kiwify-csv-20261026','status','paid',
    'email','offline@example.invalid','valor_centavos',9700,'pago_em','2026-10-20T12:00:00-03:00',
    'capi_status','nao_enviado_retroativo','crm_status','nao_enviado_retroativo',
    'payload',jsonb_build_object('order_ref','offline-ref-20261026','Product',
      jsonb_build_object('product_name','Gravação da aula - Aula Gestão Operacional'),
      'importacao',jsonb_build_object('fonte','kiwify_csv','data_pagamento','criacao_aproximada')));
  r := public.sevilha_registrar_compra_kiwify(b);
  r := public.sevilha_registrar_compra_kiwify(b || jsonb_build_object('order_id','offline-provider-20261026',
    'payload',jsonb_build_object('order_ref','offline-ref-20261026','Product',jsonb_build_object('product_name','Gravação da aula - Aula Gestão Operacional'))));
  if r->>'order_id' <> 'offline-kiwify-csv-20261026' or r->>'capi_status' <> 'nao_enviado_retroativo'
    or r->'payload'->'importacao'->>'data_pagamento' <> 'criacao_aproximada' then raise exception 'identity_or_precision_lost'; end if;
  r := public.sevilha_registrar_compra_kiwify(b || '{"aprovacao_confirmada":true}'::jsonb);
  if r->'payload'->'importacao'->>'data_pagamento' <> 'aprovacao_webhook' then raise exception 'approval_precision_not_updated'; end if;
  r := public.sevilha_registrar_compra_kiwify(b || '{"status":"refunded"}'::jsonb);
  r := public.sevilha_registrar_compra_kiwify(b);
  if r->>'status' <> 'refunded' then raise exception 'refund_resurrected'; end if;
  if (select count(*) from public.sevilha_compras_aula where payload->>'order_ref'='offline-ref-20261026') <> 1 then raise exception 'duplicate'; end if;
  r := public.sevilha_registrar_compra_kiwify(b || '{"order_id":"offline-other-20261026","payload":{"order_ref":"offline-other-ref-20261026"}}'::jsonb);
  begin
    perform public.sevilha_registrar_compra_kiwify(b || '{"order_id":"offline-other-20261026"}'::jsonb);
    raise exception 'expected_identity_divergence';
  exception when others then
    if sqlerrm <> 'purchase_identity_divergence' then raise; end if;
  end;
  if has_function_privilege('anon','public.sevilha_registrar_compra_kiwify(jsonb)','EXECUTE')
    or has_function_privilege('authenticated','public.sevilha_registrar_compra_kiwify(jsonb)','EXECUTE') then raise exception 'public_rpc_access'; end if;
end;
$$;
rollback;
