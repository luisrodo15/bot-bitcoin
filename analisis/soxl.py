import json,sys,datetime as dt
D=sys.argv[1]
def load(n):
    r=json.load(open(f"{D}/{n}.json"))['chart']['result'][0]
    ts=r['timestamp'];q=r['indicators']
    c=q.get('adjclose',[{}])[0].get('adjclose') or q['quote'][0]['close']
    return {dt.datetime.utcfromtimestamp(t).date():v for t,v in zip(ts,c) if v}
def sma(a,n,i): return sum(a[i-n+1:i+1])/n if i>=n-1 else None
def stats(eq,dates):
    yrs=(dates[-1]-dates[0]).days/365.25; cagr=(eq[-1]/eq[0])**(1/yrs)-1
    pk=eq[0];dd=0
    for v in eq: pk=max(pk,v); dd=min(dd,v/pk-1)
    return cagr*100,dd*100,eq[-1]/eq[0]
def run(sig_px,trade_ret,n,cost=0.001):
    # sig_px list aligned; trade_ret[i]=return from i-1 to i
    eq=[1.0];pos=0;trades=0
    for i in range(1,len(trade_ret)):
        e=eq[-1]*(1+trade_ret[i]) if pos else eq[-1]
        s=sma(sig_px,n,i); new=1 if (s and sig_px[i]>s) else 0
        if new!=pos: e*=1-cost; trades+=1; pos=new
        eq.append(e)
    return eq,trades
def report(name,dates,px_sig,ret):
    print(f"\n== {name} {dates[0]}..{dates[-1]}")
    hold=[1.0]
    for r in ret[1:]: hold.append(hold[-1]*(1+r))
    c,d,m=stats(hold,dates); print(f"  comprar y mantener: {c:6.1f}%/año  caída máx {d:6.1f}%  x{m:,.1f}")
    for n in (50,100,200):
        eq,t=run(px_sig,ret,n); c,d,m=stats(eq,dates)
        print(f"  SMA{n:<3} ({t:3d} cambios): {c:6.1f}%/año  caída máx {d:6.1f}%  x{m:,.1f}")
    # by period
    return hold
soxl=load('SOXL'); sox=load('SOX')
ds=sorted(set(soxl)&set(sox))
px=[soxl[d] for d in ds]; ix=[sox[d] for d in ds]
ret=[0]+[px[i]/px[i-1]-1 for i in range(1,len(px))]
report("SOXL real, señal con precio de SOXL",ds,px,ret)
report("SOXL real, señal con índice SOX",ds,ix,ret)
# synthetic 3x SOX since index start, fee 0.95%/yr + financing ~2x cash ~ assume 2%/yr total drag extra
ds2=sorted(sox); ix2=[sox[d] for d in ds2]
r3=[0]+[3*(ix2[i]/ix2[i-1]-1)-0.04/252 for i in range(1,len(ix2))]
report("3x sintético del SOX (costo 4%/año)",ds2,ix2,r3)
# decay: SOXL vs 3x SOX buy and hold total return
a=ix[-1]/ix[0]; b=px[-1]/px[0]; print(f"\nDesde {ds[0]}: SOX x{a:.1f} (3x ingenuo x{a**3:.0f}), SOXL x{b:.1f}")
# sub-periods for SMA200 on SOX index, real SOXL
for y0,y1 in [(2010,2014),(2015,2019),(2020,2022),(2023,2026),(2025,2026)]:
    idx=[i for i,d in enumerate(ds) if y0<=d.year<=y1]; i0,i1=idx[0],idx[-1]
    sub=ds[i0:i1+1]
    h=px[i1]/px[i0]
    eq,t=run(ix[max(0,i0-250):i1+1],[0]+ret[max(0,i0-250)+1:i1+1],200)
    k=i0-max(0,i0-250); s=eq[-1]/eq[k]
    pk=0;dd=0;hh=1;pkh=1;ddh=0
    for v in eq[k:]: pk=max(pk,v); dd=min(dd,v/pk-1)
    for i in range(i0,i1+1): pkh=max(pkh,px[i]/px[i0]); ddh=min(ddh,px[i]/px[i0]/pkh-1)
    print(f"{y0}-{y1}: mantener x{h:.2f} (caída {ddh*100:.0f}%)  SMA200 SOX x{s:.2f} (caída {dd*100:.0f}%)")
