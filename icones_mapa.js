// Ícones dos mapas do portal (Leaflet). Símbolos simples desenhados em SVG, num selo colorido por tipo.
// Uso: L.marker([lat, lon], {icon: iconeMapa("heliponto", {sel:true, situacao:"inoperante"})})
(function(){
  const G = {  // glifos em viewBox 24 — traço branco (s) ou preenchimento branco (f)
    heliponto: {s:'<path d="M7.5 5.5v13M16.5 5.5v13M7.5 12h9" stroke-width="3"/>'},
    pista:     {f:'<path d="M21 15.5v-1.8l-7.5-4.6V4.2a1.5 1.5 0 0 0-3 0v4.9L3 13.7v1.8l7.5-2.3v4.9l-2 1.5V21l3.5-1 3.5 1v-1.4l-2-1.5v-4.9z"/>'},
    vigilancia:{s:'<path d="M12 6.5l-4.5 14M12 6.5l4.5 14M9 15.5h6M10.4 11h3.2"/><path d="M8.5 3.5h7l-1 3h-5z" fill="#fff"/>'},
    camera:    {s:'<rect x="3" y="7" width="13" height="10" rx="2"/><path d="M16 11l5-3v8l-5-3z" fill="#fff"/>'},
    estacao:   {s:'<path d="M14 14.8V4.5a2 2 0 0 0-4 0v10.3a4 4 0 1 0 4 0z"/><circle cx="12" cy="18" r="1.6" fill="#fff"/><path d="M17 6h3M17 9.5h3"/>'},
    agua:      {f:'<path d="M12 2.8s-6.2 6.6-6.2 11.1a6.2 6.2 0 0 0 12.4 0C18.2 9.4 12 2.8 12 2.8z"/>'},
    sede:      {f:'<path d="M3 11.2L12 4l9 7.2V20a1 1 0 0 1-1 1h-5.2v-5.6H9.2V21H4a1 1 0 0 1-1-1z"/>'},
    antena:    {s:'<path d="M12 11v10M8.5 21h7M6.3 5.7a8 8 0 0 0 0 10.6M17.7 5.7a8 8 0 0 1 0 10.6M9 8.4a4 4 0 0 0 0 5.2M15 8.4a4 4 0 0 1 0 5.2"/><circle cx="12" cy="11" r="1.6" fill="#fff"/>'},
    radio:     {s:'<rect x="7" y="7.5" width="10" height="13" rx="2"/><path d="M10 7.5V3.5M10 11.5h4M10 15h4"/>'},
    parceiro:  {s:'<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/>'},
    colaborador:{s:'<circle cx="12" cy="8" r="3.5"/><path d="M5 20.5c0-3.9 3.1-7 7-7s7 3.1 7 7"/>'},
    brigadista:{s:'<circle cx="12" cy="8" r="3.5"/><path d="M5 20.5c0-3.9 3.1-7 7-7s7 3.1 7 7"/>'},
    alimentacao:{s:'<path d="M7 3v7a2 2 0 0 0 4 0V3M9 12v9M17 21V3c-2 1-3 3.5-3 7v3h3"/>'},
    saude:     {f:'<path d="M9.5 3.5h5v6h6v5h-6v6h-5v-6h-6v-5h6z"/>'},
    abastecimento:{s:'<path d="M5 21V5a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v16M3.5 21h12M7 8h5M14 10h2a1.5 1.5 0 0 1 1.5 1.5v5a1.5 1.5 0 0 0 3 0V8l-3-3"/>'},
    outro:     {s:'<circle cx="12" cy="10" r="3"/><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/>'},
    fogo:      {f:'<path d="M12 2.5c.8 3.2 4.8 5.2 4.8 10a4.8 4.8 0 0 1-9.6 0c0-2.3 1.2-3.5 1.3-5.5 1.3 1 2 2.2 2.5 2.4.3-2.2 0-4.6 1-6.9z"/>'}
  };
  const COR = {heliponto:"#ff7a1a", pista:"#2f7df6", vigilancia:"#e0b000", camera:"#e0b000", estacao:"#9b6bff", agua:"#12a9d8",
               sede:"#2e5603", antena:"#d6336c", fogo:"#e0301e",
               radio:"#b83280", parceiro:"#1f5fd1", colaborador:"#8a5a2b", brigadista:"#c46f1a", alimentacao:"#e8590c", saude:"#0f9d58", abastecimento:"#495057", outro:"#868e96"};
  const ROT = {heliponto:"Heliponto", pista:"Pista de pouso", vigilancia:"Torre / posto de observação", camera:"Câmera",
               estacao:"Estação meteorológica", agua:"Ponto de água", sede:"Sede da UC", antena:"Repetidora / antena", fogo:"Incêndio",
               radio:"Rádio fixo", parceiro:"Parceiro", colaborador:"Colaborador / morador", brigadista:"Brigadista voluntário", alimentacao:"Alimentação", saude:"Unidade de saúde", abastecimento:"Abastecimento", outro:"Outro prestador"};
  function svg(tipo, tam){
    const g = G[tipo] || G.vigilancia;
    const corpo = g.f ? `<g fill="#fff">${g.f}</g>` : `<g fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${g.s}</g>`;
    return `<svg viewBox="0 0 24 24" width="${tam}" height="${tam}" aria-hidden="true">${corpo}</svg>`;
  }
  // tipo de ícone de um ponto de infraestrutura (câmeras usam o próprio símbolo)
  window.tipoIcone = (tipo, atributos) => tipo === "vigilancia" && /c[âa]mera/i.test((atributos||{}).estrutura||"") ? "camera" : tipo;
  window.iconeMapa = function(tipo, o = {}){
    const d = o.sel ? 36 : (o.tam || 28), cor = COR[tipo] || "#555", off = o.situacao === "inoperante";
    const html = `<div style="width:${d}px;height:${d}px;border-radius:50%;background:${off ? "#8a8a84" : cor};border:2px solid ${o.sel ? "#111" : "#fff"};
      box-shadow:0 1px 4px rgba(0,0,0,.55)${o.sel ? ",0 0 0 3px #fff" : ""};display:grid;place-items:center;position:relative">${svg(tipo, Math.round(d * .62))}
      ${off ? `<span style="position:absolute;right:-4px;top:-4px;width:14px;height:14px;border-radius:50%;background:#b3261e;color:#fff;font:700 10px/14px system-ui;text-align:center;border:1.5px solid #fff">×</span>` : ""}
      ${o.situacao === "parcial" ? `<span style="position:absolute;right:-4px;top:-4px;width:14px;height:14px;border-radius:50%;background:#e0a100;color:#fff;font:700 10px/14px system-ui;text-align:center;border:1.5px solid #fff">!</span>` : ""}</div>`;
    return L.divIcon({className:"", html, iconSize:[d, d], iconAnchor:[d/2, d/2], tooltipAnchor:[0, -d/2]});
  };
  // pequeno ícone para legendas
  window.iconeLegenda = (tipo, tam = 18) => `<span style="display:inline-grid;place-items:center;width:${tam}px;height:${tam}px;border-radius:50%;background:${COR[tipo]};border:1.5px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.25);vertical-align:-4px;margin-right:5px">${svg(tipo, Math.round(tam*.62))}</span>`;
  window.ICONES_ROTULO = ROT;
})();
