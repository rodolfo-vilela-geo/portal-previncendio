// Páginas restritas: sem login, vai para a página inicial (diálogo de entrar) e volta para cá depois.
// Uso: <script src="exige_login.js?v=..."></script> logo depois do supabase-js, no <head>.
// Só o Painel de ocorrências (histórico) e o Boletim da FTP são públicos.
(function(){
  document.documentElement.style.visibility = "hidden";          // nada aparece antes da conferência
  const volta = encodeURIComponent(location.pathname.split("/").pop() + location.search);
  const sair = () => location.replace("index.html?entrar=1&volta=" + volta);
  try{
    const sb = window.supabase.createClient("https://nhsjsttvxixgfqnweqos.supabase.co", "sb_publishable__Zr4dURPH97qiUMBrBdMMQ_4f6pNv39");
    window.COLIBRI_LOGIN = sb.auth.getSession().then(async ({data: {session}}) => {
      if (!session) return sair();
      const {data: p} = await sb.rpc("meu_perfil");
      if (!p) return sair();
      document.documentElement.style.visibility = "";
      return p;
    }).catch(sair);
  }catch(e){ sair(); }
})();
