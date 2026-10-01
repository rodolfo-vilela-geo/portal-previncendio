/* ====================================================================
   COLIBRI — leitor do ROI em PDF (modelo DIUC/IEF, seções 1 a 12)
   lerROIpdf(pdfjsLib, doc) -> {estado, avisos, marcadas, imagens}
   · estado usa os mesmos nomes de campo do formulário roi.html
     (+ _evol e _fauna), para ser aplicado direto no formulário;
   · caixas de marcação: quadrados desenhados (~9 pt) com um "X" de
     linhas dentro, ou um "x" digitado no lugar da caixa;
   · tabelas: colunas pela posição dos títulos (células vazias somem
     do texto, então a posição é o que diz a coluna de cada número).
   Funciona no navegador e no Node (testes).
   ==================================================================== */
(function (raiz) {
  "use strict";

  const norm = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const limpa = s => (s || "").replace(/\s+/g, " ").trim();

  /* ---------- geometria das caixas a partir da lista de operações ---------- */
  function mult(m, n) {
    return [m[0]*n[0] + m[2]*n[1], m[1]*n[0] + m[3]*n[1], m[0]*n[2] + m[2]*n[3], m[1]*n[2] + m[3]*n[3],
            m[0]*n[4] + m[2]*n[5] + m[4], m[1]*n[4] + m[3]*n[5] + m[5]];
  }
  const ap = (m, x, y) => [m[0]*x + m[2]*y + m[4], m[1]*x + m[3]*y + m[5]];

  function formas(OPS, ol) {
    const caixas = [], riscos = [], imagens = [];
    let ctm = [1, 0, 0, 1, 0, 0]; const pilha = [];
    for (let i = 0; i < ol.fnArray.length; i++) {
      const f = ol.fnArray[i], a = ol.argsArray[i];
      if (f === OPS.save) pilha.push(ctm);
      else if (f === OPS.restore) ctm = pilha.pop() || [1, 0, 0, 1, 0, 0];
      else if (f === OPS.transform) ctm = mult(ctm, a);
      else if (f === OPS.paintImageXObject || f === OPS.paintJpegXObject || f === OPS.paintInlineImageXObject) {
        const p = [ap(ctm, 0, 0), ap(ctm, 1, 0), ap(ctm, 0, 1), ap(ctm, 1, 1)];
        const xs = p.map(q => q[0]), ys = p.map(q => q[1]);
        imagens.push({x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys)});
      } else if (f === OPS.constructPath) {
        const [ops, cs] = a; let k = 0, cur = null, ini = null;
        const segs = [], rets = [];
        for (const op of ops) {
          if (op === OPS.rectangle) {
            const [x, y, w, h] = cs.slice(k, k + 4); k += 4;
            const p1 = ap(ctm, x, y), p2 = ap(ctm, x + w, y + h);
            rets.push({x0: Math.min(p1[0], p2[0]), x1: Math.max(p1[0], p2[0]), y0: Math.min(p1[1], p2[1]), y1: Math.max(p1[1], p2[1])});
          } else if (op === OPS.moveTo) { cur = ap(ctm, cs[k], cs[k + 1]); ini = cur; k += 2; }
          else if (op === OPS.lineTo) { const p = ap(ctm, cs[k], cs[k + 1]); k += 2; if (cur) segs.push([cur, p]); cur = p; }
          else if (op === OPS.curveTo) { const p = ap(ctm, cs[k + 4], cs[k + 5]); k += 6; if (cur) segs.push([cur, p]); cur = p; }
          else if (op === OPS.curveTo2 || op === OPS.curveTo3) { const p = ap(ctm, cs[k + 2], cs[k + 3]); k += 4; if (cur) segs.push([cur, p]); cur = p; }
          else if (op === OPS.closePath) { if (cur && ini) segs.push([cur, ini]); cur = ini; }
        }
        const quad = r => { const w = r.x1 - r.x0, h = r.y1 - r.y0; return w > 5.5 && w < 14 && h > 5.5 && h < 14 && Math.abs(w - h) < 2.5; };
        rets.filter(quad).forEach(r => caixas.push(r));
        // diagonais (o "X" da marcação); caixas desenhadas com linhas (4 lados retos)
        const diag = segs.filter(([p, q]) => Math.abs(p[0] - q[0]) > 2 && Math.abs(p[1] - q[1]) > 2);
        diag.forEach(([p, q]) => riscos.push({x0: Math.min(p[0], q[0]), x1: Math.max(p[0], q[0]), y0: Math.min(p[1], q[1]), y1: Math.max(p[1], q[1])}));
        if (!rets.length && segs.length >= 4 && !diag.length) {
          const xs = segs.flat().map(p => p[0]), ys = segs.flat().map(p => p[1]);
          const r = {x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys)};
          if (quad(r)) caixas.push(r);
        }
      }
    }
    // remove caixas repetidas (Word desenha contorno e preenchimento)
    const unicas = [];
    caixas.forEach(c => { if (!unicas.some(u => Math.abs(u.x0 - c.x0) < 1.5 && Math.abs(u.y0 - c.y0) < 1.5)) unicas.push(c); });
    unicas.forEach(c => {
      const cx = (c.x0 + c.x1) / 2, cy = (c.y0 + c.y1) / 2, lado = c.x1 - c.x0;
      c.marcada = riscos.some(r => {
        const rx = (r.x0 + r.x1) / 2, ry = (r.y0 + r.y1) / 2;
        return Math.abs(rx - cx) < lado * 0.45 && Math.abs(ry - cy) < lado * 0.45 && (r.x1 - r.x0) > lado * 0.4;
      });
    });
    return {caixas: unicas, imagens};
  }

  /* ---------- linhas de texto ---------- */
  function montarLinhas(itens, pagina) {
    const v = itens.filter(i => i.str !== "").map(i => ({s: i.str, x: i.transform[4], y: i.transform[5], w: i.width, h: Math.abs(i.transform[3]) || 10}));
    v.sort((a, b) => b.y - a.y || a.x - b.x);
    const linhas = [];
    v.forEach(it => {
      let l = linhas.find(l => Math.abs(l.y - it.y) < Math.max(2.2, it.h * 0.3));
      if (!l) { l = {y: it.y, itens: [], pagina}; linhas.push(l); }
      l.itens.push(it);
    });
    linhas.forEach(l => {
      l.itens.sort((a, b) => a.x - b.x);
      // palavras: junta pedaços colados ("Buenópo"+"lis"), separa por espaços ou vãos
      const pal = []; let atual = null;
      l.itens.forEach(it => {
        const partes = it.s.split(/(\s+)/);
        let x = it.x; const cw = it.s.length ? it.w / it.s.length : 0;
        partes.forEach(p => {
          const w = p.length * cw;
          if (/^\s+$/.test(p) || p === "") { if (p) atual = null; x += w; return; }
          if (atual && x - (atual.x + atual.w) < 1.2) { atual.s += p; atual.w = x + w - atual.x; }
          else { atual = {s: p, x, w, y: l.y}; pal.push(atual); }
          x += w;
        });
      });
      l.pal = pal;
      l.txt = pal.map(p => p.s).join(" ");
      l.n = norm(l.txt);
    });
    linhas.sort((a, b) => b.y - a.y);
    return linhas;
  }
  const CABECALHO = ["governodoestadodeminasgerais", "sistemaestadualdemeioambiente", "institutoestadualdeflorestas", "diretoriadeunidadesdeconservacaodiuc"];
  const ehRodape = l => /^\d+de\d+$/.test(l.n) || CABECALHO.includes(l.n);

  /* ---------- conversões ---------- */
  function data(s, anoPadrao) {
    const m = (s || "").match(/(\d{1,2})\s*[\/.-]\s*(\d{1,2})\s*[\/.-]\s*(\d{2,4})/);
    if (!m) return null;
    let a = +m[3]; if (a < 100) a += 2000;
    const d = +m[1], me = +m[2];
    if (me < 1 || me > 12 || d < 1 || d > 31) return null;
    return `${a}-${String(me).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  function hora(s) {
    const m = (s || "").match(/(\d{1,2})\s*(?:[:h]|hs?)\s*(\d{2})?/i);
    if (!m) return null;
    const h = +m[1], mi = +(m[2] || 0);
    if (h > 23 || mi > 59) return null;
    return `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
  }
  const numero = s => { if (s == null) return null; const t = String(s).replace(/[^\d,.\-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", "."); if (!t || t === "-" ) return null; const n = Number(t); return isNaN(n) ? null : n; };
  const inteiro = s => { const t = String(s || "").trim(); if (/^[-–—*]+$/.test(t) || t === "") return null; const n = numero(t); return n == null ? null : Math.round(n); };

  /* ---------- listas do formulário ---------- */
  const DETEC = [["Gerente da UC", "Gerente da UC"], ["Funcionário da UC", "Funcionário da UC"], ["Brigadista Previncêndio", "Brigadista Previncêndio"],
    ["Brigadista Parceiro", "Brigadista Parceiro"], ["Morador da UC", "Morador da UC"], ["Morador do Entorno", "Morador do Entorno"],
    ["Denúncia Anônima", "Denúncia Anônima"], ["Monitoramento Aéreo", "Monitoramento Aéreo"], ["Satélite de Monitoramento", "Satélite de Monitoramento"], ["Outros", "Outros"]];
  const CAUSAS = [["Desconhecida", "Desconhecida"], ["Natural", "Natural (incêndio causado por queda de raio)"], ["Acidente", "Acidental"],
    ["Cabo de Alta Tensão", "Cabo de Alta Tensão"], ["Fagulha de Máquinas", "Fagulha de Máquinas"], ["Atividade agropecuária", "Limpeza de Área para Fins Agropecuários - Não especificados"],
    ["Limpeza de área para cultivo", "Limpeza de Área para Cultivo"], ["Renovação de pastagem natural", "Renovação de Pastagem Natural"],
    ["Renovação de pastagem plantada", "Renovação de Pastagem Plantada"], ["Queima de Restos de Exploração", "Queima de Resíduos de Exploração Vegetal"],
    ["Extrativismo", "Extração de Espécie Vegetal"], ["Caça", "Caça"], ["Extração de Espécie Vegetal", "Extração de Espécie Vegetal"], ["Extração de Madeira", "Extração de Madeira"],
    ["Outras Causas", null], ["Fogos de artifício", "Fogos de Artifício"], ["Fogueira de acampamento", "Fogueira de Acampamento"], ["Ritual religioso", "Ritual Religioso"],
    ["Queima de lixo", "Queima de Lixo"], ["Vandalismo", "Vandalismo"], ["Litígio com IEF", "Litígio com o IEF-MG"],
    ["Limpeza de estradas", "Limpeza de Estradas/Rodovias/Ferrovias"], ["Outro:", "Outro"]];
  const AGENTES = [["Indeterminado", "Indeterminado"], ["Descarga Elétrica (raio)", "Descarga Elétrica (raio)"], ["Descarga Elétrica (rede", "Descarga Eletrica (rede de alta tensão)"],
    ["Assentado", "Assentado"], ["Brigadista", "Brigadista"], ["Caçador/Pescador", "Caçador/Pescador"], ["Empresa Florestal", "Empresa Florestal"],
    ["Extrativista Vegetal", "Extrativista Vegetal"], ["Festeiro", "Festeiro (uso de fogos de artifício)"], ["Morador da UC", "Morador da UC"],
    ["Morador do Entorno", "Morador do Entorno"], ["Proprietário ou Funcionário de Fazenda", "Proprietário ou Funcionário de Fazenda"], ["Garimpeiro", "Garimpeiro"],
    ["Incendiário", "Incendiário/Piromaníaco"], ["Invasor", "Invasor"], ["Motorista", "Motorista/Operador de Máquina"], ["Transeunte", "Transeunte"],
    ["Posseiro", "Posseiro"], ["Religioso", "Religioso"], ["Turista", "Turista"], ["Madeireiro", "Madeireiro"], ["Outros:", "Outros"]];
  const VEG = [["Floresta Estacional Decidual", "veg_f_e_d"], ["Floresta Estacional Semidecidual", "veg_f_e_s"], ["Floresta Ombrófila", "veg_f_o"],
    ["Campo Rupestre", "veg_c_r"], ["Área antrópica", "veg_ant"], ["Campo cerrado", "veg_c_c"], ["Campo de altitude", "veg_c_a"],
    ["Cerrado sensu stricto", "veg_c_s_s"], ["Cerradão", "veg_c_d"], ["Vereda", "veg_ver"]];
  const VEIC = [["Veículo 4x2", "vc_4x2", "vc_4x2_d"], ["Veículo 4x4", "vc_4x4", "vc_4x4_d"], ["Van", "vc_van", "vc_van_d"], ["Motocicleta", "vc_moto", "vc_moto_d"],
    ["Trator", "vc_trator", "vc_trator_d"], ["Caminhão pipa", "vc_pipa", "vc_pipa_d"], ["Helicóptero", null, "a_helicop"], ["Air Tractor", null, "a_air_tr"], ["Outros:", null, null]];
  const COMB = ["comb_uc", "comb_ftp", "comb_par", "comb_sm", "comb_vol", "comb_pm", "comb_bm"];

  /* ==================================================================== */
  async function lerROIpdf(pdfjsLib, doc) {
    const OPS = pdfjsLib.OPS;
    const L = [], marcas = [], imagens = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const pg = await doc.getPage(p);
      const tc = await pg.getTextContent();
      const linhas = montarLinhas(tc.items, p).filter(l => !ehRodape(l));
      const ol = await pg.getOperatorList();
      const fo = formas(OPS, ol);
      // rótulo de cada caixa: o texto logo à direita, na mesma linha
      fo.caixas.forEach(c => {
        const cy = (c.y0 + c.y1) / 2;
        const l = linhas.find(l => Math.abs(l.y + 3 - cy) < 6);
        if (!l) return;
        const dir = l.pal.filter(w => w.x >= c.x1 - 1);
        const prox = fo.caixas.filter(o => o !== c && Math.abs((o.y0 + o.y1) / 2 - cy) < 4 && o.x0 > c.x1).map(o => o.x0);
        const lim = prox.length ? Math.min(...prox) : Infinity;
        const rot0 = dir.filter(w => w.x < lim), rot = [];
        rot0.forEach((w, k) => { if (!k || w.x - (rot0[k - 1].x + rot0[k - 1].w) < 14) { if (rot.length === k) rot.push(w); } });
        if (!rot.length || rot[0].x - c.x1 > 25) return;
        marcas.push({pagina: p, y: l.y, x: c.x0, linha: l, rotulo: rot.map(w => w.s).join(" "), n: norm(rot.map(w => w.s).join(" ")), marcada: c.marcada, digitado: false});
      });
      // "x" digitado no lugar (ou ao lado) da caixa
      linhas.forEach(l => l.pal.forEach((w, i) => {
        if (!/^[xX✓✔]$/.test(w.s)) return;
        const r0 = l.pal.slice(i + 1).filter(o => o.x - w.x < 260), rot = [];
        r0.forEach((o, k) => { if (!k || o.x - (r0[k - 1].x + r0[k - 1].w) < 14) { if (rot.length === k) rot.push(o); } });
        if (!rot.length || rot[0].x - (w.x + w.w) > 30) return;
        // não confundir com quantidade "x" na tabela de veículos (tratada lá)
        const ja = marcas.find(m => m.pagina === p && Math.abs(m.y - l.y) < 3 && Math.abs(m.x - w.x) < 18);
        if (ja) { ja.marcada = true; ja.digitado = true; return; }
        const txt = rot.map(o => o.s).join(" ");
        marcas.push({pagina: p, y: l.y, x: w.x, linha: l, rotulo: txt, n: norm(txt), marcada: true, digitado: true});
      }));
      fo.imagens.forEach(im => imagens.push({pagina: p, ...im}));
      linhas.forEach(l => L.push(l));
    }
    L.forEach((l, i) => l.i = i);
    marcas.forEach(m => m.i = m.linha.i);

    const E = {}, avisos = [], marcadas = [];
    const av = (campo, msg) => avisos.push({campo, msg});
    const acha = (re, de = 0) => { for (let i = de; i < L.length; i++) if (re.test(L[i].n)) return i; return -1; };
    const secoes = {
      // pelo título, não pelo número: há versões do modelo sem a seção 8 (renumeradas)
      s1: acha(/^\d*formadedetec/), s2: acha(/^\d*operacaodecombate/), s22: acha(/evolucaodaoperacaodecombate/),
      s3: acha(/^\d*veiculosda/), s4: acha(/^\d*vegetacaoeareaatingida/), s41: acha(/^\d*fontedainforma/), s42: acha(/^\d*zonasdefinida|^\d*zonadefinida/),
      s5: acha(/^\d*provaveiscausas/), s51: acha(/^\d*provavelagente/), s6: acha(/^\d*faunaatingida/), s7: acha(/^\d*descricaodaocorrencia/),
      s8: acha(/^\d*identificacaodoproprietario/), s9: acha(/^\d*dificuldadesencontradas/), s10: acha(/^\d*alimentacao$/), s11: acha(/^\d*anexarfotos/), s12: acha(/^\d*poligonogeorreferenciado/)
    };
    const NOMES = {s1: "1. Forma de detecção", s2: "2. Operação de combate", s22: "2.2 Evolução do combate", s3: "3. Veículos", s4: "4. Vegetação e área",
      s41: "4.1 Fonte da informação", s42: "4.2 Zonas do Plano de Manejo", s5: "5. Causas", s51: "5.1 Agente causal", s6: "6. Fauna", s7: "7. Descrição",
      s8: "8. Proprietário ou posseiro", s9: "9. Dificuldades", s10: "10. Alimentação", s11: "11. Fotos", s12: "12. Polígono"};
    Object.entries(secoes).forEach(([k, v]) => { if (v < 0) av("", `Seção “${NOMES[k]}” não encontrada no PDF.`); });
    const fim = (k) => { const ord = Object.values(secoes).filter(v => v > secoes[k]).sort((a, b) => a - b); return ord.length ? ord[0] : L.length; };
    const noIntervalo = (m, a, b) => m.i >= a && m.i < b;
    const marcadasEm = (a, b) => marcas.filter(m => m.marcada && noIntervalo(m, a, b));
    const textoEntre = (a, b) => {
      if (a < 0) return null;
      const ls = L.slice(a + 1, b).filter(l => l.txt.trim());
      let out = "", ant = null;
      ls.forEach(l => {
        if (ant) out += (ant.pagina !== l.pagina || ant.y - l.y > 20) ? "\n" : " ";
        out += l.txt.trim(); ant = l;
      });
      return limpa(out.replace(/ \n/g, "\n")) ? out.trim() : null;
    };
    const rotulo = (re, ate) => {          // "Rótulo: valor" numa linha
      const i = acha(re); if (i < 0 || (ate != null && i >= ate)) return null;
      const t = L[i].txt; const p = t.indexOf(":");
      return p >= 0 ? limpa(t.slice(p + 1)) : null;
    };

    /* ---- cabeçalho ---- */
    const iTit = acha(/relatoriodeocorrenciadeincendio/);
    if (iTit >= 0) {
      const m = L[iTit].txt.match(/n\s*[ºo°.]?\s*(\d{1,3})\s*\/\s*(\d{2,4})/i);
      if (m) { E.roi_num = String(+m[1]); let a = +m[2]; if (a < 100) a += 2000; E.ano = String(a); }
      const nomes = []; for (let i = iTit - 1; i >= 0 && i >= iTit - 3; i--) { if (L[i].txt.trim()) nomes.unshift(L[i].txt.trim()); }
      E._titulo_uc = limpa(nomes.join(" "));
    }
    if (!E.roi_num) av("roi_num", "Número do ROI não encontrado no título.");
    const iRI = acha(/numerori/);
    if (iRI >= 0) {
      const t = L[iRI].txt.replace(/^.*?RI\s*:?/i, "");
      const m = t.match(/(\d{1,4})\s*\/?\s*(\d{2,4})?/);
      if (m) { E.ri = String(+m[1]); if (m[2] && !E.ano) { let a = +m[2]; if (a < 100) a += 2000; E.ano = String(a); } }
      // REDS: o que estiver à direita do rótulo "Número REDS / ou BOS:"
      const reds = [];
      for (let i = Math.max(0, iRI - 3); i < iRI; i++) {
        const l = L[i]; if (!/redsoubos|numeroreds|oubos/.test(l.n)) continue;
        const lab = l.pal.findIndex(w => /BOS:|REDS/i.test(w.s));
        l.pal.forEach((w, k) => { if (k > lab && !/^(ou|BOS:?|REDS|Número)$/i.test(w.s)) reds.push(w.s); });
      }
      if (reds.length) E.reds_bos = limpa(reds.join(" "));
    }
    if (!E.ri) av("ri", "Número do RI não encontrado.");
    const bo = marcas.filter(m => m.marcada && /^(bocur|sbjan)/.test(m.n));
    if (bo.length === 1) E.base_op = bo[0].n.startsWith("bocur") ? "Base Operacional de Curvelo" : "Sub Base de Januária";
    E.municipio = rotulo(/^municipiosenvolvidos/);
    if (E.municipio) E.municipio = E.municipio.replace(/\s+e\s+/g, " / ").replace(/\s*,\s*/g, " / ");
    E.gerente_uc = rotulo(/^gerentedaunidade/);
    E.responsavel = rotulo(/^responsavelpelopreenchimento/);
    E.telefone = rotulo(/^telefonedecontato/);
    E.nome_local = rotulo(/^nomedolocaldoinicio/);
    const iLoc = acha(/^localizacaoprovavel/);
    if (iLoc >= 0) {
      const mi = marcas.filter(m => m.marcada && m.i === iLoc);
      const int = mi.some(m => m.n.startsWith("areainterna")), ent = mi.some(m => m.n.startsWith("entorno"));
      E.local = int && ent ? "Interno/Entorno" : int ? "Interno" : ent ? "Entorno" : "";
      if (!E.local) av("local", "Localização (área interna / entorno) não marcada no PDF.");
      const d = L[iLoc].txt.split(/Dist[âa]ncia\s*:?/i)[1];
      const dd = limpa((d || "").replace(/^\s*metros\s*$/i, ""));
      if (dd && /\d/.test(dd)) E.distancia = dd;
    }

    /* ---- 1. detecção ---- */
    if (secoes.s1 >= 0) {
      const iCab = acha(/quem.*data.*hora/, secoes.s1);
      if (iCab >= 0 && iCab < secoes.s1 + 3) {
        const l = L[iCab + 1];
        if (l && !marcas.some(m => m.i === l.i)) {
          const t = l.txt;
          const md = t.match(/\d{1,2}\s*\/\s*\d{1,2}\s*\/\s*\d{2,4}/);
          if (md) {
            E.dat_detec = data(md[0]);
            E.hr_detec = hora(t.slice(md.index + md[0].length));
            E.f_detec_quem = limpa(t.slice(0, md.index)) || null;
          } else E.f_detec_quem = limpa(t);
        }
      }
      const md = marcadasEm(secoes.s1, fim("s1"));
      const opc = md.map(m => DETEC.find(([r]) => m.n.startsWith(norm(r)))).filter(Boolean);
      if (opc.length) {
        E.f_detec = opc[0][1];
        const outros = md.find(m => m.n.startsWith("outros"));
        const txtO = outros ? limpa(outros.rotulo.replace(/^Outros\s*:?/i, "")) : "";
        if (txtO) E.f_detec_quem = E.f_detec_quem && norm(E.f_detec_quem) !== norm(txtO) ? `${E.f_detec_quem} (${txtO})` : (E.f_detec_quem || txtO);
        if (opc.length > 1) av("f_detec", `Mais de uma forma de detecção marcada: ${opc.map(o => o[0]).join(", ")}. Usei a primeira.`);
        marcadas.push(...md.map(m => "Detecção: " + m.rotulo));
      } else av("f_detec", "Nenhuma forma de detecção marcada.");
      if (!E.dat_detec) av("dat_detec", "Data da detecção não lida.");
      if (!E.hr_detec) av("hr_detec", "Hora da detecção não lida.");
    }

    /* ---- 2.1 coordenadas ---- */
    const dms = (re) => {
      const i = acha(re, Math.max(0, secoes.s2)); if (i < 0 || (secoes.s22 >= 0 && i > secoes.s22)) return null;
      const t = L[i].txt.replace(/^.*?\((?:S|W|O)\)\s*/i, "").replace(/^.*?(Lat\.?|Long\.?)\s*/i, "");
      const partes = t.split(/[\s°º’'"“”″]+/).map(s => s.trim()).filter(s => /\d/.test(s));
      if (!partes.length) return null;
      let [g, m, s] = partes;
      if (s && partes.length > 3 && /^\d+$/.test(partes[3])) s = s + "," + partes[3];        // "32”8"
      return {g: (g || "").replace(/\D/g, ""), m: (m || "").replace(/[^\d]/g, ""), s: (s || "").replace(/[^\d,.]/g, "").replace(".", ",")};
    };
    const la = dms(/^coordenadaslats|^lats|lat\.?\(s\)|^coordenadas.*lat/), lo = dms(/^geograficaslongw|^longw|long.*\(w\)|^geograficas.*long/);
    if (la) { E.lat_g = la.g; E.lat_m = la.m; E.lat_s = la.s; }
    if (lo) { E.lon_g = lo.g; E.lon_m = lo.m; E.lon_s = lo.s; }
    if (!la || !lo) av("lat_g", "Coordenadas do local do incêndio não lidas.");

    /* ---- 2.2 evolução do combate ---- */
    E._evol = [];
    if (secoes.s22 >= 0) {
      const ini = secoes.s22, fimT = secoes.s3 >= 0 ? secoes.s3 : ini + 30;
      // posições dos títulos das colunas
      const col = {};
      for (let i = ini; i < Math.min(fimT, ini + 6); i++) L[i].pal.forEach(w => {
        const n = norm(w.s);
        if (n === "data") col.data = w.x + w.w / 2;
        else if (n === "inicio") col.hr_inicio = w.x + w.w / 2;
        else if (n === "fim") col.hr_fim = w.x + w.w / 2;
        else if (n === "uc") col.comb_uc = w.x + w.w / 2;
        else if (n === "ftp") col.comb_ftp = w.x + w.w / 2;
        else if (n === "parc") col.comb_par = w.x + w.w / 2;
        else if (n === "cfm") col.comb_sm = w.x + w.w / 2;
        else if (n === "voluntaria") col.comb_vol = w.x + w.w / 2;
        else if (n === "pm") col.comb_pm = w.x + w.w / 2;
        else if (n === "bm") col.comb_bm = w.x + w.w / 2;
        else if (n === "total") col.total = w.x + w.w / 2;
      });
      const faltam = ["data", "hr_inicio", "hr_fim", ...COMB, "total"].filter(k => col[k] == null);
      if (faltam.length) av("_evol", "Não reconheci todos os títulos da tabela 2.2 (" + faltam.join(", ") + "). Confira as colunas.");
      const ks = Object.keys(col);
      for (let i = ini + 1; i < fimT; i++) {
        const l = L[i];
        if (!/\d{1,2}\s*\/\s*\d{1,2}\s*\/\s*\d{2,4}/.test(l.txt)) continue;
        const o = {}; const tot = [];
        l.pal.forEach(w => {
          const cx = w.x + w.w / 2;
          let k = null, d = Infinity; ks.forEach(c => { const dd = Math.abs(col[c] - cx); if (dd < d) { d = dd; k = c; } });
          if (!k) return;
          o[k] = o[k] ? o[k] + " " + w.s : w.s;
        });
        const r = {data: data(o.data), hr_inicio: hora(o.hr_inicio), hr_fim: hora(o.hr_fim)};
        COMB.forEach(k => { const v = inteiro(o[k]); r[k] = v == null ? "" : v; });
        if (!r.data) { av("_evol", `Linha da evolução sem data legível: "${l.txt}".`); continue; }
        const soma = COMB.reduce((s, k) => s + (+r[k] || 0), 0), t = inteiro(o.total);
        if (t != null && t !== soma) av("_evol", `Evolução em ${r.data.split("-").reverse().join("/")}: a soma das colunas dá ${soma}, mas o TOTAL do PDF é ${t}.`);
        E._evol.push(r);
      }
      if (E._evol.length) {
        const p = E._evol[0], u = E._evol[E._evol.length - 1];
        E.dat_comb = p.data; E.hr_comb = p.hr_inicio;
        E.dat_final = u.data; E.hr_final = u.hr_fim;
        if (p.hr_inicio && u.hr_fim && E._evol.length === 1 && u.hr_fim < p.hr_inicio) {
          const d = new Date(u.data + "T12:00:00"); d.setDate(d.getDate() + 1); E.dat_final = d.toISOString().slice(0, 10);
          av("dat_final", "O combate terminou depois da meia-noite: considerei o fim no dia seguinte.");
        }
        av("dat_final", "O modelo do ROI não tem campo de fim da ocorrência: usei o fim do último turno da evolução do combate.");
      } else { E.sem_combate = true; av("_evol", "Nenhuma linha na evolução do combate: marquei “Não houve combate”. Confira."); }
    }

    /* ---- 3. veículos ---- */
    if (secoes.s3 >= 0) {
      const ini = secoes.s3, fimT = secoes.s4 >= 0 ? secoes.s4 : ini + 20;
      let xUC = null, xOut = null, xVei = null, xInst = null;
      for (let i = ini + 1; i < Math.min(fimT, ini + 3); i++) L[i].pal.forEach(w => {
        const n = norm(w.s);
        if (n === "uc" && xUC == null) xUC = w.x + w.w / 2;
        else if (n === "outros" && xOut == null) xOut = w.x + w.w / 2;
        else if (n === "veiculos") xVei = w.x;
        else if (n === "nome" && xInst == null) xInst = w.x;
      });
      const inst = [], nomes = [], outros = [];
      if (xUC == null || xOut == null) av("vc_4x4", "Não reconheci as colunas UC / Outros da tabela de veículos.");
      for (let i = ini + 1; i < fimT; i++) {
        const l = L[i];
        // coluna da instituição (pode ocupar várias linhas)
        if (xInst != null) { const ws = l.pal.filter(w => w.x >= xInst - 15 && !/^nome$|^da$|^instituição$|^\(em|^caso|^de$|^outros\)$/i.test(w.s)); if (ws.length && !/Nome da Institui/i.test(l.txt)) inst.push(ws.map(w => w.s).join(" ")); }
        const v = VEIC.find(([rot]) => l.n.includes(norm(rot)));
        if (!v) continue;
        const [rot, kUC, kOut] = v;
        const iRot = l.pal.findIndex(w => norm(w.s).length && norm(rot).startsWith(norm(w.s)) );
        const xr = iRot >= 0 ? l.pal[iRot].x : (xVei || 150);
        const esq = l.pal.filter(w => w.x + w.w < xr - 2);
        esq.forEach(w => {
          const cx = w.x + w.w / 2;
          const alvo = xUC != null && xOut != null ? (Math.abs(cx - xUC) < Math.abs(cx - xOut) ? "uc" : "out") : "out";
          let n = inteiro(w.s);
          if (/^[xX]$/.test(w.s)) { n = 1; av(alvo === "uc" ? (kUC || kOut) : kOut, `${rot}: marcado com “x” em vez da quantidade; considerei 1.`); }
          if (n == null) return;
          const k = alvo === "uc" ? (kUC || kOut) : kOut;
          if (k) E[k] = String((+E[k] || 0) + n);
          else outros.push(`${n}`);
        });
        // texto depois de "Nome(s):" / "Outros:" (antes da coluna da instituição)
        const t = l.pal.filter(w => w.x > xr && (xInst == null || w.x < xInst - 15)).map(w => w.s).join(" ");
        const extra = limpa(t.replace(/^.*?(Nome\(s\)\s*:|Outros\s*:)/i, "")).replace(/^\*+$/, "");
        if (extra && /Nome\(s\)|Outros:/i.test(t)) {
          if (rot === "Outros:") outros.push(extra);
          else { nomes.push(`${rot}: ${extra}`); if (kOut && !E[kOut]) { E[kOut] = "1"; av(kOut, `${rot} com nome (${extra}) e sem quantidade; considerei 1.`); } }
        }
      }
      const so = outros.join(" ").trim();
      if (so) E.vc_outro = so;
      const ins = limpa(inst.join(" "));
      E.vc_instituicoes = [ins, ...nomes].filter(Boolean).join("; ") || null;
    }

    /* ---- 4. vegetação e área ---- */
    if (secoes.s4 >= 0) {
      const ini = secoes.s4, fimT = secoes.s41 >= 0 ? secoes.s41 : fim("s4");
      for (let i = ini + 1; i < fimT; i++) {
        const l = L[i];
        VEG.forEach(([rot, k]) => {
          const p = l.txt.toLowerCase().indexOf(rot.toLowerCase());
          if (p < 0) return;
          const antes = l.txt.slice(0, p).match(/([\d.,]+)\s*h?a?\s*$/i);
          if (antes) { const n = numero(antes[1]); if (n) E[k] = String(n); }
        });
        const mo = l.txt.match(/([\d.,]+)\s*ha\s+Outros\s*(.*)$/i);
        if (mo && numero(mo[1])) E.veg_outro = `${limpa(mo[2].replace(/Especificar neste campo\.?/i, "")) || "Outros"}: ${mo[1]}`;
        if (/area\s*interna/i.test(l.txt.normalize("NFD").replace(/[̀-ͯ]/g, ""))) {
          const mi = l.txt.match(/interna\s*:?\s*([\d.,]+)/i), me = l.txt.match(/Z\.?A\.?\s*:?\s*([\d.,]+)/i), mt = l.txt.match(/queimada\s*:?\s*([\d.,]+)/i);
          if (mi) E.area_int = String(numero(mi[1]) ?? "");
          if (me) E.area_ent = String(numero(me[1]) ?? "");
          if (mt) E._area_total = numero(mt[1]);
        }
      }
      if (E.area_int == null) av("area_int", "Área interna não lida.");
      if (E.area_ent == null) { E.area_ent = "0"; av("area_ent", "Área de entorno não informada; considerei 0."); }
      const tot = (+E.area_int || 0) + (+E.area_ent || 0);
      if (E._area_total != null && Math.abs(E._area_total - tot) > 0.05) av("area_int", `Área interna + entorno = ${tot.toFixed(2)} ha, mas o total do PDF é ${E._area_total} ha.`);
      const somaVeg = VEG.reduce((s, [, k]) => s + (+E[k] || 0), 0) + (E.veg_outro ? numero(E.veg_outro.split(":").pop()) || 0 : 0);
      if (somaVeg > 0 && Math.abs(somaVeg - tot) > 0.05) av("veg_c_r", `A soma por vegetação (${somaVeg.toFixed(2)} ha) é diferente da área total (${tot.toFixed(2)} ha).`);
    }
    if (secoes.s41 >= 0) {
      const f = marcadasEm(secoes.s41, secoes.s42 >= 0 ? secoes.s42 : secoes.s41 + 3).map(m => m.n);
      if (f.some(n => n.startsWith("zee"))) E.fonte_area = "ZEE"; else if (f.some(n => n.startsWith("uc"))) E.fonte_area = "UC";
    }
    if (secoes.s42 >= 0) { const z = textoEntre(secoes.s42, fim("s42")); if (z) E.zonas_pm = limpa(z); }

    /* ---- 5. causas e agente ---- */
    const escolhe = (ini, fimS, lista, campoP, campoOut, nome) => {
      if (ini < 0) return;
      const md = marcadasEm(ini, fimS);
      const op = md.map(m => {
        const o = lista.find(([r]) => m.n.startsWith(norm(r)));
        if (!o) return null;
        if (o[1] === "Outro" || o[1] === "Outros") {
          const t = limpa(m.rotulo.replace(/^Outros?\s*:?/i, "").replace(/Insira a prov[aá]vel causa de inc[eê]ndio/i, ""));
          return t ? ["Outro", (o[1] === "Outro" ? "Outro: " : "Outros: ") + t] : null;
        }
        return o[1] ? o : null;
      }).filter(Boolean);
      marcadas.push(...md.map(m => nome + ": " + m.rotulo));
      if (!op.length) { av(campoP, `${nome}: nenhuma opção marcada.`); return; }
      E[campoP] = op[0][1];
      if (op.length > 1) E[campoOut] = op.slice(1).map(o => o[1]).join("; ");
    };
    escolhe(secoes.s5, secoes.s51 >= 0 ? secoes.s51 : fim("s5"), CAUSAS, "causa_p", "causa_out", "Causa");
    escolhe(secoes.s51, fim("s51"), AGENTES, "ag_causal", "ag_out", "Agente causal");

    /* ---- 6. fauna ---- */
    E._fauna = [];
    if (secoes.s6 >= 0) {
      for (let i = secoes.s6 + 1; i < fim("s6"); i++) {
        const l = L[i];
        if (/quantidade|identificacao|^nome/.test(l.n) && !/^\d/.test(l.txt.trim())) continue;
        const m = l.txt.match(/^\s*(\d+)\s+(.+?)\s*(Lat\..*)?$/i);
        if (!m) continue;
        const nome = limpa(m[2]); if (!nome || /^nome$/i.test(nome)) continue;
        const c = m[3] || "", zero = /0°\s*0’\s*0,00/.test(c);
        const lat = zero ? "" : limpa((c.match(/Lat\.?\s*(.*?)\s*Long/i) || [])[1] || "");
        const lon = zero ? "" : limpa((c.match(/Long\.?\s*(.*)$/i) || [])[1] || "");
        E._fauna.push({qtd: String(+m[1]), nome, lat, lon});
      }
    }

    /* ---- 7 a 9. textos ---- */
    E.descricao = textoEntre(secoes.s7, fim("s7"));
    E.proprietario = textoEntre(secoes.s8, fim("s8"));
    E.dificuldades = textoEntre(secoes.s9, fim("s9"));
    if (!E.descricao) av("descricao", "Descrição da ocorrência (seção 7) vazia.");

    /* ---- 10. alimentação ---- */
    if (secoes.s10 >= 0) {
      const md = marcadasEm(secoes.s10, fim("s10")).map(m => m.n);
      if (md.some(n => n.startsWith("sim"))) E.alim_fornecida = "true"; else if (md.some(n => n.startsWith("nao"))) E.alim_fornecida = "false";
      const iq = acha(/^\d*quantidade.*cafe|quantidade.*cafedamanha/, secoes.s10);
      if (iq >= 0 && iq < fim("s10")) {
        const t = L[iq].txt;
        [["alim_cafe_manha", /Caf[ée] da Manh[ãa]\s*:?\s*(\d+)/i], ["alim_almoco", /Almo[çc]o\s*:?\s*(\d+)/i], ["alim_cafe_tarde", /Caf[ée] da Tarde\s*:?\s*(\d+)/i], ["alim_jantar", /Jantar\s*:?\s*(\d+)/i]]
          .forEach(([k, re]) => { const m = t.match(re); if (m) E[k] = String(+m[1]); });
      }
    }

    /* ---- 11. fotos: imagens entre as seções 11 e 12 ---- */
    const fotos = [];
    if (secoes.s11 >= 0) {
      const a = L[secoes.s11], b = secoes.s12 >= 0 ? L[secoes.s12] : null;
      imagens.forEach(im => {
        const w = im.x1 - im.x0, h = im.y1 - im.y0;
        if (w < 90 || h < 60) return;                       // logotipos e ícones
        const depois = im.pagina > a.pagina || (im.pagina === a.pagina && im.y1 <= a.y + 2);
        const antes = !b || im.pagina < b.pagina || (im.pagina === b.pagina && im.y0 >= b.y - 2);
        if (depois && antes) fotos.push(im);
      });
    }

    /* ---- data do documento (local, dd de mês de aaaa) ---- */
    const MESES = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
    for (let i = L.length - 1; i >= Math.max(0, L.length - 12); i--) {
      const t = L[i].txt, n = t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
      let m = n.match(/(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(\d{4})/);
      if (m && MESES.includes(m[2])) { E._data_doc = `${m[3]}-${String(MESES.indexOf(m[2]) + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`; break; }
      const d = data(t); if (d && /,/.test(t)) { E._data_doc = d; break; }
    }

    /* ---- conferências ---- */
    const anoR = +E.ano;
    ["dat_detec", "dat_comb", "dat_final"].forEach(k => {
      if (E[k] && anoR && +E[k].slice(0, 4) !== anoR) av(k, `Data ${E[k].split("-").reverse().join("/")} fora do ano do ROI (${anoR}). Provável erro de digitação.`);
    });
    if (E.dat_detec && E.dat_comb && E.dat_comb < E.dat_detec) av("dat_comb", "O início do combate está antes da detecção.");
    Object.keys(E).forEach(k => { if (E[k] === null || E[k] === undefined) delete E[k]; });
    return {estado: E, avisos, marcadas, fotos, paginas: doc.numPages};
  }

  raiz.lerROIpdf = lerROIpdf;
  if (typeof module !== "undefined") module.exports = {lerROIpdf};
})(typeof window !== "undefined" ? window : globalThis);
