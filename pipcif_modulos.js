// Módulos de informação de cada UC e os blocos (seções do modelo do PIPCIF 2026) de cada um.
// O PIPCIF passa a ser um relatório gerado a partir desses módulos (ver PIPCIF_RELATORIO).
// Usado na página inicial e no Cadastro das UCs. mapa = bloco com dados georreferenciados.
window.PIPCIF_MODULOS = [
  {n:1, ic:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>', id:"cadastro", nome:"Cadastro da UC", pronto:true, blocos:[
    {s:"3",   t:"Informações gerais", d:"gerente e contatos, funcionários, responsáveis na ausência, decretos, ambiente, meses críticos, situação fundiária"},
    {s:"4.1", t:"Sede da UC", d:"endereço e coordenadas", mapa:true}]},
  {n:2, ic:'<path d="M3 21h18M5 21V10l7-5 7 5v11"/><path d="M10 21v-6h4v6"/>', id:"infraestrutura", nome:"Infraestrutura", pronto:true, blocos:[
    {s:"4.2", t:"Alojamento e camping", d:"camas, roupa de cama, sanitários, cozinha, barracas, energia"},
    {s:"4.3", t:"Vigilância", d:"torres e postos de observação", mapa:true},
    {s:"4.7", t:"Pistas de pouso", d:"dimensões, pavimentação, reservatório de água, situação", mapa:true},
    {s:"4.8", t:"Heliportos e helipontos", d:"áreas para operação de helicóptero", mapa:true},
    {s:"4.9", t:"Estações meteorológicas", d:"responsável, localização e situação", mapa:true},
    {s:"4.10", t:"Hidrantes e pontos de água", d:"hidrantes, represas, poços e outros pontos de abastecimento", mapa:true}]},
  {n:3, ic:'<rect x="7" y="7" width="10" height="14" rx="2"/><path d="M10 7V3M10 11h4M10 14.5h4"/>', id:"recursos", nome:"Recursos e comunicação", blocos:[
    {s:"4.4", t:"Veículos", d:"tipo, marca/modelo, estado de conservação, disponibilidade"},
    {s:"4.5", t:"Radiocomunicação da UC", d:"repetidoras, rádios fixos, móveis e portáteis (HT)", mapa:true},
    {s:"4.6", t:"Rádios com parceiros", d:"fixos, móveis e portáteis disponibilizados por parceiros"},
    {s:"5",   t:"Materiais e equipamentos", d:"ferramentas manuais, equipamentos especiais e EPIs — quantidade e situação"}]},
  {n:4, ic:'<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 11a3 3 0 1 0 0-6M21 20c0-2.8-1.8-5.2-4.4-5.8"/>', id:"apoio", nome:"Rede de apoio", blocos:[
    {s:"6", t:"Parceiros e apoios disponíveis", d:"instituições do catálogo, responsável, contatos e apoio oferecido", mapa:true},
    {s:"7", t:"Prestadores de serviço", d:"alimentação, unidades de saúde e outros"},
    {s:"8", t:"Colaboradores e moradores", d:"propriedades, atividade e tipo de apoio", mapa:true},
    {s:"9", t:"Brigadistas voluntários", d:"nome, município e contato"}]},
  {n:5, ic:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M9 15.5l2 2 4-4"/>', id:"prevencao", nome:"Prevenção e plano anual", blocos:[
    {s:"10", t:"Aceiros, estradas e trilhas", d:"construção e manutenção, com traçado no mapa", mapa:true},
    {s:"11", t:"Elementos favoráveis e adversos", d:"à prevenção e ao combate"},
    {s:"12", t:"Cronograma de ações preventivas", d:"capacitação e sensibilização — período, local e público"},
    {s:"13", t:"Projetos de sustentabilidade", d:"dentro e no entorno da UC", mapa:true},
    {s:"16", t:"Atuação dos brigadistas contratados", d:"rondas, escala, plantão e pontos estratégicos"}]},
  {n:6, ic:'<path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>', id:"risco", nome:"Mapa de risco", blocos:[
    {s:"14", t:"Setores de risco", d:"fatores favoráveis e adversos por setor, com o histórico de cicatrizes do BDG", mapa:true}]},
  {n:7, ic:'<path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2.5 1.3-3.7 1.5-5.5 1.2 1 2 2.2 2.5 2.5.2-2.4-.3-4.6 1-7z"/>', id:"operacional", nome:"Plano operacional", blocos:[
    {s:"15", t:"Plano operacional de combate", d:"procedimentos iniciais, intermediários (grandes incêndios), dos parceiros e pós-incêndio"}]}
];

// Relatório que reúne os módulos (design a definir)
window.PIPCIF_RELATORIO = {ic:'<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M9 14h6M9 17h4"/>', nome:"PIPCIF — Plano Integrado de Prevenção e Combate a Incêndios Florestais",
  d:"Junta os dados de todos os módulos da UC num documento para exportar em PDF (SEI), com introdução, objetivo, distribuição (seção 17) e termo de participação."};

// ícone de um módulo (SVG em traço, herda a cor do texto)
window.iconeModulo = (m, tam = 20) => `<svg viewBox="0 0 24 24" width="${tam}" height="${tam}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${m.ic || ""}</svg>`;
