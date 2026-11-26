# Motor 0.0.1-rt3 (gecko.js da release v0.0.1 do firefox-wasm, com o pacote de dados editado)
- `greprefs.js` embutido: o bloco `intl.hyphenation-alias.*` (só hifenização) foi trocado, com o MESMO tamanho em bytes, por
  `pref("intl.accept_languages","pt-BR, pt, en-US, en", locked)` + autoplay liberado. O modo embutido não lê user.js e força
  idioma/user-agent em tempo de execução; só `locked` vence. O user-agent é fixo no binário (Firefox Linux): não mexer em platform/oscpu
  (ficaria incoerente).
- Fonte de emoji: `Twemoji.Mozilla.ttf` (mozilla/twemoji-colr v0.7.0, CC-BY 4.0) anexada ao fim do pacote como
  `/gre-baked/fonts/TwemojiMozilla.ttf` (`embutir-fonte.cjs`; atualiza o índice e `remote_package_size`).
- Arquivo novo sempre em pasta de versão nova (`/motor/<versão>/` tem cache imutável) + `CACHE` novo no `sw.js`.
