// Módulos de informação de cada UC e os blocos (seções do modelo do PIPCIF 2026) de cada um.
// O PIPCIF passa a ser um relatório gerado a partir desses módulos (ver PIPCIF_RELATORIO).
// Usado na página inicial e no Cadastro das UCs. mapa = bloco com dados georreferenciados.
window.PIPCIF_MODULOS = [
  {n:1, id:"cadastro", nome:"Cadastro da UC", pronto:true, blocos:[
    {s:"3",   t:"Informações gerais", d:"gerente e contatos, funcionários, responsáveis na ausência, decretos, ambiente, meses críticos, situação fundiária"},
    {s:"4.1", t:"Sede da UC", d:"endereço e coordenadas", mapa:true}]},
  {n:2, id:"infraestrutura", nome:"Infraestrutura", pronto:true, blocos:[
    {s:"4.2", t:"Alojamento e camping", d:"camas, roupa de cama, sanitários, cozinha, barracas, energia"},
    {s:"4.3", t:"Vigilância", d:"torres e postos de observação", mapa:true},
    {s:"4.7", t:"Pistas de pouso", d:"dimensões, pavimentação, reservatório de água, situação", mapa:true},
    {s:"4.8", t:"Heliportos e helipontos", d:"áreas para operação de helicóptero", mapa:true},
    {s:"4.9", t:"Estações meteorológicas", d:"responsável, localização e situação", mapa:true},
    {s:"4.10", t:"Hidrantes e pontos de água", d:"hidrantes, represas, poços e outros pontos de abastecimento", mapa:true}]},
  {n:3, id:"recursos", nome:"Recursos e comunicação", blocos:[
    {s:"4.4", t:"Veículos", d:"tipo, marca/modelo, estado de conservação, disponibilidade"},
    {s:"4.5", t:"Radiocomunicação da UC", d:"repetidoras, rádios fixos, móveis e portáteis (HT)", mapa:true},
    {s:"4.6", t:"Rádios com parceiros", d:"fixos, móveis e portáteis disponibilizados por parceiros"},
    {s:"5",   t:"Materiais e equipamentos", d:"ferramentas manuais, equipamentos especiais e EPIs — quantidade e situação"}]},
  {n:4, id:"apoio", nome:"Rede de apoio", blocos:[
    {s:"6", t:"Parceiros e apoios disponíveis", d:"instituições do catálogo, responsável, contatos e apoio oferecido", mapa:true},
    {s:"7", t:"Prestadores de serviço", d:"alimentação, unidades de saúde e outros"},
    {s:"8", t:"Colaboradores e moradores", d:"propriedades, atividade e tipo de apoio", mapa:true},
    {s:"9", t:"Brigadistas voluntários", d:"nome, município e contato"}]},
  {n:5, id:"prevencao", nome:"Prevenção e plano anual", blocos:[
    {s:"10", t:"Aceiros, estradas e trilhas", d:"construção e manutenção, com traçado no mapa", mapa:true},
    {s:"11", t:"Elementos favoráveis e adversos", d:"à prevenção e ao combate"},
    {s:"12", t:"Cronograma de ações preventivas", d:"capacitação e sensibilização — período, local e público"},
    {s:"13", t:"Projetos de sustentabilidade", d:"dentro e no entorno da UC", mapa:true},
    {s:"16", t:"Atuação dos brigadistas contratados", d:"rondas, escala, plantão e pontos estratégicos"}]},
  {n:6, id:"risco", nome:"Mapa de risco", blocos:[
    {s:"14", t:"Setores de risco", d:"fatores favoráveis e adversos por setor, com o histórico de cicatrizes do BDG", mapa:true}]},
  {n:7, id:"operacional", nome:"Plano operacional", blocos:[
    {s:"15", t:"Plano operacional de combate", d:"procedimentos iniciais, intermediários (grandes incêndios), dos parceiros e pós-incêndio"}]}
];

// Relatório que reúne os módulos (design a definir)
window.PIPCIF_RELATORIO = {nome:"PIPCIF — Plano Integrado de Prevenção e Combate a Incêndios Florestais",
  d:"Junta os dados de todos os módulos da UC num documento para exportar em PDF (SEI), com introdução, objetivo, distribuição (seção 17) e termo de participação."};
