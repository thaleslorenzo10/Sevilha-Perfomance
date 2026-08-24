# DESIGN.md — Sevilha Performance

Mundo visual das landing pages. O que está aqui é o que já está no código; quando
página e documento discordarem, a página vence e este arquivo se atualiza.

## Superfícies

| Página | Modo | Layout |
|---|---|---|
| `/mentoria` (v1) | Persuade | Pilha vertical de seções |
| `/mentoria-2` (v2) | Persuade | Bento grid de 12 colunas |

As duas rodam em teste A/B por `/diagnostico`, com cookie `_sp_variant_se`.

## Tokens

```
--navy      #0b1b4d   texto, campos escuros, botão de ação secundária
--green     #3dd63a   marca, campo verde, botão principal
--green-ink #0f7a12   verde legível sobre branco (contraste; o --green não passa)
--ink       #12172b   corpo
--muted     #5a6178   apoio
--chao      #e9edf6   fundo cinza-azulado da página
```

Vermelho de erro e de item negativo: `#c62828`. Cantos: 20px nos cartões, 14px em
imagem, 8px na marca da headline.

## Tipografia

Poppins 700/800 para peso (headings, números, botões), Inter para leitura. A
escala precisa ser lida como escala: `h1` em `clamp(2.15rem, 4.1vw, 3.25rem)`,
`h2` 1.5rem, `h3` 1.05rem, corpo 1rem, apoio .85rem. Não introduzir tamanho
intermediário só para caber texto — a v2 já teve oito tamanhos entre 12,5 e 17px
e o olho lia tudo como um bloco só.

## Bento (v2)

Grade de 12 colunas; a largura da célula é o argumento. Tese em `c8`, oferta em
`c4` verde, comparação em `c5`/`c7`, passos em `c4`, consultores em `c8`, perfil e
fechamento em `c12`. Abaixo de 1000px tudo vira `span 12`.

Cartão que ficaria com um terço vazio ao lado de um vizinho alto recebe
`align-self: start` — ver `.steps-cell`.

## Movimento

Entrada só **adiciona**: o estado padrão é visível e a animação é declarada
dentro de `@media (prefers-reduced-motion: no-preference)`. Nunca `opacity: 0`
esperando JS — na v2 isso deixou quatro blocos invisíveis e gerou 41 falsos
positivos de contraste no axe.

## Regras que já custaram caro

- **Eyebrow/kicker acima de heading é proibido.** Qualificador de público vai
  para dentro da tabela da oferta, onde é lido como critério.
- **Nada de caixa alta em texto de corpo.** Só na tag do modal.
- Imagem com atributo `height` precisa de `height: auto` no CSS, senão o
  atributo vence o `aspect-ratio` e o retrato vira faixa vazia no celular.
- A cadeia flex do modal (`#form-wrapper → form → .modal-body/.modal-foot`)
  precisa de `min-height: 0`, senão o botão de enviar sai da tela no celular.
- Prova social: só o que existe. Ver PRODUCT.md — não há depoimento nem case.

## Verificação

Uma rodada em lote, 1440×900 e 390×844: `detect.mjs`, axe-core, console,
Web Vitals, overflow horizontal e o modal com o roteamento sub-10 aberto.
Capturas em `.impeccable/review/`.
