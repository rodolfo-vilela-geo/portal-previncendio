-- =====================================================================
--  CORREÇÃO: APA Parque Fernão Dias -> APA Parque Cataguás
--  (Lei 22.428/2016, renomeada pela Lei 25.366/2025 · Betim/Contagem)
--  A APA Fernão Dias (Sul de Minas, Decreto 38.925/97) continua igual e
--  passa a ter o seu limite oficial ligado corretamente.
--  Pode rodar antes ou depois dos arquivos 07; rodar de novo não causa problema.
-- =====================================================================
begin;

-- 1. Histórico: registros da antiga APA Parque Fernão Dias
update roi set nome_uc = 'Parque Cataguás' where nome_uc = 'Parque Fernão Dias';

-- 2. Cadastro: Parque Cataguás herda os dados de Betim/Contagem
insert into uc (nome_uc, categoria, grupo, bioma_uc, ufbio, base_op, municipios, gerente, telefone)
select 'Parque Cataguás', categoria, grupo, bioma_uc, ufbio, base_op, municipios, gerente, telefone
from uc where nome_uc = 'Parque Fernão Dias'
on conflict (nome_uc) do update set
  base_op    = coalesce(uc.base_op, excluded.base_op),
  municipios = coalesce(excluded.municipios, uc.municipios),
  gerente    = coalesce(uc.gerente, excluded.gerente),
  telefone   = coalesce(uc.telefone, excluded.telefone);
delete from uc where nome_uc = 'Parque Fernão Dias';

-- 3. Lista suspensa de UCs
insert into dominio (campo, valor, ordem, ativo)
select 'nome_uc', 'Parque Cataguás', ordem, true from dominio where campo = 'nome_uc' and valor = 'Parque Fernão Dias'
on conflict do nothing;
delete from dominio where campo = 'nome_uc' and valor = 'Parque Fernão Dias';

-- 4. Limite oficial da APA Fernão Dias (estava ligado ao nome errado)
update uc_limite set nome_uc = 'Fernão Dias' where nome_uc = 'Parque Fernão Dias';

commit;

-- Conferência
select nome_uc, count(*) from roi where nome_uc in ('Parque Cataguás','Fernão Dias','Parque Fernão Dias') group by 1;
