---
name: claude-ads
description: |
  Skill que audita contas de anúncios em 12 plataformas (Google, Meta, YouTube, LinkedIn, TikTok, Microsoft, Apple e outras) e lista o que consertar primeiro. Use quando o cliente disser: "audite minhas campanhas de anúncios"; "por que meu Facebook Ads está caro"; "analise o Google Ads da minha conta"; "diagnóstico de tráfego pago"; "o que otimizar nos meus anúncios".
---

# Claude Ads

> **Validada no benchmark.**

## Quando usar
Agência ou gestor de tráfego com exportação de dados de campanha.

## Quando NÃO usar
Sem dados de campanha.

## Passo a passo
Instalar a skill no agente e entregar os CSVs/exportações de campanha. Ela devolve o diagnóstico por plataforma.

## O que o benchmark mediu
Rodou em sandbox de CPU: 1.5s, pico de memória 24 MB; files=414; md_files=135; skill_md=34; md_kchars=603

## Requisitos
Só leitura dos dados exportados; sem GPU, sem root. Sem GPU.

## Combina com
`headroom` (exportações grandes), `relatorio`.
