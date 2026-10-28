const {test} = require('node:test');
const assert = require('node:assert/strict');
const {montar,escopo} = require('../lib/sevilha-operacao');
const {agregarCompras} = require('../lib/eventos-dashboard-compras');
const site = (id,pagina,dia,extra={}) => ({id,pagina,created_at:`${dia}T15:00:00Z`,email:'pessoa@exemplo.com',telefone:'11990000001',colaboradores:'12',...extra});
const pedido = (id,nome,status='paid') => ({order_id:id,status,pago_em:'2026-10-20T15:00:00Z',updated_at:'2026-10-20T16:00:00Z',valor_centavos:1000,payload:{Product:{product_name:nome},Commissions:{product_base_price:1000,my_commission:900}}});
const parametros = (funil,extra={}) => ({funil,since:'2026-10-01',until:'2026-10-27',...extra});
const fontes = rows => ({supabase:async()=>({registros:rows}),forms:async()=>{throw Error('Não pode ler planilha neste funil');},compras:async()=>agregarCompras([],'2026-10-14','2026-10-27')});

test('site aplica origem antes do dedupe e ignora falha de planilha não solicitada',async()=>{
 const p=await montar(parametros('sessao_site'),fontes([site('cp','/','2026-09-01'),site('site','/mentoria','2026-10-02'),site('cafe','/cafe-com-sevilha','2026-10-03')]));
 assert.equal(p.total.leads,1); assert.equal(p.total.qualificados,1); assert.deepEqual(p.por_pagina.map(l=>l.pagina),['/mentoria']);
 assert.equal(JSON.stringify(p).includes('pessoa@'),false); assert.equal(p.fontes.length,1);
});
test('formulário nativo não se mistura com site nem outro grupo',async()=>{
 const f=fontes([]);f.forms=async()=>({registros:[{id:1,data:'2026-10-02',campanha:'[CP] [FORMS]',email:'mesmo@example.com'},{id:2,data:'2026-10-03',campanha:'[SE] [FORMS]',email:'mesmo@example.com',colaboradores:'De 10 a 19'}]});
 const p=await montar(parametros('sessao_formulario'),f);
 assert.equal(p.total.leads,1);assert.equal(p.total.qualificados,null);assert.equal(p.qualificacao.confirmados,0);assert.equal(p.qualificacao.indeterminados,1);
});
test('reinscrição em outra edição não desaparece; edição incompatível é rejeitada',async()=>{
 const p=await montar(parametros('aula',{edicao:'aula-2026-10-27',since:'2026-10-14'}),fontes([site('old','/aula-gestao-operacional','2026-10-06'),site('new','/aula-gestao-operacional','2026-10-17')]));
 assert.equal(p.total.leads,1);assert.throws(()=>escopo('cafe','aula-2026-10-27','2026-10-14','2026-10-27'));
 assert.throws(()=>escopo('aula','aula-2026-10-27','2026-10-01','2026-10-27'));
});
test('exclui somente IDs comprovados sem filtro amplo por nome/email',async()=>{
 const p=await montar(parametros('sessao_site'),fontes([site('0a3e7114-4605-4c8c-a262-7a545a35d42d','/formulario-consultoria','2026-10-09'),site('real','/formulario-consultoria','2026-10-10',{email:'teste@example.com'})]));
 assert.equal(p.total.leads,1);assert.equal(p.fixtures_excluidas,1);
});
test('falha de leads não zera nem impede compras e testes Kiwify não contam',async()=>{
 const f=fontes([]);f.supabase=async()=>{throw Error('Secret must not leak');};f.compras=async()=>agregarCompras([pedido('a','Aula Gestão Operacional'),pedido('b','Gravação da aula - Aula Gestão Operacional'),pedido('t','Example product'),pedido('r','Aula Gestão Operacional','refunded')],'2026-10-14','2026-10-27');
 const p=await montar(parametros('aula',{edicao:'aula-2026-10-27',since:'2026-10-14'}),f);
 assert.equal(p.total.leads,null);assert.equal(p.compras.aula.pagas,1);assert.equal(p.compras.gravacao.pagas,1);assert.equal(p.compras.combinado.cobrado,20);assert.equal(JSON.stringify(p).includes('Secret'),false);
});
test('Café isola oferta/edição e elimina contatos das etiquetas agregadas',async()=>{
 const p=await montar(parametros('cafe',{edicao:'cafe-2026-11-11',since:'2026-10-14'}),fontes([site('old','/cafe-com-sevilha','2026-10-01'),site('aula','/aula-gestao-operacional','2026-10-15'),site('cafe','/cafe-com-sevilha/','2026-10-16',{utm_campaign:'Café +55 (11) 99999-8888'})]));
 assert.equal(p.total.leads,1);assert.equal(p.compras,null);assert.equal(JSON.stringify(p).includes('99999'),false);assert.equal(p.por_campanha[0].campanha,'Sem etiqueta válida');
});
