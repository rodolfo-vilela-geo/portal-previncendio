// Portal Previncêndio — criação de login e nova senha (somente administradores).
// O cadastro na tabela equipe e as UCs do gerente são gravados pelo navegador do admin
// (com RLS e histórico); aqui só se mexe no Supabase Auth, que exige a chave de serviço.
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// senha legível: sem 0/O, 1/l/I
function gerarSenha(n = 10) {
  const c = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const v = crypto.getRandomValues(new Uint32Array(n));
  return Array.from(v, (x) => c[x % c.length]).join("") + "!";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: quem, error: e1 } = await admin.auth.getUser(token);
    if (e1 || !quem?.user?.email) return resposta({ erro: "Sessão inválida. Entre novamente." }, 401);
    const { data: perfil } = await admin.from("equipe").select("papel, ativo").eq("email", quem.user.email.toLowerCase()).maybeSingle();
    if (!perfil || !perfil.ativo || perfil.papel !== "admin") return resposta({ erro: "Somente administradores." }, 403);

    const { acao, email: bruto } = await req.json();
    const email = String(bruto || "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return resposta({ erro: "E-mail inválido." }, 400);
    const senha = gerarSenha();

    // procura o usuário no Auth (poucas centenas: uma página basta)
    const { data: lista, error: e2 } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (e2) return resposta({ erro: e2.message }, 500);
    const existente = lista.users.find((u) => (u.email || "").toLowerCase() === email);

    if (acao === "criar") {
      if (existente) {
        const { error } = await admin.auth.admin.updateUserById(existente.id, { password: senha, email_confirm: true });
        if (error) return resposta({ erro: error.message }, 500);
        return resposta({ ok: true, senha, jaExistia: true });
      }
      const { error } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true });
      if (error) return resposta({ erro: error.message }, 500);
      return resposta({ ok: true, senha, jaExistia: false });
    }
    if (acao === "senha") {
      if (!existente) return resposta({ erro: "Este e-mail ainda não tem login. Use “Criar login”." }, 404);
      const { error } = await admin.auth.admin.updateUserById(existente.id, { password: senha });
      if (error) return resposta({ erro: error.message }, 500);
      return resposta({ ok: true, senha });
    }
    return resposta({ erro: "Ação desconhecida." }, 400);
  } catch (e) {
    return resposta({ erro: String((e as Error)?.message || e) }, 500);
  }
});
