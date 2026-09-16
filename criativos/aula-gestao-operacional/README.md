# Criativos — aula "Gestão Operacional" (Meta, 1080×1350)

Três anúncios estáticos no mundo visual de `/aula-gestao-operacional` (roxo `#150C43`,
neon `#50DC00`, Poppins 800 na headline, Inter no apoio). Cada peça é um HTML
autocontido; o PNG sai de um screenshot do navegador.

| Peça | Arquivo | Saída |
|---|---|---|
| margem | `margem.html` | `out/margem-4x5.png` |
| oito-por-cento | `oito-por-cento.html` | `out/oito-por-cento-4x5.png` |
| tentou-de-tudo | `tentou-de-tudo.html` | `out/tentou-de-tudo-4x5.png` |

## Regenerar

```bash
./render.sh        # agent-browser em sessão nomeada + ffmpeg para out/preview.png
```

Precisa de internet (Poppins/Inter vêm do Google Fonts). Se o PNG sair com
serifa, a fonte não carregou: aumente o `wait 1500` do script.

## Zona segura

Nada essencial nos 220 px de cima nem nos 220 px de baixo — Reels corta 4:5
para 9:16 e sobrepõe UI. O `.zona` (top/bottom 220 px) garante isso; só a logo
fica fora dele. Ao editar copy, confira que o CTA continua acima de y=1130.

## Preço e rodapé mudam com o lote

`Escritórios com 10+ colaboradores · R$ 27` é o Lote 1. Ao virar o lote,
troque o `.rodape` nos três HTMLs e rode `./render.sh` de novo.
