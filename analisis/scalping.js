// Scalping 1m/5m, 7 monedas, 12 meses (rama datos). Elige el mejor ajuste en la 1a mitad y lo prueba en la 2a.
// Costos por lado: futuros taker 0.05%+0.01% desliz, futuros maker 0.02% (optimista), spot 0.075%+0.01% (solo largos).
// Uso: node scalping.js carpeta_csv
const fs=require('fs'),D=process.argv[2];
const COINS=['BTC','ETH','SOL','BNB','XRP','DOGE','ADA'];
const COST={futTaker:{c:0.06,short:1},futMaker:{c:0.02,short:1},spot:{c:0.085,short:0}};
function load(c,tf){const L=fs.readFileSync(`${D}/${c}.csv`,'utf8').trim().split('\n');const b=[];
 for(let i=0;i<L.length;i+=tf){let o,h=-1e18,l=1e18,cl;for(let j=i;j<Math.min(i+tf,L.length);j++){const p=L[j].split(',');if(j==i)o=+p[1];h=Math.max(h,+p[2]);l=Math.min(l,+p[3]);cl=+p[4];}b.push([o,h,l,cl]);}return b;}
function run(b,cfg,cost,a,z){const {tipo,N,tp,sl,H,k}=cfg;let tr=[],i=Math.max(a,N+1);
 while(i<z){const c=b[i][3];let s=0,sum=0,sq=0,hi=-1e18,lo=1e18;
  for(let j=i-N;j<i;j++){hi=Math.max(hi,b[j][1]);lo=Math.min(lo,b[j][2]);sum+=b[j][3];sq+=b[j][3]**2;}
  if(tipo=='brk'){if(c>hi)s=1;else if(c<lo)s=-1;}
  else{const m=sum/N,sd=Math.sqrt(Math.max(sq/N-m*m,0));if(c<m-k*sd)s=1;else if(c>m+k*sd)s=-1;}
  if(s==-1&&!cost.short)s=0;
  if(!s){i++;continue;}
  const T=c*(1+s*tp/100),S=c*(1-s*sl/100);let r=null,j=i+1;
  for(;j<Math.min(i+1+H,z);j++){const [,h,l,cc]=b[j];
   if(s==1){if(l<=S){r=-sl;break;}if(h>=T){r=tp;break;}}else{if(h>=S){r=-sl;break;}if(l<=T){r=tp;break;}}}
  if(r===null){j=Math.min(j,z-1);r=s*(b[j][3]/c-1)*100;}
  tr.push(r-2*cost.c);i=j+1;}
 const tot=tr.reduce((x,y)=>x+y,0);return {n:tr.length,tot,R:tot/cfg.sl,win:tr.filter(x=>x>0).length/(tr.length||1)};}
const cfgs=[];for(const tipo of['brk','rev'])for(const N of[20,60])for(const [tp,sl]of[[0.2,0.2],[0.3,0.3],[0.5,0.25],[0.6,0.3],[1,0.5],[0.25,0.5]])for(const k of(tipo=='rev'?[2,3]:[0]))cfgs.push({tipo,N,tp,sl,H:60,k});
const out=[];
for(const tf of[1,5])for(const c of COINS){const b=load(c,tf),m=Math.floor(b.length/2);
 for(const cn in COST){const cost=COST[cn];let best=null,pos=0;
  for(const cfg of cfgs){const A=run(b,cfg,cost,0,m);const B=run(b,cfg,cost,m,b.length);if(B.tot>0)pos++;if(!best||A.tot>best.A.tot)best={cfg,A,B};}
  const f=x=>`${x.n}op ${x.tot.toFixed(1)}% ${x.R.toFixed(0)}R gana${(x.win*100).toFixed(0)}%`;
  out.push(`${tf}m ${c} ${cn}: mejor 1a mitad ${best.cfg.tipo} N${best.cfg.N} tp${best.cfg.tp}/sl${best.cfg.sl}${best.cfg.k?' k'+best.cfg.k:''} | 1a: ${f(best.A)} | 2a: ${f(best.B)} | ajustes + en 2a: ${pos}/${cfgs.length}`);
  console.log(out[out.length-1]);}}
