// Página del portafolio. Se dibuja en el navegador con los datos de portafolio.json (se actualiza sola cada 10 segundos).
module.exports = () => `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mi Portafolio</title><link rel="icon" href="data:,"><style>
:root{--bg:#060b18;--card:#0c1630;--card2:#101d3d;--line:#1c2b52;--mut:#8c9abb;--txt:#e9eef9;--gold:#f2b632;--up:#2fd08a;--down:#ff5d6c}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(1200px 600px at 50% -200px,#16285a 0%,var(--bg) 60%) fixed,var(--bg);color:var(--txt);font:14px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
.w{max-width:760px;margin:0 auto;padding:18px 16px 40px}
.top{display:flex;align-items:center;justify-content:space-between;gap:10px}h1{font-size:22px;margin:0}h1 span{color:var(--gold)}
.live{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--up);background:rgba(47,208,138,.1);border:1px solid rgba(47,208,138,.3);padding:3px 10px;border-radius:99px;white-space:nowrap}
.live i{width:7px;height:7px;border-radius:50%;background:var(--up);animation:lat 1.6s infinite}.live.off{color:var(--down);border-color:rgba(255,93,108,.4);background:rgba(255,93,108,.1)}.live.off i{background:var(--down)}
@keyframes lat{0%{box-shadow:0 0 0 0 rgba(47,208,138,.7)}70%{box-shadow:0 0 0 8px rgba(47,208,138,0)}100%{box-shadow:0 0 0 0 rgba(47,208,138,0)}}
.sub{color:var(--mut);font-size:12.5px;margin:4px 0 14px}
.hero{background:linear-gradient(135deg,#1b2d63 0%,#0f1c3f 55%,#0c1630 100%);border:1px solid #2a3f78;border-radius:18px;padding:16px;margin-bottom:12px;box-shadow:0 10px 30px rgba(0,0,0,.35)}
.hh{display:flex;justify-content:space-between;align-items:center;gap:8px}
.l{color:var(--mut);font-size:11px;text-transform:uppercase;letter-spacing:.08em}
.big{font-size:32px;font-weight:700;letter-spacing:-.02em;margin:4px 0 2px;word-break:break-all}.big small{font-size:14px;color:var(--mut);font-weight:500}
.eq{color:var(--mut);font-size:12.5px}
.sw{display:inline-flex;background:#0a1430;border:1px solid var(--line);border-radius:99px;padding:2px}.sw button{background:none;border:0;color:var(--mut);font:inherit;font-size:12.5px;padding:4px 12px;border-radius:99px;cursor:pointer}.sw button.on{background:var(--gold);color:#070d1c;font-weight:700}
.pg{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px}.pg div{background:rgba(6,11,24,.4);border-radius:12px;padding:8px 9px;min-width:0}.pg span{display:block;color:var(--mut);font-size:11px}.pg b{display:block;font-size:15px;overflow-wrap:anywhere;line-height:1.3}.pg small{font-size:12px}.pg .fl{display:block;color:var(--mut);font-size:10.5px;line-height:1.35;margin-top:3px}
.k{background:linear-gradient(180deg,var(--card2),var(--card));border:1px solid var(--line);border-radius:16px;padding:13px;margin-bottom:12px;box-shadow:0 6px 18px rgba(0,0,0,.25)}
.rg{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0 4px}.rg button{background:#0f1a36;color:var(--mut);border:1px solid var(--line);border-radius:99px;padding:5px 13px;font:inherit;font-size:12.5px;cursor:pointer}.rg button.on{background:var(--gold);color:#070d1c;border-color:var(--gold);font-weight:700}
svg{width:100%;height:auto;display:block;touch-action:pan-y}
.row{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;padding:9px 0;border-bottom:1px solid var(--line)}.row:last-child{border-bottom:0}
.row .a{min-width:0}.row .b{text-align:right;white-space:nowrap}.row .t{font-weight:600}.row .s{color:var(--mut);font-size:12px}
.coin{display:inline-grid;place-items:center;width:30px;height:30px;border-radius:50%;background:#16264f;color:var(--gold);font-weight:700;font-size:11px;margin-right:9px;flex:none}
.cr{display:flex;align-items:center}
.up{color:var(--up)}.down{color:var(--down)}.gold{color:var(--gold)}.n{color:var(--mut);font-size:12px}
.e{border:1px solid rgba(255,93,108,.6);background:rgba(255,93,108,.09);border-radius:14px;padding:10px 12px;font-size:13px;margin-bottom:12px}
.av{border:1px dashed var(--gold);background:rgba(242,182,50,.08);border-radius:14px;padding:8px 12px;font-size:12px;margin-bottom:12px;color:var(--mut)}
.more{width:100%;margin-top:8px;background:#0f1a36;color:var(--txt);border:1px solid var(--line);border-radius:12px;padding:9px;font:inherit;cursor:pointer}
a{color:var(--gold)}
@media(max-width:420px){.big{font-size:27px}.pg{gap:6px}.pg b{font-size:13px}}
</style></head><body><div class="w">
<div class="top"><h1>Mi <span>Portafolio</span></h1><span class="live" id="lv"><i></i>en vivo</span></div>
<p class="sub" id="sub">Binance · conectando…</p>
<div id="err"></div>
<div class="hero"><div class="hh"><div class="l">Valor total estimado</div><div class="sw" id="sw"><button data-c="MXN">MXN</button><button data-c="USD">USD</button></div></div>
<div class="big" id="tot">…</div><div class="eq" id="eq"></div>
<div class="pg"><div><span>PnL de hoy</span><b id="p-hoy">…</b><small id="pp-hoy"></small></div><div><span>PnL del mes</span><b id="p-mes">…</b><small id="pp-mes"></small></div><div><span>PnL del año</span><b id="p-ano">…</b><small id="pp-ano"></small></div></div></div>
<div class="k"><div class="l" id="gt">Valor de tu cuenta</div><div class="rg" id="rg"><button data-r="hoy">Hoy</button><button data-r="mes">Mes</button><button data-r="ano">Año</button></div><div id="gf"></div></div>
<div class="k"><div class="l">Calculadora Binance Card</div><div class="n" style="margin:4px 0 8px">Escribe lo que vas a pagar y te digo cuántos pesos convertir a USDC.</div>
<div style="display:flex;gap:8px;align-items:center"><span class="t">$</span><input id="cm" type="number" inputmode="decimal" min="0" step="any" value="100" style="flex:1;min-width:0;background:#0a1430;border:1px solid var(--line);border-radius:10px;color:var(--txt);font:inherit;font-size:18px;padding:8px 10px"><span class="n">MXN</span></div>
<div id="cr" style="margin-top:10px"></div></div>
<div class="k"><div class="l">Tus monedas</div><div id="mon"></div></div>
<div id="pos"></div>
<div class="k"><div class="l">Billeteras</div><div id="wal"></div></div>
<div class="k"><div class="l">Movimientos</div><div class="rg" id="fl"><button data-f="">Todos</button><button data-f="dep">Depósitos</button><button data-f="ret">Retiros</button><button data-f="tr">Transferencias</button><button data-f="cv">Compras y ventas</button><button data-f="fut">Futuros</button><button data-f="otro">Otros</button></div><div id="mov"></div></div>
<div id="av"></div>
<p class="n">Solo lectura: el servidor usa tu llave para ver saldos y movimientos, nunca para mover dinero. PnL calculado como Binance: lo que ganan o pierden tus monedas por precio, sin contar depósitos ni retiros. Días de Binance: empiezan a las 00:00 UTC (6 pm de México). <a id="bot" href="#">Bot de futuros (pausado)</a></p>
</div><script>(()=>{
const $=id=>document.getElementById(id),Q=location.search,ls={g(k){try{return localStorage.getItem(k)}catch(e){return null}},s(k,v){try{localStorage.setItem(k,v)}catch(e){}}};
$("bot").href="bot"+Q;
let D=null,cur=ls.g("pcur")||"MXN",R=ls.g("prg")||"mes",FL="",N=60;
const MES=["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
const f2=(v,d)=>Math.abs(v).toLocaleString("es-MX",{minimumFractionDigits:d,maximumFractionDigits:d});
function dinero(u,dU){if(u==null)return"—";if(cur==="MXN"&&D.rate)return"$"+f2(u*D.rate,2)+" MXN";return f2(u,dU??(Math.abs(u)<1?4:2))+" USDT"}
function sg(u){return(u>=0?"+":"−")+dinero(Math.abs(u))}
function cant(q){const a=Math.abs(q);return(q<0?"−":"")+(a>=1000?f2(a,2):a>=1?(+a.toFixed(6)).toLocaleString("es-MX",{maximumFractionDigits:6}):a.toFixed(8).replace(/0+$/,"").replace(/\.$/,""))}
function fecha(t){const d=new Date(t);return d.getDate()+" "+MES[d.getMonth()]+" "+d.getFullYear()+" · "+d.toLocaleTimeString("es-MX",{hour:"2-digit",minute:"2-digit"})}
function hace(t){const s=Math.round((Date.now()-t)/1000);return s<60?"hace "+Math.max(s,0)+" s":"hace "+Math.round(s/60)+" min"}
function pinta(){if(!D)return;
  document.querySelectorAll("#sw button").forEach(b=>b.classList.toggle("on",b.dataset.c===cur));
  const tot=D.total!=null?D.total:(D.monedas||[]).reduce((a,x)=>a+(x.v||0),0);
  $("tot").innerHTML=cur==="MXN"&&D.rate?"$"+f2(tot*D.rate,2)+" <small>MXN</small>":f2(tot,8)+" <small>USDT</small>";
  $("eq").textContent=(cur==="MXN"?"≈ "+f2(tot,8)+" USDT":D.rate?"≈ $"+f2(tot*D.rate,2)+" MXN":"")+(D.rate?" · dólar a $"+f2(D.rate,2):"");
  for(const k of["hoy","mes","ano"]){const p=D.pnl&&D.pnl[k];const b=$("p-"+k),s=$("pp-"+k);if(!p){b.textContent="…";continue}
    b.textContent=sg(p.v);b.className=p.v>=0?"up":"down";s.innerHTML='<span class="'+(p.v>=0?"up":"down")+'">'+(p.pct>=0?"+":"−")+Math.abs(p.pct).toFixed(2)+"%</span>"+(k!=="hoy"||p.entro||p.salio?'<span class="fl">entró '+dinero(p.entro||0)+"<br>salió "+dinero(p.salio||0)+"</span>":"")+(p.falta&&p.falta.length?'<span class="fl gold">aún sin leer: '+p.falta.join(", ")+"</span>":"")}
  grafica();
  const ms0=D.monedas||[],ms=ms0.filter(x=>x.v==null||x.v>=0.005),chicas=ms0.length-ms.length;$("mon").innerHTML=ms.length?ms.map(x=>{const w=x.by?Object.entries(x.by).filter(([,q])=>Math.abs(q)>1e-12).map(([n,q])=>n+" "+cant(q)).join(" · "):"";
    return'<div class="row"><div class="a cr"><span class="coin">'+x.c.slice(0,4)+'</span><div><div class="t">'+x.c+'</div><div class="s">'+cant(x.q)+" "+x.c+(w&&Object.keys(x.by).length>1?" · "+w:x.by?" · "+Object.keys(x.by)[0]:"")+'</div></div></div><div class="b"><div class="t">'+dinero(x.v)+'</div><div class="s">'+(x.p!=null&&x.c!=="USDT"?(cur==="MXN"&&D.rate?"$"+f2(x.p*D.rate,x.p*D.rate<1?6:2):f2(x.p,x.p<1?6:2))+" ":"")+(x.ch!=null?'<span class="'+(x.ch>=0?"up":"down")+'">'+(x.ch>=0?"+":"−")+Math.abs(x.ch).toFixed(2)+"%</span>":"")+"</div></div></div>"}).join(""):'<div class="n">Sin saldo</div>';if(chicas)$("mon").innerHTML+='<div class="n" style="margin-top:6px">y '+chicas+" moneda"+(chicas>1?"s":"")+" con saldo casi cero</div>";
  $("pos").innerHTML=(D.pos||[]).length?'<div class="k"><div class="l">Posiciones abiertas en Futuros</div>'+D.pos.map(p=>'<div class="row"><div class="a"><div class="t">'+p.s+" · "+(p.q>0?"Largo":"Corto")+" "+p.apal+'x</div><div class="s">'+cant(Math.abs(p.q))+" · entrada "+f2(p.entrada,2)+" · ahora "+f2(p.marca,2)+'</div></div><div class="b '+(p.pnl>=0?"up":"down")+'">'+sg(p.pnl)+'<div class="s">sin cerrar</div></div></div>').join("")+"</div>":"";
  $("wal").innerHTML=(D.wallets||[]).map(w=>'<div class="row"><div class="a">'+w.n+'</div><div class="b">'+dinero(w.v)+"</div></div>").join("")||'<div class="n">…</div>';
  movs();calc();
  const av=(D.avisos||[]);$("av").innerHTML=av.length?'<div class="av">No pude leer: '+av.map(x=>x.replace(/</g,"&lt;")).join(" · ")+"</div>":"";
  $("err").innerHTML=D.error?'<div class="e">'+String(D.error).replace(/</g,"&lt;")+"</div>":"";
  $("sub").textContent="Binance · todas tus billeteras · actualizado "+(D.t?hace(D.t):"…")+(D.listo?"":" · leyendo tu historial…");
}
function movs(){const L=(D.movs||[]).filter(m=>!FL||m.cat===FL);document.querySelectorAll("#fl button").forEach(b=>b.classList.toggle("on",b.dataset.f===FL));
  $("mov").innerHTML=L.length?L.slice(0,N).map(m=>{const legs=m.legs.map(([c,d])=>'<span class="'+(d>=0?"up":"down")+'">'+(d>=0?"+":"−")+cant(Math.abs(d))+" "+c+"</span>").join("<br>");
    return'<div class="row"><div class="a"><div class="t">'+m.tx.replace(/</g,"&lt;")+'</div><div class="s">'+fecha(m.t)+(m.usd?" · "+dinero(m.usd)+" en ese momento":"")+'</div></div><div class="b">'+legs+"</div></div>"}).join("")+(L.length>N?'<button class="more" id="mas">Ver más ('+(L.length-N)+")</button>":""):'<div class="n">'+(D.listo?"Sin movimientos":"Leyendo tu historial de Binance…")+"</div>";
  const b=$("mas");if(b)b.onclick=()=>{N+=100;movs()}}
function grafica(){document.querySelectorAll("#rg button").forEach(b=>b.classList.toggle("on",b.dataset.r===R));
  const s=(D.series&&D.series[R])||[],k=cur==="MXN"&&D.rate?D.rate:1;if(s.length<2){$("gf").innerHTML='<div class="n">Preparando gráfica…</div>';return}
  const W=680,H=230,L=4,Rr=96,T=12,B=24,v=s.map(x=>x[1]*k),mn=Math.min(...v),mx=Math.max(...v),pad=(mx-mn)*.1||mx*.01||1,lo=mn-pad,hi=mx+pad,t0=s[0][0],t1=s[s.length-1][0];
  const X=t=>L+(t-t0)/(t1-t0||1)*(W-L-Rr),Y=y=>T+(hi-y)/(hi-lo)*(H-T-B);
  const pts=s.map((x,i)=>X(x[0]).toFixed(1)+","+Y(v[i]).toFixed(1)).join(" "),up=v[v.length-1]>=v[0],col="#f2b632";
  const lab=y=>cur==="MXN"&&D.rate?"$"+f2(y,2):f2(y,y<10?4:2);
  const dl=t=>{const d=new Date(t);return R==="hoy"?d.toLocaleTimeString("es-MX",{hour:"2-digit",minute:"2-digit"}):d.getDate()+" "+MES[d.getMonth()]};
  let g='<svg viewBox="0 0 '+W+" "+H+'" id="sv"><defs><linearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+col+'" stop-opacity=".35"/><stop offset="1" stop-color="'+col+'" stop-opacity="0"/></linearGradient></defs>';
  for(const y of[hi-pad,(hi+lo)/2,lo+pad])g+='<line x1="'+L+'" x2="'+(W-Rr)+'" y1="'+Y(y)+'" y2="'+Y(y)+'" stroke="#1c2b52" stroke-dasharray="3 4"/><text x="'+(W-Rr+6)+'" y="'+(Y(y)+4)+'" fill="#8c9abb" font-size="12">'+lab(y)+"</text>";
  g+='<polygon points="'+X(t0)+","+(H-B)+" "+pts+" "+X(t1)+","+(H-B)+'" fill="url(#ga)"/><polyline points="'+pts+'" fill="none" stroke="'+col+'" stroke-width="2.2" stroke-linejoin="round"/>';
  g+='<circle cx="'+X(t1)+'" cy="'+Y(v[v.length-1])+'" r="4" fill="'+col+'"/><text x="'+L+'" y="'+(H-6)+'" fill="#8c9abb" font-size="12">'+dl(t0)+'</text><text x="'+(W-Rr)+'" y="'+(H-6)+'" fill="#8c9abb" font-size="12" text-anchor="end">'+dl(t1)+"</text>";
  g+='<line id="cx" y1="'+T+'" y2="'+(H-B)+'" stroke="#8c9abb" stroke-width="1" visibility="hidden"/><circle id="cp" r="4" fill="#fff" visibility="hidden"/></svg><div class="n" id="ci">'+(up?'<span class="up">▲ ':'<span class="down">▼ ')+(cur==="MXN"&&D.rate?"$"+f2(Math.abs(v[v.length-1]-v[0]),2)+" MXN":f2(Math.abs(v[v.length-1]-v[0]),4)+" USDT")+"</span> en el periodo (incluye depósitos y retiros) · toca la línea para ver cada punto</div>";
  $("gf").innerHTML=g;const sv=$("sv");
  const mv=e=>{const r=sv.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*W;let i=0,b=1e9;s.forEach((p,j)=>{const d=Math.abs(X(p[0])-x);if(d<b){b=d;i=j}});
    const cx=$("cx"),cp=$("cp");cx.setAttribute("x1",X(s[i][0]));cx.setAttribute("x2",X(s[i][0]));cx.setAttribute("visibility","visible");cp.setAttribute("cx",X(s[i][0]));cp.setAttribute("cy",Y(v[i]));cp.setAttribute("visibility","visible");
    $("ci").textContent=fecha(s[i][0])+" · "+(cur==="MXN"&&D.rate?"$"+f2(v[i],2)+" MXN":f2(v[i],8)+" USDT")};
  sv.addEventListener("pointermove",mv);sv.addEventListener("pointerdown",mv)}
document.querySelectorAll("#sw button").forEach(b=>b.onclick=()=>{cur=b.dataset.c;ls.s("pcur",cur);pinta()});
document.querySelectorAll("#rg button").forEach(b=>b.onclick=()=>{R=b.dataset.r;ls.s("prg",R);grafica()});
document.querySelectorAll("#fl button").forEach(b=>b.onclick=()=>{FL=b.dataset.f;N=60;movs()});
async function carga(){try{const r=await fetch("portafolio.json"+Q,{cache:"no-store"});if(!r.ok)throw 0;D=await r.json();$("lv").className="live";pinta()}catch(e){$("lv").className="live off";$("sub").textContent="Sin conexión con el servidor, reintentando…"}}
// Calculadora de la tarjeta, con tus capturas del 17 oct 2026 (dólar de Binance a 18.49):
// Convertir 110 MXN -> 5.91010687 USDC (18.61218459 MXN por USDC, sin comisión).
// Pago de 100 MXN con la tarjeta -> 5.55555 USDC (1 USD = 18.01801802 MXN, 1 USDC = 0.99900099 USD).
const R0=18.49,CONV=18.61218459/R0,CARD=18.01801802*0.99900099/R0;
function calc(){const m=+$("cm").value||0,r=(D&&D.rate)||R0,usdc=m/(r*CARD),mxn=usdc*r*CONV,ex=mxn-m;try{localStorage.setItem("pcm",$("cm").value)}catch(e){}
  $("cr").innerHTML=m>0?'<div class="row"><div class="a">La tarjeta te cobra</div><div class="b t">'+usdc.toFixed(6)+' USDC</div></div><div class="row"><div class="a">Pesos a convertir a USDC</div><div class="b t gold">$'+f2(mxn,2)+' MXN</div></div><div class="row"><div class="a">Extra aparte de tus $'+f2(m,2)+'<div class="s">tipo de cambio de la tarjeta y de Convertir</div></div><div class="b t down">+$'+f2(ex,2)+' ('+(ex/m*100).toFixed(2)+'%)</div></div><div class="n">Para ir seguro convierte $'+f2(Math.ceil(mxn),0)+' MXN. Calculado con el dólar de ahora ($'+f2(r,2)+'). Binance cobra el USDC de tu Earn Flexible.</div>':""}
try{const v=localStorage.getItem("pcm");if(v)$("cm").value=v}catch(e){}
$("cm").addEventListener("input",calc);calc();
carga();setInterval(carga,10000);setInterval(()=>{if(D&&D.t)$("sub").textContent="Binance · todas tus billeteras · actualizado "+hace(D.t)+(D.listo?"":" · leyendo tu historial…")},1000);
})();</script></body></html>`;
