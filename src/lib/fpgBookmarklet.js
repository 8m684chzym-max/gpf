// "GPF → myFPG" bookmarklet.
// Runs in the player's own browser, on my.fpg.pt, while they're logged in.
// It reads the round the player copied in GPF (clipboard, or a paste prompt)
// and fills the myFPG form. It never clicks Save: the player checks and submits.
//
// myFPG (Datagolf "Player Area" V3.05, ASP.NET WebForms) has two steps:
//   1. SingleScoreRegister.aspx — date, description, course+tee (DpCourse,
//      option text "Course - COLOUR"), holes (DpHoles), HCP round radio → Save
//   2. SingleScoreCard.aspx?id=… — inpScoreH1..18, marker fed no (txtMarker)
//      → Validate → Save/Recalc
// Field ids mapped from pages saved on 2026-11-13. If myFPG changes them the
// script says so and the copy panel in GPF still works.

export const FPG_PAYLOAD_PREFIX = "GPF-FPG ";

// Compact payload: d date YYYY-MM-DD, c course, t tee, h 18 strokes, m marker fed no, n description
export function fpgPayload(round) {
  const holes = round.scorecard?.holes?.length === 18 ? round.scorecard.holes.map(Number) : null;
  return FPG_PAYLOAD_PREFIX + JSON.stringify({
    v: 1,
    d: String(round.date || "").slice(0, 10),
    c: round.course?.name || "",
    t: round.tee?.name || "",
    h: holes,
    m: round.partner?.fpgNumber || "",
    n: "GPF" + (round.course?.name ? ` · ${round.course.name}` : ""),
  });
}

const SRC = String.raw`(async()=>{
const P='GPF-FPG ';
let raw='';
try{raw=await navigator.clipboard.readText();}catch(e){}
if(!raw||raw.indexOf(P)!==0){raw=prompt('GPF → myFPG\n\nCola aqui o cartão copiado no GPF (botão "Copiar para preencher").')||'';}
raw=raw.trim();
if(raw.indexOf(P)!==0){alert('GPF: não encontrei nenhum cartão copiado do GPF.');return;}
let r;try{r=JSON.parse(raw.slice(P.length));}catch(e){alert('GPF: os dados copiados não são válidos.');return;}
const g=id=>document.getElementById(id);
const mark=el=>{el.style.outline='3px solid #2e8b57';el.style.outlineOffset='1px';};
const set=(el,v)=>{if(!el||v==null||v==='')return false;el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));mark(el);return true;};
const norm=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const words=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
const COL={white:'brancas',branca:'brancas',brancas:'brancas',yellow:'amarelas',amarela:'amarelas',amarelas:'amarelas',red:'vermelhas',vermelha:'vermelhas',vermelhas:'vermelhas',blue:'azuis',azul:'azuis',azuis:'azuis',black:'pretas',preta:'pretas',pretas:'pretas',green:'verdes',verde:'verdes',verdes:'verdes',purple:'roxas',roxa:'roxas',roxas:'roxas',gold:'douradas',dourada:'douradas',douradas:'douradas'};
const out=[];const warn=[];
if(g('MainContent_inpScoreH1')){
  if(!Array.isArray(r.h)||r.h.length!==18){alert('GPF: esta ronda não tem os 18 buracos no GPF. Edita-a no GPF primeiro.');return;}
  let n=0;for(let i=1;i<=18;i++){if(set(g('MainContent_inpScoreH'+i),String(r.h[i-1])))n++;}
  out.push(n+' buracos preenchidos (total '+r.h.reduce((a,b)=>a+b,0)+')');
  if(r.m&&set(g('MainContent_txtMarker'),r.m))out.push('marcador '+r.m);else warn.push('Marcador: escreve o nº de federado no separador Marker.');
  alert('GPF → myFPG\n\n✓ '+out.join('\n✓ ')+(warn.length?'\n\n! '+warn.join('\n! '):'')+'\n\nAgora:\n1. Confere os valores.\n2. Separador Marker → Validate.\n3. Save/Recalc.');
  return;
}
const sel=g('MainContent_DpCourse');
if(sel){
  if(set(g('MainContent_txtDtSS'),r.d))out.push('data '+r.d.split('-').reverse().join('/'));
  set(g('MainContent_txbScoreDesc'),r.n);
  const tee=COL[norm(r.t)]||norm(r.t);const cn=norm(r.c);const cw=words(r.c);
  let best=null,bs=0,bl=1e9;
  for(const o of sel.options){
    const t=o.text;const k=t.lastIndexOf(' - ');if(k<0)continue;
    const on=norm(t.slice(0,k)),oc=norm(t.slice(k+3));
    if(tee&&oc!==tee)continue;
    let s=0;if(on===cn)s=4;else if(on.indexOf(cn)>=0)s=3;else if(cn.indexOf(on)>=0)s=2;else{const ow=words(t.slice(0,k));if(cw.length&&cw.every(w=>ow.indexOf(w)>=0))s=1;}
    if(s>bs||(s===bs&&s>0&&on.length<bl)){best=o;bs=s;bl=on.length;}
  }
  if(best){sel.value=best.value;sel.dispatchEvent(new Event('change',{bubbles:true}));mark(sel);out.push('campo '+best.text);}
  else warn.push('Campo: não encontrei "'+r.c+(r.t?' - '+r.t:'')+'". Escolhe-o à mão.');
  const h=g('MainContent_DpHoles');if(h&&set(h,'18'))out.push('18 buracos');
  const y=g('MainContent_radioHcpRound_1');if(y){y.checked=true;y.dispatchEvent(new Event('change',{bubbles:true}));out.push('HCP round: Yes');}
  if(r.m)set(g('MainContent_txtMarker'),r.m);
  alert('GPF → myFPG (passo 1 de 2)\n\n✓ '+out.join('\n✓ ')+(warn.length?'\n\n! '+warn.join('\n! '):'')+'\n\nConfere e carrega em Save.\nNa página seguinte carrega outra vez no GPF → FPG para os buracos e o marcador.');
  return;
}
alert('GPF: abre primeiro o Novo Cartão Jogo no myFPG (com sessão iniciada) e carrega outra vez.');
})();`;

export const FPG_BOOKMARKLET = "javascript:" + encodeURIComponent(SRC);
