# Migração do Colibri para Supabase self-hosted

Roteiro para levar o banco do Colibri do Supabase em nuvem (projeto `nhsjsttvxixgfqnweqos`) para um Supabase instalado nos servidores do Estado (Docker). Segue o guia oficial: <https://supabase.com/docs/guides/self-hosting/restore-from-platform>.

## O que existe hoje (29/10/2026)

| Item | Valor |
|---|---|
| Postgres | 17 (recomendado subir o self-hosted também em Postgres 17 — guia oficial "postgres-upgrade-17") |
| Tamanho do banco | ~290 MB |
| Extensões | postgis 3.3, pg_net 0.20 (busca do CAR no SICAR), pgcrypto, uuid-ossp, pg_stat_statements, supabase_vault |
| Storage | buckets `roi-fotos` e `acoes-fotos` (poucos arquivos, < 1 MB) |
| Edge Function | `usuarios` (cria login e gera senha provisória) — código em `banco/funcoes/usuarios/index.ts` |
| Login | e-mail e senha (Supabase Auth); sem login social; sem envio de e-mail |

## Passo 1 — Exportar (máquina com Docker, fora do repositório)

```sh
export ORIGEM_DB_URL='[connection string do botão Connect, com a senha do banco]'
export ORIGEM_SERVICE_KEY='[chave service_role]'
bash exportar.sh
```

- A connection string está no painel do Supabase → **Connect** (copie a de *Session pooler* ou *Direct connection*; a senha é a do banco).
- A chave `service_role` está em **Project Settings → API Keys**.
- Gera `colibri_dump_AAAA-MM-DD.tar.gz` com: `roles.sql`, `schema.sql`, `data.sql` (inclui `auth.users`, com as senhas em hash), as fotos do Storage, a lista de extensões e a contagem de linhas de cada tabela.
- **O pacote tem dados pessoais e as contas dos usuários.** Nunca colocar no GitHub; entregar por meio seguro.

## Passo 2 — Preparar o self-hosted (STI)

1. Instalar o Supabase pelo Docker: <https://supabase.com/docs/guides/self-hosting/docker> (de preferência com Postgres 17).
2. No `.env`: gerar `JWT_SECRET`, `ANON_KEY` e `SERVICE_ROLE_KEY` novos; definir `POSTGRES_PASSWORD`, `SITE_URL` (endereço onde as páginas vão ficar) e `API_EXTERNAL_URL`.
3. Liberar a saída HTTPS do banco para `geoserver.car.gov.br` (pg_net, busca do CAR) e do navegador dos usuários para `geoserver.meioambiente.mg.gov.br` (camadas do IDE-Sisema).

## Passo 3 — Importar

```sh
export DESTINO_DB_URL='postgres://postgres.[tenant-id]:[POSTGRES_PASSWORD]@[servidor]:5432/postgres'
export DESTINO_URL='https://[endereço da API do self-hosted]'
export DESTINO_SERVICE_KEY='[SERVICE_ROLE_KEY do .env]'
tar xzf colibri_dump_AAAA-MM-DD.tar.gz
TESTE=1 bash importar.sh colibri_dump_AAAA-MM-DD   # 1ª vez, numa instância de teste: lista os erros
bash importar.sh colibri_dump_AAAA-MM-DD           # importação valendo, numa base limpa
```

O script cria as extensões, ajusta o `data.sql` se o destino for Postgres 15, importa papéis + estrutura + dados numa transação única (gatilhos desligados durante a carga), envia as fotos e compara a contagem de linhas de cada tabela com a origem.

Se aparecer `COPY` de tabela ou coluna que não existe no destino (versões mais novas de Auth/Storage na nuvem), comentar a linha `COPY ... FROM stdin;` e o `\.` correspondente no `data_ajustado.sql` — ver a seção *Troubleshooting* do guia oficial.

## Passo 4 — Depois da importação

1. **Edge Function**: copiar `banco/funcoes/usuarios/index.ts` para `volumes/functions/usuarios/index.ts` do self-hosted (usa `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`, que o self-hosted já fornece).
2. **Páginas**: o endereço do banco e a chave pública (`anon`) estão escritos em 17 arquivos `.html`/`.js` (procure `nhsjsttvxixgfqnweqos` e `sb_publishable_`). Trocar pelo endereço e pela `ANON_KEY` novos — ou centralizar antes num arquivo de configuração único (pedir ao Claude na próxima sessão).
3. **Usuários**: as contas e senhas vêm no dump, mas como o `JWT_SECRET` é novo todos precisam entrar de novo (uma vez).
4. **Testar**: login, abrir um ROI, Geo Colibri, Painel da UC, gerar senha provisória (Edge Function), busca do CAR numa UC pequena (pg_net) e o Painel de ocorrências sem login.
5. **Backup**: programar `pg_dump` diário no servidor da STI.
