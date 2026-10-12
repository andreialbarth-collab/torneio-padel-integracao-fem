# Torneio Impulse Padel BVB

Sistema estático (HTML + CSS + JS, sem build) para sorteio de duplas, lançamento de placares e classificação do torneio de padel futebolizado.

## Publicar na Vercel

A Vercel não aceita upload de .zip pelo painel. Use uma das opções:

**Opção A — GitHub (recomendada)**
1. Descompacte o zip.
2. Crie um repositório no GitHub e envie os arquivos (pode ser pelo botão "Add file → Upload files").
3. Na Vercel: *Add New → Project → Import* o repositório. Framework Preset: **Other**. Sem build command. Deploy.

**Opção B — Vercel CLI**
```bash
cd torneio-padel
npx vercel --prod
```

## Uso
1. Aba **Jogadores**: cadastre 8 direitas e 8 esquerdas → *Iniciar torneio*.
2. Aba **Rodadas**: *Sortear rodada* → lance os placares. O próximo sorteio só libera com todos os placares da rodada atual.
3. Aba **Classificação**: ranking por lado, prévia das duplas niveladas e campeões.
4. Aba **Telão**: visão para TV/projetor (tela cheia).

## Regras implementadas
- Rodadas 1 e 2: duplas aleatórias (a 2ª evita repetir parceiro da 1ª).
- Rodadas 3–5: 1º D + 8º E, 2º D + 7º E … 8º D + 1º E.
- Confrontos e quadras sempre aleatórios; nunca repete dupla x dupla da rodada anterior e evita repetir adversários.
- Pontuação: V=3, E=1, D=0. Desempate: pontos → saldo → pontos feitos → sorteio.

## Dados
Ficam salvos no navegador (localStorage) do dispositivo que opera o torneio. Use *Exportar backup* ao fim de cada rodada.
