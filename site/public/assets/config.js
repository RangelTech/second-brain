// Configuração do site. Planos: Lite (id interno light), Max, Ultra (checkout Cakto) e Enterprise (WhatsApp, sem checkout). Links de checkout da Cakto (ofertas mensais, criadas por API em 05/11/2026).
window.BRAIN = {
  checkout: { light: 'https://pay.cakto.com.br/to43jov', max: 'https://pay.cakto.com.br/jpqnrnn', ultra: 'https://pay.cakto.com.br/36dntzb', vm: 'https://pay.cakto.com.br/dkdgm49' },
  // mesma assinatura somada à máquina virtual (R$ 399): preço exato do plano + 399, ofertas mensais criadas por API
  checkoutVm: { light: 'https://pay.cakto.com.br/5xahd7d', max: 'https://pay.cakto.com.br/sqj49ov', ultra: 'https://pay.cakto.com.br/ykn5sth' },
  precoVm: 399,
  planos: { lite: { mensal: 119 }, max: { mensal: 497 }, ultra: { mensal: 1197 } },  // mensal cheio de cada plano (a página /assinar calcula o resumo com isso)
  // anual: 10 vezes o mensal (2 meses gratis), assinatura anual, ate 12x no cartao
  mesesAnual: 10,
  checkoutAnual: { light: 'https://pay.cakto.com.br/3736wam', max: 'https://pay.cakto.com.br/7xcoves', ultra: 'https://pay.cakto.com.br/xr6bjdq', vm: 'https://pay.cakto.com.br/9bzx2zn' },
  checkoutVmAnual: { light: 'https://pay.cakto.com.br/39dosn2', max: 'https://pay.cakto.com.br/36ar3j6', ultra: 'https://pay.cakto.com.br/s2g2trg' },
  termosVersao: '2026-11-10',  // versão dos Termos de uso que o site mostra e o servidor registra no aceite
  checkoutProprio: true,  // true: o botão de compra abre /assinar (pagamento da Cakto dentro do nosso site); false: vai direto para a página da Cakto
  web: 'https://app.segundocerebro.pro/',
  api: 'https://api.segundocerebro.pro',
  repo: 'RangelTech/second-brain',
}
