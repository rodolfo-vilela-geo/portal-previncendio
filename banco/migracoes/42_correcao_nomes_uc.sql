-- =====================================================================
--  42 · Correção de nomes (Rodolfo, 13/10/2026)
--  · Nome curto correto: "Mata do Krambeck" (era "Mata de Krambeck"); a troca em uc propaga em cascata.
--  · Nome oficial correto: "Monumento Natural Estadual Pico da Ibituruna" (o IDE grafa "Pico do Ibituruna").
--  · As APEs Santa Izabel e Espalha e Todos os Santos saíram da gestão do IEF: ficam sem nome oficial.
--  · "Parque Estadual de Serra Nova e Talhado" confirmado como nome oficial.
-- =====================================================================
update uc set nome_uc = 'Mata do Krambeck', variantes = variantes || array['Mata de Krambeck', 'PE Mata do Krambeck']
 where nome_uc = 'Mata de Krambeck';
update uc set nome_oficial = 'Monumento Natural Estadual Pico da Ibituruna', variantes = variantes || array['Monumento Natural Estadual Pico do Ibituruna']
 where nome_uc = 'Pico da Ibituruna';
update dominio set valor = 'Mata do Krambeck' where campo = 'nome_uc' and valor = 'Mata de Krambeck';
