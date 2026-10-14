// Módulo 7 · Plano operacional — aba do Cadastro da UC (ucs.html). Seção 15 do PIPCIF.
// Parte comum (fixa, dos protocolos conjuntos CBMMG × IEF) + parte da UC: setores operacionais no mapa (uc_setor),
// cenários, comando por porte, prontidão, pós-incêndio e revisão com o CBMMG (uc_operacional).
// Usa globais de ucs.html: sb, $, $$, esc, msg, podeEditar, GEO, marcarSujo, sujo, UCS, REG, fmtDH, nomePor; e GeoEntrada (geo_entrada.js).
(function(){
/* ======================= parte comum (muda aqui quando os protocolos mudarem) ======================= */
const BASE = "Decreto nº 48.767/2024 (Força-Tarefa Previncêndio) e Protocolos Conjuntos CBMMG × IEF 01/2025 (aeronaves), 02/2026 (registro de ocorrências), 03/2026 (acionamento mútuo) e 04/2025 (área queimada)";
const VERSAO = "rascunho de 14/10/2026 — será revisto junto com os protocolos";
const SALA = "0800 283 2323";
const FLUXO = [
  ["Detecção", "Monitoramento da UC e da zona de amortecimento: focos de calor, observação em campo e aviso da comunidade."],
  ["Acionamento imediato e simultâneo", `O responsável pela UC liga para o <b>CBMMG</b> (193, a unidade da área ou a coordenação do CBMMG — telefone a definir) e, ao mesmo tempo, para a <b>Sala de Situação do IEF (${SALA})</b>, que abre o Registro de Incêndio (RI).`],
  ["Informações do acionamento", "UC e setor; coordenada em graus, minutos e segundos; data e hora em que o foco foi visto; o que se sabe do fogo, do acesso e de quem já está no local."],
  ["Primeiro combate", "Se a UC tem pessoal treinado ou brigada, o combate começa logo após a detecção, sempre que for seguro. <b>Até a chegada do CBMMG, ou durante toda a operação quando o CBMMG não for, o comando é do gerente ou do responsável pela UC.</b>"],
  ["Chegada do CBMMG", "O CBMMG abre o chamado, coordena o combate e instala o Sistema de Comando em Operações com posto de comando unificado; o responsável pela UC integra o comando e repassa as informações de campo."],
  ["RI atualizado", "O responsável pela UC mantém a Sala de Situação informada durante toda a operação."],
  ["Apoio aéreo", "Pedido à coordenação do CBMMG, com as informações do acionamento e as pistas e áreas de pouso próximas (o plano mostra as pistas num raio de 50 km de cada setor, como informação). A decisão sobre o emprego da aeronave é de quem a opera."],
  ["Extinção", "Comunicar a Sala de Situação para fechar o RI. Se o IEF atuou sem o CBMMG, avisar o CBMMG no mesmo dia (REDS)."],
  ["Registro", "ROI no Colibri com a área medida em até <b>10 dias corridos da extinção</b> (percurso em campo com GPS, drone ou imagem de satélite). Frentes distantes entre si = ROIs separados."],
  ["Avaliação", "Reunião de avaliação com a equipe depois do incêndio."]];
const CENARIOS = [
  {k:"entorno", t:"Foco fora da UC e da zona de amortecimento", p:"Monitorar a evolução e o vento e informar a Sala de Situação. Acionar o CBMMG se o fogo avançar em direção à zona de amortecimento ou à UC. A equipe da UC só atua fora da UC em apoio e com segurança."},
  {k:"za", t:"Foco na zona de amortecimento", p:"Acionar o CBMMG e a Sala de Situação ao mesmo tempo. Deslocar equipe para avaliar e, havendo condições e segurança, iniciar o combate para impedir a entrada do fogo na UC. Avisar proprietários e parceiros próximos."},
  {k:"pequeno", t:"Incêndio de pequenas proporções dentro da UC", p:"Acionar o CBMMG e a Sala. A equipe ou brigada da UC inicia o combate sob o comando do gerente ou responsável. Manter o RI atualizado, fazer o rescaldo e comunicar a extinção."},
  {k:"grande", t:"Incêndio de grandes proporções ou fora de controle", p:"Pedir reforço (UCs vizinhas, brigadas, parceiros) e, se preciso, apoio aéreo. Com o CBMMG no local, comando unificado; a UC integra o posto de comando. Organizar a logística: água, alimentação, transporte e descanso das equipes."},
  {k:"sensivel", t:"Incêndio que ameaça área sensível, pessoas ou estruturas", p:"Prioridade máxima. Informar no acionamento o que está em risco (moradias, linhas de transmissão, nascentes, espécies, sede). Concentrar recursos na proteção dessas áreas e avaliar o apoio aéreo."},
  {k:"indireto", t:"Local de difícil acesso ou sem combate direto", p:"Avaliar acesso (trilha, helicóptero) e segurança. Sem combate direto (paredões, áreas rochosas, fogo subterrâneo, noite): aceiros e linhas de controle, monitoramento e isolamento da área."}];
const FUNCOES = ["Comando", "Operações (combate)", "Logística (água, alimentação, transporte)", "Comunicação com a Sala de Situação (RI)", "Segurança da equipe"];
const POS = "Rescaldo e vigilância até não haver risco de reignição; comunicar a extinção à Sala de Situação (fecha o RI); medir a área queimada e fazer o ROI no Colibri em até 10 dias corridos; avisar o CBMMG no mesmo dia quando o IEF atuou sozinho; reunião de avaliação com a equipe.";
const CORES = ["#e8590c", "#1c7ed6", "#2f9e44", "#ae3ec9", "#f59f00", "#0c8599", "#d6336c", "#5c940d", "#7048e8", "#c92a2a"];
const MESES = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
const ORIGEM = {desenhado:"desenhado no Colibri", importado:"importado de arquivo", zoneamento:"copiado do zoneamento", quadrantes:"quadrantes do mapa de risco"};
// marcações da conferência do mapa de risco (módulo 6) — mesmos tipos e cores
const MARCA = {inicio:["adverso","Início frequente de incêndios"], combustivel:["adverso","Muito combustível acumulado"], acesso_pessoas:["adverso","Acesso de pessoas"],
  dificil:["adverso","Difícil acesso para o combate"], sensivel:["adverso","Área sensível a proteger"], aceiro:["favoravel","Aceiro ou barreira natural"],
  agua:["favoravel","Ponto de água"], vigia:["favoravel","Vigilância"], apoio:["favoravel","Apoio de parceiro ou brigada"], outro:["outro","Outro"]};
const COR_G = {adverso:"#c92a2a", favoravel:"#2b8a3e", outro:"#495057"};
const AEREO_PISTA = new Set(["aerodromo_publico","aerodromo_privado","aerodromo_militar","pista_nao_registrada"]);

let OP = null, mapaO = null;
const fmtHa = v => v == null ? "—" : (+v).toLocaleString("pt-BR", {maximumFractionDigits: 1}) + " ha";
const fmtKm = v => v == null ? "—" : (+v).toLocaleString("pt-BR", {maximumFractionDigits: 1}) + " km";
const vazio = () => ({cenarios:{}, comando:{pequeno:[], grande:[]}, prontidao:{}, pos_obs:"", revisao:{}, obs:""});

function estilo(){
  if (document.getElementById("estiloOper")) return;
  document.head.insertAdjacentHTML("beforeend", `<style id="estiloOper">
  .op-cab{border:1px solid var(--linha);border-radius:10px;padding:12px 14px;margin-top:14px;background:#fff;display:flex;gap:14px;flex-wrap:wrap;align-items:center;justify-content:space-between}
  .op-cab h3{margin:0;font-size:16px} .op-cab .sub{font-size:12.5px;color:var(--suave)}
  .op-tag{display:inline-block;font-size:11px;font-weight:700;border-radius:99px;padding:2px 8px;margin-left:6px;vertical-align:2px}
  .op-tag.ok{background:#e6f4ea;color:#1e6b34} .op-tag.pend{background:#fff4d6;color:#8a5a00}
  .op-sec{margin-top:14px} .op-sec > legend{font-size:14px}
  .op-fluxo{counter-reset:p;list-style:none;margin:6px 0 0;padding:0;display:grid;gap:6px}
  .op-fluxo li{counter-increment:p;display:grid;grid-template-columns:26px 1fr;gap:8px;font-size:13px;line-height:1.45}
  .op-fluxo li::before{content:counter(p);background:var(--verde);color:#fff;border-radius:50%;width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:700}
  .op-tel{display:flex;gap:10px;flex-wrap:wrap;margin:8px 0 2px} .op-tel div{border:1px solid var(--linha);border-radius:8px;padding:6px 10px;font-size:12.5px;background:#fafaf7} .op-tel b{display:block;font-size:14px}
  .op-mapa{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(300px,1fr);gap:14px;align-items:start}
  @media (max-width:900px){ .op-mapa{grid-template-columns:1fr} }
  #mapaOp{height:540px;border-radius:10px;border:1px solid var(--linha)} #mapaOp.desenhando{cursor:crosshair}
  .op-barra{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 8px}
  .op-dica-des{background:#1d1d1f;color:#fff;border-radius:8px;padding:6px 10px;font-size:12.5px;margin:0 0 8px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
  .op-dica-des button{font:inherit;font-size:12px;border:0;border-radius:6px;padding:3px 8px;cursor:pointer}
  .op-set{width:100%;border-collapse:collapse;font-size:12.5px} .op-set th{text-align:left;font-size:11.5px;color:var(--suave);padding:4px 6px;border-bottom:1px solid var(--linha)}
  .op-set td{padding:5px 6px;border-bottom:1px solid #eee;vertical-align:top} .op-set tbody tr{cursor:pointer} .op-set tbody tr:hover,.op-set tr.sel{background:var(--realce)}
  .op-cor{display:inline-block;width:11px;height:11px;border-radius:3px;margin-right:5px;vertical-align:-1px;border:1px solid #0003}
  .op-ed{border:1px solid var(--linha);border-radius:10px;padding:10px 12px;background:#fff}
  .op-ed label{margin-top:6px} .op-ed input,.op-ed textarea{width:100%}
  .op-res{font-size:12.5px;line-height:1.55;margin:8px 0 0;padding:8px 10px;background:#f7f6f2;border-radius:8px}
  .op-res .ok{color:#1e6b34;font-weight:700} .op-res .nao{color:#8a5a00;font-weight:700}
  .op-cen{display:grid;gap:8px} .op-cen > div{border:1px solid var(--linha);border-radius:8px;padding:8px 10px;background:#fff}
  .op-cen h4{margin:0;font-size:13.5px;display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap}
  .op-cen p{margin:4px 0 6px;font-size:12.5px;color:var(--suave);line-height:1.45}
  .op-cen select{width:auto;font-size:12.5px;padding:3px 6px} .op-cen textarea{width:100%;min-height:40px;font-size:12.5px}
  .op-cen > div.nao{opacity:.55}
  .op-cmd{width:100%;border-collapse:collapse;font-size:12.5px} .op-cmd th{text-align:left;font-size:11.5px;color:var(--suave);padding:4px 6px}
  .op-cmd td{padding:3px 4px} .op-cmd input{width:100%;font-size:12.5px;padding:4px 6px} .op-cmd td:last-child{width:30px}
  .op-imp{border:1px dashed var(--linha);border-radius:8px;padding:8px 10px;margin-top:8px;font-size:12.5px}
  .op-imp .lin{display:grid;grid-template-columns:20px 14px 1fr 90px;gap:6px;align-items:center;padding:3px 0}
  .op-imp input[type=text]{font-size:12.5px;padding:3px 6px}
  .op-rot{background:transparent;border:0;box-shadow:none;color:#fff;font-weight:700;font-size:11.5px;text-shadow:0 0 3px #000,0 0 2px #000,0 0 1px #000;white-space:nowrap}
  .op-rot::before{display:none}
  .op-vert{width:11px;height:11px;background:#fff;border:2px solid #e8590c;border-radius:50%;box-sizing:border-box}
  .rk-quad{background:transparent;border:0;box-shadow:none;color:#fff;font-weight:700;font-size:11px;text-shadow:0 0 3px #000,0 0 2px #000}
  .rk-quad::before{display:none}
  </style>`);
}

/* ======================= abrir ======================= */
window.abrirModuloOperacional = async function(nome){
  estilo();
  const box = $("#mod-conteudo"), ed = podeEditar(nome);
  box.innerHTML = `<div class="dica" style="padding:20px">Carregando o plano operacional…</div>`;
  const [r1, r2, r3, r4, r5, rR, rV] = await Promise.all([
    sb.from("uc_operacional").select("*").eq("nome_uc", nome).maybeSingle(),
    sb.rpc("setores_geo", {p_nome_uc: nome}),
    sb.rpc("zoneamento_uc", {p_nome_uc: nome}),
    sb.from("uc_cadastro").select("gerente_nome,gerente_contatos,responsaveis,meses_criticos,meses_obs,cbmmg_unidade,cbmmg_contatos").eq("nome_uc", nome).maybeSingle(),
    sb.from("auditoria").select("*").in("tabela", ["uc_operacional", "uc_setor"]).eq("chave", nome).order("quando", {ascending:false}).limit(60),
    sb.from("uc_risco").select("versao,dados").eq("nome_uc", nome).maybeSingle(),
    sb.from("uc_risco_revisao").select("versao,marcacoes,atualizado_em").eq("nome_uc", nome).order("atualizado_em", {ascending:false}).limit(1)]);
  const erro = [r1, r2, r3, r4].find(r => r.error);
  if (erro) return box.innerHTML = `<div class="dica" style="color:var(--erro);padding:20px">${esc(erro.error.message)}</div>`;
  OP = {nome, ed, op: Object.assign(vazio(), r1.data || {}), novo: !r1.data, setores: r2.data || [], resumo: {}, zon: r3.data || [], cad: r4.data || {},
        hist: r5.data || [], aereo: [], sel: null, des: null, imp: null, risco: rR.data || null, marcas: []};
  if (OP.risco){ const rv = (rV.data || [])[0]; OP.marcas = rv && rv.versao === OP.risco.versao ? (rv.marcacoes || []) : []; prepararRisco(); }
  OP.op.comando = Object.assign({pequeno: [], grande: []}, OP.op.comando || {});
  if (!OP.op.comando.pequeno.length) OP.op.comando.pequeno = FUNCOES.map(f => ({funcao: f, responsavel: f === "Comando" ? (OP.cad.gerente_nome ? OP.cad.gerente_nome + " (gerente)" : "Gerente ou responsável pela UC") : "", contato: ""}));
  if (!OP.op.comando.grande.length) OP.op.comando.grande = FUNCOES.map(f => ({funcao: f, responsavel: f === "Comando" ? "Comando unificado com o CBMMG (a UC integra o posto de comando)" : "", contato: ""}));
  desenhar();
  carregarResumo();
  carregarAereo();
};

/* ======================= tela ======================= */
function desenhar(){
  const {op, ed, cad} = OP, u = (UCS || []).find(x => x.nome_uc === OP.nome) || {}, reg = (REG || {})[u.ufbio] || {};
  const rev = op.revisao || {}, cb = cad.cbmmg_contatos || [];
  const meses = (cad.meses_criticos || []).map(m => MESES[m - 1]).join(", ");
  $("#mod-conteudo").innerHTML = `
  <div class="op-cab">
    <div style="flex:1;min-width:260px"><h3>Plano operacional ${rev.data ? `<span class="op-tag ok">revisado com o CBMMG em ${new Date(rev.data + "T12:00").toLocaleDateString("pt-BR")}</span>` : `<span class="op-tag pend">ainda não revisado com o CBMMG</span>`}</h3>
      <div class="sub">Seção 15 do PIPCIF · parte comum: ${esc(VERSAO)}${op.atualizado_em ? ` · última alteração: ${esc(nomePor(op.atualizado_por))} em ${fmtDH(op.atualizado_em)}` : ""}</div></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn primario" id="opImprimir">Imprimir plano e ficha de acionamento</button></div>
  </div>

  <fieldset class="op-sec"><legend>1 · Parte comum a todas as UCs</legend>
    <p class="dica" style="margin:0 0 6px">Fixa, mantida pelo Previncêndio. Base: ${esc(BASE)}.</p>
    <div class="op-tel">
      <div>Sala de Situação do IEF<b>${SALA}</b></div>
      <div>CBMMG<b>193</b>${cad.cbmmg_unidade ? esc(cad.cbmmg_unidade) : "unidade da área: cadastre no módulo 1"}${cb.length ? "<br>" + cb.map(x => esc(x.valor)).join(" · ") : ""}</div>
      <div>Coordenação do CBMMG<b>a definir</b>telefone em definição</div>
      <div>Gerente da UC<b>${esc(cad.gerente_nome || "—")}</b>${(cad.gerente_contatos || []).map(x => esc(x.valor)).join(" · ")}</div>
    </div>
    <details open><summary style="cursor:pointer;font-size:13px;font-weight:700;margin-top:6px">Fluxo do acionamento ao registro</summary>
      <ol class="op-fluxo">${FLUXO.map(([t, d]) => `<li><span><b>${t}.</b> ${d}</span></li>`).join("")}</ol></details>
  </fieldset>

  <fieldset class="op-sec"><legend>2 · Setores operacionais</legend>
    <p class="dica" style="margin:0 0 8px">Divida a UC (e, se quiser, o entorno) em setores para o combate. Cada setor mostra o que tem por perto e o histórico de fogo. Os setores aparecem para a Sala de Situação no RI. Pode desenhar, importar um arquivo (KML, KMZ, GeoJSON ou Shapefile .zip) ou partir do zoneamento do plano de manejo.</p>
    <div class="op-mapa">
      <div>
        ${ed ? `<div class="op-barra"><button type="button" class="btn" id="opDesenhar">+ Desenhar setor</button>
          <button type="button" class="btn" id="opImportar">Importar arquivo</button><input type="file" id="opArq" accept=".kml,.kmz,.geojson,.json,.zip" hidden>
          ${OP.zon.length ? `<button type="button" class="btn" id="opZon">Usar o zoneamento</button>` : ""}
          ${OP.risco ? `<button type="button" class="btn" id="opQuad">Usar os quadrantes do risco</button>` : ""}</div>` : ""}
        <div id="opDes"></div>
        <div id="mapaOp"></div>
        ${OP.risco ? `<div class="rk-leg" style="display:flex;gap:10px;flex-wrap:wrap;font-size:12px;margin-top:6px">${[4, 3, 2, 1, 0].map(k => `<span><i style="display:inline-block;width:14px;height:10px;border-radius:2px;margin-right:4px;vertical-align:-1px;border:1px solid #0002;background:${window.RiscoMapa.COR[k]}"></i>${window.RiscoMapa.NOME[k]}</span>`).join("")}<span>· mapa de risco versão ${esc(OP.risco.versao)} (módulo 6)</span></div>` : ""}
        <p class="dica" style="margin:6px 0 0">${OP.risco ? "Desenhe os setores olhando o mapa de risco (ligue e desligue no seletor de camadas, no canto do mapa). Bolinhas vermelhas e verdes: marcações da UC na conferência do mapa de risco. " : ""}Verde: limite da UC. ✈ pistas e helipontos do cadastro de apoio aéreo. ${OP.zon.length ? "O zoneamento do plano de manejo pode ser ligado no seletor de camadas." : "Esta UC não tem zoneamento cadastrado."}</p>
      </div>
      <div><div id="opLado"></div></div>
    </div>
    <div style="overflow:auto;margin-top:10px"><table class="op-set"><thead><tr><th>Setor</th><th>Área</th>${OP.risco ? "<th>Risco: atenção alta + muito alta</th>" : ""}<th>Zonas do plano de manejo</th><th>Pistas em até 50 km</th><th>Heliponto / pouso</th><th>Ponto de água</th><th>Fogo 2013–2025</th></tr></thead><tbody id="opTab"></tbody></table></div>
  </fieldset>

  <fieldset class="op-sec"><legend>3 · Cenários</legend>
    <p class="dica" style="margin:0 0 8px">O procedimento padrão de cada cenário vem da parte comum. Marque se o cenário se aplica à UC e escreva o que é próprio dela (onde acontece, quem chamar, cuidados).</p>
    <div class="op-cen">${CENARIOS.map(c => { const v = op.cenarios?.[c.k] || {};
      return `<div data-cen="${c.k}" class="${v.aplica === false ? "nao" : ""}"><h4>${esc(c.t)}<select data-cen-ap ${ed ? "" : "disabled"}><option value="">Aplica-se à UC?</option><option value="sim" ${v.aplica === true ? "selected" : ""}>Aplica-se</option><option value="nao" ${v.aplica === false ? "selected" : ""}>Não se aplica</option></select></h4>
        <p>${esc(c.p)}</p><textarea data-cen-aj placeholder="Na UC: onde acontece, quem acionar, cuidados…" ${ed ? "" : "disabled"}>${esc(v.ajuste || "")}</textarea></div>`; }).join("")}</div>
  </fieldset>

  <fieldset class="op-sec"><legend>4 · Comando e funções</legend>
    <p class="dica" style="margin:0 0 8px"><b>Até a chegada do CBMMG, ou quando ele não vai, o comando é do gerente ou do responsável pela UC.</b> Com o CBMMG no local, o comando é unificado e a UC integra o posto de comando.</p>
    <div class="grade" style="grid-template-columns:repeat(auto-fit,minmax(380px,1fr))">
      ${["pequeno", "grande"].map(p => `<div><b style="font-size:13px">${p === "pequeno" ? "Incêndio de pequenas proporções" : "Incêndio de grandes proporções"}</b>
        <table class="op-cmd"><thead><tr><th>Função</th><th>Responsável</th><th>Contato</th><th></th></tr></thead><tbody data-cmd="${p}"></tbody></table>
        ${ed ? `<button type="button" class="btn peq" data-cmd-add="${p}" style="margin-top:4px">+ função</button>` : ""}</div>`).join("")}
    </div>
    <datalist id="opPessoas">${[cad.gerente_nome && cad.gerente_nome + " (gerente)", ...(cad.responsaveis || []).map(r => r.nome)].filter(Boolean).map(n => `<option value="${esc(n)}">`).join("")}</datalist>
  </fieldset>

  <fieldset class="op-sec"><legend>5 · Prontidão</legend>
    <p class="dica" style="margin:0 0 8px">Meses críticos (módulo 1): <b>${meses || "não informados"}</b>${cad.meses_obs ? ` — ${esc(cad.meses_obs)}` : ""}. A rotina dos brigadistas contratados fica no módulo 5.</p>
    <div class="grade">
      <div class="largo"><label>Escala da brigada ou da equipe no período crítico</label><textarea data-pr="escala" style="min-height:44px" ${ed ? "" : "disabled"}>${esc(op.prontidao?.escala || "")}</textarea></div>
      <div class="largo"><label>Plantão e horários (inclui fins de semana e feriados)</label><input data-pr="plantao" value="${esc(op.prontidao?.plantao || "")}" ${ed ? "" : "disabled"}></div>
      <div class="largo"><label>O que muda nos dias de risco alto</label><textarea data-pr="dias_risco" style="min-height:44px" placeholder="ex.: rondas extras, equipe de prontidão na sede, veículo abastecido" ${ed ? "" : "disabled"}>${esc(op.prontidao?.dias_risco || "")}</textarea></div>
    </div>
  </fieldset>

  <fieldset class="op-sec"><legend>6 · Pós-incêndio</legend>
    <p class="dica" style="margin:0 0 6px">${esc(POS)}</p>
    <label>Na UC (o que mais é feito depois do incêndio)</label><textarea data-k-op="pos_obs" style="min-height:44px;width:100%" ${ed ? "" : "disabled"}>${esc(op.pos_obs || "")}</textarea>
  </fieldset>

  <fieldset class="op-sec"><legend>Revisão com o CBMMG</legend>
    <div class="grade">
      <div><label>Data da reunião</label><input type="date" data-rv="data" value="${esc(rev.data || "")}" ${ed ? "" : "disabled"}></div>
      <div class="duplo"><label>Unidade do CBMMG</label><input data-rv="cbmmg" value="${esc(rev.cbmmg || cad.cbmmg_unidade || "")}" ${ed ? "" : "disabled"}></div>
      <div class="largo"><label>Participantes</label><input data-rv="participantes" value="${esc(rev.participantes || "")}" ${ed ? "" : "disabled"}></div>
      <div class="largo"><label>Observações e combinados</label><textarea data-rv="obs" style="min-height:44px" ${ed ? "" : "disabled"}>${esc(rev.obs || "")}</textarea></div>
    </div>
  </fieldset>

  ${ed ? `<div class="acoes"><button class="btn primario" id="opSalvar">Salvar plano operacional</button><span class="dica" id="opEstado">Os setores são salvos um a um, no próprio setor.</span></div>`
       : `<p class="dica" style="margin-top:12px">Somente a equipe da UC e o Previncêndio editam o plano operacional.</p>`}
  <details class="historico"><summary>Histórico de alterações (${OP.hist.length})</summary>${historico()}</details>`;

  comandoTabelas();
  if (ed){
    $$("#mod-conteudo [data-cen-ap]").forEach(s => s.onchange = () => { s.closest("[data-cen]").classList.toggle("nao", s.value === "nao"); sujoO(); });
    $$("#mod-conteudo [data-cen-aj], #mod-conteudo [data-pr], #mod-conteudo [data-rv], #mod-conteudo [data-k-op]").forEach(i => i.addEventListener("input", sujoO));
    $("#opSalvar").onclick = salvarPlano;
    $("#opDesenhar").onclick = () => iniciarDesenho(null);
    $("#opImportar").onclick = () => $("#opArq").click();
    $("#opArq").onchange = e => { const f = e.target.files[0]; e.target.value = ""; if (f) importar(f); };
    $("#opZon") && ($("#opZon").onclick = painelZoneamento);
    $("#opQuad") && ($("#opQuad").onclick = painelQuadrantes);
  }
  $("#opImprimir").onclick = imprimir;
  montarMapa();
  tabelaSetores();
  painelLado();
}
function sujoO(){ marcarSujo(); const e = $("#opEstado"); if (e) e.textContent = "Alterações não salvas"; }

function comandoTabelas(){
  ["pequeno", "grande"].forEach(p => {
    const L = OP.op.comando[p], tb = $(`[data-cmd="${p}"]`), d = OP.ed ? "" : "disabled";
    tb.innerHTML = L.map((r, i) => `<tr><td><input data-c="funcao" data-i="${i}" value="${esc(r.funcao || "")}" ${d}></td><td><input data-c="responsavel" data-i="${i}" list="opPessoas" value="${esc(r.responsavel || "")}" ${d}></td>
      <td><input data-c="contato" data-i="${i}" value="${esc(r.contato || "")}" ${d}></td><td>${OP.ed ? `<button type="button" class="btn peq" data-c-del="${i}" title="Remover">×</button>` : ""}</td></tr>`).join("");
    $$("input", tb).forEach(inp => inp.oninput = () => { L[+inp.dataset.i][inp.dataset.c] = inp.value; sujoO(); });
    $$("[data-c-del]", tb).forEach(b => b.onclick = () => { L.splice(+b.dataset.cDel, 1); comandoTabelas(); sujoO(); });
  });
  $$("[data-cmd-add]").forEach(b => b.onclick = () => { OP.op.comando[b.dataset.cmdAdd].push({funcao: "", responsavel: "", contato: ""}); comandoTabelas(); sujoO(); });
}

async function salvarPlano(){
  const o = OP.op, val = s => $(s)?.value.trim() || null;
  o.cenarios = Object.fromEntries(CENARIOS.map(c => { const box = $(`[data-cen="${c.k}"]`), ap = $("[data-cen-ap]", box).value;
    return [c.k, {aplica: ap === "sim" ? true : ap === "nao" ? false : null, ajuste: $("[data-cen-aj]", box).value.trim() || null}]; }));
  o.prontidao = Object.fromEntries(["escala", "plantao", "dias_risco"].map(k => [k, val(`[data-pr="${k}"]`)]));
  o.revisao = Object.fromEntries(["data", "cbmmg", "participantes", "obs"].map(k => [k, val(`[data-rv="${k}"]`)]));
  o.pos_obs = val('[data-k-op="pos_obs"]');
  ["pequeno", "grande"].forEach(p => o.comando[p] = o.comando[p].filter(r => (r.funcao || r.responsavel || r.contato || "").trim()));
  const b = $("#opSalvar"); b.disabled = true;
  const {data, error} = await sb.from("uc_operacional").upsert({nome_uc: OP.nome, cenarios: o.cenarios, comando: o.comando, prontidao: o.prontidao,
    pos_obs: o.pos_obs, revisao: o.revisao, obs: o.obs || null}, {onConflict: "nome_uc"}).select().single();
  b.disabled = false;
  if (error) return msg("Não foi possível salvar: " + error.message, "erro");
  sujo = false; msg("Plano operacional salvo.");
  OP.op = Object.assign(vazio(), data); OP.novo = false;
  const {data: h} = await sb.from("auditoria").select("*").in("tabela", ["uc_operacional", "uc_setor"]).eq("chave", OP.nome).order("quando", {ascending:false}).limit(60);
  OP.hist = h || []; desenhar();
}

function historico(){
  const H = OP.hist; if (!H.length) return `<p class="dica">Sem alterações registradas.</p>`;
  const rot = {cenarios:"Cenários", comando:"Comando e funções", prontidao:"Prontidão", pos_obs:"Pós-incêndio", revisao:"Revisão com o CBMMG", obs:"Observações",
               nome:"Nome", acesso:"Acesso", agua:"Água", apoio:"Apoio", geom:"Desenho", ordem:"Ordem", origem:"Origem"};
  return `<ul class="hist" style="padding-left:18px;margin-top:8px">${H.map(h => { const set = h.tabela === "uc_setor", nm = (h.depois || h.antes || {}).nome;
    return `<li><span class="q">${fmtDH(h.quando)} · ${esc(nomePor(h.quem))}</span> · ${set ? `setor <b>${esc(nm || "")}</b> ${h.operacao === "incluir" ? "incluído" : h.operacao === "excluir" ? "excluído" : "alterado"}` : "plano operacional " + (h.operacao === "incluir" ? "criado" : "alterado")}
      ${h.operacao === "alterar" ? `<span class="dica"> — ${(h.campos || []).filter(k => k !== "area_ha").map(k => rot[k] || k).join(", ")}</span>` : ""}</li>`; }).join("")}</ul>`;
}

/* ======================= mapa ======================= */
const corSetor = i => CORES[i % CORES.length];
function montarMapa(){
  if (mapaO){ mapaO.remove(); mapaO = null; }
  mapaO = L.map("mapaOp", {zoomSnap:.25});
  const sat = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {maxZoom:18, attribution:"Imagem © Esri, Maxar"}).addTo(mapaO);
  const ruas = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}", {maxZoom:18, maxNativeZoom:16, attribution:"© Esri, HERE, Garmin, OpenStreetMap"});
  L.control.scale({imperial:false}).addTo(mapaO);
  const f = GEO?.features.find(x => x.properties.nome_uc === OP.nome);
  OP.lim = f ? L.geoJSON(f, {style:{color:"#7CFC00", weight:2.5, fill:false}, interactive:false}).addTo(mapaO) : null;
  OP.zonCam = L.geoJSON({type:"FeatureCollection", features: OP.zon.map(z => ({type:"Feature", geometry:z.geom, properties:{zona:z.zona}}))},
    {style:{color:"#ffe066", weight:1, dashArray:"4 3", fillColor:"#ffe066", fillOpacity:.12}, onEachFeature:(ft, l) => l.bindTooltip(esc(ft.properties.zona), {sticky:true})});
  const extras = {};
  if (OP.risco){
    const C = window.RiscoMapa.camada(OP.risco); OP.rC = C; C.camada.addTo(mapaO); extras["Mapa de risco"] = C.camada;
    OP.camMarcas = L.layerGroup(OP.marcas.map(m => L.marker([m.lat, m.lon], {icon: L.divIcon({className:"", html:`<div style="width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px #000a;background:${COR_G[MARCA[m.tipo]?.[0] || "outro"]}"></div>`, iconSize:[14, 14], iconAnchor:[7, 7]})})
      .bindTooltip(`<b>${esc(MARCA[m.tipo]?.[1] || m.tipo)}</b>${m.nota ? "<br>" + esc(m.nota) : ""}`))).addTo(mapaO);
    extras["Marcações da UC (mapa de risco)"] = OP.camMarcas;
  }
  OP.camSet = L.featureGroup().addTo(mapaO);
  OP.camAereo = L.layerGroup().addTo(mapaO);
  OP.camDes = L.layerGroup().addTo(mapaO);
  OP.ctl = L.control.layers({"Satélite": sat, "Mapa": ruas}, Object.assign({"Setores": OP.camSet}, extras, OP.lim ? {"Limite da UC": OP.lim} : {}, OP.zon.length ? {"Zoneamento (plano de manejo)": OP.zonCam} : {}, {"Apoio aéreo": OP.camAereo}), {collapsed:true}).addTo(mapaO);
  window.CamadasRef && CamadasRef.adicionar(mapaO, OP.ctl);
  pintarSetores();
  enquadrar();
  mapaO.on("click", e => { if (OP.des) addVertice(e.latlng); });
  mapaO.on("dblclick", e => { if (OP.des){ L.DomEvent.stop(e); concluirDesenho(); } });
  mapaO.on("mousemove", e => { if (OP.des) elastico(e.latlng); });
}
function enquadrar(){
  const b = OP.camSet.getLayers().length ? OP.camSet.getBounds() : OP.lim?.getBounds();
  if (OP.lim && b) b.extend(OP.lim.getBounds());
  if (b && b.isValid()) mapaO.fitBounds(b, {padding:[14, 14]}); else mapaO.setView([-18.5, -44.5], 7);
}
function pintarSetores(){
  OP.camSet.clearLayers();
  OP.setores.forEach((s, i) => {
    if (OP.des?.id === s.id || OP.ajuste?.id === s.id) return;
    const sel = OP.sel === s.id, c = corSetor(i);
    const l = L.geoJSON(s.geom, {style:{color: sel ? "#ffd43b" : c, weight: sel ? 3.5 : 2.4, fillColor: c, fillOpacity: OP.risco ? (sel ? .18 : .06) : (sel ? .32 : .2)}})
      .on("click", ev => { if (OP.des) return; L.DomEvent.stop(ev); selecionar(s.id); });
    l.bindTooltip(esc(s.nome), {permanent:true, direction:"center", className:"op-rot"});
    OP.camSet.addLayer(l);
  });
}
async function carregarAereo(){
  const b = OP.lim ? OP.lim.getBounds().pad(.6) : null; if (!b) return;
  const {data} = await sb.from("recurso_aereo").select("id,nome,tipo,lat,lon,comprimento_m,largura_m,superficie,situacao").neq("situacao", "inativo")
    .gte("lat", b.getSouth()).lte("lat", b.getNorth()).gte("lon", b.getWest()).lte("lon", b.getEast());
  OP.aereo = data || []; OP.camAereo.clearLayers();
  OP.aereo.forEach(r => L.marker([+r.lat, +r.lon], {icon: iconeMapa(window.iconeAereo ? iconeAereo(r.tipo) : "pista", {tam: 22}), title: r.nome})
    .bindTooltip(`<b>${esc(r.nome)}</b>${AEREO_PISTA.has(r.tipo) && r.comprimento_m ? `<br>${r.comprimento_m} × ${r.largura_m || "?"} m${r.superficie ? " · " + esc(r.superficie) : ""}` : ""}`).addTo(OP.camAereo));
}
/* ---------- mapa de risco (módulo 6) dentro dos setores ---------- */
function prepararRisco(){
  const RM = window.RiscoMapa, R = OP.risco; if (!RM || !R?.dados?.cel) { OP.risco = null; return; }
  const g = R.dados.grade, c = R.dados.cel, n = c.id.length, lat = new Float64Array(n), lon = new Float64Array(n);
  for (let i = 0; i < n; i++){ const [x, y] = RM.centro(c.id[i], g.lado_m), [la, lo] = RM.utmParaLL(x, y, g.zona, g.sul); lat[i] = la; lon[i] = lo; }
  OP.rc = {lat, lon, n}; OP.rcache = new Map();
}
function dentroAnel(x, y, r){ let d = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++){ const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) d = !d; } return d; }
function caixa(geom){ let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; geom.coordinates.forEach(p => p[0].forEach(([x, y]) => { if (x < a) a = x; if (y < b) b = y; if (x > c) c = x; if (y > d) d = y; })); return [a, b, c, d]; }
function dentroGeom(x, y, geom, bb){ if (x < bb[0] || x > bb[2] || y < bb[1] || y > bb[3]) return false; return geom.coordinates.some(p => dentroAnel(x, y, p[0]) && !p.slice(1).some(h => dentroAnel(x, y, h))); }
// resumo do risco no setor: % em atenção alta e muito alta, classes, motivos e marcações da UC
function riscoSetor(s){
  if (!OP.risco) return null;
  const chave = s.id + ":" + s.atualizado_em; if (OP.rcache.has(chave)) return OP.rcache.get(chave);
  const R = OP.risco, c = R.dados.cel, bb = caixa(s.geom), cl = [0, 0, 0, 0, 0], mot = new Map(); let tot = 0, queimou = 0;
  for (let i = 0; i < OP.rc.n; i++){
    if (!dentroGeom(OP.rc.lon[i], OP.rc.lat[i], s.geom, bb)) continue;
    tot++; cl[c.c[i]]++; if (c.a[i]) queimou++;
    if (c.c[i] >= 3) (c.m[i] || "").split(",").filter(Boolean).forEach(k => mot.set(+k, (mot.get(+k) || 0) + 1));
  }
  const marcas = OP.marcas.filter(m => dentroGeom(m.lon, m.lat, s.geom, bb));
  const r = tot ? {tot, cl, atencao: (cl[3] + cl[4]) / tot, queimou: queimou / tot,
    motivos: [...mot.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => (R.dados.motivos || [])[k]).filter(Boolean), marcas} : {tot: 0, marcas};
  OP.rcache.set(chave, r); return r;
}
const pctR = v => Math.round(v * 100) + "%";
function barraRisco(r){
  if (!r) return "";
  if (!r.tot) return `<span class="dica">fora do mapa de risco</span>`;
  const RM = window.RiscoMapa;
  return `<span style="display:inline-flex;height:9px;width:90px;border-radius:3px;overflow:hidden;border:1px solid #0002;vertical-align:-1px">${[4, 3, 2, 1, 0].map(k => r.cl[k] ? `<span style="flex:${r.cl[k]};background:${RM.COR[k]}"></span>` : "").join("")}</span> <b style="color:${r.atencao >= .3 ? RM.COR[4] : r.atencao >= .15 ? RM.COR[3] : "inherit"}">${pctR(r.atencao)}</b>`;
}
function riscoTxt(r){
  if (!r) return null;
  if (!r.tot) return "o setor fica fora da área do mapa de risco";
  const mm = new Map(); r.marcas.forEach(m => mm.set(m.tipo, (mm.get(m.tipo) || 0) + 1));
  return `${pctR(r.atencao)} da área em atenção alta ou muito alta${r.motivos.length ? " — " + esc(r.motivos.join("; ")) : ""}; ${pctR(r.queimou)} já queimou (2013–2025)`
    + (r.marcas.length ? `<br>Marcações da UC: ${[...mm].map(([k, n]) => `${esc(MARCA[k]?.[1] || k)}${n > 1 ? " (" + n + ")" : ""}`).join("; ")}` : "");
}
async function carregarResumo(){
  if (!OP.setores.length){ OP.resumo = {}; tabelaSetores(); return; }
  const {data, error} = await sb.rpc("setores_resumo", {p_nome_uc: OP.nome});
  if (error) return msg("Resumo dos setores: " + error.message, "erro");
  OP.resumo = Object.fromEntries((data || []).map(r => [r.id, r])); tabelaSetores(); painelLado();
}
function resumoTxt(r){
  if (!r) return {pista:"…", pistas:"…", heli:"…", agua:"…", fogo:"…", zonas:"…"};
  const p = r.pista, L = r.pistas_50km || [], n = r.n_pistas_50km || 0, h = r.heliponto, a = r.agua;
  const umaPista = x => `${esc(x.nome)} · ${fmtKm(x.km)}${x.comprimento_m ? ` · ${x.comprimento_m} × ${x.largura_m || "?"} m` : ""}${x.superficie ? " · " + esc(x.superficie) : ""}`;
  return {pista: p ? umaPista(p) : "nenhuma cadastrada",
    pistas: n ? `<b>${n}</b> pista${n === 1 ? "" : "s"}: ${L.slice(0, 3).map(umaPista).join("; ")}${n > 3 ? `; e mais ${n - 3}` : ""}`
             : `nenhuma em 50 km${p ? ` · mais próxima: ${umaPista(p)}` : ""}`,
    heli: h ? `${esc(h.nome)} · ${fmtKm(h.km)}` : "nenhum cadastrado", agua: a ? `${esc(a.nome)} · ${fmtKm(a.km)}` : "nenhum cadastrado no módulo 2",
    fogo: `${r.ocorrencias} ocorrência${r.ocorrencias === 1 ? "" : "s"}${r.queimado_ha ? ` · ${fmtHa(r.queimado_ha)} queimados` : ""}`, zonas: r.zonas ? esc(r.zonas) : "—"};
}
function tabelaSetores(){
  const tb = $("#opTab"); if (!tb) return;
  tb.innerHTML = OP.setores.length ? OP.setores.map((s, i) => { const t = resumoTxt(OP.resumo[s.id]);
    return `<tr data-s="${s.id}" class="${OP.sel === s.id ? "sel" : ""}"><td><span class="op-cor" style="background:${corSetor(i)}"></span><b>${esc(s.nome)}</b></td><td>${fmtHa(s.area_ha)}</td>${OP.risco ? `<td style="white-space:nowrap">${barraRisco(riscoSetor(s))}</td>` : ""}
      <td>${t.zonas}</td><td>${t.pistas}</td><td>${t.heli}</td><td>${t.agua}</td><td>${t.fogo}</td></tr>`; }).join("")
    : `<tr><td colspan="${OP.risco ? 8 : 7}" class="dica" style="cursor:default">Nenhum setor cadastrado.${OP.ed ? " Desenhe, importe ou use o zoneamento." : ""}</td></tr>`;
  $$("tr[data-s]", tb).forEach(tr => tr.onclick = () => selecionar(+tr.dataset.s));
}

/* ======================= painel lateral: editar setor ======================= */
function selecionar(id){
  if (OP.des || OP.ajuste) return msg("Conclua ou cancele o desenho primeiro.", "erro");
  OP.sel = id; OP.imp = null; pintarSetores(); tabelaSetores(); painelLado();
  const s = OP.setores.find(x => x.id === id); if (s) mapaO.fitBounds(L.geoJSON(s.geom).getBounds(), {padding:[30, 30], maxZoom:15});
}
function painelLado(){
  const el = $("#opLado"); if (!el) return;
  if (OP.imp) return painelImportacao();
  const s = OP.setores.find(x => x.id === OP.sel);
  if (!s){
    el.innerHTML = `<div class="op-ed"><b>${OP.setores.length} setor${OP.setores.length === 1 ? "" : "es"}</b>
      <p class="dica" style="margin:6px 0 0">${OP.setores.length ? "Clique num setor no mapa ou na tabela para ver os detalhes" + (OP.ed ? " e editar." : ".") : OP.ed ? "Comece desenhando, importando um arquivo ou usando o zoneamento do plano de manejo." : "A UC ainda não cadastrou setores."}</p>
      <p class="dica" style="margin:8px 0 0">O que entra em cada setor: como chegar, onde pegar água, ponto de apoio e parceiro de referência. As pistas em até 50 km, o heliponto mais próximo e o histórico de fogo são calculados pelo Colibri.</p></div>`;
    return;
  }
  const d = OP.ed ? "" : "disabled", t = resumoTxt(OP.resumo[s.id]);
  el.innerHTML = `<div class="op-ed">
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><b>Setor</b><button type="button" class="btn peq" id="opFechar">Fechar</button></div>
    <label>Nome</label><input data-s="nome" value="${esc(s.nome)}" ${d}>
    <label>Acesso (estradas, trilhas, 4x4, tempo de deslocamento)</label><textarea data-s="acesso" style="min-height:44px" ${d}>${esc(s.acesso || "")}</textarea>
    <label>Água para o combate</label><input data-s="agua" value="${esc(s.agua || "")}" ${d}>
    <label>Ponto de apoio e parceiro de referência</label><input data-s="apoio" value="${esc(s.apoio || "")}" ${d}>
    <label>Observações</label><textarea data-s="obs" style="min-height:40px" ${d}>${esc(s.obs || "")}</textarea>
    <div class="op-res"><b>${fmtHa(s.area_ha)}</b> · ${esc(ORIGEM[s.origem] || s.origem)}<br>
      ${OP.risco ? `Mapa de risco: ${riscoTxt(riscoSetor(s))}<br>` : ""}Zonas do plano de manejo: ${t.zonas}<br>Pistas em até 50 km: ${t.pistas}<br>Heliponto / pouso: ${t.heli}<br>Ponto de água: ${t.agua}<br>Fogo 2013–2025 (BDG): ${t.fogo}</div>
    ${OP.ed ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px"><button type="button" class="btn primario" id="opSetSalvar">Salvar setor</button>
      <button type="button" class="btn" id="opSetAjustar">Ajustar desenho</button><button type="button" class="btn" id="opSetRedes">Redesenhar</button>
      <button type="button" class="btn" id="opSetExcluir" style="color:var(--erro)">Excluir</button></div>` : ""}
  </div>`;
  $("#opFechar").onclick = () => { OP.sel = null; pintarSetores(); tabelaSetores(); painelLado(); };
  if (!OP.ed) return;
  $$("#opLado [data-s]").forEach(i => i.addEventListener("input", sujoO));
  $("#opSetSalvar").onclick = () => salvarSetor(s);
  $("#opSetRedes").onclick = () => iniciarDesenho(s);
  $("#opSetAjustar").onclick = () => iniciarAjuste(s);
  $("#opSetExcluir").onclick = () => excluirSetor(s);
}
function dadosForm(){ return Object.fromEntries($$("#opLado [data-s]").map(i => [i.dataset.s, i.value])); }
async function salvarSetor(s, geom){
  const dados = s ? dadosForm() : {};
  const {data, error} = await sb.rpc("setor_salvar", {p_id: s?.id ?? null, p_nome_uc: OP.nome, p_dados: dados, p_geom: geom || null});
  if (error){ msg("Não foi possível salvar o setor: " + error.message, "erro"); return null; }
  sujo = false; msg("Setor salvo."); await recarregarSetores(data); return data;
}
async function recarregarSetores(sel){
  const [{data}, {data: h}] = await Promise.all([sb.rpc("setores_geo", {p_nome_uc: OP.nome}),
    sb.from("auditoria").select("*").in("tabela", ["uc_operacional", "uc_setor"]).eq("chave", OP.nome).order("quando", {ascending:false}).limit(60)]);
  OP.setores = data || []; OP.hist = h || []; if (sel !== undefined) OP.sel = sel;
  pintarSetores(); tabelaSetores(); painelLado(); carregarResumo();
  const hd = $("#mod-conteudo details.historico"); if (hd) hd.innerHTML = `<summary>Histórico de alterações (${OP.hist.length})</summary>${historico()}`;
}
async function excluirSetor(s){
  if (!confirm(`Excluir o setor “${s.nome}”? Fica registrado no histórico.`)) return;
  const {error} = await sb.from("uc_setor").delete().eq("id", s.id);
  if (error) return msg("Não foi possível excluir: " + error.message, "erro");
  msg("Setor excluído."); OP.sel = null; recarregarSetores();
}

/* ======================= desenhar um setor ======================= */
function iniciarDesenho(s){
  if (OP.ajuste) return;
  OP.des = {id: s?.id ?? null, s, pts: []}; OP.imp = null;
  mapaO.doubleClickZoom.disable(); $("#mapaOp").classList.add("desenhando");
  barraDesenho(); pintarSetores(); desenharTemp();
}
function barraDesenho(){
  const n = OP.des.pts.length;
  $("#opDes").innerHTML = `<div class="op-dica-des"><span>${OP.des.s ? `Redesenhando “${esc(OP.des.s.nome)}”` : "Novo setor"}: clique no mapa para marcar os cantos (${n} marcado${n === 1 ? "" : "s"}). Duplo clique ou Enter conclui; Backspace desfaz; Esc cancela.</span>
    <button type="button" id="opDesOk" style="background:#ffd43b">Concluir</button><button type="button" id="opDesDesf">Desfazer</button><button type="button" id="opDesCanc">Cancelar</button></div>`;
  $("#opDesOk").onclick = concluirDesenho; $("#opDesDesf").onclick = () => { OP.des.pts.pop(); desenharTemp(); barraDesenho(); }; $("#opDesCanc").onclick = pararDesenho;
}
function addVertice(ll){ OP.des.pts.push([ll.lng, ll.lat]); desenharTemp(); barraDesenho(); }
function desenharTemp(ll){
  OP.camDes.clearLayers(); const p = OP.des.pts.map(([x, y]) => [y, x]); if (ll) p.push([ll.lat, ll.lng]);
  if (p.length >= 3) L.polygon(p, {color:"#ffd43b", weight:2, dashArray:"5 4", fillOpacity:.15, interactive:false}).addTo(OP.camDes);
  else if (p.length === 2) L.polyline(p, {color:"#ffd43b", weight:2, dashArray:"5 4", interactive:false}).addTo(OP.camDes);
  OP.des.pts.forEach(([x, y]) => L.circleMarker([y, x], {radius:4, color:"#ffd43b", fillColor:"#fff", fillOpacity:1, weight:2, interactive:false}).addTo(OP.camDes));
}
function elastico(ll){ if (OP.des.pts.length) desenharTemp(ll); }
function pararDesenho(){
  OP.des = null; OP.camDes.clearLayers(); $("#opDes").innerHTML = ""; $("#mapaOp")?.classList.remove("desenhando");
  if (mapaO) mapaO.doubleClickZoom.enable(); pintarSetores();
}
async function concluirDesenho(){
  const d = OP.des; if (!d) return;
  // o duplo clique também dispara dois cliques: tira vértices repetidos no fim
  while (d.pts.length > 1 && Math.abs(d.pts.at(-1)[0] - d.pts.at(-2)[0]) < 1e-7 && Math.abs(d.pts.at(-1)[1] - d.pts.at(-2)[1]) < 1e-7) d.pts.pop();
  if (d.pts.length < 3) return msg("Marque pelo menos 3 cantos para formar o setor.", "erro");
  const geom = {type:"MultiPolygon", coordinates:[[[...d.pts, d.pts[0]]]]};
  if (d.s){ const id = d.s.id; pararDesenho(); OP.sel = id; painelLado(); await salvarSetor(OP.setores.find(x => x.id === id), geom); return; }
  const nome = prompt("Nome do novo setor:", `Setor ${OP.setores.length + 1}`); if (nome === null) return;
  pararDesenho();
  const {data, error} = await sb.rpc("setor_salvar", {p_id: null, p_nome_uc: OP.nome, p_dados: {nome, origem: "desenhado", ordem: OP.setores.length + 1}, p_geom: geom});
  if (error) return msg("Não foi possível salvar o setor: " + error.message, "erro");
  msg("Setor criado. Complete acesso, água e apoio."); await recarregarSetores(data);
}
document.addEventListener("keydown", e => {
  if (!OP?.des || !document.getElementById("mapaOp")) return;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  if (e.key === "Enter"){ e.preventDefault(); concluirDesenho(); }
  else if (e.key === "Escape"){ e.preventDefault(); pararDesenho(); }
  else if (e.key === "Backspace"){ e.preventDefault(); OP.des.pts.pop(); desenharTemp(); barraDesenho(); }
});

/* ======================= ajustar vértices de um setor ======================= */
function iniciarAjuste(s){
  const n = s.geom.coordinates.flat(2).length;
  if (n > 800) return msg(`Este setor tem ${n} vértices — é detalhado demais para ajustar à mão. Use “Redesenhar” ou ajuste no QGIS e importe de novo.`, "erro");
  OP.ajuste = {id: s.id, s, coords: JSON.parse(JSON.stringify(s.geom.coordinates))};
  pintarSetores(); desenharAjuste();
  $("#opDes").innerHTML = `<div class="op-dica-des"><span>Ajustando “${esc(s.nome)}”: arraste os pontos brancos; clique num ponto para removê-lo.</span>
    <button type="button" id="opAjOk" style="background:#ffd43b">Salvar desenho</button><button type="button" id="opAjCanc">Cancelar</button></div>`;
  $("#opAjOk").onclick = async () => { const geom = {type:"MultiPolygon", coordinates: OP.ajuste.coords}, id = OP.ajuste.id; pararAjuste(); await salvarSetor(OP.setores.find(x => x.id === id), geom); };
  $("#opAjCanc").onclick = pararAjuste;
}
function desenharAjuste(){
  OP.camDes.clearLayers(); const A = OP.ajuste;
  const poli = L.polygon(A.coords.map(p => p.map(r => r.map(([x, y]) => [y, x]))), {color:"#ffd43b", weight:2, fillOpacity:.15, interactive:false}).addTo(OP.camDes);
  A.coords.forEach((p, ip) => p.forEach((r, ir) => r.slice(0, -1).forEach(([x, y], iv) => {
    const mk = L.marker([y, x], {draggable:true, icon: L.divIcon({className:"", html:'<div class="op-vert"></div>', iconSize:[11, 11], iconAnchor:[6, 6]})}).addTo(OP.camDes);
    mk.on("drag", e => { const q = e.target.getLatLng(); r[iv] = [q.lng, q.lat]; if (iv === 0) r[r.length - 1] = [q.lng, q.lat]; poli.setLatLngs(A.coords.map(pp => pp.map(rr => rr.map(([a, b]) => [b, a])))); });
    mk.on("click", () => { if (r.length <= 4) return msg("Um setor precisa de pelo menos 3 cantos.", "erro"); r.splice(iv, 1); if (iv === 0) r[r.length - 1] = r[0]; desenharAjuste(); });
  })));
}
function pararAjuste(){ OP.ajuste = null; OP.camDes.clearLayers(); $("#opDes").innerHTML = ""; pintarSetores(); }

/* ======================= importar arquivo / usar o zoneamento ======================= */
async function importar(f){
  let r;
  try{ r = await GeoEntrada.poligonos(f); }catch(e){ return msg(e.message, "erro"); }
  if (!r.itens.length) return msg("Nenhum polígono encontrado no arquivo.", "erro");
  if (r.itens.length > 60) return msg(`O arquivo tem ${r.itens.length} polígonos — confira se é mesmo o arquivo de setores (máximo de 60).`, "erro");
  OP.sel = null; OP.imp = {fonte: f.name, origem: "importado", trocado: r.trocado, itens: r.itens.map((x, i) => ({...x, ok: true, nome: x.nome || `Setor ${OP.setores.length + i + 1}`}))};
  pintarSetores(); tabelaSetores(); painelLado();
}
function painelZoneamento(){
  OP.sel = null;
  OP.imp = {fonte: "zoneamento do plano de manejo", origem: "zoneamento", zon: true, itens: OP.zon.map(z => ({nome: z.zona, ok: false, geom: z.geom, area_ha: z.area_ha}))};
  pintarSetores(); tabelaSetores(); painelLado();
}
function painelQuadrantes(){
  const RM = window.RiscoMapa, R = OP.risco, g = R.dados.grade, resumo = new Map(RM.porQuadrante(R).map(q => [q.n, q]));
  const dens = (a, b, n = 6) => Array.from({length: n}, (_, k) => [a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);   // lados com pontos intermediários (UTM → grau não é reto)
  const ordem = q => { const m = /^([A-Z])(\d+)$/.exec(q.n); return m ? (+m[2]) * 100 + m[1].charCodeAt(0) : 0; };
  const itens = [...(R.dados.quadrantes || [])].filter(q => resumo.has(q.n)).sort((a, b) => ordem(a) - ordem(b)).map(q => {
    const cant = [[q.x0, q.y0], [q.x1, q.y0], [q.x1, q.y1], [q.x0, q.y1]], anel = [];
    for (let k = 0; k < 4; k++) anel.push(...dens(cant[k], cant[(k + 1) % 4]));
    anel.push(anel[0]);
    const r = resumo.get(q.n);
    return {nome: "Quadrante " + q.n, ok: false, geom: {type:"MultiPolygon", coordinates:[[anel.map(([x, y]) => { const [la, lo] = RM.utmParaLL(x, y, g.zona, g.sul); return [+lo.toFixed(6), +la.toFixed(6)]; })]]},
            info: `${pctR(r.atencao)} em atenção alta`};
  });
  OP.sel = null;
  OP.imp = {fonte: "quadrantes do mapa de risco", origem: "quadrantes", zon: true, quad: true, itens};
  pintarSetores(); tabelaSetores(); painelLado();
}
function painelImportacao(){
  const I = OP.imp, el = $("#opLado");
  el.innerHTML = `<div class="op-ed"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><b>${I.quad ? "Usar os quadrantes do risco" : I.zon ? "Usar o zoneamento" : "Importar " + esc(I.fonte)}</b><button type="button" class="btn peq" id="opImpCanc">Cancelar</button></div>
    <p class="dica" style="margin:6px 0">${I.quad ? "Marque os quadrantes de 5 × 5 km que viram setores. Para um setor maior, marque vários vizinhos e junte num só. O setor pode passar do limite da UC (entorno)." : I.zon ? "Marque as zonas que viram setores. Elas continuam no zoneamento; o setor é uma cópia que pode ser renomeada e ajustada." : `${I.itens.length} polígono(s). Marque os que viram setores e confira os nomes.`}${I.trocado ? " <b>O arquivo vinha com latitude e longitude trocadas — corrigido.</b>" : ""}</p>
    <div class="op-imp">${I.itens.map((x, i) => `<div class="lin"><input type="checkbox" data-imp-ok="${i}" ${x.ok ? "checked" : ""} style="width:auto"><span class="op-cor" style="background:${CORES[i % CORES.length]}"></span>
      <input type="text" data-imp-nome="${i}" value="${esc(x.nome)}"><span class="dica" style="text-align:right">${x.info || (x.area_ha != null ? fmtHa(x.area_ha) : "")}</span></div>`).join("")}</div>
    ${I.zon ? `<label style="display:flex;gap:6px;align-items:center;font-weight:400;font-size:12.5px;margin-top:8px"><input type="checkbox" id="opJuntar" style="width:auto"> Juntar ${I.quad ? "os quadrantes marcados" : "as zonas marcadas"} num setor só</label>
      <input id="opJuntarNome" placeholder="Nome do setor (se juntar)" style="margin-top:4px">` : ""}
    ${I.quad ? `<p class="dica" style="margin:6px 0 0">Dica: clique num quadrante do mapa para marcá-lo.</p>` : ""}
    <div style="margin-top:10px"><button type="button" class="btn primario" id="opImpOk">Criar setores</button></div></div>`;
  OP.camDes.clearLayers();
  I.itens.forEach((x, i) => L.geoJSON(x.geom, {style:{color: I.quad ? (x.ok ? "#ffd43b" : "#ffffff") : CORES[i % CORES.length], weight: I.quad ? (x.ok ? 3 : 1) : 2, dashArray:"6 4",
      fillColor: I.quad ? "#ffd43b" : CORES[i % CORES.length], fillOpacity: x.ok ? .25 : I.quad ? 0 : .05}, interactive: !!I.quad})
    .on("click", ev => { L.DomEvent.stop(ev); x.ok = !x.ok; painelImportacao(); }).addTo(OP.camDes));
  if (!I._enq){ I._enq = true; try{ mapaO.fitBounds(OP.camDes.getBounds(), {padding:[20, 20]}); }catch(_){} }
  $$("[data-imp-ok]").forEach(c => c.onchange = () => { I.itens[+c.dataset.impOk].ok = c.checked; painelImportacao(); });
  $$("[data-imp-nome]").forEach(c => c.oninput = () => { I.itens[+c.dataset.impNome].nome = c.value; });
  $("#opImpCanc").onclick = () => { OP.imp = null; OP.camDes.clearLayers(); painelLado(); enquadrar(); };
  $("#opImpOk").onclick = gravarImportacao;
}
async function gravarImportacao(){
  const I = OP.imp, sel = I.itens.filter(x => x.ok);
  if (!sel.length) return msg("Marque pelo menos um polígono.", "erro");
  const lote = [];
  if (I.zon && $("#opJuntar")?.checked){
    lote.push({nome: $("#opJuntarNome").value.trim() || sel.map(x => x.nome).join(" + "), geom: {type:"MultiPolygon", coordinates: sel.flatMap(x => x.geom.coordinates)}});
  } else sel.forEach(x => lote.push({nome: x.nome.trim() || "Setor", geom: x.geom}));
  $("#opImpOk").disabled = true; let ok = 0, ultimo = null;
  for (const [k, x] of lote.entries()){
    const {data, error} = await sb.rpc("setor_salvar", {p_id: null, p_nome_uc: OP.nome, p_dados: {nome: x.nome, origem: I.origem, ordem: OP.setores.length + k + 1, obs: I.zon ? null : `Importado de ${I.fonte}`}, p_geom: x.geom});
    if (error){ msg(`${x.nome}: ${error.message}`, "erro"); continue; }
    ok++; ultimo = data;
  }
  OP.imp = null; OP.camDes.clearLayers();
  msg(`${ok} setor${ok === 1 ? "" : "es"} criado${ok === 1 ? "" : "s"}.`); await recarregarSetores(ok === 1 ? ultimo : null); enquadrar();
}

/* ======================= impressão: ficha de acionamento + plano ======================= */
function figuraSVG(larg = 760, alt = 460){
  const geoms = OP.setores.map(s => s.geom.coordinates), f = GEO?.features.find(x => x.properties.nome_uc === OP.nome);
  const lim = f ? (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates) : [];
  const pts = lim.flat(2).concat(geoms.flat(3)); if (!pts.length) return "";
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const kx = Math.cos((y0 + y1) / 2 * Math.PI / 180), w = (x1 - x0) * kx || 1e-6, h = (y1 - y0) || 1e-6, esc_ = Math.min((larg - 20) / w, (alt - 20) / h);
  const P = ([x, y]) => `${(10 + (x - x0) * kx * esc_).toFixed(1)},${(10 + (y1 - y) * esc_).toFixed(1)}`;
  const caminho = polys => polys.map(p => p.map(r => "M" + r.map(P).join("L") + "Z").join("")).join("");
  let svg = `<svg viewBox="0 0 ${larg} ${alt}" width="100%" style="border:1px solid #bbb;background:#fafafa">`;
  OP.setores.forEach((s, i) => svg += `<path d="${caminho(s.geom.coordinates)}" fill="${corSetor(i)}" fill-opacity=".28" stroke="${corSetor(i)}" stroke-width="1.6" fill-rule="evenodd"/>`);
  if (lim.length) svg += `<path d="${caminho(lim)}" fill="none" stroke="#1b5e20" stroke-width="2.4"/>`;
  OP.setores.forEach(s => { const c = s.geom.coordinates.flat(2), cx = c.reduce((a, p) => a + p[0], 0) / c.length, cy = c.reduce((a, p) => a + p[1], 0) / c.length, [X, Y] = P([cx, cy]).split(",");
    svg += `<text x="${X}" y="${Y}" text-anchor="middle" font-size="12" font-weight="700" stroke="#fff" stroke-width="3" paint-order="stroke">${esc(s.nome)}</text>`; });
  const pxKm = esc_ / 111.32, km = [0.5, 1, 2, 5, 10, 20, 50].find(k => k * pxKm >= 60) || 50, barra = km * pxKm;   // 1 km ≈ 1/111,32 grau
  svg += `<rect x="12" y="${alt - 16}" width="${barra.toFixed(1)}" height="5" fill="#000"/><text x="${(16 + barra).toFixed(1)}" y="${alt - 11}" font-size="11">${String(km).replace(".", ",")} km</text>`;
  return svg + `</svg>`;
}
function imprimir(){
  const {op, cad, nome} = OP, u = (UCS || []).find(x => x.nome_uc === nome) || {}, reg = (REG || {})[u.ufbio] || {}, cb = cad.cbmmg_contatos || [];
  const cont = L => (L || []).map(x => esc(x.valor + (x.obs ? ` (${x.obs})` : ""))).join(" · ");
  const ap = CENARIOS.filter(c => op.cenarios?.[c.k]?.aplica !== false);
  const w = window.open("", "_blank"); if (!w) return msg("Permita janelas pop-up para imprimir o plano.", "erro");
  w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Plano operacional · ${esc(nome)}</title><style>
    body{font:12.5px/1.45 Arial,sans-serif;margin:22px;color:#111} h1{font-size:18px;margin:0 0 2px} h2{font-size:14px;margin:16px 0 6px;border-bottom:2px solid #333;padding-bottom:2px}
    table{border-collapse:collapse;width:100%;font-size:11.5px;margin:4px 0} th,td{border:1px solid #999;padding:3px 6px;text-align:left;vertical-align:top} th{background:#eee}
    .tels{display:grid;grid-template-columns:repeat(2,1fr);gap:6px} .tels div{border:2px solid #333;border-radius:6px;padding:6px 8px} .tels b{font-size:15px;display:block}
    ol{margin:4px 0;padding-left:20px} li{margin:2px 0} .sub{color:#555} .quebra{page-break-before:always}
    @media print{ button{display:none} body{margin:10mm} }</style></head><body>
    <button onclick="print()" style="float:right;padding:6px 12px">Imprimir / salvar PDF</button>
    <h1>Ficha de acionamento — ${esc(nome)}</h1><div class="sub">Plano operacional (seção 15 do PIPCIF) · ${esc(reg.nome || u.ufbio || "")} · impresso em ${new Date().toLocaleDateString("pt-BR")}</div>
    <h2>Ao detectar um incêndio: ligue para os dois ao mesmo tempo</h2>
    <div class="tels"><div>Sala de Situação do IEF<b>${SALA}</b>abre o Registro de Incêndio (RI)</div>
      <div>CBMMG<b>193</b>${cad.cbmmg_unidade ? "Unidade da área: " + esc(cad.cbmmg_unidade) : ""}${cb.length ? "<br>" + cont(cb) : ""}<br>Coordenação do CBMMG: telefone a definir</div>
      <div>Gerente da UC<b>${esc(cad.gerente_nome || "—")}</b>${cont(cad.gerente_contatos)}</div>
      <div>Na ausência do gerente<b>${(cad.responsaveis || []).map(r => esc(r.nome)).join("; ") || "—"}</b>${(cad.responsaveis || []).map(r => esc([r.telefone, r.email].filter(Boolean).join(" "))).filter(Boolean).join(" · ")}</div></div>
    <p><b>Passe:</b> UC e setor; coordenada (graus, minutos e segundos); hora em que o foco foi visto; o que se sabe do fogo, do acesso e de quem já está no local.
      <b>Até a chegada do CBMMG, ou quando ele não vai, quem comanda é o gerente ou o responsável pela UC.</b></p>
    <h2>Setores</h2>${figuraSVG()}
    <table><thead><tr><th>Setor</th>${OP.risco ? "<th>Mapa de risco</th>" : ""}<th>Acesso</th><th>Água</th><th>Apoio</th><th>Pistas em até 50 km</th><th>Heliponto</th></tr></thead><tbody>
      ${OP.setores.map(s => { const t = resumoTxt(OP.resumo[s.id]); return `<tr><td><b>${esc(s.nome)}</b><br>${fmtHa(s.area_ha)}</td>${OP.risco ? `<td>${riscoTxt(riscoSetor(s))}</td>` : ""}<td>${esc(s.acesso || "")}</td><td>${esc(s.agua || "")}${OP.resumo[s.id]?.agua ? "<br>" + t.agua : ""}</td><td>${esc(s.apoio || "")}</td><td>${t.pistas}</td><td>${t.heli}</td></tr>`; }).join("") || `<tr><td colspan="${OP.risco ? 7 : 6}">Setores ainda não cadastrados.</td></tr>`}</tbody></table>
    <h2 class="quebra">15. Plano operacional de combate — ${esc(nome)}</h2>
    <p class="sub">Parte comum (${esc(VERSAO)}). Base: ${esc(BASE)}.</p>
    <ol>${FLUXO.map(([t, d]) => `<li><b>${t}.</b> ${d}</li>`).join("")}</ol>
    <h2>Cenários</h2><table><thead><tr><th style="width:24%">Cenário</th><th>Procedimento padrão</th><th style="width:30%">Na UC</th></tr></thead><tbody>
      ${ap.map(c => `<tr><td><b>${esc(c.t)}</b>${op.cenarios?.[c.k]?.aplica == null ? '<br><span class="sub">(não marcado)</span>' : ""}</td><td>${esc(c.p)}</td><td>${esc(op.cenarios?.[c.k]?.ajuste || "")}</td></tr>`).join("")}</tbody></table>
    <h2>Comando e funções</h2>
    ${["pequeno", "grande"].map(p => `<b>${p === "pequeno" ? "Incêndio de pequenas proporções" : "Incêndio de grandes proporções"}</b><table><thead><tr><th>Função</th><th>Responsável</th><th>Contato</th></tr></thead><tbody>
      ${(op.comando?.[p] || []).map(r => `<tr><td>${esc(r.funcao || "")}</td><td>${esc(r.responsavel || "")}</td><td>${esc(r.contato || "")}</td></tr>`).join("")}</tbody></table>`).join("")}
    <h2>Prontidão</h2><table><tbody>
      <tr><th style="width:30%">Meses críticos</th><td>${(cad.meses_criticos || []).map(m => MESES[m - 1]).join(", ") || "—"}${cad.meses_obs ? " — " + esc(cad.meses_obs) : ""}</td></tr>
      <tr><th>Escala</th><td>${esc(op.prontidao?.escala || "")}</td></tr><tr><th>Plantão e horários</th><td>${esc(op.prontidao?.plantao || "")}</td></tr>
      <tr><th>Dias de risco alto</th><td>${esc(op.prontidao?.dias_risco || "")}</td></tr></tbody></table>
    <h2>Pós-incêndio</h2><p>${esc(POS)}</p>${op.pos_obs ? `<p>${esc(op.pos_obs)}</p>` : ""}
    <h2>Revisão com o CBMMG</h2><p>${op.revisao?.data ? `Revisado em ${new Date(op.revisao.data + "T12:00").toLocaleDateString("pt-BR")} com ${esc(op.revisao.cbmmg || "o CBMMG")}.` : "Ainda não revisado com o CBMMG."}
      ${op.revisao?.participantes ? ` Participantes: ${esc(op.revisao.participantes)}.` : ""} ${esc(op.revisao?.obs || "")}</p>
    </body></html>`);
  w.document.close();
}
})();
