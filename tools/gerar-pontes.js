// Gera as paginas-ponte de l/<empreendimento>/index.html.
//
// Por que elas existem: o robo do WhatsApp (e do Instagram, Telegram, Facebook)
// nao roda o JavaScript do site. Ele so le as marcacoes do arquivo HTML que
// recebeu. Como o portfolio inteiro e um index.html so, esse robo nunca teria
// como saber se o link aberto e do Renaissance ou do Boulevard — ele leria
// sempre a mesma foto generica, para todos.
//
// A ponte resolve isso sendo um arquivo por empreendimento, minusculo, com o
// nome e a foto daquele predio escritos dentro. O robo le a ponte e mostra a
// previa certa; a pessoa que clica e mandada na mesma hora para o endereco de
// sempre, com os mesmos parametros (?u=, ?sel=).
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

// Uma frase curta: o prazo de entrega na frente (pronto para morar ou em obra e a
// primeira pergunta de quem recebe o link) e, depois, a chamada do empreendimento.
const semAcento = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const resumo = (emp) => {
  const prazo = emp.id === "outros" ? "" : String(emp.entrega || emp.statusLabel || "").trim();
  // A chamada de alguns empreendimentos ja termina em "pronto para morar": nesses,
  // repetir o prazo na frente so encheria a previa com a mesma frase duas vezes.
  const repetido = prazo && semAcento(emp.tagline).includes(semAcento(emp.statusLabel || prazo));
  const base = [repetido ? "" : prazo, emp.tagline].filter(Boolean).join(" · ")
    || "Fotos, plantas, valores e disponibilidade.";
  return base.length > 180 ? `${base.slice(0, 177)}…` : base;
};

const pagina = (emp) => {
  const titulo = `${emp.nome} — Construtora Senger`;
  const desc = resumo(emp);
  const foto = `${SITE}/assets/preview/${emp.id}.jpg`;
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#182129">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}/l/${emp.id}/">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Construtora Senger">
<meta property="og:locale" content="pt_BR">
<meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${SITE}/l/${emp.id}/">
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
  // Manda pro portfolio antes de a ponte aparecer, levando junto ?u= e ?sel=.
  // replace() em vez de href: o "voltar" do celular nao fica preso nesta pagina.
  (function () {
    var qs = location.search.replace(/^\\?/, "");
    var raiz = location.pathname.replace(/\\/l\\/[^/]*\\/?$/, "/");
    location.replace(raiz + "?cliente" + (qs ? "&" + qs : "") + "#emp-${emp.id}");
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
    <img src="../../assets/preview/${emp.id}.jpg" alt="${esc(emp.nome)}">
    <h1>${esc(emp.nome)}</h1>
    <p>${esc(emp.cidade || "")}</p>
    <a id="ir" href="../../?cliente#emp-${emp.id}">Ver fotos, plantas e valores</a>
  </div>
  <script>
    (function () {
      var qs = location.search.replace(/^\\?/, "");
      var raiz = location.pathname.replace(/\\/l\\/[^/]*\\/?$/, "/");
      document.getElementById("ir").href = raiz + "?cliente" + (qs ? "&" + qs : "") + "#emp-${emp.id}";
    })();
  </script>
</body>
</html>
`;
};

let n = 0;
for (const emp of EMPREENDIMENTOS) {
  const previa = path.join(RAIZ, "assets", "preview", `${emp.id}.jpg`);
  if (!fs.existsSync(previa)) {
    console.error(`  ! ${emp.id}: falta assets/preview/${emp.id}.jpg — ponte NAO gerada`);
    continue;
  }
  const dir = path.join(RAIZ, "l", emp.id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), pagina(emp));
  console.log(`  l/${emp.id}/index.html`);
  n++;
}
console.log(`\n${n} ponte(s) gerada(s) de ${EMPREENDIMENTOS.length} empreendimento(s).`);
