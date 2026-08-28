// Gera as paginas-ponte do site.
//
// Por que elas existem: o robo do WhatsApp (e do Instagram, Telegram, Facebook)
// nao roda o JavaScript do site. Ele so le as marcacoes do arquivo HTML que
// recebeu. Como o portfolio inteiro e um index.html so, esse robo nunca teria
// como saber se o link aberto e do Renaissance ou do Boulevard — ele leria
// sempre a mesma foto generica, para todos.
//
// A ponte resolve isso sendo um arquivo por endereco, minusculo, com o nome e a
// foto daquele imovel escritos dentro. O robo le a ponte e mostra a previa
// certa; a pessoa que clica e mandada na mesma hora para o endereco de sempre,
// com os mesmos parametros (?u=, ?sel=, ?w= do corretor).
//
// Sao duas familias de ponte:
//   l/<empreendimento>/            -> a previa fala do predio
//   l/<empreendimento>/u/<codigo>/ -> a previa fala DAQUELA unidade
//
// A segunda existe porque a previa da unidade era a do predio: o corretor
// mandava o apartamento 501 e o WhatsApp anunciava "Renaissance — alto padrao".
// Quem recebe decide se clica pela previa, entao ela precisa falar do imovel
// que foi enviado.
//
// A previa NAO leva preco de proposito: o corretor escolhe, no envio, se manda
// com ou sem valor, e a previa aparece sozinha, antes de a pessoa abrir. Preco
// ali dentro passaria por cima dessa escolha.
//
// Rodar depois de mexer em data.js:  node tools/gerar-pontes.js

const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
const SITE = "https://sanchaikraemer.github.io/materialsengercorretores";

const { EMPREENDIMENTOS } = new Function(
  fs.readFileSync(path.join(RAIZ, "data.js"), "utf8").replace(/window\.SENGER[\s\S]*$/, "") +
  "; return { EMPREENDIMENTOS };"
)();

const esc = (s) => String(s || "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// O codigo da unidade vira pedaco de endereco: "701 B" -> "701-b".
// Precisa bater com o codigoSlug() do app.js, senao o link enviado aponta
// para uma ponte que nao existe.
const slug = (texto) => String(texto || "")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

// Uma frase curta: a chamada do empreendimento, ou o prazo de entrega.
const resumo = (emp) => {
  const base = emp.tagline || emp.entrega || "Fotos, plantas, valores e disponibilidade.";
  return base.length > 180 ? `${base.slice(0, 177)}…` : base;
};

// Molde unico das duas familias de ponte. "profundidade" e quantas pastas
// separam o arquivo da raiz do site (2 para l/<emp>/, 4 para l/<emp>/u/<cod>/):
// e o que faz os caminhos relativos e o redirecionamento acertarem a raiz.
const pagina = ({ emp, titulo, desc, caminho, profundidade, destaque, extra }) => {
  const foto = `${SITE}/assets/preview/${emp.id}.jpg`;
  const acima = "../".repeat(profundidade);
  // Do arquivo ate a raiz do site: l/<emp>/ sobe uma pasta depois do "l",
  // l/<emp>/u/<codigo>/ sobe tres. O padrao vai escrito dentro da ponte.
  const subir = profundidade === 2
    ? "\\/l\\/[^/]*\\/?$"
    : "\\/l\\/[^/]*\\/u\\/[^/]*\\/?$";
  const query = extra ? `${JSON.stringify(extra)} + (qs ? "&" + qs : "")` : "qs";
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#182129">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}/${caminho}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Construtora Senger">
<meta property="og:locale" content="pt_BR">
<meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${SITE}/${caminho}">
<meta property="og:image" content="${foto}">
<meta property="og:image:secure_url" content="${foto}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(`${emp.nome} — ${emp.cidade || "Construtora Senger"}`)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(titulo)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${foto}">
<script>
  // Manda pro portfolio antes de a ponte aparecer, levando junto tudo que veio
  // no endereco (?u=, ?sel=, e o ?w= com o WhatsApp de quem enviou).
  // replace() em vez de href: o "voltar" do celular nao fica preso nesta pagina.
  (function () {
    var qs = location.search.replace(/^\\?/, "");
    var raiz = location.pathname.replace(/${subir}/, "/");
    var extra = ${query};
    location.replace(raiz + "?cliente" + (extra ? "&" + extra : "") + "#emp-${emp.id}");
  })();
</script>
<style>
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
       padding:24px;background:#182129;color:#fff;
       font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
  .cartao{width:100%;max-width:420px;text-align:center}
  img{width:100%;height:auto;border-radius:14px;display:block;margin-bottom:20px}
  h1{margin:0 0 6px;font-size:26px;line-height:1.2}
  p{margin:0 0 22px;opacity:.75;line-height:1.5;font-size:15px}
  a{display:block;padding:15px 20px;border-radius:999px;background:#fff;color:#182129;
    text-decoration:none;font-weight:700}
</style>
</head>
<body>
  <!-- So aparece se o JavaScript estiver desligado ou o redirecionamento falhar. -->
  <div class="cartao">
    <img src="${acima}assets/preview/${emp.id}.jpg" alt="${esc(emp.nome)}">
    <h1>${esc(destaque)}</h1>
    <p>${esc(emp.cidade || "")}</p>
    <a id="ir" href="${acima}?cliente#emp-${emp.id}">Ver fotos, plantas e valores</a>
  </div>
  <script>
    (function () {
      var qs = location.search.replace(/^\\?/, "");
      var raiz = location.pathname.replace(/${subir}/, "/");
      var extra = ${query};
      document.getElementById("ir").href = raiz + "?cliente" + (extra ? "&" + extra : "") + "#emp-${emp.id}";
    })();
  </script>
</body>
</html>
`;
};

// Como a unidade se chama e o que se diz dela na previa. Segue o itemLabel()
// do app.js: sala no comercial, apto no residencial, quadra e lote no loteamento.
function unidadesDe(emp) {
  const itens = [];

  (emp.grupos || []).forEach((grupo) => {
    (grupo.unidades || []).forEach((unidade) => {
      const prefixo = emp.categoria === "comercial" ? "Sala" : "Apto";
      const codigo = String(unidade.apto);
      itens.push({
        codigo,
        rotulo: /^\d/.test(codigo) ? `${prefixo} ${codigo}` : codigo,
        // A tipologia e a area sao o que faz a previa valer a pena: e o que a
        // pessoa quer saber antes de decidir se abre.
        detalhes: [grupo.tipo, unidade.areaUnit || grupo.area, grupo.garagem].filter(Boolean),
        etiquetas: unidade.tags || [],
      });
    });
  });

  (emp.terrenos || []).forEach((terreno) => {
    itens.push({
      codigo: `${terreno.quadra}-${terreno.numero}`,
      rotulo: `Quadra ${terreno.quadra} · Lote ${terreno.numero}`,
      detalhes: [
        terreno.area ? `${Number(terreno.area).toLocaleString("pt-BR")} m²` : "",
        terreno.rua,
      ].filter(Boolean),
      etiquetas: [],
    });
  });

  (emp.outros || []).forEach((outro) => {
    itens.push({
      codigo: String(outro.nome),
      rotulo: String(outro.nome),
      detalhes: [outro.area, outro.local, outro.descricao].filter(Boolean),
      etiquetas: [],
    });
  });

  return itens;
}

function descricaoDaUnidade(emp, item) {
  const partes = [...item.detalhes, ...item.etiquetas].filter(Boolean);
  const texto = [partes.join(" · "), emp.cidade].filter(Boolean).join(" — ");
  const base = texto || resumo(emp);
  return base.length > 180 ? `${base.slice(0, 177)}…` : base;
}

let pontes = 0;
let unidades = 0;
const semPrevia = [];

for (const emp of EMPREENDIMENTOS) {
  const previa = path.join(RAIZ, "assets", "preview", `${emp.id}.jpg`);
  if (!fs.existsSync(previa)) {
    semPrevia.push(emp.id);
    console.error(`  ! ${emp.id}: falta assets/preview/${emp.id}.jpg — pontes NAO geradas`);
    continue;
  }

  const dir = path.join(RAIZ, "l", emp.id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), pagina({
    emp,
    titulo: `${emp.nome} — Construtora Senger`,
    desc: resumo(emp),
    caminho: `l/${emp.id}/`,
    profundidade: 2,
    destaque: emp.nome,
    extra: "",
  }));
  pontes++;

  // A ponte da unidade e gerada para TODA unidade do cadastro, inclusive a
  // vendida. O painel muda status o tempo todo sem rodar este script; se a
  // ponte so existisse para a unidade disponivel, desfazer uma venda deixaria
  // o link do cliente caindo em pagina inexistente.
  const usados = new Map();
  for (const item of unidadesDe(emp)) {
    let nome = slug(item.codigo);
    if (!nome) continue;
    // Dois codigos diferentes que viram o mesmo endereco ("1 A" e "1-a"):
    // o segundo ganha um sufixo para nao sobrescrever o primeiro.
    const vezes = (usados.get(nome) || 0) + 1;
    usados.set(nome, vezes);
    if (vezes > 1) {
      // O app.js monta o endereco da unidade sozinho e nao sabe deste sufixo:
      // se isto disparar, os dois codigos precisam ficar diferentes no data.js.
      console.error(`  ! ${emp.id}: "${item.codigo}" da o mesmo endereco de outra unidade (${nome})`);
      nome = `${nome}-${vezes}`;
    }

    const destino = path.join(dir, "u", nome);
    fs.mkdirSync(destino, { recursive: true });
    // "Outros Imoveis" nao e um predio, e uma pasta: cada imovel de la tem nome
    // proprio e a previa fica melhor sem o "Outros Imoveis —" na frente.
    const chamada = emp.id === "outros" ? item.rotulo : `${emp.nome} — ${item.rotulo}`;
    fs.writeFileSync(path.join(destino, "index.html"), pagina({
      emp,
      titulo: `${chamada} | Construtora Senger`,
      desc: descricaoDaUnidade(emp, item),
      caminho: `l/${emp.id}/u/${nome}/`,
      profundidade: 4,
      destaque: chamada,
      extra: `u=${encodeURIComponent(item.codigo)}`,
    }));
    unidades++;
  }
  console.log(`  l/${emp.id}/  (+ ${usados.size} unidade${usados.size === 1 ? "" : "s"})`);
}

console.log(`\n${pontes} ponte(s) de empreendimento e ${unidades} de unidade.`);
if (semPrevia.length) console.log(`Sem previa (nada gerado): ${semPrevia.join(", ")}`);
