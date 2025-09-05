// js/utils.js
export function $(id){ return document.getElementById(id); }

export function shuffle(a){
  for(let i=a.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}

export function sample(arr,n,exclude=new Set()){
  const pool = arr.filter(x=>!exclude.has(x));
  const out=[];
  while(out.length<n && pool.length){
    out.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]);
  }
  return out;
}

export function fmt(s){ return String(s).padStart(2,'0'); }

export function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, m =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])
  );
}
