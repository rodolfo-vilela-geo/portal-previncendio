# Ferramentas do Colibri

Scripts de apoio que não rodam no site. Nenhum deles contém dado pessoal.

| Pasta | O que tem |
|---|---|
| `risco/` | Receita do mapa de risco: `grade.py` (grade hexagonal + histórico do BDG), `gee/` (extração de variáveis no Google Earth Engine), `modelo.py` (regressão logística e conferência 2023–2025), `mapa.py` (figura de conferência), `exportar.py` (JSON para importar no Colibri). Passo a passo em `docs/mapa_risco.md`. |
| `pipcif/` | `exportar_pipcif.sql`: gera o JSON de importação de uma UC a partir do banco local. Passo a passo em `docs/pipcif.md`. Os conversores por UC (`gerar_*.py`) ficam no pacote privado. |
| `testes/` | Ambiente de teste local (Postgres + PostgREST + Playwright). Ver `testes/README.md`. |

Ferramentas do banco (migração da planilha histórica do BDG, base para PostgreSQL fora do Supabase) estão em `banco/ferramentas/`.
