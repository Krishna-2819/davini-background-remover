
// Model is loaded straight from the jsdelivr CDN, matching the known-good
// reference build exactly (https://quiet-cactus-6905c2.netlify.app/, verified
// by inspecting its own script: it uses jsdelivr + allowLocalModels=false +
// NO dtype override — i.e. full-precision weights, not a quantized file).
// We previously routed model fetches through our own backend proxy and forced
// dtype:"q8" (the small quantized file) because that proxy has a hard size
// limit and fails on the larger fp16/fp32 files (confirmed by direct testing:
// the ~44MB quantized file works, ~88MB/~176MB files fail instantly with a
// gateway error). That quantization is what produced the noisier mask (the
// white blobs). Since the CDN path is confirmed working, we load from there
// instead and skip our own size-limited proxy entirely for the model file.
import { AutoModel, AutoProcessor, RawImage, env } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3";

env.allowLocalModels = false;

const S = {
  bg:"white", fmt:"jpeg", size:1400, pad:100, offx:0, offy:0,
  erode:1, thr:16, crop:true, enhanceOn:true, sharpen:55, contrast:106, saturate:110, bright:100,
  model:"briaai/RMBG-1.4", expand:2, feather:1,
  largest:false, fill:false, passthrough:false, cutHoles:false,
  useProxy:true, proxyTpl:"/api/img?url={url}",
  plateOn:false, plateFill:82, comboOn:false, packSize:6, packLabel:"",
  smokingOn:false, smoking:15,
  geminiOn:false,
};
const items = [];
let model=null, processor=null, loadedId=null, busy=false;

const $ = s => document.querySelector(s);
const grid=$("#grid"), emptyEl=$("#empty"), engineMsg=$("#engineMsg");

const bind=(id,key,fmt,suffix)=>{const e=$(id);e.addEventListener("input",()=>{
  S[key]=+e.value; if(fmt)$(fmt).textContent=e.value+(suffix||"");});};
bind("#size","size","#sizeV"," px");bind("#pad","pad","#padV"," px");
bind("#erode","erode","#erodeV"," px");bind("#thr","thr","#thrV","");
bind("#expand","expand","#expandV"," px");bind("#feather","feather","#featherV"," px");bind("#platefill","plateFill","#platefillV","%");
bind("#sharpen","sharpen","#sharpV","");bind("#contrast","contrast","#contrastV","%");bind("#saturate","saturate","#saturateV","%");bind("#bright","bright","#brightV","%");
bind("#smoking","smoking","#smokingV","%");
$("#offx").addEventListener("input",e=>S.offx=+e.target.value||0);
$("#offy").addEventListener("input",e=>S.offy=+e.target.value||0);
$("#crop").addEventListener("change",e=>S.crop=e.target.checked);
$("#passthrough").addEventListener("change",e=>S.passthrough=e.target.checked);
$("#enh").addEventListener("change",e=>S.enhanceOn=e.target.checked);
$("#smokingOn").addEventListener("change",e=>{S.smokingOn=e.target.checked;$("#smokingControls").style.display=S.smokingOn?"block":"none"});
$("#geminiOn")?.addEventListener("change",e=>{S.geminiOn=e.target.checked;});
$("#model").addEventListener("change",e=>{S.model=e.target.value;loadedId=null;model=null;});
$("#plateon")?.addEventListener("change",e=>{S.plateOn=e.target.checked;});
$("#comboon")?.addEventListener("change",e=>{S.comboOn=e.target.checked;
  document.querySelectorAll(".combochk").forEach(el=>el.style.display=S.comboOn?"inline-flex":"none");
  updateComboBtn();});
$("#combobuild")?.addEventListener("click",comboBuild);
$("#packsize")?.addEventListener("input",e=>{S.packSize=Math.max(2,+e.target.value||6);const v=$("#packsizeV");if(v)v.textContent="×"+S.packSize;});
$("#packlabel")?.addEventListener("input",e=>{S.packLabel=e.target.value;});
function updateComboBtn(){const b=$("#combobuild");if(b)b.disabled=!S.comboOn||busy||items.filter(i=>i.combo).length<1;}
document.querySelectorAll("#bgseg button").forEach(b=>b.addEventListener("click",()=>{
  document.querySelectorAll("#bgseg button").forEach(x=>x.classList.remove("active"));b.classList.add("active");S.bg=b.dataset.bg;}));
document.querySelectorAll("#fmtseg button").forEach(b=>b.addEventListener("click",()=>{
  document.querySelectorAll("#fmtseg button").forEach(x=>x.classList.remove("active"));b.classList.add("active");S.fmt=b.dataset.fmt;}));

let mode="single";

// ---- card with before/after ----
function makeCard(it){
  const card=document.createElement("div");card.className="card";card.dataset.id=it.id;
  card.innerHTML=`<div class="bar"><i></i></div>
    <div class="compare">
      <div class="cell"><div class="cap">Before</div><div class="thumb"><img class="orig"></div></div>
      <div class="cell"><div class="cap">After</div><div class="thumb"><img class="out"></div></div>
    </div>
    <div class="meta"><label class="combochk" style="display:${S.comboOn?'inline-flex':'none'};align-items:center;gap:4px;font-size:12px;margin-right:6px;cursor:pointer"><input type="checkbox" class="cchk"> combo</label><label style="display:inline-flex;align-items:center;gap:4px;font-size:12px;margin-right:6px;cursor:pointer" title="Tick this, then click 'Retry checked' to reprocess just this image"><input type="checkbox" class="rtchk"> retry</label><span class="name">${it.name}</span>
    <span class="acts"><button class="mini pick">✏️ Pick</button>
    <span class="status q">queued</span></span></div>`;
  grid.appendChild(card);
  it.el=card;it.statusEl=card.querySelector(".status");
  it.img=card.querySelector(".orig");it.outImg=card.querySelector(".out");
  it.bar=card.querySelector(".bar>i");
  it.img.onerror=()=>{it.statusEl.className="status err";it.statusEl.textContent="load failed";};
  it.img.crossOrigin="anonymous";
  it.img.src=procURL(it.srcURL);
  card.querySelector(".pick").addEventListener("click",()=>openEditor(it));
  const cc=card.querySelector(".cchk");
  if(cc){cc.checked=!!it.combo;cc.addEventListener("change",()=>{it.combo=cc.checked;it._cut=null;updateComboBtn();});}
  const rc=card.querySelector(".rtchk");
  if(rc){rc.checked=!!it.retrySel;rc.addEventListener("change",()=>{it.retrySel=rc.checked;});}
}
function addItem(name,srcURL,revoke){
  const id="i"+Math.random().toString(36).slice(2);
  const it={id,name,srcURL,revoke:!!revoke,outBlob:null,outURL:null};
  makeCard(it);items.push(it);return it;
}
function addFiles(list){
  [...list].filter(f=>f.type.startsWith("image/")).forEach(f=>addItem(f.name,URL.createObjectURL(f),true));
  refresh();
}
function clearAll(){items.forEach(i=>{if(i.revoke)URL.revokeObjectURL(i.srcURL);i.outURL&&URL.revokeObjectURL(i.outURL);});
  items.length=0;grid.innerHTML="";const co=$("#comboOut");if(co)co.innerHTML="";updateComboBtn();refresh();}

// ---- drop wiring ----
function wireDrop(boxId,inputId,single){
  const box=$("#"+boxId),inp=$("#"+inputId);if(!box||!inp)return;
  box.addEventListener("click",e=>{if(e.target.tagName!=="INPUT")inp.click();});
  box.addEventListener("dragover",e=>{e.preventDefault();box.classList.add("hot");});
  box.addEventListener("dragleave",()=>box.classList.remove("hot"));
  box.addEventListener("drop",e=>{e.preventDefault();box.classList.remove("hot");if(single)clearAll();addFiles(e.dataTransfer.files);});
  inp.addEventListener("change",e=>{if(single)clearAll();addFiles(e.target.files);});
}
wireDrop("drop","file",true);
wireDrop("dropLocal","fileLocal",false);

function loadSingleUrl(){
  const u=$("#singleUrl").value.trim();if(!u)return;
  clearAll();
  let name="image";
  try{const p=new URL(u).pathname.split("/").pop();if(p)name=decodeURIComponent(p);}catch(_){}
  if(!/\.(png|jpe?g|webp|gif|bmp)$/i.test(name))name=name+".jpg";
  addItem(name,u,false);refresh();
}
$("#singleUrlBtn")?.addEventListener("click",loadSingleUrl);
$("#singleUrl")?.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();loadSingleUrl();}});

// ---- mode tabs ----
document.querySelectorAll("#modeSeg button").forEach(b=>b.addEventListener("click",()=>{
  document.querySelectorAll("#modeSeg button").forEach(x=>x.classList.remove("active"));b.classList.add("active");
  mode=b.dataset.m;clearAll();
  $("#paneSingle").style.display=mode==="single"?"block":"none";
  $("#paneLocal").style.display=mode==="local"?"block":"none";
  $("#paneExcel").style.display=mode==="excel"?"block":"none";
  refresh();
}));

// ---- Excel ----
let excelRows=null;
$("#fileExcel").addEventListener("change",async e=>{
  const f=e.target.files[0];if(!f)return;
  try{
    const wb=XLSX.read(await f.arrayBuffer(),{type:"array"});
    excelRows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:""});
    const cols=excelRows.length?Object.keys(excelRows[0]):[];
    const opt=cols.map(c=>`<option>${c}</option>`).join("");
    $("#colUrl").innerHTML=opt;$("#colName").innerHTML=opt;
    if($("#colPack"))$("#colPack").innerHTML='<option value="">(none — use box)</option>'+opt;
    if($("#colLabel"))$("#colLabel").innerHTML='<option value="">(none)</option>'+opt;
    const ug=cols.find(c=>/url|image|link|photo/i.test(c));
    const ng=cols.find(c=>/barcode|sku|code|^id$|name/i.test(c));
    const pg=cols.find(c=>/pack|qty|quantity|count|units?/i.test(c));
    if(ug)$("#colUrl").value=ug; if(ng)$("#colName").value=ng;
    if(pg&&$("#colPack"))$("#colPack").value=pg;
    $("#excelMap").style.display="block";
    $("#excelNote").textContent=`${excelRows.length} rows found. Map the columns, then Load rows.`;
  }catch(err){$("#excelNote").style.display="block";$("#excelNote").textContent="Could not read file: "+err.message;}
});
$("#excelLoad").addEventListener("click",()=>{
  if(!excelRows)return;clearAll();
  const uc=$("#colUrl").value,nc=$("#colName").value;let n=0;
  const pcCol=$("#colPack")?$("#colPack").value:"";
  const lbCol=$("#colLabel")?$("#colLabel").value:"";
  excelRows.forEach((r,i)=>{const url=(r[uc]||"").toString().trim();if(!url)return;
    const name=((r[nc]!==""&&r[nc]!=null)?r[nc]:("row_"+(i+1))).toString().trim();
    const it=addItem(name+".jpg",url,false);
    if(pcCol){const pv=parseInt((r[pcCol]||"").toString().replace(/[^0-9]/g,""),10);if(pv>1)it.packSize=pv;}
    if(lbCol){const lv=(r[lbCol]||"").toString().trim();if(lv)it.packLabel=lv;}
    n++;});
  $("#excelNote").textContent=`Loaded ${n} image rows. Click "Auto remove backgrounds".`;refresh();
});

function refresh(){
  emptyEl.style.display=items.length?"none":"block";
  $("#run").disabled=!items.length||busy;
  $("#clear").disabled=!items.length||busy;
  const rr=$("#rerun");if(rr)rr.disabled=!items.length||busy;
  const single=mode==="single";
  $("#zip").style.display=single?"none":"inline-flex";
  $("#zip").disabled=single||busy||!items.some(i=>i.outBlob);
  const done=items.filter(i=>i.outBlob).length;
  $("#count").textContent=items.length?`${done}/${items.length} done`:"";
}
$("#clear").addEventListener("click",clearAll);

function downloadItem(it){
  if(!it.outURL)return;const base=it.name.replace(/\.[^.]+$/,"");const ext=S.fmt==="jpeg"?"jpg":"png";
  const a=document.createElement("a");a.href=it.outURL;a.download=`${base}.${ext}`;a.click();
}
function markDownload(it){
  const acts=it.el.querySelector(".acts");
  const base=it.name.replace(/\.[^.]+$/,""); const ext=S.fmt==="jpeg"?"jpg":"png";
  acts.innerHTML=`<button class="mini pick">✏️ Pick</button>
    <a class="mini" href="${it.outURL}" download="${base}.${ext}">⬇ Save</a>`;
  acts.querySelector(".pick").addEventListener("click",()=>openEditor(it));
}

async function ensureModel(){
  if(model && loadedId===S.model) return;
  const webgpu=!!navigator.gpu;
  engineMsg.textContent=`Loading ${S.model} (${webgpu?"WebGPU":"CPU/WASM"})… first time downloads the model.`;
  const isBiRef=/RMBG-2|birefnet/i.test(S.model);
  const opts=webgpu?{device:"webgpu"}:{};
  model=await AutoModel.from_pretrained(S.model,{config:{model_type:isBiRef?"birefnet":"custom"},...opts});
  processor=await AutoProcessor.from_pretrained(S.model,{config:{
    do_normalize:true,do_pad:false,do_rescale:true,do_resize:true,
    image_mean:isBiRef?[0.485,0.456,0.406]:[0.5,0.5,0.5],
    image_std:isBiRef?[0.229,0.224,0.225]:[1,1,1],
    resample:2,size:{width:1024,height:1024},
  }});
  loadedId=S.model;
  engineMsg.textContent=`Ready · running on ${webgpu?"your GPU (WebGPU)":"CPU"}.`;
}

function erodeAlpha(a,w,h,r){
  if(r<=0)return a;let cur=a;
  for(let p=0;p<r;p++){const nx=new Uint8ClampedArray(cur.length);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;let m=cur[i];
      if(x>0)m=Math.min(m,cur[i-1]);if(x<w-1)m=Math.min(m,cur[i+1]);
      if(y>0)m=Math.min(m,cur[i-w]);if(y<h-1)m=Math.min(m,cur[i+w]);nx[i]=m;}
    cur=nx;}
  return cur;
}
function dilateAlpha(a,w,h,r){
  if(r<=0)return a;let cur=a;
  for(let p=0;p<r;p++){const nx=new Uint8ClampedArray(cur.length);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;let m=cur[i];
      if(x>0)m=Math.max(m,cur[i-1]);if(x<w-1)m=Math.max(m,cur[i+1]);
      if(y>0)m=Math.max(m,cur[i-w]);if(y<h-1)m=Math.max(m,cur[i+w]);nx[i]=m;}
    cur=nx;}
  return cur;
}
function blurAlpha(a,w,h,r){
  r=Math.max(1,Math.round(r));const win=2*r+1;
  const tmp=new Float32Array(w*h),out=new Uint8ClampedArray(w*h);
  const cl=(v,hi)=>v<0?0:(v>hi?hi:v);
  for(let y=0;y<h;y++){const row=y*w;let sum=0;
    for(let k=-r;k<=r;k++)sum+=a[row+cl(k,w-1)];
    for(let x=0;x<w;x++){tmp[row+x]=sum/win;
      sum+=a[row+cl(x+r+1,w-1)]-a[row+cl(x-r,w-1)];}}
  for(let x=0;x<w;x++){let sum=0;
    for(let k=-r;k<=r;k++)sum+=tmp[cl(k,h-1)*w+x];
    for(let y=0;y<h;y++){out[y*w+x]=sum/win;
      sum+=tmp[cl(y+r+1,h-1)*w+x]-tmp[cl(y-r,h-1)*w+x];}}
  return out;
}
function boxMeanF(s,w,h,r){
  const win=2*r+1;const tmp=new Float32Array(w*h),out=new Float32Array(w*h);
  const cl=(v,hi)=>v<0?0:(v>hi?hi:v);
  for(let y=0;y<h;y++){const row=y*w;let sum=0;
    for(let k=-r;k<=r;k++)sum+=s[row+cl(k,w-1)];
    for(let x=0;x<w;x++){tmp[row+x]=sum/win;
      sum+=s[row+cl(x+r+1,w-1)]-s[row+cl(x-r,w-1)];}}
  for(let x=0;x<w;x++){let sum=0;
    for(let k=-r;k<=r;k++)sum+=tmp[cl(k,h-1)*w+x];
    for(let y=0;y<h;y++){out[y*w+x]=sum/win;
      sum+=tmp[cl(y+r+1,h-1)*w+x]-tmp[cl(y-r,h-1)*w+x];}}
  return out;
}
function keepLargest(a,w,h){
  const on=i=>a[i]>16;const lbl=new Int32Array(w*h).fill(-1);
  let best=-1,bestSize=0;const stack=[];
  for(let s=0;s<w*h;s++){
    if(!on(s)||lbl[s]>=0)continue;
    let size=0;lbl[s]=s;stack.length=0;stack.push(s);
    while(stack.length){const i=stack.pop();size++;
      const x=i%w,y=(i/w)|0;
      const nb=[x>0?i-1:-1,x<w-1?i+1:-1,y>0?i-w:-1,y<h-1?i+w:-1];
      for(const j of nb)if(j>=0&&on(j)&&lbl[j]<0){lbl[j]=s;stack.push(j);}}
    if(size>bestSize){bestSize=size;best=s;}
  }
  if(best<0)return a;
  const out=new Uint8ClampedArray(a.length);
  for(let i=0;i<w*h;i++)out[i]=lbl[i]===best?a[i]:0;
  return out;
}
function fillHoles(a,w,h){
  const bg=new Uint8Array(w*h);const stack=[];
  const push=i=>{if(a[i]<=16&&!bg[i]){bg[i]=1;stack.push(i);}};
  for(let x=0;x<w;x++){push(x);push((h-1)*w+x);}
  for(let y=0;y<h;y++){push(y*w);push(y*w+w-1);}
  while(stack.length){const i=stack.pop();const x=i%w,y=(i/w)|0;
    if(x>0)push(i-1);if(x<w-1)push(i+1);if(y>0)push(i-w);if(y<h-1)push(i+w);}
  const out=new Uint8ClampedArray(a);
  for(let i=0;i<w*h;i++)if(a[i]<=16&&!bg[i])out[i]=255;
  return out;
}
// Gentle unsharp-mask: restores crispness/text when a small image is enlarged,
// without the harsh halos of aggressive sharpening.
function unsharp(octx,w,h,amount,radius){
  const base=octx.getImageData(0,0,w,h);
  const t=document.createElement("canvas");t.width=w;t.height=h;
  const tx=t.getContext("2d");tx.filter="blur("+radius+"px)";tx.drawImage(octx.canvas,0,0);
  const blur=tx.getImageData(0,0,w,h);
  const d=base.data,b=blur.data;
  for(let i=0;i<d.length;i+=4){
    if(d[i+3]<8)continue;                       // skip transparent pixels
    for(let c=0;c<3;c++){const v=d[i+c]+amount*(d[i+c]-b[i+c]);d[i+c]=v<0?0:(v>255?255:v);}
  }
  octx.putImageData(base,0,0);
}
// Bleed the subject's own colour outward into the soft/edge band so no white
// (background) fringe shows when the cutout is placed on another background.
function decontaminate(data,a,w,h,passes){
  let solid=new Uint8Array(w*h);
  for(let i=0;i<w*h;i++)solid[i]=a[i]>200?1:0;
  for(let p=0;p<passes;p++){
    const ns=solid.slice();
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const i=y*w+x;if(solid[i])continue;
      let n=-1;
      if(x>0&&solid[i-1])n=i-1;else if(x<w-1&&solid[i+1])n=i+1;
      else if(y>0&&solid[i-w])n=i-w;else if(y<h-1&&solid[i+w])n=i+w;
      else if(x>0&&y>0&&solid[i-w-1])n=i-w-1;else if(x<w-1&&y>0&&solid[i-w+1])n=i-w+1;
      else if(x>0&&y<h-1&&solid[i+w-1])n=i+w-1;else if(x<w-1&&y<h-1&&solid[i+w+1])n=i+w+1;
      if(n>=0){const o=i*4,no=n*4;data[o]=data[no];data[o+1]=data[no+1];data[o+2]=data[no+2];ns[i]=1;}
    }
    solid=ns;
  }
}
// Drop tiny disconnected specks (noise) but keep all sizeable objects.
function removeSpecks(a,w,h,minFrac){
  const on=i=>a[i]>16;const lbl=new Int32Array(w*h).fill(-1);
  const sizes={};const stack=[];let maxSize=0;
  for(let s=0;s<w*h;s++){
    if(!on(s)||lbl[s]>=0)continue;
    let size=0;lbl[s]=s;stack.length=0;stack.push(s);
    while(stack.length){const i=stack.pop();size++;const x=i%w,y=(i/w)|0;
      const nb=[x>0?i-1:-1,x<w-1?i+1:-1,y>0?i-w:-1,y<h-1?i+w:-1];
      for(const j of nb)if(j>=0&&on(j)&&lbl[j]<0){lbl[j]=s;stack.push(j);}}
    sizes[s]=size;if(size>maxSize)maxSize=size;
  }
  const minSize=maxSize*minFrac;
  const out=new Uint8ClampedArray(a.length);
  for(let i=0;i<w*h;i++){const l=lbl[i];out[i]=(l>=0&&sizes[l]>=minSize)?a[i]:0;}
  return out;
}
// Make small near-white regions that are ENCLOSED by the coloured subject
// (e.g. a die-cut carry handle in the printed label) transparent. The large
// clear-plastic body is protected by a size cap so it is never removed.
function cutEnclosedWhite(data,alpha,W,H){
  const N=W*H;const nw=new Uint8Array(N);
  for(let i=0;i<N;i++){const o=i*4;const r=data[o],g=data[o+1],b=data[o+2];
    const mn=Math.min(r,g,b),mx=Math.max(r,g,b);nw[i]=(mn>=224&&(mx-mn)<=18)?1:0;}
  const open=new Uint8Array(N);const st=[];
  for(let i=0;i<N;i++)if(alpha[i]<=16){open[i]=1;st.push(i);}            // outside / transparent
  while(st.length){const i=st.pop();const x=i%W,y=(i/W)|0;               // flood through near-white
    const nb=[x>0?i-1:-1,x<W-1?i+1:-1,y>0?i-W:-1,y<H-1?i+W:-1];
    for(const j of nb){if(j<0||open[j])continue;if(nw[j]){open[j]=1;st.push(j);}}}
  let subj=0;for(let i=0;i<N;i++)if(alpha[i]>16)subj++;
  const maxHole=subj*0.12;                                              // cap so big clear plastic is safe
  const lbl=new Int32Array(N).fill(-1);
  for(let s=0;s<N;s++){
    if(lbl[s]>=0||!(nw[s]&&!open[s]&&alpha[s]>16))continue;
    let size=0;const comp=[];lbl[s]=s;st.length=0;st.push(s);
    while(st.length){const i=st.pop();size++;comp.push(i);const x=i%W,y=(i/W)|0;
      const nb=[x>0?i-1:-1,x<W-1?i+1:-1,y>0?i-W:-1,y<H-1?i+W:-1];
      for(const j of nb){if(j<0||lbl[j]>=0)continue;if(nw[j]&&!open[j]&&alpha[j]>16){lbl[j]=s;st.push(j);}}}
    if(size<=maxHole)for(const i of comp)alpha[i]=0;
  }
  return alpha;
}
// ---- Gemini AI Enhancement: send the raw original image to the backend
// (/api/ai-enhance, which calls gemini-3.1-flash-image via the LiteLLM proxy)
// and get back an enhanced image, then resize+pad locally — mirrors the
// reference Python (Streamlit) tool's pipeline exactly, with no local
// background-removal step first. Requires a one-time email (checked against
// a server-side whitelist) since access is gated per-user.
function getGeminiUserEmail(){
  let email = localStorage.getItem("geminiUserEmail") || "";
  if (!email) {
    email = (prompt("Enter your talabat.com email to use Gemini AI Enhancement:") || "").trim();
    if (email) localStorage.setItem("geminiUserEmail", email);
  }
  return email;
}

// Sends the raw image bytes straight to Gemini (no local background removal
// or compositing first) and returns the decoded result — mirrors the
// reference Python script's call_gemini_api() exactly: one call, whatever
// Gemini returns is trusted as-is (no similarity check, no auto-retry on
// content, no local fallback). Network/API errors still throw so the caller
// can surface a real failure, matching the Python script returning None.
async function geminiEnhanceImage(blob){
  const email = getGeminiUserEmail();
  if (!email) throw new Error("Email required for Gemini enhancement");
  const mime = blob.type || "image/jpeg";
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  const res = await fetch("/api/ai-enhance", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-user-email": email },
    body: JSON.stringify({ image: base64, mime }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.image) throw new Error(j.error || `Gemini enhancement failed (${res.status})`);
  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve; img.onerror = reject;
    img.src = `data:${j.mime || "image/png"};base64,${j.image}`;
  });
  return img;
}

// Port of the Python script's crop_white_space(): trims to the bounding box
// of non-near-white pixels (tolerance 20), with a 5px margin — used only on
// Gemini's returned image, exactly like the reference implementation.
function cropWhiteSpaceCanvas(canvas){
  const w=canvas.width,h=canvas.height;
  const d=canvas.getContext("2d").getImageData(0,0,w,h).data;
  const tol=20;
  let minX=w,minY=h,maxX=0,maxY=0,any=false;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const o=(y*w+x)*4,r=d[o],g=d[o+1],b=d[o+2];
    if(!(r>255-tol&&g>255-tol&&b>255-tol)){any=true;
      if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;}
  }
  if(!any)return {x:0,y:0,w,h};
  const m=5;
  minX=Math.max(0,minX-m);minY=Math.max(0,minY-m);
  maxX=Math.min(w-1,maxX+m);maxY=Math.min(h-1,maxY+m);
  return {x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1};
}

// Port of the Python script's resize_with_padding(): crop_white_space, scale
// to FIT (min ratio) the content area, then paste onto a white canvas_size
// square with the given padding. No other adjustments — Gemini's own output
// is trusted as the final look, exactly like the reference implementation.
async function resizeWithPaddingCanvas(img,canvasSize,padding){
  const src=document.createElement("canvas");src.width=img.naturalWidth||img.width;src.height=img.naturalHeight||img.height;
  src.getContext("2d").drawImage(img,0,0);
  const box=cropWhiteSpaceCanvas(src);
  const contentSize=canvasSize-2*padding;
  const ratio=Math.min(contentSize/box.w,contentSize/box.h);
  const newW=Math.max(1,Math.trunc(box.w*ratio)),newH=Math.max(1,Math.trunc(box.h*ratio));
  const out=document.createElement("canvas");out.width=canvasSize;out.height=canvasSize;
  const octx=out.getContext("2d");
  octx.fillStyle="#fff";octx.fillRect(0,0,canvasSize,canvasSize);
  const x=padding+Math.trunc((contentSize-newW)/2),y=padding+Math.trunc((contentSize-newH)/2);
  octx.imageSmoothingEnabled=true;octx.imageSmoothingQuality="high";
  octx.drawImage(src,box.x,box.y,box.w,box.h,x,y,newW,newH);
  // Gemini itself typically returns a lower-resolution image (commonly
  // ~1024x1024) than the 1200px content area we scale it up into, and the
  // browser's upscale filter alone leaves text/edges looking soft — the
  // Python reference has this same limitation, it's just less noticeable at
  // smaller preview sizes. This is a pure sharpness pass (no colour/contrast
  // change, doesn't touch or reinterpret content) purely to counteract that
  // upscale softness — it does not affect the fidelity/hallucination fix.
  if(ratio>1) unsharp(octx,canvasSize,canvasSize,Math.min(0.6,0.15*ratio),1.1);
  return out;
}

// Full Gemini path for one item — mirrors process_image_logic() in the
// reference Python script: raw image -> Gemini -> resize_with_padding. No
// local background removal, no extra sharpening/contrast pass, no
// similarity/rejection heuristics — whatever Gemini returns is the result.
async function geminiEnhanceOnly(it,srcOverride){
  it.statusEl&&(it.statusEl.className="status run",it.statusEl.textContent="enhancing with Gemini…");
  const resp=await fetch(procURL(srcOverride||it.srcURL));
  if(!resp.ok) throw new Error(`Could not load source image (${resp.status})`);
  const srcBlob=await resp.blob();
  const enhancedImg=await geminiEnhanceImage(srcBlob);
  const out=await resizeWithPaddingCanvas(enhancedImg,S.size,S.pad);
  const mime=S.fmt==="jpeg"?"image/jpeg":"image/png";
  const finalBlob=await new Promise(r=>out.toBlob(r,mime,0.96));
  if(it.outURL)URL.revokeObjectURL(it.outURL);
  it.outBlob=finalBlob;it.outURL=URL.createObjectURL(finalBlob);
  (it.outImg||it.img).src=it.outURL;
  it.statusEl&&(it.statusEl.className="status done",it.statusEl.textContent="done");
  markDownload(it);
}

// Visible polish: contrast/saturation/brightness, then sharpen. Applied to the
// finished cutout so products look crisp and vivid instead of soft/flat.
function enhance(octx,w,h){
  if(!S.enhanceOn)return;
  if(S.contrast!=100||S.saturate!=100||S.bright!=100){
    const t=document.createElement("canvas");t.width=w;t.height=h;
    t.getContext("2d").drawImage(octx.canvas,0,0);
    octx.clearRect(0,0,w,h);
    octx.filter=`contrast(${S.contrast}%) saturate(${S.saturate}%) brightness(${S.bright}%)`;
    octx.drawImage(t,0,0);octx.filter="none";
  }
  if(S.sharpen>0) unsharp(octx,w,h,S.sharpen/100,1.2);
}

function applySmoking(octx,w,h){
  if(!S.smokingOn||S.smoking<=0)return;
  const blurRadius=(S.smoking/100)*15;
  const pad=Math.ceil(blurRadius)+2;
  const padded=document.createElement("canvas");padded.width=w+pad*2;padded.height=h+pad*2;
  const pctx=padded.getContext("2d");
  pctx.drawImage(octx.canvas,pad,pad);
  const blurred=document.createElement("canvas");blurred.width=w+pad*2;blurred.height=h+pad*2;
  const bctx=blurred.getContext("2d");
  bctx.filter="blur("+blurRadius+"px)";
  bctx.drawImage(padded,0,0);
  octx.clearRect(0,0,w,h);
  octx.drawImage(blurred,pad,pad,w,h,0,0,w,h);
}
async function renderCutout(it,alpha,W,H,opts){
  opts=opts||{};
  const srcOverride=opts.srcOverride||null;
  const src=document.createElement("canvas");src.width=W;src.height=H;
  const sctx=src.getContext("2d");
  const im=new Image();im.crossOrigin="anonymous";await new Promise(r=>{im.onload=r;im.onerror=r;im.src=procURL(srcOverride||it.srcURL);});
  sctx.drawImage(im,0,0,W,H);
  const id=sctx.getImageData(0,0,W,H);

  let a=alpha;
  if(opts.grow>0)a=dilateAlpha(a,W,H,opts.grow);
  if(opts.erode>0)a=erodeAlpha(a,W,H,opts.erode);
  if(opts.despeckle)a=removeSpecks(a,W,H,0.02);
  if(S.fill)a=fillHoles(a,W,H);
  if(S.largest)a=keepLargest(a,W,H);
  if(S.cutHoles)a=cutEnclosedWhite(id.data,a,W,H);
  const passes=Math.max(2,(opts.feather|0)+(opts.grow|0)+(opts.erode|0)+2);
  decontaminate(id.data,a,W,H,passes);
  if(opts.feather>0)a=blurAlpha(a,W,H,opts.feather);

  for(let i=0;i<W*H;i++)id.data[i*4+3]=a[i];
  sctx.putImageData(id,0,0);

  let minX=W,minY=H,maxX=0,maxY=0,any=false;
  if(S.crop){
    // Threshold kept low (>2, not >8) so faint edges of near-white product
    // parts (e.g. a white cap against a white background) still count as
    // "product" instead of being silently excluded from the crop box —
    // excluded rows/cols are never drawn at all (see drawImage below), so a
    // too-high threshold here permanently trims that edge off the output.
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){if(a[y*W+x]>2){any=true;
      if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;}}
    if(any){const m=3;minX=Math.max(0,minX-m);minY=Math.max(0,minY-m);
      maxX=Math.min(W-1,maxX+m);maxY=Math.min(H-1,maxY+m);}
  }
  if(!any){minX=0;minY=0;maxX=W-1;maxY=H-1;}
  const cw=maxX-minX+1,ch=maxY-minY+1;

  const N=S.size,pad=S.pad,box=N-2*pad;
  const ratio=Math.min(box/cw,box/ch);
  const dw=Math.max(1,Math.round(cw*ratio)),dh=Math.max(1,Math.round(ch*ratio));
  const out=document.createElement("canvas");out.width=N;out.height=N;
  const octx=out.getContext("2d");
  if(S.bg==="white"||S.fmt==="jpeg"){octx.fillStyle="#fff";octx.fillRect(0,0,N,N);}
  const dx=Math.round((N-dw)/2)+S.offx,dy=Math.round((N-dh)/2)+S.offy;
  octx.imageSmoothingQuality="high";
  octx.drawImage(src,minX,minY,cw,ch,dx,dy,dw,dh);
  enhance(octx,N,N);
  applySmoking(octx,N,N);

  const mime=S.fmt==="jpeg"?"image/jpeg":"image/png";
  const finalBlob=await new Promise(r=>out.toBlob(r,mime,0.96));

  if(it.outURL)URL.revokeObjectURL(it.outURL);
  it.outBlob=finalBlob;it.outURL=URL.createObjectURL(finalBlob);
  (it.outImg||it.img).src=it.outURL;
  it.statusEl&&(it.statusEl.className="status done",it.statusEl.textContent="done");
  markDownload(it);
}

// White-background passthrough: no AI. Trim the white border, then center the
// product on a white square canvas with the chosen size/padding/optical offset.
async function renderPassthrough(it,srcOverride){
  const im=new Image();im.crossOrigin="anonymous";await new Promise(r=>{if(im.complete&&im.naturalWidth)r();im.onload=r;im.onerror=r;im.src=procURL(srcOverride||it.srcURL);});
  const W=im.naturalWidth,H=im.naturalHeight;
  const src=document.createElement("canvas");src.width=W;src.height=H;
  const sctx=src.getContext("2d");
  // Composite onto white FIRST: the source may already carry its own
  // transparency (e.g. a pre-cut PNG from the PIM), not necessarily an
  // opaque white photo. Drawing straight onto a blank (transparent) canvas
  // left those pixels black/transparent, which the white-trim check below
  // then treated as "part of the product" — showing up as gray/black blob
  // artifacts around the edges and a wrong crop/resize.
  sctx.fillStyle="#fff";sctx.fillRect(0,0,W,H);
  sctx.drawImage(im,0,0);
  const imgData=sctx.getImageData(0,0,W,H);const d=imgData.data;
  // CLEAN: snap low-saturation near-white pixels (studio background, soft shadows, and the
  // grey interior of die-cut handle holes) to pure white. Coloured pixels (peppers, label)
  // have higher saturation, so they are left untouched.
  for(let i=0;i<d.length;i+=4){const r=d[i],g=d[i+1],b=d[i+2];
    const mn=Math.min(r,g,b),mx=Math.max(r,g,b);
    if(mn>=228&&(mx-mn)<=16){d[i]=255;d[i+1]=255;d[i+2]=255;}}
  sctx.putImageData(imgData,0,0);
  const tol=20;                                   // how far from pure white still counts as background
  let minX=W,minY=H,maxX=0,maxY=0,any=false;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const o=(y*W+x)*4;
    if((255-d[o])>tol||(255-d[o+1])>tol||(255-d[o+2])>tol){any=true;
      if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;}}
  if(!any){minX=0;minY=0;maxX=W-1;maxY=H-1;}
  const cw=maxX-minX+1,ch=maxY-minY+1;
  const N=S.size,pad=S.pad,boxv=N-2*pad;
  const ratio=Math.min(boxv/cw,boxv/ch);
  const dw=Math.max(1,Math.round(cw*ratio)),dh=Math.max(1,Math.round(ch*ratio));
  const out=document.createElement("canvas");out.width=N;out.height=N;
  const octx=out.getContext("2d");octx.fillStyle="#fff";octx.fillRect(0,0,N,N);
  const dx=Math.round((N-dw)/2)+S.offx,dy=Math.round((N-dh)/2)+S.offy;
  octx.imageSmoothingQuality="high";
  octx.drawImage(src,minX,minY,cw,ch,dx,dy,dw,dh);
  enhance(octx,N,N);
  applySmoking(octx,N,N);
  const mime=S.fmt==="jpeg"?"image/jpeg":"image/png";
  const blob=await new Promise(r=>out.toBlob(r,mime,0.96));
  if(it.outURL)URL.revokeObjectURL(it.outURL);
  it.outBlob=blob;it.outURL=URL.createObjectURL(blob);(it.outImg||it.img).src=it.outURL;
  it.statusEl&&(it.statusEl.className="status done",it.statusEl.textContent="done");
  markDownload(it);
}
// Ask the media CDN for a higher-resolution source so scaled output stays sharp.
function hintHiRes(u){
  try{
    const url=new URL(u);
    if(/dhmedia\.io$/i.test(url.hostname) && !url.searchParams.has("width")){
      url.searchParams.set("width","2000");
      return url.toString();
    }
  }catch(_){}
  return u;
}
function procURL(u){
  if(!/^https?:\/\//i.test(u))return u;        // leave blob:/local URLs untouched
  u=hintHiRes(u);
  if(!S.useProxy)return u;
  const tpl=S.proxyTpl||"";
  if(tpl.includes("{url}"))return tpl.replace("{url}",encodeURIComponent(u));
  return tpl+encodeURIComponent(u);
}
// Different segmentation models name their ONNX input differently. Try
// "input", and if the model reports a different required input name, retry.
async function runSeg(model,pv){
  try{ return await model({input:pv}); }
  catch(e){
    const m=/Missing the following inputs?:\s*"?([A-Za-z0-9_.]+)/.exec(String(e&&e.message||e));
    if(m&&m[1]){ const feeds={}; feeds[m[1]]=pv; return await model(feeds); }
    throw e;
  }
}
async function autoAlpha(srcURL){
  // Many product images (e.g. from a PIM) ALREADY have a transparent
  // background. Feeding one of those into the AI model composites the
  // transparent pixels onto black first (canvas default), which the model
  // was never trained on — it produces a bad/noisy mask. Detect that case
  // up front by checking whether the image's own border is transparent, and
  // if so just reuse its existing alpha instead of re-running AI on it.
  const pre=new Image();pre.crossOrigin="anonymous";
  await new Promise(r=>{pre.onload=r;pre.onerror=r;pre.src=procURL(srcURL);});
  const W0=pre.naturalWidth,H0=pre.naturalHeight;
  if(W0&&H0){
    const cc=document.createElement("canvas");cc.width=W0;cc.height=H0;
    const cx=cc.getContext("2d");cx.drawImage(pre,0,0);
    const dd=cx.getImageData(0,0,W0,H0).data;
    const bpts=[[0,0],[W0-1,0],[0,H0-1],[W0-1,H0-1],[W0>>1,0],[W0>>1,H0-1],[0,H0>>1],[W0-1,H0>>1]];
    let bclear=0; for(const bp of bpts){ if(dd[(bp[1]*W0+bp[0])*4+3]<20) bclear++; }
    if(bclear>=7){                          // border transparent -> reuse existing cutout
      const cut=Math.max(S.thr,96);         // alpha below this = soft shadow -> remove
      const a=new Uint8ClampedArray(W0*H0);
      for(let i=0;i<a.length;i++){const v=dd[i*4+3];a[i]=v<cut?0:v;}
      return {a,W:W0,H:H0};
    }
  }
  await ensureModel();
  const raw=await RawImage.fromURL(procURL(srcURL));
  const {pixel_values}=await processor(raw);
  const o=await runSeg(model,pixel_values);
  const t=(o.output??o.alphas??o.logits??Object.values(o)[0]);
  let pred=t[0]; if(/RMBG-2|birefnet/i.test(S.model))pred=pred.sigmoid();
  const mask=await RawImage.fromTensor(pred.mul(255).to("uint8")).resize(raw.width,raw.height);
  const a=new Uint8ClampedArray(raw.width*raw.height);
  for(let i=0;i<a.length;i++){const v=mask.data[i];a[i]=v<=S.thr?0:v;}
  try{ pixel_values&&pixel_values.dispose&&pixel_values.dispose(); }catch(_){}
  try{ if(o) for(const k in o){ const tt=o[k]; tt&&tt.dispose&&tt.dispose(); } }catch(_){}
  return {a,W:raw.width,H:raw.height};
}

// ---- PLATE: place the product cutout centred on a black slate plate ----
let __plate=null;
function loadPlate(){ return __plate?Promise.resolve(__plate):new Promise((res,rej)=>{const p=new Image();p.crossOrigin="anonymous";p.onload=()=>{__plate=p;res(p);};p.onerror=rej;p.src="/plate.png";}); }
function cutoutCanvas(img,a,W,H){
  const c=document.createElement("canvas");c.width=W;c.height=H;const x=c.getContext("2d");
  x.drawImage(img,0,0,W,H);
  const id=x.getImageData(0,0,W,H);
  let minX=W,minY=H,maxX=0,maxY=0,any=false;
  for(let i=0;i<W*H;i++){const al=a[i]; id.data[i*4+3]=al; if(al>8){any=true;const px=i%W,py=(i/W)|0; if(px<minX)minX=px;if(px>maxX)maxX=px;if(py<minY)minY=py;if(py>maxY)maxY=py;}}
  x.putImageData(id,0,0);
  if(!any){minX=0;minY=0;maxX=W-1;maxY=H-1;}
  const cw=maxX-minX+1,ch=maxY-minY+1;
  const cc=document.createElement("canvas");cc.width=cw;cc.height=ch;
  cc.getContext("2d").drawImage(c,minX,minY,cw,ch,0,0,cw,ch);
  return cc;
}
// Place the product cutout onto the black slate plate, centred, at the target size.
async function applyPlate(it,src){
  const {a,W,H}=await autoAlpha(src);
  const im=new Image();im.crossOrigin="anonymous";await new Promise(r=>{im.onload=r;im.onerror=r;im.src=procURL(src);});
  const prod=cutoutCanvas(im,a,W,H);
  const plate=await loadPlate();
  const N=S.size;
  const out=document.createElement("canvas");out.width=N;out.height=N;const ctx=out.getContext("2d");
  ctx.fillStyle="#fff";ctx.fillRect(0,0,N,N);
  ctx.imageSmoothingQuality="high";
  const pr=Math.min((N*0.98)/plate.naturalWidth,(N*0.92)/plate.naturalHeight);
  const pw=plate.naturalWidth*pr, ph=plate.naturalHeight*pr, px=(N-pw)/2, py=(N-ph)/2;
  ctx.drawImage(plate,px,py,pw,ph);
  const fill=Math.max(40,Math.min(95,S.plateFill||82))/100;
  const zoneW=pw*fill, zoneH=ph*fill, zcx=px+pw/2, zcy=py+ph*0.46;   // product sits on the plate surface
  const sr=Math.min(zoneW/prod.width, zoneH/prod.height);
  const dw=prod.width*sr, dh=prod.height*sr;
  ctx.drawImage(prod,0,0,prod.width,prod.height, Math.round(zcx-dw/2)+S.offx, Math.round(zcy-dh/2)+S.offy, dw, dh);
  const mime=S.fmt==="jpeg"?"image/jpeg":"image/png";
  const blob=await new Promise(rb=>out.toBlob(rb,mime,0.96));
  if(it.outURL)URL.revokeObjectURL(it.outURL);
  it.outBlob=blob;it.outURL=URL.createObjectURL(blob);(it.outImg||it.img).src=it.outURL;
  it.statusEl&&(it.statusEl.className="status done",it.statusEl.textContent="done");
  markDownload(it);
}

// ---- COMBO: merge several marked products into ONE white square ----
// Get a tight, background-removed cutout canvas for an item (cached).
async function getCut(it){
  if(it._cut) return it._cut;
  const {a,W,H}=await autoAlpha(it.srcURL);
  const im=new Image();im.crossOrigin="anonymous";
  await new Promise(r=>{im.onload=r;im.onerror=r;im.src=procURL(it.srcURL);});
  it._cut=cutoutCanvas(im,a,W,H);
  return it._cut;
}
function drawFit(ctx,c,bx,by,bw,bh){
  const s=Math.min(bw/c.width,bh/c.height);const w=c.width*s,h=c.height*s;
  ctx.drawImage(c,bx+(bw-w)/2,by+(bh-h)/2,w,h);
}
// Scale each cutout to equal visual "mass" (equal area) so a wide banana and a
// round apple look proportionate instead of one tiny / one huge.
function normSizes(cuts){
  const base=Math.max(...cuts.map(c=>c.width*c.height));
  return cuts.map(c=>{const s=Math.sqrt(base/(c.width*c.height));return {c,w:c.width*s,h:c.height*s};});
}
// Fit centre-positioned items into rect R={x,y,w,h}; draw largest-first.
function placeAndFit(ctx,placed,R){
  let minx=1e9,miny=1e9,maxx=-1e9,maxy=-1e9;
  placed.forEach(p=>{minx=Math.min(minx,p.x-p.w/2);maxx=Math.max(maxx,p.x+p.w/2);miny=Math.min(miny,p.y-p.h/2);maxy=Math.max(maxy,p.y+p.h/2);});
  const gw=maxx-minx||1,gh=maxy-miny||1,sc=Math.min(R.w/gw,R.h/gh);
  const gcx=(minx+maxx)/2,gcy=(miny+maxy)/2,cx=R.x+R.w/2,cy=R.y+R.h/2;
  placed.forEach(p=>{
    const dw=Math.max(1,p.w*sc),dh=Math.max(1,p.h*sc);
    ctx.drawImage(p.c,cx+(p.x-gcx)*sc-dw/2,cy+(p.y-gcy)*sc-dh/2,dw,dh);
  });
}
// Natural produce-basket pile: round items form a back cluster, elongated
// items and the smallest round items sit in front along the bottom.
function layoutBundle(ctx,cuts,R){
  if(cuts.length===1){const nz=normSizes(cuts);placeAndFit(ctx,[{c:nz[0].c,x:0,y:0,w:nz[0].w,h:nz[0].h}],R);return;}
  const elongCuts=cuts.filter(c=>c.width/c.height>1.25);
  const roundCuts=cuts.filter(c=>c.width/c.height<=1.25).sort((a,b)=>(b.width*b.height)-(a.width*a.height));
  const nFront=roundCuts.length>=3?Math.max(1,Math.floor(roundCuts.length/3)):0;
  const backCuts=nFront?roundCuts.slice(0,roundCuts.length-nFront):roundCuts;
  const frontRoundCuts=nFront?roundCuts.slice(backCuts.length):[];
  const frontCuts=elongCuts.concat(frontRoundCuts);
  const back=normSizes(backCuts.length?backCuts:cuts), front=frontCuts.length?normSizes(frontCuts):[];
  const all=back.concat(front),avgH=all.reduce((s,o)=>s+o.h,0)/all.length,rise=avgH*0.55;
  const rowPlace=(items,baseY,ov)=>{const placed=[];let tot=0;
    items.forEach((o,i)=>tot+=i?o.w*(1-ov):o.w);
    let x=-tot/2;items.forEach(o=>{placed.push({c:o.c,x:x+o.w/2,y:baseY-o.h/2,w:o.w,h:o.h});x+=o.w*(1-ov);});
    return placed;};
  const placed=rowPlace(back,-rise*0.4,0.20).concat(front.length?rowPlace(front,rise*0.35,0.22):[]);
  placeAndFit(ctx,placed,R);
}
// Equal-height scaling: standing products (cans, bottles, tubes) line up at the
// same height, like on a shelf.
function normHeights(cuts){
  const H=Math.max(...cuts.map(c=>c.height));
  return cuts.map(c=>{const s=H/c.height;return {c,w:c.width*s,h:c.height*s};});
}
// Side-by-side, bottoms aligned, equal heights.
function layoutRow(ctx,cuts,R){
  const nz=normHeights(cuts),gap=nz.reduce((a,o)=>a+o.w,0)/nz.length*0.06;
  let x=0;const placed=[];
  nz.forEach(o=>{placed.push({c:o.c,x:x+o.w/2,y:-o.h/2,w:o.w,h:o.h});x+=o.w+gap;});
  placeAndFit(ctx,placed,R);
}
// Vertical stack, proportionate, centred.
function layoutStack(ctx,cuts,R){
  const nz=normSizes(cuts),gap=nz.reduce((a,o)=>a+o.h,0)/nz.length*0.12;
  let y=0;const placed=[];
  nz.forEach(o=>{placed.push({c:o.c,x:0,y:y+o.h/2,w:o.w,h:o.h});y+=o.h+gap;});
  placeAndFit(ctx,placed,R);
}
// Balanced grid within rect.
function layoutGrid(ctx,cuts,R){
  const n=cuts.length,cols=Math.ceil(Math.sqrt(n)),rows=Math.ceil(n/cols),gap=Math.round(Math.min(R.w,R.h)*0.03);
  const cw=(R.w-gap*(cols-1))/cols,ch=(R.h-gap*(rows-1))/rows;
  cuts.forEach((c,i)=>{const cx=i%cols,cy=(i/cols)|0;drawFit(ctx,c,R.x+cx*(cw+gap),R.y+cy*(ch+gap),cw,ch);});
}
// ---- MULTIPACK: one unit repeated N times, within rect ----
function packGrid(ctx,unit,n,R){ layoutGrid(ctx,new Array(n).fill(unit),R); }
function packFront(ctx,unit,n,R){
  const ov=0.10,uwByW=R.w/(1+(n-1)*(1-ov)),sc=Math.min(uwByW/unit.width,R.h/unit.height);
  const uw=unit.width*sc,uh=unit.height*sc,total=uw*(1+(n-1)*(1-ov));
  let x=R.x+(R.w-total)/2;const y=R.y+(R.h-uh)/2;
  for(let i=0;i<n;i++)ctx.drawImage(unit,x+i*uw*(1-ov),y,uw,uh);
}
// Stacked case: two rows, big units filling the rect like a shrink-pack.
function packHero(ctx,unit,n,R){
  const ovx=0.05,rise=0.42,asp=unit.height/unit.width,front=Math.ceil(n/2),back=n-front;
  let uw=R.w/(1+(front-1)*(1-ovx)),uh=uw*asp;
  if(uh*(1+rise)>R.h){const s=R.h/(uh*(1+rise));uw*=s;uh*=s;}
  const fw=uw*(1+(front-1)*(1-ovx)),fx=R.x+(R.w-fw)/2,fy=R.y+R.h-uh,by=fy-rise*uh;
  const bw=uw*(1+(back-1)*(1-ovx)),bx=R.x+(R.w-bw)/2;
  for(let i=0;i<back;i++)ctx.drawImage(unit,bx+i*uw*(1-ovx),by,uw,uh);
  for(let i=0;i<front;i++)ctx.drawImage(unit,fx+i*uw*(1-ovx),fy,uw,uh);
}
// Talabat-style bottom banner: an orange pill sized to the text, centred, with
// a black border and white bold text. No arrow.
function drawLabel(ctx,N,text,band){
  if(!text)return;
  const h=Math.round(band.h*0.86),r=Math.round(h*0.28);
  ctx.font="800 "+Math.round(h*0.5)+"px Inter, Arial, sans-serif";
  const tw=ctx.measureText(text).width,padx=Math.round(h*0.55),w=Math.round(tw+2*padx);
  const x=Math.round(band.x+(band.w-w)/2),y=Math.round(band.y+(band.h-h)/2);
  const rr=(bx,by,bw,bh,br)=>{ctx.beginPath();
    if(ctx.roundRect)ctx.roundRect(bx,by,bw,bh,br);
    else{ctx.moveTo(bx+br,by);ctx.arcTo(bx+bw,by,bx+bw,by+bh,br);ctx.arcTo(bx+bw,by+bh,bx,by+bh,br);ctx.arcTo(bx,by+bh,bx,by,br);ctx.arcTo(bx,by,bx+bw,by,br);ctx.closePath();}};
  ctx.fillStyle="#111111";rr(x-6,y-6,w+12,h+12,r+5);ctx.fill();
  ctx.fillStyle="#FF5900";rr(x,y,w,h,r);ctx.fill();
  ctx.fillStyle="#ffffff";ctx.textAlign="center";ctx.textBaseline="middle";
  ctx.fillText(text,x+w/2,y+h/2+1);
}
function addComboCard(label,blob){
  const url=URL.createObjectURL(blob);const ext=S.fmt==="jpeg"?"jpg":"png";const key=label.toLowerCase().replace(/[^a-z0-9]+/g,"_");
  const card=document.createElement("div");card.className="card";
  card.innerHTML=`<div class="compare"><div class="cell" style="flex:1"><div class="cap">Combo · ${label}</div><div class="thumb"><img class="out"></div></div></div>
    <div class="meta"><span class="name">combo_${key}</span>
    <span class="acts"><a class="mini" href="${url}" download="combo_${key}.${ext}">⬇ Save</a></span></div>`;
  card.querySelector(".out").src=url;
  $("#comboOut").appendChild(card);
}
async function comboBuild(){
  if(busy)return;
  const sel=items.filter(i=>i.combo);
  if(!sel.length){engineMsg.textContent="Turn on Combo mode and tick at least one image.";return;}
  busy=true;refresh();updateComboBtn();
  $("#comboOut").innerHTML="";
  try{
    const N=S.size,pad=S.pad,mime=S.fmt==="jpeg"?"image/jpeg":"image/png";
    const mk=async(label,lbl,draw)=>{
      const out=document.createElement("canvas");out.width=N;out.height=N;
      const ctx=out.getContext("2d");ctx.fillStyle="#fff";ctx.fillRect(0,0,N,N);ctx.imageSmoothingQuality="high";
      const has=!!(lbl&&lbl.trim());
      const bandH=Math.round(N*0.14),gap=Math.round(N*0.045),botM=Math.round(N*0.045);
      const band={x:0,y:N-botM-bandH,w:N,h:bandH};
      const R=has?{x:pad,y:pad,w:N-2*pad,h:(band.y-gap)-pad}:{x:pad,y:pad,w:N-2*pad,h:N-2*pad};
      draw(ctx,R);
      if(has)drawLabel(ctx,N,lbl.trim(),band);
      const blob=await new Promise(r=>out.toBlob(r,mime,0.96));
      addComboCard(label,blob);
    };
    if(sel.length>=2){
      const cuts=[];
      for(const it of sel){ engineMsg.textContent=`Cutting out ${it.name}…`; cuts.push(await getCut(it)); }
      const lbl=(S.packLabel||"").trim();
      await mk("Bundle",lbl,(ctx,R)=>layoutBundle(ctx,cuts,R));
      await mk("Grid",lbl,(ctx,R)=>layoutGrid(ctx,cuts,R));
      await mk("Row",lbl,(ctx,R)=>layoutRow(ctx,cuts,R));
      await mk("Stack",lbl,(ctx,R)=>layoutStack(ctx,cuts,R));
      engineMsg.textContent=`Combo built from ${sel.length} products — Bundle, Grid, Row and Stack are at the top. Save the one you like.`;
    }else{
      const it=sel[0];
      const n=Math.max(2,(it.packSize||S.packSize||6)|0);
      const drawn=Math.min(n,6);
      let lbl=(it.packLabel||S.packLabel||"").trim();
      if(!lbl && n>6) lbl=n+" pcs";
      engineMsg.textContent=`Building ${n}-pack of ${it.name}…`;
      const unit=await getCut(it);
      await mk("Stacked case",lbl,(ctx,R)=>packHero(ctx,unit,drawn,R));
      await mk("Grid",lbl,(ctx,R)=>packGrid(ctx,unit,drawn,R));
      await mk("Front row",lbl,(ctx,R)=>packFront(ctx,unit,drawn,R));
      engineMsg.textContent=`${n}-pack built — Stacked case, Grid and Front row are at the top.`+(n>6?` Showing 6 units with a "${lbl}" label.`:``)+` Save the one you like.`;
    }
  }catch(err){console.error(err);engineMsg.textContent="Combo failed: "+err.message;}
  busy=false;refresh();updateComboBtn();
}

async function runAll(force){
  if(busy)return;
  if(force){
    items.forEach(it=>{ if(it.outURL)URL.revokeObjectURL(it.outURL); it.outBlob=null; it.outURL=null; it._cut=null;
      if(it.statusEl){it.statusEl.className="status q";it.statusEl.textContent="queued";}
      if(it.bar){it.bar.style.width="0";it.bar.style.background="var(--accent)";} });
  }
  busy=true;refresh();
  try{
    for(const it of items){
      if(it.outBlob){it.bar.style.width="100%";continue;}
      it.statusEl.className="status run";it.statusEl.textContent="working…";it.bar.style.width="40%";
      try{
        if(S.geminiOn){ await geminiEnhanceOnly(it); }
        else if(S.plateOn){ engineMsg.textContent="Placing on plate…"; await applyPlate(it,it.srcURL); }
        else if(S.passthrough){ await renderPassthrough(it); }
        else{ const {a,W,H}=await autoAlpha(it.srcURL); await renderCutout(it,a,W,H,{erode:S.erode,feather:S.feather}); }
        it.bar.style.width="100%";
      }
      catch(err){console.error(err);it.statusEl.className="status err";it.statusEl.textContent="failed";
        it.bar.style.background="var(--err)";it.bar.style.width="100%";}
      refresh();await new Promise(r=>setTimeout(r,10));
    }
  }catch(err){engineMsg.textContent="Model failed to load: "+err.message;console.error(err);}
  if(mode==="single"&&items[0]&&items[0].outBlob)downloadItem(items[0]);
  busy=false;refresh();
}
$("#run").addEventListener("click",()=>runAll(false));
$("#rerun")?.addEventListener("click",()=>runAll(true));

// Reprocess only the images the user ticked "retry" on — e.g. ones where
// Gemini invented a different packaging, or any other one-off failure —
// without touching (or re-billing/re-calling Gemini for) the rest of the batch.
async function retryChecked(){
  if(busy)return;
  const sel=items.filter(i=>i.retrySel);
  if(!sel.length){alert("Tick \"retry\" on the image(s) you want to reprocess first.");return;}
  busy=true;refresh();
  try{
    for(const it of sel){
      if(it.outURL){URL.revokeObjectURL(it.outURL);it.outURL=null;}
      it.outBlob=null;it._cut=null;
      it.statusEl.className="status run";it.statusEl.textContent="retrying…";it.bar.style.width="40%";
      try{
        if(S.geminiOn){ await geminiEnhanceOnly(it); }
        else if(S.plateOn){ await applyPlate(it,it.srcURL); }
        else if(S.passthrough){ await renderPassthrough(it); }
        else{ const {a,W,H}=await autoAlpha(it.srcURL); await renderCutout(it,a,W,H,{erode:S.erode,feather:S.feather}); }
        it.bar.style.width="100%";
      }catch(err){console.error(err);it.statusEl.className="status err";it.statusEl.textContent="failed";
        it.bar.style.background="var(--err)";it.bar.style.width="100%";}
      refresh();await new Promise(r=>setTimeout(r,10));
    }
  }finally{busy=false;refresh();}
}
$("#retryChecked")?.addEventListener("click",retryChecked);

// ============ SMART PICK: auto-detect + click + manual brush fix ============
const ed={open:false,it:null,fgA:null,lbl:null,W:0,H:0,selected:new Set(),comps:null,
  base:null,addMask:null,eraseMask:null,alpha:null,
  mode:"click",brush:"add",brushSize:20,painting:false,grow:0,cursor:null};
const edImg=$("#edImg"),edCanvas=$("#edCanvas"),edMsg=$("#edMsg"),edHolder=$("#edHolder");
const edCtx=edCanvas.getContext("2d");

function detectProducts(a,w,h){
  const on=i=>a[i]>16;const lbl=new Int32Array(w*h).fill(-1);const stack=[];const comps=[];
  for(let s=0;s<w*h;s++){
    if(!on(s)||lbl[s]>=0)continue;
    let size=0,minX=w,minY=h,maxX=0,maxY=0;
    lbl[s]=s;stack.length=0;stack.push(s);
    while(stack.length){const i=stack.pop();size++;const x=i%w,y=(i/w)|0;
      if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;
      const nb=[x>0?i-1:-1,x<w-1?i+1:-1,y>0?i-w:-1,y<h-1?i+w:-1];
      for(const j of nb)if(j>=0&&on(j)&&lbl[j]<0){lbl[j]=s;stack.push(j);}}
    comps.push({id:s,size,box:[minX,minY,maxX,maxY]});
  }
  const minArea=w*h*0.004;
  return {lbl,comps:comps.filter(c=>c.size>=minArea).sort((p,q)=>q.size-p.size)};
}

// Final alpha = selected components, plus brush-added, minus brush-erased.
function compose(){
  const N=ed.W*ed.H;const a=ed.base?ed.base.slice(0):new Uint8ClampedArray(N);
  if(ed.addMask)for(let i=0;i<N;i++)if(ed.addMask[i])a[i]=255;
  if(ed.eraseMask)for(let i=0;i<N;i++)if(ed.eraseMask[i])a[i]=0;
  let out=a;
  if(ed.grow>0)out=dilateAlpha(out,ed.W,ed.H,ed.grow);
  else if(ed.grow<0)out=erodeAlpha(out,ed.W,ed.H,-ed.grow);
  ed.alpha=out;
  let any=false;for(let i=0;i<N;i++)if(out[i]>16){any=true;break;}
  $("#edApply").disabled=!any;
  drawOverlay();
}

async function openEditor(it){
  ed.it=it;ed.selected=new Set();ed.alpha=null;ed.comps=null;
  ed.base=null;ed.addMask=null;ed.eraseMask=null;ed.mode="click";ed.brush="add";ed.painting=false;ed.grow=0;ed.cursor=null;
  $("#edApply").disabled=true;
  $("#modeClick").classList.add("active");$("#modeBrush").classList.remove("active");
  $("#brAdd").classList.add("active");$("#brErase").classList.remove("active");
  $("#brushOpts").style.display="none";
  $("#editor").classList.remove("hidden");ed.open=true;
  ed.fgA=null;ed.lbl=null;
  edImg.src=it.srcURL;edCanvas.style.cursor="crosshair";edCanvas.style.touchAction="none";
  await new Promise(r=>{if(edImg.complete&&edImg.naturalWidth)r();else edImg.onload=r;});
  // set size + a blank base from the IMAGE first, so the Brush works even if detection fails
  ed.W=edImg.naturalWidth;ed.H=edImg.naturalHeight;ed.base=new Uint8ClampedArray(ed.W*ed.H);
  edCanvas.width=edImg.clientWidth;edCanvas.height=edImg.clientHeight;edHolder.style.width=edImg.clientWidth+"px";
  drawOverlay();
  edMsg.textContent="Detecting products… (you can use 🖌 Brush at any time)";
  try{
    await ensureModel();
    const {a}=await autoAlpha(it.srcURL);
    ed.fgA=a;
    const {lbl,comps}=detectProducts(a,ed.W,ed.H);
    ed.lbl=lbl;ed.comps=comps;
    if(comps.length===1){ed.selected.add(comps[0].id);rebuildSelection();
      edMsg.textContent="Detected 1 product (auto-selected). Use it, ⤢ Grow the edge, or 🖌 Brush to fix.";}
    else if(comps.length>1){compose();edMsg.textContent=`Detected ${comps.length} item(s) (blue boxes). Click to keep, or 🖌 Brush to fix.`;}
    else{compose();edMsg.textContent="Couldn't auto-detect a clear subject — switch to 🖌 Brush and paint over what to keep (Add), then Use this cutout.";}
    drawOverlay();
  }catch(err){console.error(err);compose();
    edMsg.textContent="Auto-detect unavailable for this image — use 🖌 Brush to paint what to keep.";}
}
function closeEditor(){$("#editor").classList.add("hidden");ed.open=false;}
$("#edClose").addEventListener("click",closeEditor);
$("#editor").addEventListener("click",e=>{if(e.target.id==="editor")closeEditor();});
$("#edReset").addEventListener("click",()=>{ed.selected=new Set();ed.base=new Uint8ClampedArray(ed.W*ed.H);
  ed.addMask=null;ed.eraseMask=null;compose();edMsg.textContent="Cleared. Click items or use the Brush.";});

// mode + brush controls
$("#modeClick").addEventListener("click",()=>{ed.mode="click";$("#modeClick").classList.add("active");
  $("#modeBrush").classList.remove("active");$("#brushOpts").style.display="none";edCanvas.style.cursor="crosshair";
  edMsg.textContent="Click mode — click an item to keep it.";});
$("#modeBrush").addEventListener("click",()=>{ed.mode="brush";$("#modeBrush").classList.add("active");
  $("#modeClick").classList.remove("active");$("#brushOpts").style.display="inline-flex";edCanvas.style.cursor="cell";
  edMsg.textContent="Brush mode — drag to "+(ed.brush==="add"?"ADD (green)":"ERASE")+". Use the slider for size.";});
$("#brAdd").addEventListener("click",()=>{ed.brush="add";$("#brAdd").classList.add("active");$("#brErase").classList.remove("active");
  edMsg.textContent="Brush: ADD — drag over the parts that were missed.";});
$("#brErase").addEventListener("click",()=>{ed.brush="erase";$("#brErase").classList.add("active");$("#brAdd").classList.remove("active");
  edMsg.textContent="Brush: ERASE — drag over the parts to remove.";});
$("#brSize").addEventListener("input",e=>ed.brushSize=+e.target.value);
$("#growEdge").addEventListener("click",()=>{if(!ed.W)return;ed.grow++;compose();edMsg.textContent="Edge expanded (+"+ed.grow+" px). Click Grow again, or Use this cutout.";});
$("#shrinkEdge").addEventListener("click",()=>{if(!ed.W)return;ed.grow--;compose();edMsg.textContent="Edge "+(ed.grow>0?"+":"")+ed.grow+" px.";});

function labelAt(ix,iy){
  const W=ed.W,H=ed.H;
  if(ix<0||iy<0||ix>=W||iy>=H)return -1;
  let l=ed.lbl[iy*W+ix];
  if(l>=0)return l;
  for(let r=4;r<=Math.max(W,H);r*=2){const step=Math.max(1,(r/4)|0);
    for(let dy=-r;dy<=r;dy+=step)for(let dx=-r;dx<=r;dx+=step){
      const x=ix+dx,y=iy+dy;if(x<0||y<0||x>=W||y>=H)continue;
      const ll=ed.lbl[y*W+x];if(ll>=0)return ll;}}
  return -1;
}
function evtToImg(e){const r=edCanvas.getBoundingClientRect();
  return [Math.round((e.clientX-r.left)/r.width*ed.W),Math.round((e.clientY-r.top)/r.height*ed.H)];}

function rebuildSelection(){
  const N=ed.W*ed.H,sel=ed.selected,lbl=ed.lbl,fg=ed.fgA;
  const b=new Uint8ClampedArray(N);
  if(sel.size)for(let i=0;i<N;i++)if(sel.has(lbl[i]))b[i]=fg[i];
  ed.base=b;compose();
  if(sel.size)edMsg.textContent=`${sel.size} item(s) selected. Click more, Shift-click to remove, or 🖌 Brush to fix.`;
}

// click = component select (only in click mode)
edCanvas.addEventListener("click",e=>{
  if(ed.mode!=="click"||!ed.W)return;
  if(!ed.lbl){edMsg.textContent="No auto-detection here — switch to 🖌 Brush to paint what to keep.";return;}
  const [ix,iy]=evtToImg(e);
  const lab=labelAt(ix,iy);
  if(lab<0){edMsg.textContent="No product detected there — click a blue item, or use the Brush.";return;}
  if(e.shiftKey)ed.selected.delete(lab);else ed.selected.add(lab);
  rebuildSelection();
});

// brush painting
function ensureMasks(){if(!ed.addMask)ed.addMask=new Uint8Array(ed.W*ed.H);if(!ed.eraseMask)ed.eraseMask=new Uint8Array(ed.W*ed.H);}
function paintAt(e){
  if(!ed.W)return;ensureMasks();
  const [ix,iy]=evtToImg(e);
  const rad=Math.max(1,Math.round(ed.brushSize*ed.W/edCanvas.width));
  const r2=rad*rad,add=ed.brush==="add";
  for(let dy=-rad;dy<=rad;dy++){const yy=iy+dy;if(yy<0||yy>=ed.H)continue;
    for(let dx=-rad;dx<=rad;dx++){if(dx*dx+dy*dy>r2)continue;const xx=ix+dx;if(xx<0||xx>=ed.W)continue;
      const i=yy*ed.W+xx;if(add){ed.addMask[i]=1;ed.eraseMask[i]=0;}else{ed.eraseMask[i]=1;ed.addMask[i]=0;}}}
  compose();
}
edCanvas.addEventListener("pointerdown",e=>{if(ed.mode!=="brush"||!ed.W)return;
  ed.painting=true;try{edCanvas.setPointerCapture(e.pointerId);}catch(_){}paintAt(e);});
edCanvas.addEventListener("pointermove",e=>{
  if(ed.mode==="brush"){const r=edCanvas.getBoundingClientRect();ed.cursor={x:e.clientX-r.left,y:e.clientY-r.top};}
  if(ed.painting)paintAt(e);else if(ed.mode==="brush")drawOverlay();
});
edCanvas.addEventListener("pointerup",()=>{ed.painting=false;});
edCanvas.addEventListener("pointerleave",()=>{ed.painting=false;ed.cursor=null;drawOverlay();});

function drawOverlay(){
  edCtx.clearRect(0,0,edCanvas.width,edCanvas.height);
  const sx=edCanvas.width/(ed.W||1),sy=edCanvas.height/(ed.H||1);
  if(ed.alpha){
    const off=document.createElement("canvas");off.width=ed.W;off.height=ed.H;
    const octx=off.getContext("2d");const id=octx.createImageData(ed.W,ed.H);
    for(let i=0;i<ed.W*ed.H;i++){const on=ed.alpha[i]>16;
      id.data[i*4]=39;id.data[i*4+1]=192;id.data[i*4+2]=147;id.data[i*4+3]=on?120:0;}
    octx.putImageData(id,0,0);
    edCtx.drawImage(off,0,0,edCanvas.width,edCanvas.height);
  }
  if(ed.comps){edCtx.lineWidth=2;edCtx.font="bold 13px sans-serif";
    ed.comps.forEach((c,n)=>{const on=ed.selected.has(c.id);
      edCtx.strokeStyle=on?"#27c093":"#19c3ff";edCtx.fillStyle=on?"#27c093":"#19c3ff";
      const x=c.box[0]*sx,y=c.box[1]*sy,w=(c.box[2]-c.box[0])*sx,h=(c.box[3]-c.box[1])*sy;
      edCtx.strokeRect(x,y,w,h);edCtx.fillText((on?"✓ ":"")+(n+1),x+4,y+15);});
  }
  if(ed.mode==="brush"&&ed.cursor){edCtx.beginPath();edCtx.arc(ed.cursor.x,ed.cursor.y,ed.brushSize,0,7);
    edCtx.strokeStyle=ed.brush==="add"?"#27c093":"#ff5d6c";edCtx.lineWidth=1.5;edCtx.stroke();}
}
window.addEventListener("resize",()=>{if(ed.open){edCanvas.width=edImg.clientWidth;edCanvas.height=edImg.clientHeight;edHolder.style.width=edImg.clientWidth+"px";drawOverlay();}});

$("#edApply").addEventListener("click",async()=>{
  if(!ed.alpha)return;
  edMsg.textContent="Building cutout…";
  const it=ed.it;it.statusEl&&(it.statusEl.className="status run",it.statusEl.textContent="working…");
  try{await renderCutout(it,ed.alpha,ed.W,ed.H,{grow:1,feather:Math.max(1,S.feather)});it.bar.style.width="100%";refresh();closeEditor();}
  catch(err){console.error(err);edMsg.textContent="Failed: "+err.message;}
});

$("#zip").addEventListener("click",async()=>{
  const zip=new JSZip();const ext=S.fmt==="jpeg"?"jpg":"png";
  items.filter(i=>i.outBlob).forEach(i=>{const base=i.name.replace(/\.[^.]+$/,"");zip.file(`${base}.${ext}`,i.outBlob);});
  const blob=await zip.generateAsync({type:"blob"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="davinci_cutouts.zip";a.click();
});

refresh();
