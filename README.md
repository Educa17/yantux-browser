# Yantux Browser

Navegador desktop feito com Electron, com foco em personalização e navegação limpa.

## Recursos

- Navegação por abas
- Barra lateral
- Bloqueador de anúncios (incluindo YouTube)
- Página inicial personalizável
- Temas claro e escuro
- Histórico e downloads
- Painel de controle (yantux-control.html)

## Requisitos

- Node.js 18 ou superior
- npm

## Como rodar

```bash
git clone https://github.com/Educa17/yantux-browser
cd yantux-browser
npm install
npm start
```

## Estrutura

| Arquivo | Função |
| --- | --- |
| main.js | Processo principal do Electron |
| preload.js | Ponte entre o processo principal e a interface |
| browser.js | Lógica do navegador (abas, menus, atalhos) |
| index.html / style.css | Interface principal |
| home.html | Página inicial |
| adblocker.js / youtube-adblocker.js | Bloqueio de anúncios |
| yantux-control.html | Painel de controle |

## Autor

Feito por [Educa17](https://github.com/Educa17).
