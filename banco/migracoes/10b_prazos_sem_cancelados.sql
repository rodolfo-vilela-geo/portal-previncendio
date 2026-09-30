-- Controle de prazos: RIs cancelados não geram cobrança de ROI.
create or replace view vw_prazos with (security_invoker = true) as
select i.ano, i.ri, i.nome_uc, i.responsavel, i.dat_final, i.data_limite, r.cod_bdp,
       coalesce(r.status, 'pendente') as status, r.enviado_em,
       case when r.cod_bdp is null then i.data_limite - current_date end as dias_restantes,
       case when r.cod_bdp is not null then 'entregue'
            when i.data_limite is null then 'sem data de fim'
            when current_date > i.data_limite then 'ATRASADO'
            when i.data_limite - current_date <= 2 then 'vence em até 2 dias'
            else 'no prazo' end as situacao
from ri i
left join roi r on r.ano = i.ano and r.ri = i.ri
where i.status <> 'cancelado'
order by (r.cod_bdp is not null), i.data_limite;
