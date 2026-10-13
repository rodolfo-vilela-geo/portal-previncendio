/* Coordenadas em graus, minutos e segundos (padrão do plano operacional, decisão de 13/10/2026).
   Os campos mostram g/m/s; o banco continua em graus decimais (SIRGAS 2000).
   O valor decimal exato fica em data-dec: se o texto não for mudado, o valor gravado é o mesmo (sem "andar" alguns metros). */
(function(){
  function gms(v, eixo){
    if (v == null || v === "" || !isFinite(+v)) return "";
    v = +v;
    const h = eixo === "lat" ? (v < 0 ? "S" : "N") : (v < 0 ? "O" : "L");
    const a = Math.abs(v); let g = Math.floor(a), m = Math.floor((a - g) * 60), s = Math.round(((a - g) * 60 - m) * 600) / 10;
    if (s >= 60){ s -= 60; m++; } if (m >= 60){ m -= 60; g++; }
    return `${g}°${String(m).padStart(2, "0")}'${s.toFixed(1).padStart(4, "0").replace(".", ",")}"${h}`;
  }
  const par = (lat, lon) => lat == null || lon == null ? "" : `${gms(lat, "lat")} ${gms(lon, "lon")}`;
  const aspas = s => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  // para usar dentro de <input ...>: value em g/m/s + data-dec com o decimal
  const attr = (v, eixo) => `value="${aspas(gms(v, eixo))}" data-dec="${v ?? ""}"`;
  function por(el, v, eixo){ if (!el) return; el.value = gms(v, eixo); el.dataset.dec = v ?? ""; }
  // lê o campo com o leitor da página (aceita decimal, g/m/s ou "17 58 32"); devolve o decimal original se nada mudou
  function ler(el, lerFn){
    const v = lerFn(el?.value), d = el?.dataset?.dec;
    return (d !== undefined && d !== "" && typeof v === "number" && isFinite(v) && Math.abs(v - +d) < 2e-5) ? +d : v;
  }
  window.Coord = {gms, par, attr, por, ler};
})();
