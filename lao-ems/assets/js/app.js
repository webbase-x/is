import { supabase, clearLaoAuthSession } from "./supabase.js?v=20260927-2";
import { APP_VERSION, APP_VERSION_LABEL } from "./version.js?v=0.19.6";

const state={session:null,user:null,profile:null,memberships:[],currentMembership:null,organizations:[],schools:[],adminSchools:[],adminSchool:null,orgSchools:[],notifications:[],pendingInvitation:null,schoolSetup:null,lecPreview:null,lecImporting:false,studentDirectory:null,studentFilters:{search:"",year_be:null,term_no:null,grade_level:"",classroom:"",presence:"",offset:0,limit:2000},personnelDirectory:null,personnelFilters:{search:"",personnel_type:"",status:"active"},personnelWork:{can_review:false,can_manage_intake:false,can_assign_authority:false,pending_join_requests:0},academicData:null,academicYearId:null,academicFilters:{grade_label:"",program_id:""},academicPreset:null,academicPresetGrade:"",academicTermId:null,academicWork:{can_manage:false,pending_teaching_workloads:0,my_returned_workloads:0,attention_count:0},teachingWorkloadData:null,teachingWorkloadPersonnelId:null,teachingWorkloadStatus:"",installPrompt:null,pwaInstalled:false,classProgramEditMode:false,classStageFilter:"",subjectEditMode:false,subjectCopyYearId:"",subjectCatalogScope:"core",subjectProgramId:"",subjectSetupTab:"target",subjectWorkspaceView:"selected",subjectParallelSelectionMode:false,subjectWorkspaceData:null,curriculumReadiness:null,routeRenderId:0,isPlatformAdmin:false,viewMode:"user",reauthenticating:false};

const routeMeta={
  overview:["ภาพรวมระบบ","ภาพรวมการเชื่อมข้อมูลและลำดับการพัฒนา"],
  membership:["สิทธิ์การเข้าใช้งาน","ดูสถานศึกษาและบทบาทที่ผู้ดูแลกำหนดให้"],
  activate:["ตั้งค่าบัญชี","ยืนยันโปรไฟล์และกำหนดรหัสผ่านสำหรับบัญชีที่ผู้ดูแลเชิญ"],
  profile:["โปรไฟล์ของฉัน","แก้ไขข้อมูลส่วนตัวและเปลี่ยนรหัสผ่าน"],
  notifications:["การแจ้งเตือน","คำขอ การอนุมัติ และการเปลี่ยนแปลงที่เกี่ยวข้องกับบัญชีของคุณ"],
  setup:["ตั้งค่าสถานศึกษา","ตรวจความพร้อมหลังนำเข้า LEC เชื่อม Google Drive และตั้งค่าการใช้งาน"],
  organization:["อปท. และสถานศึกษา","โครงสร้างองค์กรและโรงเรียนในแพลตฟอร์ม"],
  users:["ผู้ใช้และสิทธิ์","คำขอเข้าใช้งาน บทบาท และขอบเขตสิทธิ์"],
  lec:["นำเข้าข้อมูล LEC","นำเข้า XLS/XLSX โดยระบบเลือกชีตที่มีข้อมูลสถานศึกษาครบและรักษาประวัติทุกปีการศึกษา"],
  personnel:["บุคลากร","ข้อมูลบุคลากรต้นทางสำหรับทุกระบบ"],
  students:["นักเรียน","ค้นหาและดูข้อมูลนักเรียนจาก LEC ตามปีการศึกษา ชั้น และห้อง"],
  academics:["งานวิชาการ","ปีการศึกษา ชั้นเรียน รายวิชา โครงสร้างเวลาเรียน และภาระงานสอน"],
  assessment:["ทะเบียนและวัดผล","คะแนน ผลการเรียน GPA/GPAX และเอกสารการศึกษา"],
  documents:["เอกสารและไฟล์","Google Drive แยกตามสถานศึกษา พร้อม metadata กลาง"],
  website:["เว็บไซต์สถานศึกษา","เว็บไซต์แต่ละโรงเรียนจากข้อมูลชุดเดียวกัน"],
  forms:["แบบฟอร์มและงาน","แบบประเมิน แบบสอบถาม แบบทดสอบ และ Workflow"],
  reports:["รายงานและ Dashboard","รายงานระดับโรงเรียนและระดับ อปท."]
};
const roleLabels={
  platform_admin:"ผู้ดูแลแพลตฟอร์ม",organization_admin:"ผู้ดูแล อปท.",organization_viewer:"ผู้ดูข้อมูลระดับ อปท.",
  school_admin:"ผู้ดูแลสถานศึกษา",school_executive:"ผู้บริหารสถานศึกษา",registrar:"งานทะเบียน",
  academic_officer:"งานวิชาการ",teacher:"ครู",staff:"บุคลากร",student:"นักเรียน",guardian:"ผู้ปกครอง"
};
const modules=[
  ["🏛","Core Organization","อปท. โรงเรียน ปีการศึกษา ภาคเรียน","Phase 1"],
  ["🛡️","Auth & Permission","ลงทะเบียน อนุมัติ บทบาท และขอบเขตสิทธิ์","Phase 1"],
  ["🪪","Personnel","บุคลากร ตำแหน่ง วิทยฐานะ และหน้าที่ในฝ่าย","Phase 2"],
  ["🎓","Student Registry","นักเรียน ผู้ปกครอง ห้องเรียน ประวัติการศึกษา","Phase 2"],
  ["📚","Academic","หลักสูตร รายวิชา ภาระงานสอน และตารางเรียน","Phase 3"],
  ["📝","Assessment","คะแนน ผลการเรียน GPA/GPAX และการตัดสินผล","Phase 4"],
  ["📄","ปพ. & Records","เอกสารทางการศึกษาและรายงานผล","Phase 4"],
  ["🌐","School Website","ข่าว กิจกรรม บุคลากร สถิติ และข้อมูลสาธารณะ","Phase 5"],
  ["☑","Forms & Tasks","แบบสอบถาม แบบประเมิน แบบทดสอบ และ Workflow","Phase 5"],
  ["🤝","Student Care","ระบบดูแลช่วยเหลือ เยี่ยมบ้าน และการส่งต่อ","Phase 6"],
  ["✅","QA / SAR","ประกันคุณภาพและหลักฐานจากข้อมูลจริง","Phase 6"],
  ["📊","Executive Dashboard","วิเคราะห์ระดับโรงเรียนและ อปท.","Phase 7"],
  ["🔎","Smart Search / AI","ค้นและสรุปข้อมูลตามสิทธิ์ของผู้ใช้","Phase 8"]
];

const q=(s,r=document)=>r.querySelector(s);
const qa=(s,r=document)=>Array.from(r.querySelectorAll(s));
const esc=v=>String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
function renderAppVersion(){
  qa("[data-app-version]").forEach(el=>{
    el.textContent=APP_VERSION_LABEL;
    el.title="LAO-EMS รุ่น "+APP_VERSION;
  });
}
async function checkLatestVersion(){
  try{
    const res=await fetch("./VERSION?t="+Date.now(),{cache:"no-store"});
    if(!res.ok)return;
    const latest=(await res.text()).trim();
    if(!/^\d+\.\d+\.\d+$/.test(latest))return;
    if(latest===APP_VERSION){
      qa("[data-app-version]").forEach(el=>{
        el.classList.remove("is-outdated");
        el.title="รุ่นปัจจุบัน "+APP_VERSION_LABEL;
      });
      return;
    }
    qa("[data-app-version]").forEach(el=>{
      el.classList.add("is-outdated");
      el.title="กำลังใช้ "+APP_VERSION_LABEL+" · รุ่นล่าสุด v"+latest;
    });
    if(!q("#version-update-notice")){
      const notice=document.createElement("button");
      notice.id="version-update-notice";
      notice.type="button";
      notice.className="version-update-notice";
      notice.innerHTML='<strong>มีรุ่นใหม่ v'+esc(latest)+'</strong><span>กำลังใช้ '+esc(APP_VERSION_LABEL)+' · แตะเพื่อโหลดรุ่นล่าสุด</span>';
      notice.addEventListener("click",()=>location.reload());
      document.body.appendChild(notice);
    }
  }catch(_){}
}

function ensurePullRefreshIndicator(){
  let indicator=q("#pull-refresh-indicator");
  if(indicator)return indicator;
  indicator=document.createElement("div");
  indicator.id="pull-refresh-indicator";
  indicator.className="pull-refresh-indicator";
  indicator.setAttribute("aria-live","polite");
  indicator.innerHTML='<span class="pull-refresh-icon" aria-hidden="true">↻</span><span class="pull-refresh-label">ดึงลงเพื่อรีเฟรช</span>';
  document.body.appendChild(indicator);
  return indicator;
}
function setPullRefreshState(stateName,distance){
  const indicator=ensurePullRefreshIndicator();
  const label=q(".pull-refresh-label",indicator);
  indicator.dataset.state=stateName;
  if(typeof distance==="number"){
    indicator.style.setProperty("--pull-distance",Math.max(0,Math.min(distance,112))+"px");
  }
  if(stateName==="ready")label.textContent="ปล่อยเพื่อรีเฟรช";
  else if(stateName==="refreshing")label.textContent="กำลังโหลดรุ่นล่าสุด...";
  else label.textContent="ดึงลงเพื่อรีเฟรช";
}
async function clearLaoEmsRuntimeCache(){
  if(!("caches" in window))return;
  try{
    const keys=await caches.keys();
    const own=keys.filter(name=>/lao[-_ ]?ems/i.test(name));
    await Promise.all(own.map(name=>caches.delete(name)));
  }catch(_){}
}
async function unregisterLaoServiceWorkers(){
  if(!("serviceWorker" in navigator))return;
  try{
    const regs=await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.filter(reg=>{
      try{
        const scope=new URL(reg.scope);
        return scope.origin===location.origin&&location.pathname.startsWith(scope.pathname);
      }catch(_){return false;}
    }).map(async reg=>{
      try{await reg.update();}catch(_){}
      try{await reg.unregister();}catch(_){}
    }));
  }catch(_){}
}
async function forceRefreshCurrentPage(){
  setPullRefreshState("refreshing",92);
  await unregisterLaoServiceWorkers();
  await clearLaoEmsRuntimeCache();
  const stamp=Date.now();
  try{
    await fetch("./VERSION?hard_refresh="+stamp,{cache:"no-store",headers:{"cache-control":"no-cache"}});
    await fetch("./index.html?hard_refresh="+stamp,{cache:"no-store",headers:{"cache-control":"no-cache"}});
  }catch(_){}
  const url=new URL("./index.html",location.href);
  url.searchParams.set("hard_refresh",String(stamp));
  url.hash=location.hash||"#/overview";
  location.replace(url.toString());
}
function bindPullToRefresh(){
  if(!("ontouchstart" in window)&&!(navigator.maxTouchPoints>0))return;
  const indicator=ensurePullRefreshIndicator();
  let startY=0,startX=0,pulling=false,armed=false;
  const threshold=82;
  const reset=()=>{
    if(indicator.dataset.state==="refreshing")return;
    pulling=false;armed=false;
    indicator.classList.remove("is-visible");
    setPullRefreshState("idle",0);
  };
  document.addEventListener("touchstart",event=>{
    if(state.lecImporting)return;
    if(event.touches.length!==1)return;
    if(window.scrollY>0||document.documentElement.scrollTop>0)return;
    const target=event.target;
    if(target&&target.closest&&target.closest("input,textarea,select,button,a,[contenteditable='true'],.table-wrap,.modal"))return;
    startY=event.touches[0].clientY;
    startX=event.touches[0].clientX;
    pulling=true;armed=false;
  },{passive:true});
  document.addEventListener("touchmove",event=>{
    if(!pulling||event.touches.length!==1)return;
    const dy=event.touches[0].clientY-startY;
    const dx=Math.abs(event.touches[0].clientX-startX);
    if(dy<=0||dx>dy){reset();return;}
    if(window.scrollY>0||document.documentElement.scrollTop>0){reset();return;}
    if(dy<8)return;
    event.preventDefault();
    const resisted=Math.min(112,dy*.58);
    armed=resisted>=threshold;
    indicator.classList.add("is-visible");
    setPullRefreshState(armed?"ready":"pulling",resisted);
  },{passive:false});
  document.addEventListener("touchend",()=>{
    if(!pulling)return;
    const shouldRefresh=armed;
    pulling=false;armed=false;
    if(shouldRefresh){void forceRefreshCurrentPage();}
    else reset();
  },{passive:true});
  document.addEventListener("touchcancel",reset,{passive:true});
}


function toast(message,type){
  const box=document.createElement("div");
  box.className="toast "+(type||"");
  box.textContent=message;
  q("#toast-region").appendChild(box);
  setTimeout(()=>box.remove(),4200);
}
function setBusy(button,busy,label){
  if(!button)return;
  if(busy){button.dataset.oldLabel=button.textContent;button.disabled=true;button.innerHTML='<span class="spinner"></span>'+(label||"กำลังดำเนินการ...");}
  else{button.disabled=false;button.textContent=button.dataset.oldLabel||button.textContent;}
}
function routeName(){return (location.hash.replace(/^#\//,"").split("/")[0]||"overview").toLowerCase();}
function schoolAdminApplyToken(){
  const m=location.hash.match(/^#\/apply-school-admin\/([A-Za-z0-9_-]{20,})$/);
  return m?m[1]:null;
}
function personnelJoinToken(){
  const token=new URLSearchParams(location.search).get("personnel_join");
  return token&&/^[A-Za-z0-9_-]{30,}$/.test(token)?token:null;
}
function clearPersonnelJoinQuery(){
  const url=new URL(location.href);
  url.searchParams.delete("personnel_join");
  history.replaceState(null,"",url.pathname+(url.searchParams.toString()?"?"+url.searchParams.toString():"")+url.hash);
}
function roleCodes(m){
  const x=m||state.currentMembership;
  return (x&&x.lao_membership_roles||[]).map(v=>v.lao_roles&&v.lao_roles.code).filter(Boolean);
}
function roleNames(m){
  const list=roleCodes(m).map(c=>roleLabels[c]||c);
  if(state.isPlatformAdmin&&!list.includes(roleLabels.platform_admin))list.unshift(roleLabels.platform_admin);
  return list.length?list.join(" · "):"ยังไม่มีบทบาท";
}
function hasRole(){
  const wanted=Array.from(arguments),codes=roleCodes();
  if(state.isPlatformAdmin&&wanted.includes("platform_admin"))return true;
  return codes.some(c=>wanted.includes(c));
}
function isPlatformAdminMode(){return state.isPlatformAdmin&&state.viewMode==="admin";}
function isSchoolAdminContext(){
  return state.viewMode==="user"&&hasRole("school_admin")&&Boolean(state.currentMembership&&state.currentMembership.status==="active");
}
function schoolSetupReady(){return Boolean(state.schoolSetup&&state.schoolSetup.can_invite_users);}
function displayName(){
  const p=state.profile||{};
  return p.display_name||[p.prefix,p.first_name_th,p.last_name_th].filter(Boolean).join(" ")||(state.user&&state.user.email)||"ผู้ใช้งาน";
}
function initials(name){
  const parts=String(name||"ผู้").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]&&parts[0][0])||"ผู้")+((parts[1]&&parts[1][0])||"");
}
function loginAvatarUrl(){
  const u=state.user||{};
  const meta=u.user_metadata||{};
  const identity=(Array.isArray(u.identities)?u.identities:[]).find(x=>x&&x.provider==="google");
  const identityData=identity&&identity.identity_data||{};
  const candidates=[
    meta.avatar_url,
    meta.picture,
    identityData.avatar_url,
    identityData.picture
  ].filter(Boolean);
  for(const value of candidates){
    try{
      const url=new URL(String(value));
      if(url.protocol==="https:")return url.href;
    }catch(_){}
  }
  return "";
}
function avatarHtml(name,extraClass=""){
  const fallback=esc(initials(name).slice(0,2));
  const url=loginAvatarUrl();
  const cls=extraClass?(" "+extraClass):"";
  if(!url)return '<span class="avatar-fallback'+cls+'">'+fallback+'</span>';
  return '<img class="login-avatar-img'+cls+'" src="'+esc(url)+'" alt="รูปโปรไฟล์ '+esc(name)+'" referrerpolicy="no-referrer" data-login-avatar-img><span class="avatar-fallback hidden'+cls+'" data-avatar-fallback>'+fallback+'</span>';
}
function bindAvatarFallback(root=document){
  qa("[data-login-avatar-img]",root).forEach(img=>{
    if(img.dataset.bound==="1")return;
    img.dataset.bound="1";
    img.addEventListener("error",()=>{
      img.classList.add("hidden");
      const fallback=img.nextElementSibling;
      if(fallback)fallback.classList.remove("hidden");
    },{once:true});
  });
}
function currentSchool(){
  if(state.isPlatformAdmin&&state.viewMode==="admin")return state.adminSchool||null;
  return state.currentMembership&&state.currentMembership.lao_schools||null;
}
function currentOrg(){
  if(state.isPlatformAdmin&&state.viewMode==="admin")return state.adminSchool&&state.adminSchool.lao_organizations||null;
  return state.currentMembership&&state.currentMembership.lao_organizations||null;
}
function canViewStudentDirectory(){
  if(state.isPlatformAdmin&&state.viewMode==="admin")return Boolean(currentSchool());
  const allowed=["organization_admin","organization_viewer","school_admin","school_executive","registrar","academic_officer","teacher","staff"];
  return Boolean(currentSchool())&&roleCodes().some(code=>allowed.includes(code));
}
function canViewPersonnel(){
  if(state.isPlatformAdmin&&state.viewMode==="admin")return Boolean(currentSchool());
  const allowed=["organization_admin","organization_viewer","school_admin","school_executive","registrar","academic_officer","teacher","staff"];
  return Boolean(currentSchool())&&roleCodes().some(code=>allowed.includes(code));
}
function canViewAcademic(){
  if(state.isPlatformAdmin&&state.viewMode==="admin")return Boolean(currentSchool());
  const allowed=["organization_admin","organization_viewer","school_admin","school_executive","registrar","academic_officer","teacher","staff"];
  return Boolean(currentSchool())&&roleCodes().some(code=>allowed.includes(code));
}
function personnelTypeLabel(value){
  return ({
    executive:"ผู้บริหาร",
    teacher:"ครูผู้สอน",
    educational_staff:"บุคลากรทางการศึกษา",
    support_staff:"บุคลากรสนับสนุน",
    contract_employee:"พนักงานจ้างเหมาบริการ",
    general_employee:"พนักงานจ้างทั่วไป",
    other:"อื่น ๆ"
  })[value]||value||"-";
}
function employmentStatusLabel(value){
  return ({
    active:"ปฏิบัติงาน",
    leave:"ลา/พักปฏิบัติงาน",
    transferred:"ย้าย",
    retired:"เกษียณ",
    resigned:"ลาออก",
    ended:"สิ้นสุดการจ้าง",
    other:"อื่น ๆ"
  })[value]||value||"-";
}
function personnelSourceLabel(value){
  return value==="account"?"จากบัญชีผู้ใช้":value==="import"?"นำเข้า":"เพิ่มในระบบ";
}
function personnelRouteState(){
  const hash=location.hash||"#/personnel";
  if(/^#\/personnel\/registry\/?$/i.test(hash))return {mode:"registry",id:null};
  if(/^#\/personnel\/requests\/?$/i.test(hash))return {mode:"requests",id:null};
  if(/^#\/personnel\/intake\/?$/i.test(hash))return {mode:"intake",id:null};
  if(/^#\/personnel\/authorities\/?$/i.test(hash))return {mode:"authorities",id:null};
  if(/^#\/personnel\/new\/?$/i.test(hash))return {mode:"new",id:null};
  const edit=hash.match(/^#\/personnel\/([0-9a-f-]{36})\/edit\/?$/i);
  if(edit)return {mode:"edit",id:edit[1]};
  const detail=hash.match(/^#\/personnel\/([0-9a-f-]{36})\/?$/i);
  if(detail)return {mode:"detail",id:detail[1]};
  return {mode:"dashboard",id:null};
}
function personnelAvatarHtml(item,extraClass=""){
  const name=item&&item.full_name||[item&&item.prefix,item&&item.first_name_th,item&&item.last_name_th].filter(Boolean).join(" ")||"บุคลากร";
  const fallback=esc(initials(name).slice(0,2));
  const cls=extraClass?(" "+extraClass):"";
  const raw=item&&item.avatar_url;
  if(!raw)return '<span class="avatar-fallback'+cls+'">'+fallback+'</span>';
  try{
    const url=new URL(String(raw));
    if(url.protocol!=="https:")throw new Error("invalid");
    return '<img class="login-avatar-img'+cls+'" src="'+esc(url.href)+'" alt="รูป '+esc(name)+'" referrerpolicy="no-referrer" data-login-avatar-img><span class="avatar-fallback hidden'+cls+'" data-avatar-fallback>'+fallback+'</span>';
  }catch(_){
    return '<span class="avatar-fallback'+cls+'">'+fallback+'</span>';
  }
}
function shortGrade(value){
  const v=String(value||"");
  const m=v.match(/ประถมศึกษาปีที่\s*(\d+)/);if(m)return "ป."+m[1];
  const k=v.match(/อนุบาล\s*(\d+)/);if(k)return "อ."+k[1];
  const s=v.match(/มัธยมศึกษาปีที่\s*(\d+)/);if(s)return "ม."+s[1];
  return v||"-";
}
function studentPresenceLabel(value){
  return value==="present"?"กำลังเรียน":value==="not_in_latest_lec"?"ไม่พบใน LEC ล่าสุด":value||"-";
}
function registryLabel(value){
  return ({enrolled:"กำลังศึกษา",transferred_out:"ย้ายออก",graduated:"จบการศึกษา",withdrawn:"ลาออก",deceased:"เสียชีวิต",other:"อื่น ๆ"})[value]||value||"-";
}
function thaiDate(value){
  if(!value)return "-";
  const d=new Date(String(value).includes("T")?value:(value+"T00:00:00"));
  return Number.isNaN(d.getTime())?String(value):new Intl.DateTimeFormat("th-TH-u-ca-buddhist",{day:"numeric",month:"short",year:"numeric"}).format(d);
}
function thaiDateTime(value){
  if(!value)return "-";
  const d=new Date(value);
  return Number.isNaN(d.getTime())?String(value):new Intl.DateTimeFormat("th-TH-u-ca-buddhist",{dateStyle:"medium",timeStyle:"short"}).format(d);
}
const THAI_MONTHS=["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
function buddhistDateParts(value){
  const m=String(value||"").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!m)return null;
  return {day:Number(m[3]),month:Number(m[2]),yearBe:Number(m[1])+543};
}
function buddhistDateControlHtml(name,value){
  const iso=String(value||"");
  const parts=buddhistDateParts(iso);
  const dayOptions=Array.from({length:31},(_,i)=>'<option value="'+(i+1)+'">'+(i+1)+'</option>').join("");
  const monthOptions=THAI_MONTHS.map((m,i)=>'<option value="'+(i+1)+'">'+m+'</option>').join("");
  return '<div class="be-date-control" data-be-date-control>'+
    '<input type="hidden" name="'+esc(name)+'" value="'+esc(iso)+'" data-be-date-value>'+
    '<button type="button" class="be-date-trigger" data-be-date-trigger aria-expanded="false"><span data-be-date-label>'+(parts?esc(thaiDate(iso)):'เลือกวันที่ (พ.ศ.)')+'</span><span class="be-date-chevron" aria-hidden="true">⌄</span></button>'+
    '<div class="be-date-picker hidden" data-be-date-picker>'+
      '<div class="be-date-picker-head"><strong>เลือกวันที่</strong><span>พุทธศักราช (พ.ศ.)</span></div>'+
      '<div class="be-date-grid">'+
        '<label>วัน<select data-be-day><option value="">วัน</option>'+dayOptions+'</select></label>'+
        '<label>เดือน<select data-be-month><option value="">เดือน</option>'+monthOptions+'</select></label>'+
        '<label>ปี พ.ศ.<input type="number" min="2400" max="2800" inputmode="numeric" data-be-year placeholder="เช่น 2569"></label>'+
      '</div>'+
      '<div class="be-date-picker-actions"><button type="button" class="secondary-btn compact-btn" data-be-clear>ล้าง</button><button type="button" class="primary-btn compact-btn" data-be-apply>ตกลง</button></div>'+
    '</div>'+
  '</div>';
}
function setBuddhistDateControlValue(control,value,emit){
  if(!control)return;
  const hidden=q("[data-be-date-value]",control),label=q("[data-be-date-label]",control);
  const iso=String(value||"");
  if(hidden)hidden.value=iso;
  if(label)label.textContent=iso?thaiDate(iso):"เลือกวันที่ (พ.ศ.)";
  const parts=buddhistDateParts(iso);
  const day=q("[data-be-day]",control),month=q("[data-be-month]",control),year=q("[data-be-year]",control);
  if(day)day.value=parts?String(parts.day):"";
  if(month)month.value=parts?String(parts.month):"";
  if(year)year.value=parts?String(parts.yearBe):"";
  if(emit&&hidden)hidden.dispatchEvent(new Event("change",{bubbles:true}));
}
function refreshBuddhistDatePickers(root=document){
  qa("[data-be-date-control]",root).forEach(control=>{
    const hidden=q("[data-be-date-value]",control);
    setBuddhistDateControlValue(control,hidden&&hidden.value||"",false);
  });
}
function bindBuddhistDatePickers(root=document){
  qa("[data-be-date-control]",root).forEach(control=>{
    if(control.dataset.beBound==="1")return;
    control.dataset.beBound="1";
    const hidden=q("[data-be-date-value]",control);
    const trigger=q("[data-be-date-trigger]",control);
    const picker=q("[data-be-date-picker]",control);
    const day=q("[data-be-day]",control),month=q("[data-be-month]",control),year=q("[data-be-year]",control);
    const apply=q("[data-be-apply]",control),clear=q("[data-be-clear]",control);
    const close=()=>{if(picker)picker.classList.add("hidden");if(trigger)trigger.setAttribute("aria-expanded","false");};
    const open=()=>{
      if(!picker)return;
      const hasValue=Boolean(hidden&&hidden.value);
      if(!hasValue){
        const now=new Date();
        if(day)day.value=String(now.getDate());
        if(month)month.value=String(now.getMonth()+1);
        if(year)year.value=String(now.getFullYear()+543);
      }else setBuddhistDateControlValue(control,hidden.value,false);
      picker.classList.remove("hidden");
      if(trigger)trigger.setAttribute("aria-expanded","true");
    };
    if(trigger)trigger.addEventListener("click",()=>picker&&picker.classList.contains("hidden")?open():close());
    if(clear)clear.addEventListener("click",()=>{setBuddhistDateControlValue(control,"",true);close();});
    if(apply)apply.addEventListener("click",()=>{
      const d=Number(day&&day.value),m=Number(month&&month.value),be=Number(year&&year.value);
      if(!d||!m||!be){toast("กรุณาเลือกวัน เดือน และปี พ.ศ. ให้ครบ","error");return;}
      if(be<2400||be>2800){toast("ปี พ.ศ. ต้องอยู่ระหว่าง 2400–2800","error");return;}
      const ce=be-543;
      const test=new Date(ce,m-1,d,12,0,0);
      if(test.getFullYear()!==ce||test.getMonth()!==m-1||test.getDate()!==d){toast("วันที่ที่เลือกไม่ถูกต้อง","error");return;}
      const iso=String(ce).padStart(4,"0")+"-"+String(m).padStart(2,"0")+"-"+String(d).padStart(2,"0");
      setBuddhistDateControlValue(control,iso,true);
      close();
    });
    setBuddhistDateControlValue(control,hidden&&hidden.value||"",false);
  });
}
function money(value){
  if(value==null||value==="")return "-";
  const n=Number(value);
  return Number.isFinite(n)?n.toLocaleString("th-TH",{maximumFractionDigits:2})+" บาท":String(value);
}
function relationLabel(value){
  return ({father:"บิดา",mother:"มารดา",guardian:"ผู้ปกครอง"})[value]||value||"-";
}
function addressLabel(value){
  return value==="registered"?"ที่อยู่ตามทะเบียนบ้าน":value==="current"?"ที่อยู่ปัจจุบัน":value||"ที่อยู่";
}
function formatAddress(a){
  if(!a)return "-";
  return [
    a.house_no?"เลขที่ "+a.house_no:"",
    a.moo?"หมู่ "+a.moo:"",
    a.road?"ถนน "+a.road:"",
    a.subdistrict?"ตำบล/แขวง "+a.subdistrict:"",
    a.district?"อำเภอ/เขต "+a.district:"",
    a.province?"จังหวัด "+a.province:"",
    a.postal_code||""
  ].filter(Boolean).join(" ")||"-";
}
function hasDisplayValue(value){
  if(value==null)return false;
  if(typeof value==="string")return value.trim()!=="";
  return true;
}
function isGoogleAuthUser(){
  const u=state.user||{};
  const providers=(u.app_metadata&&u.app_metadata.providers)||[];
  if(Array.isArray(providers)&&providers.includes("google"))return true;
  return Array.isArray(u.identities)&&u.identities.some(x=>x&&x.provider==="google");
}
function isStandalonePwa(){
  return Boolean(
    (window.matchMedia&&window.matchMedia("(display-mode: standalone)").matches)
    || window.navigator.standalone===true
  );
}
async function detectPwaInstalled(){
  if(isStandalonePwa()){
    localStorage.setItem("lao_pwa_installed","1");
    state.pwaInstalled=true;
    return true;
  }
  try{
    if(typeof navigator.getInstalledRelatedApps==="function"){
      const apps=await navigator.getInstalledRelatedApps();
      if(Array.isArray(apps)&&apps.length){
        localStorage.setItem("lao_pwa_installed","1");
        state.pwaInstalled=true;
        return true;
      }
    }
  }catch(_){}
  state.pwaInstalled=localStorage.getItem("lao_pwa_installed")==="1";
  return state.pwaInstalled;
}
function installCardHtml(){
  if(state.pwaInstalled||isStandalonePwa())return "";
  const ios=/iphone|ipad|ipod/i.test(navigator.userAgent||"");
  return '<section class="pwa-install-card" data-pwa-install-card><div class="pwa-install-icon">L</div><div class="pwa-install-copy"><p class="eyebrow">WEB APP</p><h2>ติดตั้ง LAO-EMS บนอุปกรณ์นี้</h2><p>'+(ios?'เพิ่มไว้บนหน้าจอโฮมเพื่อเปิดใช้งานเหมือนแอป และเข้าระบบได้สะดวกขึ้น':'ติดตั้งเป็น Web App เพื่อเปิดจากหน้าจอหลักหรือเดสก์ท็อปได้ทันที')+'</p></div><button class="primary-btn" type="button" data-pwa-install>'+(ios?'วิธีติดตั้ง':'ติดตั้งแอป')+'</button></section>';
}
function bindPwaInstallCard(){
  const btn=q("[data-pwa-install]");if(!btn)return;
  btn.addEventListener("click",async()=>{
    if(state.installPrompt){
      const promptEvent=state.installPrompt;
      state.installPrompt=null;
      await promptEvent.prompt();
      const choice=await promptEvent.userChoice.catch(()=>null);
      if(choice&&choice.outcome==="accepted"){
        localStorage.setItem("lao_pwa_installed","1");
        state.pwaInstalled=true;
        toast("กำลังติดตั้ง LAO-EMS บนอุปกรณ์นี้","success");
        renderRoute();
      }
      return;
    }
    const ios=/iphone|ipad|ipod/i.test(navigator.userAgent||"");
    if(ios)toast("บน iPhone/iPad: แตะปุ่มแชร์ แล้วเลือก “เพิ่มไปยังหน้าจอโฮม”","success");
    else toast("เปิดเมนูของเบราว์เซอร์ แล้วเลือก “ติดตั้งแอป” หรือ “Add to Home screen”","success");
  });
}
function bindPwaRuntime(){
  if("serviceWorker" in navigator){
    window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js?v="+encodeURIComponent(APP_VERSION),{scope:"./",updateViaCache:"none"}).catch(err=>console.error("PWA service worker",err)),{once:true});
  }
  window.addEventListener("beforeinstallprompt",event=>{
    event.preventDefault();
    state.installPrompt=event;
    state.pwaInstalled=false;
    localStorage.removeItem("lao_pwa_installed");
    if(state.user&&routeName()==="overview")renderRoute();
  });
  window.addEventListener("appinstalled",()=>{
    localStorage.setItem("lao_pwa_installed","1");
    state.pwaInstalled=true;
    state.installPrompt=null;
    if(state.user&&routeName()==="overview")renderRoute();
  });
}
async function signInWithGoogle(){
  const btn=q("[data-google-signin]");if(!btn)return;
  const remember=q('#signin-form input[name="remember_login"]');
  if(remember&&remember.checked)localStorage.setItem("lao_remember_login","1");
  else localStorage.removeItem("lao_remember_login");
  setBusy(btn,true,"กำลังเปิด Google...");
  const redirectPath=location.pathname.endsWith("/")?location.pathname:location.pathname.replace(/\/[^/]*$/,"/");
  const res=await supabase.auth.signInWithOAuth({
    provider:"google",
    options:{
      redirectTo:new URL(redirectPath,location.origin).href,
      queryParams:{prompt:"select_account"}
    }
  });
  if(res.error){
    setBusy(btn,false);
    toast("เข้าสู่ระบบด้วย Google ไม่สำเร็จ: "+res.error.message,"error");
  }
}

function bindManualRefresh(){
  qa("[data-manual-refresh]").forEach(btn=>{
    if(btn.dataset.bound==="1")return;
    btn.dataset.bound="1";
    btn.addEventListener("click",async()=>{
      if(state.lecImporting){toast("กำลังนำเข้า LEC กรุณารอจนกว่าระบบจะแจ้งว่าเสร็จ","error");return;}
      setBusy(btn,true,"");
      btn.classList.add("is-refreshing");
      btn.setAttribute("aria-label","กำลังรีเฟรช");
      await forceRefreshCurrentPage();
    });
  });
}

function bindStaticUI(){
  q("#signin-form").addEventListener("submit",signIn);
  const googleBtn=q("[data-google-signin]");
  if(googleBtn)googleBtn.addEventListener("click",signInWithGoogle);
  bindPasswordToggles();
  /* password toggles are bound once by bindPasswordToggles */
  qa("[data-password-toggle]").filter(button=>button.dataset.bound!=="1").forEach(button=>button.addEventListener("click",()=>{
    const field=button.closest(".input-with-action, .password-field");
    const input=field&&field.querySelector("[data-password-input]");
    if(!input)return;
    const show=input.type==="password";
    input.type=show?"text":"password";
    button.classList.toggle("is-visible",show);
    button.setAttribute("aria-pressed",String(show));
    button.setAttribute("aria-label",show?"ซ่อนรหัสผ่าน":"แสดงรหัสผ่าน");
  }));
  qa("[data-view-mode]").forEach(button=>button.addEventListener("click",()=>{
    if(!state.isPlatformAdmin)return;
    state.viewMode=button.dataset.viewMode==="admin"?"admin":"user";
    localStorage.setItem("lao_view_mode",state.viewMode);
    refreshHeader();
    renderTenants();
    if(state.viewMode==="user"&&!["overview","membership","notifications"].includes(routeName())){
      location.hash="#/overview";
    }else{
      renderRoute();
    }
  }));
  const sidebar=q("#sidebar"),scrim=q("[data-scrim]");
  q("[data-sidebar-open]").addEventListener("click",()=>{sidebar.classList.add("open");scrim.classList.add("show");});
  const close=()=>{sidebar.classList.remove("open");scrim.classList.remove("show");};
  q("[data-sidebar-close]").addEventListener("click",close);
  scrim.addEventListener("click",close);
  window.addEventListener("hashchange",()=>{if(!location.hash.startsWith("#/academics/classes")){state.classProgramEditMode=false;state.classStageFilter="";}if(!location.hash.startsWith("#/academics/subjects")){state.subjectEditMode=false;state.subjectCopyYearId="";}if(state.user)renderRoute();else showAuth();close();});
  q("[data-signout]").addEventListener("click",()=>{
    localStorage.setItem("lao_legacy_session_rejected","1");
    clearLaoAuthSession();
    location.reload();
  });
  const profileButton=q(".profile-btn");
  if(profileButton)profileButton.addEventListener("click",()=>{location.hash="#/profile";});
  q("#tenant-select").addEventListener("change",async e=>{
    const value=e.target.value;
    if(state.isPlatformAdmin&&state.viewMode==="admin"){
      const id=value.startsWith("admin:")?value.slice(6):"";
      state.adminSchool=state.adminSchools.find(s=>s.id===id)||null;
      if(state.adminSchool)localStorage.setItem("lao_admin_school",state.adminSchool.id);
      else localStorage.removeItem("lao_admin_school");
      state.academicYearId=null;state.academicTermId=null;state.academicData=null;state.teachingWorkloadData=null;state.teachingWorkloadPersonnelId=null;
      await Promise.all([loadPersonnelWorkCounts(),loadAcademicWorkCounts()]);refreshHeader();renderRoute();return;
    }
    const m=state.memberships.find(x=>x.id===value&&x.status==="active");
    if(m){state.currentMembership=m;localStorage.setItem("lao_current_membership",m.id);state.academicYearId=null;state.academicTermId=null;state.academicData=null;state.teachingWorkloadData=null;state.teachingWorkloadPersonnelId=null;await Promise.all([loadPersonnelWorkCounts(),loadAcademicWorkCounts()]);refreshHeader();renderRoute();}
  });
}


function joinPositionOptions(selected){
  const rows=[
    ["director","ผู้อำนวยการสถานศึกษา"],
    ["deputy","รองผู้อำนวยการสถานศึกษา"],
    ["teacher","ครู"],
    ["educational_staff","บุคลากรทางการศึกษา"],
    ["support_staff","เจ้าหน้าที่ / บุคลากรสนับสนุน"],
    ["employee","พนักงานจ้าง"],
    ["__custom__","ระบุเอง"]
  ];
  return rows.map(([v,l])=>'<option value="'+v+'" '+(selected===v?"selected":"")+'>'+l+'</option>').join("");
}
function joinAcademicStandingOptions(selected){
  const rows=[
    ["","ไม่มี / ไม่ระบุ"],
    ["ครูผู้ช่วย","ครูผู้ช่วย"],
    ["ครู","ครู"],
    ["ครูชำนาญการ","ครูชำนาญการ"],
    ["ครูชำนาญการพิเศษ","ครูชำนาญการพิเศษ"],
    ["ครูเชี่ยวชาญ","ครูเชี่ยวชาญ"],
    ["ครูเชี่ยวชาญพิเศษ","ครูเชี่ยวชาญพิเศษ"],
    ["__custom__","ระบุเอง"]
  ];
  return rows.map(([v,l])=>'<option value="'+v+'" '+(selected===v?"selected":"")+'>'+l+'</option>').join("");
}
function joinPositionData(choice,custom){
  const map={
    director:{personnel_type:"executive",position_title:"ผู้อำนวยการสถานศึกษา"},
    deputy:{personnel_type:"executive",position_title:"รองผู้อำนวยการสถานศึกษา"},
    teacher:{personnel_type:"teacher",position_title:"ครู"},
    educational_staff:{personnel_type:"educational_staff",position_title:"บุคลากรทางการศึกษา"},
    support_staff:{personnel_type:"support_staff",position_title:"เจ้าหน้าที่ / บุคลากรสนับสนุน"},
    employee:{personnel_type:"contract_employee",position_title:"พนักงานจ้าง"}
  };
  if(choice==="__custom__")return {personnel_type:"other",position_title:String(custom||"").trim()};
  return map[choice]||{personnel_type:"other",position_title:String(custom||"").trim()};
}
function publicJoinStatusHtml(request,schoolName){
  if(!request)return "";
  if(request.status==="pending_review"){
    return '<div class="join-status-card waiting"><div class="join-status-icon">⏳</div><h2>ส่งคำขอแล้ว</h2><p>ยืนยันอีเมลเรียบร้อย และส่งคำขอเข้าร่วม <strong>'+esc(schoolName||"สถานศึกษา")+'</strong> แล้ว</p><div class="join-step-list"><span class="done">✓ ยืนยันอีเมลแล้ว</span><span class="done">✓ ส่งข้อมูลแล้ว</span><span class="current">3 รอฝ่ายบุคลากร / School Admin ตรวจสอบ</span></div><div class="notice">ไม่ต้องสมัครซ้ำ เมื่อผู้เกี่ยวข้องอนุมัติแล้วจึงสามารถเข้าใช้ LAO-EMS ของโรงเรียนได้</div></div>';
  }
  if(request.status==="approved"){
    return '<div class="join-status-card approved"><div class="join-status-icon">✓</div><h2>อนุมัติแล้ว</h2><p>บัญชีของคุณได้รับอนุมัติและเชื่อมกับทะเบียนบุคลากรของ <strong>'+esc(schoolName||"สถานศึกษา")+'</strong> แล้ว</p><button class="primary-btn wide" type="button" data-join-enter-app>เข้าสู่ระบบ LAO-EMS</button></div>';
  }
  if(request.status==="rejected"){
    return '<div class="join-status-card rejected"><div class="join-status-icon">!</div><h2>คำขอยังไม่ได้รับอนุมัติ</h2><p>'+esc(request.rejection_reason||"กรุณาติดต่อฝ่ายบุคลากรของโรงเรียนเพื่อตรวจสอบข้อมูล")+'</p><button class="secondary-btn wide" type="button" data-join-reapply>ตรวจข้อมูลและยื่นใหม่</button></div>';
  }
  return '<div class="join-status-card"><h2>สถานะคำขอ</h2><p>'+esc(request.status||"-")+'</p></div>';
}
async function renderPublicPersonnelJoin(token,session=null,forceForm=false){
  const box=q("#personnel-join-screen"); if(!box)return;
  box.classList.remove("hidden");
  box.innerHTML='<div class="loading-inline"><span class="spinner"></span>กำลังตรวจสอบลิงก์...</div>';

  const infoRes=await supabase.rpc("lao_public_personnel_join_link",{p_token:token});
  if(infoRes.error){
    box.innerHTML='<div class="form-heading"><h2>เปิดลิงก์ไม่สำเร็จ</h2><p>'+esc(infoRes.error.message)+'</p></div>';
    return;
  }
  const info=infoRes.data||{};

  if(session&&session.user){
    const myRes=await supabase.rpc("lao_my_personnel_join_request",{p_token:token});
    if(!myRes.error&&myRes.data&&!forceForm){
      const statusHtml=publicJoinStatusHtml(myRes.data,info.school_name);
      box.innerHTML=statusHtml;
      const enter=q("[data-join-enter-app]",box);
      if(enter)enter.addEventListener("click",async()=>{
        clearPersonnelJoinQuery();
        await showApp(session);
      });
      const reapply=q("[data-join-reapply]",box);
      if(reapply)reapply.addEventListener("click",()=>renderPublicPersonnelJoin(token,session,true));
      return;
    }
  }

  if(!info.valid){
    const msg=info.reason==="closed"?"ขณะนี้โรงเรียนปิดรับคำขอเข้าร่วมผ่านลิงก์นี้ กรุณาติดต่อฝ่ายบุคลากร":info.reason==="school_inactive"?"สถานศึกษานี้ยังไม่พร้อมใช้งาน":"ไม่พบลิงก์รับสมัครนี้";
    box.innerHTML='<div class="join-status-card rejected"><div class="join-status-icon">!</div><h2>ยังไม่เปิดรับสมัคร</h2><p>'+esc(msg)+'</p></div>';
    return;
  }

  if(!session||!session.user){
    box.innerHTML='<div class="form-heading"><p class="eyebrow">PERSONNEL JOIN</p><h2>เข้าร่วม '+esc(info.school_name||"สถานศึกษา")+'</h2><p>กรอกอีเมลของคุณ ระบบจะส่งลิงก์ยืนยันไปยังอีเมลก่อนให้กรอกข้อมูลบุคลากร</p></div>'+
      '<div class="join-flow-steps"><span class="current">1 ยืนยันอีเมล</span><span>2 กรอกข้อมูล</span><span>3 รออนุมัติ</span></div>'+
      '<form id="personnel-join-email-form" class="auth-form"><label class="form-field"><span>อีเมล <span class="required-mark">*</span></span><input name="email" type="email" autocomplete="email" required placeholder="name@example.com"></label><button class="primary-btn wide" type="submit">ส่งลิงก์ยืนยันอีเมล</button></form>'+
      '<p class="google-login-note">ใช้ลิงก์ที่ได้รับทางอีเมลเพื่อยืนยันว่าอีเมลนี้เป็นของคุณจริง จากนั้นระบบจะพากลับมากรอกข้อมูลต่อ</p>';
    const form=q("#personnel-join-email-form",box);
    form.addEventListener("submit",async e=>{
      e.preventDefault();
      const fd=new FormData(form),btn=form.querySelector("button[type=submit]");
      const email=String(fd.get("email")||"").trim().toLowerCase();
      const redirect=new URL(location.pathname,location.origin);
      redirect.searchParams.set("personnel_join",token);
      setBusy(btn,true,"กำลังส่ง...");
      const res=await supabase.auth.signInWithOtp({
        email,
        options:{emailRedirectTo:redirect.href,shouldCreateUser:true}
      });
      setBusy(btn,false);
      if(res.error){toast(authMessage(res.error.message),"error");return;}
      box.innerHTML='<div class="join-status-card waiting"><div class="join-status-icon">✉</div><h2>ส่งลิงก์ยืนยันแล้ว</h2><p>กรุณาเปิดอีเมล <strong>'+esc(email)+'</strong> แล้วกดลิงก์ยืนยัน จากนั้นจะกลับมาที่ LAO-EMS เพื่อกรอกข้อมูลต่อ</p><div class="notice">หากไม่พบอีเมล ให้ตรวจโฟลเดอร์ Spam/Junk และรอสักครู่ก่อนส่งซ้ำ</div></div>';
    });
    return;
  }

  const email=session.user.email||"";
  const meta=session.user.user_metadata||{};
  const providers=(session.user.app_metadata&&session.user.app_metadata.providers)||[];
  const hasGoogle=Array.isArray(providers)&&providers.includes("google");
  const needsPassword=!hasGoogle&&meta.lao_personnel_join_password_set!==true;
  box.innerHTML='<div class="form-heading"><p class="eyebrow">PERSONNEL JOIN</p><h2>ข้อมูลผู้สมัคร</h2><p>อีเมลได้รับการยืนยันแล้ว กรุณากรอกข้อมูลตามจริง ฝ่ายบุคลากรหรือ School Admin จะตรวจสอบและสามารถแก้ไขก่อนอนุมัติ</p></div>'+
    '<div class="join-flow-steps"><span class="done">✓ ยืนยันอีเมล</span><span class="current">2 กรอกข้อมูล</span><span>3 รออนุมัติ</span></div>'+
    '<div class="join-verified-email"><div><small>อีเมลที่ยืนยันแล้ว</small><strong>'+esc(email)+'</strong></div><button type="button" class="text-btn" data-join-use-other>ใช้อีเมลอื่น</button></div>'+
    '<form id="personnel-join-profile-form" class="auth-form public-application-form">'+
      '<div class="responsive-form-grid">'+
        '<label class="form-field compact-field">คำนำหน้า<select name="prefix"><option value="">ไม่ระบุ</option><option '+(meta.prefix==="นาย"?"selected":"")+'>นาย</option><option '+(meta.prefix==="นาง"?"selected":"")+'>นาง</option><option '+(meta.prefix==="นางสาว"?"selected":"")+'>นางสาว</option></select></label>'+
        '<label class="form-field">ชื่อ <span class="required-mark">*</span><input name="first_name_th" required autocomplete="given-name" value="'+esc(meta.first_name_th||meta.given_name||"")+'"></label>'+
        '<label class="form-field">นามสกุล <span class="required-mark">*</span><input name="last_name_th" required autocomplete="family-name" value="'+esc(meta.last_name_th||meta.family_name||"")+'"></label>'+
        '<label class="form-field">เบอร์โทรศัพท์<input name="phone" type="tel" autocomplete="tel" inputmode="tel" value="'+esc(meta.phone||"")+'"></label>'+
        '<label class="form-field">ตำแหน่ง <span class="required-mark">*</span><select name="position_choice" data-join-position>'+joinPositionOptions("teacher")+'</select></label>'+
        '<label class="form-field hidden" data-join-position-custom-wrap>ระบุตำแหน่งเอง <span class="required-mark">*</span><input name="position_custom" data-join-position-custom></label>'+
        '<label class="form-field">วิทยฐานะ<select name="academic_standing" data-join-standing>'+joinAcademicStandingOptions("")+'</select></label>'+
        '<label class="form-field hidden" data-join-standing-custom-wrap>ระบุวิทยฐานะเอง <span class="required-mark">*</span><input name="academic_standing_custom" data-join-standing-custom></label>'+
        '<label class="form-field span-all">หมายเหตุเพิ่มเติม<textarea name="note" rows="3" placeholder="เว้นว่างได้"></textarea></label>'+
        (needsPassword?'<div class="span-all join-password-section"><strong>ตั้งรหัสผ่านสำหรับเข้าใช้ครั้งถัดไป</strong><p>อย่างน้อย 8 ตัวอักษร หลังได้รับอนุมัติสามารถใช้ร่วมกับอีเมลนี้เพื่อเข้าสู่ระบบได้</p><div class="responsive-form-grid"><label class="form-field">รหัสผ่าน <span class="required-mark">*</span><div class="input-with-action"><input name="join_password" type="password" minlength="8" required autocomplete="new-password" data-password-input><button class="password-toggle" type="button" data-password-toggle aria-label="แสดงรหัสผ่าน" aria-pressed="false"><svg class="eye-open" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.7"/></svg><svg class="eye-closed" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 6.2A10 10 0 0 1 12 6c6.1 0 9.5 6 9.5 6a16 16 0 0 1-3.1 3.8M6.1 6.1C3.8 7.8 2.5 12 2.5 12s3.4 6 9.5 6c1.7 0 3.2-.5 4.5-1.2"/><path d="M9.9 9.9A3 3 0 0 0 14.1 14.1"/></svg></button></div></label><label class="form-field">ยืนยันรหัสผ่าน <span class="required-mark">*</span><div class="input-with-action"><input name="join_password_confirm" type="password" minlength="8" required autocomplete="new-password" data-password-input><button class="password-toggle" type="button" data-password-toggle aria-label="แสดงรหัสผ่าน" aria-pressed="false"><svg class="eye-open" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.7"/></svg><svg class="eye-closed" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 6.2A10 10 0 0 1 12 6c6.1 0 9.5 6 9.5 6a16 16 0 0 1-3.1 3.8M6.1 6.1C3.8 7.8 2.5 12 2.5 12s3.4 6 9.5 6c1.7 0 3.2-.5 4.5-1.2"/><path d="M9.9 9.9A3 3 0 0 0 14.1 14.1"/></svg></button></div></label></div></div>':'')+
      '</div>'+
      '<div class="notice"><strong>ก่อนส่งคำขอ</strong><br>ข้อมูลตำแหน่งและวิทยฐานะที่คุณเลือกเป็นข้อมูลที่ผู้สมัครระบุ ผู้อนุมัติจะตรวจสอบและอาจแก้ไขให้ตรงกับข้อมูลของโรงเรียนก่อนอนุมัติ</div>'+
      '<button class="primary-btn wide" type="submit">ส่งคำขอเข้าร่วมโรงเรียน</button>'+
    '</form>';

  const useOther=q("[data-join-use-other]",box);
  if(useOther)useOther.addEventListener("click",async()=>{
    try{await supabase.auth.signOut({scope:"local"});}catch(_){}
    clearLaoAuthSession();
    state.session=state.user=null;
    await renderPublicPersonnelJoin(token,null);
  });

  const form=q("#personnel-join-profile-form",box);
  bindPasswordToggles(form);
  const pos=q("[data-join-position]",form),posWrap=q("[data-join-position-custom-wrap]",form),posCustom=q("[data-join-position-custom]",form);
  const standing=q("[data-join-standing]",form),standingWrap=q("[data-join-standing-custom-wrap]",form),standingCustom=q("[data-join-standing-custom]",form);
  const syncCustom=()=>{
    const customPos=pos.value==="__custom__";
    posWrap.classList.toggle("hidden",!customPos);posCustom.required=customPos;if(!customPos)posCustom.value="";
    const customStanding=standing.value==="__custom__";
    standingWrap.classList.toggle("hidden",!customStanding);standingCustom.required=customStanding;if(!customStanding)standingCustom.value="";
  };
  pos.addEventListener("change",syncCustom);standing.addEventListener("change",syncCustom);syncCustom();

  form.addEventListener("submit",async e=>{
    e.preventDefault();
    const fd=new FormData(form),btn=form.querySelector("button[type=submit]");
    const posData=joinPositionData(String(fd.get("position_choice")||""),String(fd.get("position_custom")||""));
    const academic=String(fd.get("academic_standing")||"")==="__custom__"?String(fd.get("academic_standing_custom")||"").trim():String(fd.get("academic_standing")||"").trim();
    if(!posData.position_title){toast("กรุณาระบุตำแหน่ง","error");return;}
    const joinPassword=String(fd.get("join_password")||"");
    const joinPasswordConfirm=String(fd.get("join_password_confirm")||"");
    if(needsPassword&&joinPassword.length<8){toast("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร","error");return;}
    if(needsPassword&&joinPassword!==joinPasswordConfirm){toast("รหัสผ่านทั้งสองช่องไม่ตรงกัน","error");return;}
    setBusy(btn,true,"กำลังส่งคำขอ...");
    if(needsPassword){
      const passRes=await supabase.auth.updateUser({password:joinPassword,data:{lao_personnel_join_password_set:true}});
      if(passRes.error){setBusy(btn,false);toast(authMessage(passRes.error.message),"error");return;}
    }
    const res=await supabase.rpc("lao_submit_personnel_join_request",{
      p_token:token,
      p_prefix:String(fd.get("prefix")||"").trim()||null,
      p_first_name_th:String(fd.get("first_name_th")||"").trim(),
      p_last_name_th:String(fd.get("last_name_th")||"").trim(),
      p_phone:String(fd.get("phone")||"").trim()||null,
      p_personnel_type:posData.personnel_type,
      p_position_title:posData.position_title,
      p_academic_standing:academic||null,
      p_note:String(fd.get("note")||"").trim()||null
    });
    setBusy(btn,false);
    if(res.error){toast(res.error.message,"error");return;}
    toast("ส่งคำขอแล้ว รอฝ่ายบุคลากรตรวจสอบ","success");
    await renderPublicPersonnelJoin(token,session);
  });
}
async function showPersonnelJoin(session){
  const token=personnelJoinToken();
  if(!token)return;
  state.session=session||null;
  state.user=session&&session.user||null;
  q("#app-shell").classList.add("hidden");
  q("#auth-screen").classList.remove("hidden");
  const signin=q("#signin-form"),adminApp=q("#school-admin-application"),joinBox=q("#personnel-join-screen");
  if(signin)signin.classList.add("hidden");
  if(adminApp)adminApp.classList.add("hidden");
  if(joinBox)joinBox.classList.remove("hidden");
  await renderPublicPersonnelJoin(token,session||null);
  dismissBootScreen();
}

async function renderPublicSchoolAdminApplication(token){
  const box=q("#school-admin-application"); if(!box)return;
  box.classList.remove("hidden");
  box.innerHTML='<div class="loading-inline"><span class="spinner"></span>กำลังตรวจสอบลิงก์...</div>';
  const res=await supabase.rpc("lao_public_school_admin_link_status",{p_token:token});
  if(res.error){box.innerHTML='<div class="form-heading"><h2>ไม่สามารถเปิดคำเชิญได้</h2><p>'+esc(res.error.message)+'</p></div>';return;}
  const info=res.data||{};
  if(!info.valid){
    const msg=info.reason==="closed"?"ผู้ดูแลแพลตฟอร์มปิดรับคำขอผ่านลิงก์นี้แล้ว":info.reason==="expired"?"ลิงก์คำเชิญนี้หมดอายุแล้ว":"ไม่พบลิงก์คำเชิญ";
    box.innerHTML='<div class="form-heading"><h2>ลิงก์ไม่พร้อมใช้งาน</h2><p>'+esc(msg)+'</p></div><a class="secondary-btn wide" href="#/overview">กลับหน้าเข้าสู่ระบบ</a>';return;
  }
  box.innerHTML='<div class="form-heading"><p class="eyebrow">School Admin application</p><h2>ยื่นคำขอเป็น School Admin</h2><p>กรอกข้อมูลตามจริงและแนบเอกสารยืนยัน Platform Admin จะตรวจเอกสารก่อนส่งคำเชิญบัญชี LAO-EMS</p></div><div class="notice warning"><strong>ต้องมีเอกสารยืนยัน</strong><br>รองรับ PDF, JPG, PNG ขนาดไม่เกิน 10 MB เช่น หนังสือมอบหมาย คำสั่ง หรือหลักฐานสิทธิ์ดูแลระบบสถานศึกษา</div><form id="school-admin-application-form" class="auth-form public-application-form"><input type="hidden" name="token" value="'+esc(token)+'"><div class="responsive-form-grid"><label class="form-field">อีเมล <span class="required-mark">*</span><input name="email" type="email" required autocomplete="email"></label><label class="form-field">เบอร์โทรศัพท์<input name="phone" type="tel" autocomplete="tel" inputmode="tel"></label><label class="form-field compact-field">คำนำหน้า<select name="prefix"><option value="">ไม่ระบุ</option><option>นาย</option><option>นาง</option><option>นางสาว</option></select></label><label class="form-field">ชื่อ <span class="required-mark">*</span><input name="first_name_th" required autocomplete="given-name"></label><label class="form-field">นามสกุล <span class="required-mark">*</span><input name="last_name_th" required autocomplete="family-name"></label><label class="form-field">อปท. ตามเอกสาร <span class="required-mark">*</span><input name="claimed_organization_name" required></label><label class="form-field span-all">สถานศึกษาตามเอกสาร <span class="required-mark">*</span><input name="claimed_school_name" required></label><label class="form-field span-all">หมายเหตุ<textarea name="applicant_note" rows="3"></textarea></label><label class="form-field span-all verification-upload">เอกสารยืนยัน <span class="required-mark">*</span><input name="document" type="file" required accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"><small>ต้องแนบเอกสารก่อนส่งคำขอ</small></label></div><button class="primary-btn wide" type="submit">ส่งคำขอให้ Platform Admin ตรวจสอบ</button></form>';
  const form=q("#school-admin-application-form");
  form.addEventListener("submit",async e=>{
    e.preventDefault();
    const btn=form.querySelector("button[type=submit]"),fd=new FormData(form);
    setBusy(btn,true,"กำลังส่งคำขอ...");
    const submit=await supabase.functions.invoke("lao-school-admin-apply",{body:fd});
    setBusy(btn,false);
    if(submit.error){toast(await readFunctionError(submit.error),"error");return;}
    box.innerHTML='<div class="application-success"><div class="success-mark">✓</div><h2>ส่งคำขอแล้ว</h2><p>Platform Admin จะตรวจเอกสารก่อน หากอนุมัติ ระบบจะส่งคำเชิญ LAO-EMS ไปยังอีเมลที่ระบุ</p><a class="secondary-btn wide" href="#/overview">กลับหน้าเข้าสู่ระบบ</a></div>';
  });
}
function bindOverview(){
  const btn=q("[data-platform-self-school]"); if(!btn)return;
  btn.addEventListener("click",async()=>{
    setBusy(btn,true,"กำลังเตรียม...");
    const res=await supabase.rpc("lao_platform_begin_school_onboarding");
    setBusy(btn,false);
    if(res.error){toast(res.error.message,"error");return;}
    localStorage.setItem("lao_view_mode","user");state.viewMode="user";
    await loadContext();location.hash="#/lec";
  });
}

async function signIn(event){
  event.preventDefault();
  const form=event.currentTarget,btn=form.querySelector("button[type=submit]"),fd=new FormData(form);
  const email=String(fd.get("email")).trim();
  const remember=fd.get("remember_login")==="on";
  if(remember){
    localStorage.setItem("lao_remember_login","1");
    localStorage.setItem("lao_saved_email",email);
  }else{
    localStorage.removeItem("lao_remember_login");
    localStorage.removeItem("lao_saved_email");
  }
  setBusy(btn,true,"กำลังเข้าสู่ระบบ...");
  const res=await supabase.auth.signInWithPassword({email:email,password:String(fd.get("password"))});
  setBusy(btn,false);
  if(res.error){toast(authMessage(res.error.message),"error");return;}
  toast("เข้าสู่ระบบสำเร็จ","success");
}
function authMessage(m){
  if(/invalid login credentials/i.test(m))return "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
  if(/already registered/i.test(m))return "อีเมลนี้มีบัญชีอยู่แล้ว";
  return m||"ไม่สามารถดำเนินการได้";
}

async function ensureProfile(){
  const m=(state.user&&state.user.user_metadata)||{};
  const res=await supabase.rpc("lao_ensure_profile",{
    p_prefix:m.prefix||null,p_first_name_th:m.first_name_th||null,p_last_name_th:m.last_name_th||null,
    p_display_name:m.display_name||null,p_phone:m.phone||null
  });
  if(res.error)throw res.error;
}
async function loadOrganizations(){
  const res=await supabase.from("lao_organizations").select("id,name_th,name_en").eq("is_active",true).order("name_th");
  if(res.error)throw res.error;
  state.organizations=res.data||[];
}
async function loadSchools(orgId){
  if(!orgId){state.schools=[];return [];}
  const res=await supabase.from("lao_schools").select("id,organization_id,name_th,name_en,slug").eq("organization_id",orgId).eq("is_active",true).order("name_th");
  if(res.error)throw res.error;
  state.schools=res.data||[];
  return state.schools;
}
async function loadAdminSchools(){
  if(!state.isPlatformAdmin){state.adminSchools=[];state.adminSchool=null;return;}
  const res=await supabase.from("lao_schools")
    .select("id,organization_id,code,name_th,name_en,short_name,slug,phone,email,website_url,address_text,is_active,source_system,lec_synced_at,lec_source_file_name,lao_organizations(id,name_th,name_en)")
    .order("name_th");
  if(res.error)throw res.error;
  state.adminSchools=res.data||[];
  const saved=localStorage.getItem("lao_admin_school");
  state.adminSchool=state.adminSchools.find(s=>s.id===saved)||null;
}
async function loadNotifications(){
  if(!state.user){state.notifications=[];return;}
  const res=await supabase.from("lao_notifications")
    .select("id,organization_id,school_id,notification_type,title,body,entity_type,entity_id,created_at,read_at")
    .eq("user_id",state.user.id).order("created_at",{ascending:false}).limit(100);
  if(res.error)throw res.error;
  state.notifications=res.data||[];
}
async function loadPersonnelWorkCounts(){
  const school=currentSchool();
  if(!school){
    state.personnelWork={can_review:false,can_manage_intake:false,can_assign_authority:false,pending_join_requests:0};
    return state.personnelWork;
  }
  const res=await supabase.rpc("lao_personnel_work_counts",{p_school_id:school.id});
  if(res.error){
    state.personnelWork={can_review:false,can_manage_intake:false,can_assign_authority:false,pending_join_requests:0};
    return state.personnelWork;
  }
  state.personnelWork=res.data||{can_review:false,can_manage_intake:false,can_assign_authority:false,pending_join_requests:0};
  return state.personnelWork;
}
async function loadAcademicWorkCounts(){
  const school=currentSchool();
  const empty={can_manage:false,pending_teaching_workloads:0,my_returned_workloads:0,attention_count:0};
  if(!school||!canViewAcademic()){
    state.academicWork=empty;
    return state.academicWork;
  }
  const res=await supabase.rpc("lao_academic_work_counts",{p_school_id:school.id});
  if(res.error){
    state.academicWork=empty;
    return state.academicWork;
  }
  state.academicWork=res.data||empty;
  return state.academicWork;
}
async function refreshAttentionState(){
  if(!state.user||personnelJoinToken())return;
  try{
    await Promise.all([loadNotifications(),loadPersonnelWorkCounts(),loadAcademicWorkCounts()]);
    refreshHeader();
  }catch(_){}
}
function bindAttentionRefresh(){
  window.addEventListener("focus",()=>{void refreshAttentionState();});
  document.addEventListener("visibilitychange",()=>{
    if(!document.hidden)void refreshAttentionState();
  });
  window.setInterval(()=>{void refreshAttentionState();},60000);
}

async function loadSchoolSetupStatus(){
  const m=state.currentMembership;
  if(!m||m.status!=="active"||!roleCodes(m).includes("school_admin")||!m.school_id){state.schoolSetup=null;return null;}
  const res=await supabase.rpc("lao_school_setup_status",{p_school_id:m.school_id});
  if(res.error)throw res.error;
  state.schoolSetup=res.data||null;
  return state.schoolSetup;
}
async function loadContext(){
  const emailGate=await supabase.rpc("lao_email_is_authorized");
  if(emailGate.error)throw emailGate.error;
  if(emailGate.data!==true)throw new Error("LAO_EMAIL_NOT_AUTHORIZED");
  const adminRes=await supabase.rpc("lao_is_platform_admin");
  if(adminRes.error)throw adminRes.error;
  state.isPlatformAdmin=adminRes.data===true;
  const accessRes=await supabase.rpc("lao_has_lao_access");
  if(accessRes.error)throw accessRes.error;
  if(accessRes.data!==true)throw new Error("LAO_ACCESS_REQUIRED");
  localStorage.removeItem("lao_legacy_session_rejected");
  await ensureProfile();
  const profileRes=await supabase.from("lao_profiles").select("*").eq("user_id",state.user.id).maybeSingle();
  if(profileRes.error)throw profileRes.error;
  state.profile=profileRes.data;
  const invitationRes=await supabase.rpc("lao_my_pending_invitation");
  if(invitationRes.error)throw invitationRes.error;
  state.pendingInvitation=invitationRes.data||null;
  const memRes=await supabase.from("lao_memberships").select("id,user_id,organization_id,school_id,requested_role_code,request_note,status,requested_at,reviewed_at,lao_organizations(id,name_th,name_en),lao_schools(id,name_th,name_en,slug),lao_membership_roles(lao_roles(code,name_th))").eq("user_id",state.user.id).order("requested_at",{ascending:false});
  if(memRes.error)throw memRes.error;
  state.memberships=memRes.data||[];
  const active=state.memberships.filter(m=>m.status==="active"),saved=localStorage.getItem("lao_current_membership");
  state.currentMembership=active.find(m=>m.id===saved)||active[0]||null;
  await loadOrganizations();
  await loadAdminSchools();
  await loadNotifications();
  if(state.isPlatformAdmin){
    const savedView=localStorage.getItem("lao_view_mode");
    state.viewMode=savedView==="user"?"user":"admin";
    ensureAdminNavigation();
  }else{
    state.viewMode="user";
  }
  await loadSchoolSetupStatus();
  await Promise.all([loadPersonnelWorkCounts(),loadAcademicWorkCounts()]);
  refreshHeader();
  renderTenants();
}
function refreshHeader(){
  const name=displayName();
  q("[data-profile-name]").textContent=name;
  const topAvatar=q("[data-avatar]");
  if(topAvatar){
    topAvatar.innerHTML=avatarHtml(name,"topbar-avatar-media");
    bindAvatarFallback(topAvatar);
  }
  const schoolMode=isSchoolAdminContext();
  const schoolRoleText=roleCodes(state.currentMembership).map(code=>roleLabels[code]||code).join(" · ");
  q("[data-profile-role]").textContent=isPlatformAdminMode()
    ?"ผู้ดูแลแพลตฟอร์ม"
    :schoolMode
      ?(schoolRoleText||"ผู้ดูแลสถานศึกษา")
      :state.currentMembership?roleNames():state.pendingInvitation&&state.pendingInvitation.status==="onboarding"?"รอนำเข้า LEC":state.pendingInvitation?"รอยืนยันบัญชี":"ยังไม่มีสิทธิ์";

  const switcher=q("[data-view-switch]");
  if(switcher)switcher.classList.toggle("hidden",!state.isPlatformAdmin);
  qa("[data-view-mode]").forEach(button=>{
    button.classList.toggle("active",button.dataset.viewMode===state.viewMode);
    if(button.dataset.viewMode==="user"){
      button.textContent=state.isPlatformAdmin?"School":((roleCodes(state.currentMembership).includes("school_admin")||(state.pendingInvitation&&state.pendingInvitation.role_code==="school_admin"))?"School":"User");
      button.setAttribute("aria-label",button.textContent);
    }else{
      button.textContent="Platform";
      button.setAttribute("aria-label","Platform Admin");
    }
  });

  const adminMode=isPlatformAdminMode();
  qa("[data-admin-menu]").forEach(item=>{
    item.classList.toggle("hidden",!(adminMode||schoolMode));
  });

  qa("[data-lec-menu]").forEach(item=>{
    const approvedFirstSchoolAdmin=Boolean(
      state.viewMode==="user" &&
      state.pendingInvitation &&
      state.pendingInvitation.status==="onboarding" &&
      state.pendingInvitation.invitation_mode==="platform_first_admin" &&
      state.pendingInvitation.role_code==="school_admin"
    );
    item.classList.toggle("hidden",!(approvedFirstSchoolAdmin||schoolMode));
  });

  const usersLink=q('[data-route="users"]');
  if(usersLink)usersLink.classList.toggle("hidden",!(adminMode||(schoolMode&&schoolSetupReady())));

  const personnelLink=q('[data-route="personnel"][data-personnel-menu]');
  if(personnelLink){
    personnelLink.classList.toggle("hidden",!canViewPersonnel());
    const personnelBadge=q("[data-personnel-badge]",personnelLink);
    const pending=Number(state.personnelWork&&state.personnelWork.pending_join_requests||0);
    if(personnelBadge){
      personnelBadge.textContent=String(pending);
      personnelBadge.classList.toggle("hidden",!(state.personnelWork&&state.personnelWork.can_review&&pending>0));
    }
  }

  const studentLink=q('[data-route="students"][data-student-menu]');
  if(studentLink)studentLink.classList.toggle("hidden",!canViewStudentDirectory());

  const academicLink=q('[data-route="academics"][data-academic-menu]');
  if(academicLink){
    academicLink.classList.toggle("hidden",!canViewAcademic());
    const badge=q("[data-academic-badge]",academicLink);
    const attention=Number(state.academicWork&&state.academicWork.attention_count||0);
    if(badge){
      badge.textContent=String(attention);
      badge.classList.toggle("hidden",attention<=0);
    }
  }

  const setupLink=q('[data-route="setup"]');
  if(setupLink)setupLink.textContent=adminMode?"⚙ ตั้งค่าระบบ":"⚙ ตั้งค่าสถานศึกษา";

  const notif=q("[data-notification-count]");
  if(notif){
    const unread=state.notifications.filter(n=>!n.read_at).length;
    notif.textContent=String(unread);
    notif.classList.toggle("hidden",unread===0);
  }

  const nav=q(".nav-list");
  if(nav&&state.isPlatformAdmin){
    nav.querySelectorAll("[data-full-admin]").forEach(item=>item.classList.toggle("hidden",!adminMode));
  }
}

function ensureAdminNavigation(){
  const nav=q(".nav-list");
  if(!nav||nav.querySelector("[data-full-admin]"))return;
  const items=[
    ["assessment","📝","ทะเบียนและวัดผล"],["documents","📄","เอกสารและไฟล์"],
    ["website","🌐","เว็บไซต์สถานศึกษา"],["forms","☑","แบบฟอร์มและงาน"],["reports","📊","รายงานและ Dashboard"]
  ];
  items.forEach(item=>{
    const link=document.createElement("a");
    link.href="#/"+item[0];link.dataset.route=item[0];link.dataset.fullAdmin="";
    link.innerHTML="<span>"+item[1]+"</span>"+item[2];
    nav.appendChild(link);
  });
}

function renderTenants(){
  const select=q("#tenant-select");
  if(state.isPlatformAdmin&&state.viewMode==="admin"){
    if(!state.adminSchools.length){
      select.innerHTML='<option value="">ยังไม่มีสถานศึกษาในระบบ</option>';return;
    }
    select.innerHTML='<option value="">ทุกสถานศึกษา · เลือกโรงเรียนเมื่อต้องการจัดการ</option>'+
      state.adminSchools.map(s=>'<option value="admin:'+esc(s.id)+'">'+esc((s.lao_organizations&&s.lao_organizations.name_th? s.lao_organizations.name_th+" · ":"")+s.name_th)+'</option>').join("");
    select.value=state.adminSchool?"admin:"+state.adminSchool.id:"";
    return;
  }
  const active=state.memberships.filter(m=>m.status==="active");
  if(!active.length){select.innerHTML=state.pendingInvitation&&state.pendingInvitation.status==="onboarding"?'<option value="">รอนำเข้า LEC เพื่อสร้างสถานศึกษา</option>':'<option value="">ยังไม่มีสิทธิ์สถานศึกษา</option>';return;}
  select.innerHTML=active.map(m=>{
    const name=m.lao_schools&&m.lao_schools.name_th||m.lao_organizations&&m.lao_organizations.name_th||"สิทธิ์ระดับองค์กร";
    return '<option value="'+esc(m.id)+'">'+esc(name)+'</option>';
  }).join("");
  if(state.currentMembership)select.value=state.currentMembership.id;
}

function adminOverviewHtml(){
  const tenant=(currentSchool()&&currentSchool().name_th)||(currentOrg()&&currentOrg().name_th)||"ยังไม่เลือกสถานศึกษา";
  const active=state.memberships.filter(m=>m.status==="active").length;
  const pending=state.memberships.filter(m=>m.status==="pending").length;
  const moduleHtml=modules.map(m=>'<article class="module-card"><div class="module-top"><span class="module-icon">'+m[0]+'</span><span class="module-stage">'+m[3]+'</span></div><h3>'+esc(m[1])+'</h3><p>'+esc(m[2])+'</p></article>').join("");
  return '<section class="system-banner"><div><span class="badge">Admin Console</span><h2>ศูนย์ควบคุม LAO-EMS</h2><p>มุมมองนี้แสดงสถานะระบบ โครงสร้างข้อมูล และเครื่องมือสำหรับผู้ดูแลแพลตฟอร์มหลัก</p></div><div class="banner-status"><span class="status-pill success">ฐานข้อมูล: เชื่อมแล้ว</span><span class="status-pill success">สิทธิ์ข้อมูล: เปิดใช้งาน</span><span class="status-pill warning">Google Drive: รอเชื่อม</span></div></section>'+
  '<section class="stats-grid">'+
  '<article class="stat-card"><span class="stat-icon">🏫</span><div><small>บริบทปัจจุบัน</small><strong>'+esc(tenant)+'</strong><p>เลือกสถานศึกษาเพื่อบริหารข้อมูลเฉพาะแห่ง</p></div></article>'+
  '<article class="stat-card"><span class="stat-icon">👥</span><div><small>Membership ที่ใช้งาน</small><strong>'+active+'</strong><p>สิทธิ์ที่อนุมัติแล้ว</p></div></article>'+
  '<article class="stat-card"><span class="stat-icon">⏳</span><div><small>คำขอรออนุมัติ</small><strong>'+pending+'</strong><p>ตรวจสอบจากเมนูผู้ใช้และสิทธิ์</p></div></article>'+
  '<article class="stat-card"><span class="stat-icon">🗂️</span><div><small>ไฟล์</small><strong>Google Drive</strong><p>แยก Drive ตามแต่ละสถานศึกษา</p></div></article></section>'+
  '<section class="content-grid"><article class="panel"><div class="panel-head"><div><p class="eyebrow">System setup</p><h2>งานของผู้ดูแลหลัก</h2></div></div><ol class="setup-list">'+
  '<li><span>1</span><div><strong>School Admin คนแรก</strong><small>เชิญด้วยอีเมล โดยยังไม่กรอกข้อมูล อปท. หรือสถานศึกษา</small></div><em>เชิญผู้ดูแล</em></li>'+
  '<li><span>2</span><div><strong>นำเข้า LEC ครั้งแรก</strong><small>School Admin ยืนยันบัญชีแล้วนำเข้า LEC เพื่อสร้าง อปท. และสถานศึกษา</small></div><em>อัตโนมัติ</em></li>'+
  '<li><span>3</span><div><strong>ข้อมูลนักเรียน</strong><small>ทุกปี/ภาคเรียนอัปเดตจาก XLS/XLSX ของ LEC โดยรักษาประวัติเดิม</small></div><em>Source of Truth</em></li>'+
  '<li><span>4</span><div><strong>Google Drive</strong><small>เชื่อมบัญชีแยกตามโรงเรียน</small></div><em>ขั้นถัดไป</em></li></ol></article>'+
  '<article class="panel"><div class="panel-head"><div><p class="eyebrow">System status</p><h2>สถานะทางเทคนิค</h2></div></div><ul class="status-list">'+
  '<li><span>✓</span><div><strong>Supabase ISSQL</strong><small>ใช้ namespace lao_ แยกจากระบบเดิม</small></div><span class="pill success">พร้อม</span></li>'+
  '<li><span>✓</span><div><strong>RLS / Role + Scope</strong><small>แยกสิทธิ์ตาม อปท. และสถานศึกษา</small></div><span class="pill success">พร้อม</span></li>'+
  '<li><span>✓</span><div><strong>Audit Log</strong><small>รองรับการตรวจสอบเหตุการณ์สำคัญ</small></div><span class="pill success">พร้อม</span></li>'+
  '<li><span>→</span><div><strong>Google OAuth</strong><small>ใช้สำหรับเชื่อม Drive ของแต่ละโรงเรียน</small></div><span class="pill warning">รอดำเนินการ</span></li></ul></article></section>'+
  '<section class="module-section"><div class="section-head"><div><p class="eyebrow">Roadmap</p><h2>โมดูลทั้งหมด</h2></div></div><div class="module-grid">'+moduleHtml+'</div></section>';
}

async function overviewHtml(){
  const active=state.memberships.filter(m=>m.status==="active").length;
  const school=currentSchool();
  const tenant=(school&&school.name_th)||(currentOrg()&&currentOrg().name_th)||"ยังไม่ได้ผูกสถานศึกษา";
  const name=displayName();
  const schoolAdmin=isSchoolAdminContext();
  const accessText=schoolAdmin?"ผู้ดูแลสถานศึกษา":state.currentMembership?roleNames():"ยังไม่มีสิทธิ์ใช้งาน";
  const personnelWork=state.personnelWork||{};
  const academicWork=state.academicWork||{};
  const unread=(state.notifications||[]).filter(n=>!n.read_at && (!school||!n.school_id||n.school_id===school.id));
  const personnelResponsible=Boolean(school)&&(schoolAdmin||personnelWork.can_review||personnelWork.can_manage_intake||personnelWork.can_assign_authority);
  const academicResponsible=Boolean(school)&&(schoolAdmin||academicWork.can_manage);
  const timelines=[];

  if(personnelResponsible){
    try{
      const timeline=await loadDepartmentSetupTimeline("personnel");
      if(timeline)timelines.push(timeline);
    }catch(e){console.warn("overview personnel timeline",e);}
  }
  if(academicResponsible){
    try{
      const timeline=await loadDepartmentSetupTimeline("academics");
      if(timeline)timelines.push(timeline);
    }catch(e){console.warn("overview academics timeline",e);}
  }

  const totalSteps=timelines.reduce((sum,t)=>sum+Number(t.total_count||0),0);
  const resolvedSteps=timelines.reduce((sum,t)=>sum+Number(t.resolved_count||0),0);
  const progressPct=totalSteps?Math.round(resolvedSteps*100/totalSteps):(timelines.length?100:0);
  const pendingJoin=Number(personnelWork.pending_join_requests||0);
  const pendingTeaching=Number(academicWork.pending_teaching_workloads||0);
  const returnedTeaching=Number(academicWork.my_returned_workloads||0);
  const attentionCount=pendingJoin+pendingTeaching+returnedTeaching+unread.length;

  const priority=[];
  if(schoolAdmin&&!schoolSetupReady()){
    priority.push({icon:"⚙",title:"ตั้งค่าสถานศึกษาให้ครบ",desc:"ตรวจข้อมูลพื้นฐานและเชื่อม Google Drive ก่อนเปิดใช้งานส่วนอื่น",route:"#/setup",label:"ทำต่อ",tone:"warning"});
  }
  timelines.forEach(t=>{
    if(t.next_step)priority.push({
      icon:"▶",title:(t.department_name||"งาน")+" · "+t.next_step.title,
      desc:t.next_step.is_required?"ขั้นตอนจำเป็น ต้องดำเนินการก่อนขั้นถัดไป":"ขั้นตอนนี้ข้ามได้ หากยังไม่กระทบงานถัดไป",
      route:t.next_step.route,label:"ทำต่อ",tone:"primary"
    });
  });
  if(pendingJoin>0&&personnelWork.can_review){
    priority.push({icon:"👥",title:"ตรวจคำขอเข้าร่วม "+pendingJoin+" รายการ",desc:"มีบุคลากรรอการตรวจสอบและอนุมัติ",route:"#/personnel/requests",label:"ตรวจสอบ",tone:"warning"});
  }
  if(pendingTeaching>0&&academicWork.can_manage){
    priority.push({icon:"📚",title:"ตรวจภาระงานสอน "+pendingTeaching+" รายการ",desc:"มีภาระงานสอนที่ส่งมาและรอการพิจารณา",route:"#/academics/workload",label:"ตรวจสอบ",tone:"warning"});
  }
  if(returnedTeaching>0){
    priority.push({icon:"↩",title:"แก้ไขภาระงานสอนที่ถูกส่งกลับ "+returnedTeaching+" รายการ",desc:"มีรายการของคุณที่ต้องปรับแก้แล้วส่งใหม่",route:"#/academics/workload",label:"แก้ไข",tone:"danger"});
  }

  const priorityHtml=priority.length
    ?priority.slice(0,6).map((item,i)=>'<a class="overview-priority-item '+esc(item.tone||"")+'" href="'+esc(item.route)+'"><span class="overview-priority-order">'+(i+1)+'</span><span class="overview-priority-icon">'+item.icon+'</span><span class="overview-priority-copy"><strong>'+esc(item.title)+'</strong><small>'+esc(item.desc)+'</small></span><em>'+esc(item.label)+'</em></a>').join("")
    :'<div class="overview-clear-state"><span>✓</span><div><strong>ยังไม่มีงานเร่งด่วนที่ต้องดำเนินการ</strong><p>เมื่อมีขั้นตอนใหม่ งานส่งกลับ หรือรายการรออนุมัติ ระบบจะแสดงที่นี่อัตโนมัติ</p></div></div>';

  const timelineCards=timelines.length
    ?timelines.map(t=>{
      const total=Number(t.total_count||0),resolved=Number(t.resolved_count||0);
      const pct=total?Math.round(resolved*100/total):100;
      const next=t.next_step;
      const pending=Math.max(total-resolved,0);
      return '<article class="overview-department-card">'+
        '<div class="overview-department-head"><div><span class="overview-department-icon">'+(t.department_code==="personnel"?"👥":"📚")+'</span><div><small>ฝ่ายที่รับผิดชอบ</small><strong>'+esc(t.department_name||t.department_code)+'</strong></div></div><span class="pill '+(t.is_complete?"success":"warning")+'">'+(t.is_complete?"ครบแล้ว":"เหลือ "+pending+" ขั้น")+'</span></div>'+
        '<div class="overview-department-progress"><div><span>ความก้าวหน้า</span><strong>'+pct+'%</strong></div><div class="department-progress-track"><span style="width:'+pct+'%"></span></div><small>'+resolved+' จาก '+total+' ขั้นตอนดำเนินการแล้ว/ข้ามตามเงื่อนไข</small></div>'+
        (next?'<div class="overview-department-next"><span>ทำต่อ</span><div><strong>'+esc(next.title)+'</strong><small>'+(next.is_required?"จำเป็นต้องทำตามลำดับ":"ข้ามได้หากยังไม่กระทบขั้นอื่น")+'</small></div><a href="'+esc(next.route)+'">เปิดงาน</a></div>':'<div class="overview-department-complete">✓ ไม่มีขั้นตอนตั้งค่าค้างในฝ่ายนี้</div>')+
        '<a class="overview-department-open" href="'+(t.department_code==="personnel"?"#/personnel":"#/academics")+'">ดูไทม์ไลน์ทั้งหมด →</a>'+
      '</article>';
    }).join("")
    :'<div class="overview-empty-responsibility"><span>ℹ</span><div><strong>ยังไม่มีไทม์ไลน์ฝ่ายที่บัญชีนี้ต้องรับผิดชอบ</strong><p>ระบบจะแสดงเฉพาะฝ่ายที่ได้รับสิทธิ์บริหารหรือได้รับมอบหมาย ไม่แสดงงานที่ไม่มีหน้าที่รับผิดชอบ</p></div></div>';

  const notificationHtml=unread.length
    ?unread.slice(0,5).map(n=>'<a class="overview-notification-row" href="#/notifications"><span>🔔</span><div><strong>'+esc(n.title||"การแจ้งเตือน")+'</strong><small>'+esc(n.body||"")+'</small></div><time>'+esc(thaiDateTime(n.created_at))+'</time></a>').join("")
    :'<div class="overview-mini-empty">ไม่มีการแจ้งเตือนที่ยังไม่ได้อ่าน</div>';

  let onboardingNotice="";
  if(!school){
    onboardingNotice='<div class="notice"><strong>ยังไม่ได้เลือกหรือผูกสถานศึกษา</strong><br>เมื่อมีสิทธิ์ในสถานศึกษาแล้ว ระบบจะแสดงงานตามหน้าที่รับผิดชอบของคุณที่หน้านี้</div>';
  }else if(schoolAdmin&&!schoolSetupReady()){
    onboardingNotice='<div class="notice warning"><strong>การตั้งค่าสถานศึกษายังไม่สมบูรณ์</strong><br>ส่วนที่ต้องพึ่งข้อมูลตั้งต้นอาจยังใช้งานไม่ได้ครบ กรุณาดำเนินการรายการแรกใน “งานที่ต้องทำต่อ”</div>';
  }

  return '<section class="system-banner overview-banner"><div><span class="badge">MY WORKSPACE</span><h2>สวัสดี '+esc(name)+'</h2><p>'+esc(tenant)+' · '+esc(accessText)+'</p></div><div class="overview-banner-progress"><small>ความก้าวหน้าการตั้งค่าที่รับผิดชอบ</small><strong>'+progressPct+'%</strong><span>'+resolvedSteps+'/'+totalSteps+' ขั้นตอน</span></div></section>'+
    onboardingNotice+
    '<section class="overview-kpi-grid">'+
      '<article><span>🎯</span><div><small>งานที่ควรทำต่อ</small><strong>'+priority.length.toLocaleString("th-TH")+'</strong><p>รายการตามลำดับความสำคัญ</p></div></article>'+
      '<article><span>⏳</span><div><small>งานรอดำเนินการ</small><strong>'+attentionCount.toLocaleString("th-TH")+'</strong><p>อนุมัติ / ส่งกลับ / แจ้งเตือน</p></div></article>'+
      '<article><span>✅</span><div><small>ความก้าวหน้ารวม</small><strong>'+progressPct+'%</strong><p>'+resolvedSteps+' จาก '+totalSteps+' ขั้นตอน</p></div></article>'+
      '<article><span>🔔</span><div><small>แจ้งเตือนใหม่</small><strong>'+unread.length.toLocaleString("th-TH")+'</strong><p>รายการที่ยังไม่ได้อ่าน</p></div></article>'+
    '</section>'+
    '<section class="overview-dashboard-grid">'+
      '<article class="panel overview-priority-panel"><div class="panel-head"><div><p class="eyebrow">NEXT ACTION</p><h2>งานที่ต้องทำต่อ</h2><p class="panel-sub">เรียงจากงานตั้งค่าที่จำเป็น งานรออนุมัติ และงานที่ถูกส่งกลับ</p></div></div><div class="overview-priority-list">'+priorityHtml+'</div></article>'+
      '<article class="panel overview-attention-panel"><div class="panel-head"><div><p class="eyebrow">ATTENTION</p><h2>สิ่งที่ต้องติดตาม</h2></div><a class="text-btn" href="#/notifications">ดูทั้งหมด</a></div>'+
        '<div class="overview-attention-summary">'+
          (personnelWork.can_review?'<div><span>👥</span><strong>'+pendingJoin+'</strong><small>คำขอบุคลากรรอตรวจ</small></div>':'')+
          (academicWork.can_manage?'<div><span>📚</span><strong>'+pendingTeaching+'</strong><small>ภาระงานสอนรออนุมัติ</small></div>':'')+
          (returnedTeaching?'<div><span>↩</span><strong>'+returnedTeaching+'</strong><small>งานของฉันถูกส่งกลับ</small></div>':'')+
          '<div><span>🔔</span><strong>'+unread.length+'</strong><small>แจ้งเตือนใหม่</small></div>'+
        '</div><div class="overview-notification-list">'+notificationHtml+'</div></article>'+
    '</section>'+
    '<section class="overview-section-head"><div><p class="eyebrow">RESPONSIBILITY TIMELINE</p><h2>ไทม์ไลน์งานที่ฉันรับผิดชอบ</h2><p>แสดงเฉพาะฝ่ายที่บัญชีนี้มีหน้าที่จัดการ พร้อมจุดที่ทำค้างไว้และขั้นตอนถัดไป</p></div></section>'+
    '<section class="overview-department-grid">'+timelineCards+'</section>'+
    '<section class="panel overview-context-panel"><div class="panel-head"><div><p class="eyebrow">MY CONTEXT</p><h2>บริบทการทำงานปัจจุบัน</h2></div></div><div class="overview-context-grid">'+
      '<div><small>สถานศึกษา</small><strong>'+esc(tenant)+'</strong></div>'+
      '<div><small>บทบาท</small><strong>'+esc(state.currentMembership?roleNames():"-")+'</strong></div>'+
      '<div><small>สิทธิ์ที่ใช้งาน</small><strong>'+active.toLocaleString("th-TH")+'</strong><span>Membership</span></div>'+
      '<div><small>ความพร้อมสถานศึกษา</small><strong>'+(schoolAdmin?(schoolSetupReady()?"พร้อมใช้งาน":"กำลังตั้งค่า"):"ตามสิทธิ์ที่ได้รับ")+'</strong></div>'+
    '</div></section>';
}
function membershipHtml(){
  const statusMap={pending:["รออนุมัติ","warning"],active:["ใช้งานได้","success"],rejected:["ไม่อนุมัติ","danger"],suspended:["ระงับ","danger"],ended:["สิ้นสุด","neutral"]};
  const rows=state.memberships.map(m=>{
    const s=statusMap[m.status]||[m.status,"neutral"];
    return '<tr><td>'+esc(m.lao_organizations&&m.lao_organizations.name_th||"-")+'</td><td>'+esc(m.lao_schools&&m.lao_schools.name_th||"-")+'</td><td>'+esc(roleLabels[m.requested_role_code]||m.requested_role_code||"-")+'</td><td><span class="pill '+s[1]+'">'+s[0]+'</span></td><td>'+thaiDate(m.requested_at)+'</td></tr>';
  }).join("");
  const history=rows?'<div class="table-wrap"><table><thead><tr><th>อปท.</th><th>สถานศึกษา</th><th>บทบาท</th><th>สถานะ</th><th>เริ่มต้น</th></tr></thead><tbody>'+rows+'</tbody></table></div>':'<div class="empty-state"><div class="empty-icon">🔐</div><h3>ยังไม่มีสิทธิ์สถานศึกษา</h3><p>บัญชี LAO-EMS สร้างและกำหนดสิทธิ์โดยผู้ดูแลเท่านั้น</p></div>';
  return '<section class="content-grid"><article class="panel"><div class="panel-head"><div><p class="eyebrow">My access</p><h2>สิทธิ์การเข้าใช้งานของฉัน</h2><p class="panel-sub">ผู้ใช้ไม่ต้องสมัครเข้าร่วมโรงเรียนเอง ผู้ดูแลสถานศึกษาจะเป็นผู้เชิญและกำหนดบทบาทให้</p></div></div>'+history+'</article></section>';
}

function profileNeedsSetup(){
  const p=state.profile||{};
  return !String(p.first_name_th||"").trim()||!String(p.last_name_th||"").trim();
}
function profileFieldsHtml(context){
  const p=state.profile||{};
  const rawPrefix=String(p.prefix||"").trim();
  const standardPrefixes=["","นาย","นาง","นางสาว"];
  const customPrefix=Boolean(rawPrefix&&!standardPrefixes.includes(rawPrefix));
  const first=esc(p.first_name_th||""),last=esc(p.last_name_th||""),phone=esc(p.phone||"");
  const email=esc(state.user&&state.user.email||"");
  const prefixOptions=[
    ["","ไม่ระบุ"],
    ["นาย","นาย"],
    ["นาง","นาง"],
    ["นางสาว","นางสาว"],
    ["__custom__","ระบุเอง"]
  ].map(([value,label])=>'<option value="'+value+'" '+((customPrefix&&value==="__custom__")||(!customPrefix&&rawPrefix===value)?"selected":"")+'>'+label+'</option>').join("");

  return '<div class="profile-fields">'+
    (context==="profile"?
      '<div class="field profile-email">'+
        '<span class="field-label-line">อีเมลบัญชี</span>'+
        '<div class="profile-email-input-wrap">'+
          '<input name="new_email" type="email" value="'+email+'" data-original-email="'+email+'" data-email-input autocomplete="email" required readonly aria-readonly="true">'+
          '<label class="profile-edit-toggle profile-edit-toggle-inline" title="แก้ไข" aria-label="แก้ไขอีเมล" data-tooltip="แก้ไข"><input type="checkbox" data-email-edit-toggle><span class="profile-toggle-track"><span></span></span></label>'+
        '</div>'+
        '<small data-email-help>ล็อกไว้เพื่อป้องกันการแก้ไขโดยไม่ตั้งใจ เปิดสวิตช์ในช่องอีเมลเมื่อต้องการแก้ไข</small>'+
      '</div>'
    :'')+
    '<div class="profile-name-grid">'+
      '<label class="field profile-prefix"><span class="field-label-line">คำนำหน้า</span><select name="prefix_mode" data-prefix-select>'+prefixOptions+'</select><input class="profile-prefix-custom '+(customPrefix?"":"hidden")+'" name="prefix_custom" value="'+esc(customPrefix?rawPrefix:"")+'" data-prefix-custom placeholder="ระบุคำนำหน้า" maxlength="40" '+(customPrefix?"required":"")+'></label>'+
      '<label class="field"><span class="field-label-line">ชื่อ <span class="required-mark">*</span></span><input name="first_name" value="'+first+'" required autocomplete="given-name" placeholder="ชื่อ"></label>'+
      '<label class="field"><span class="field-label-line">นามสกุล <span class="required-mark">*</span></span><input name="last_name" value="'+last+'" required autocomplete="family-name" placeholder="นามสกุล"></label>'+
    '</div>'+
    '<label class="field profile-phone"><span class="field-label-line">เบอร์โทรศัพท์</span><input name="phone" type="tel" value="'+phone+'" autocomplete="tel" inputmode="tel" placeholder="เช่น 0812345678"><small>ใช้สำหรับข้อมูลติดต่อภายในระบบ ไม่แสดงต่อสาธารณะโดยอัตโนมัติ</small></label>'+
  '</div>';
}

function bindProfileFields(root=document){
  const prefixSelect=q("[data-prefix-select]",root);
  const prefixCustom=q("[data-prefix-custom]",root);
  if(prefixSelect&&prefixCustom){
    const syncPrefix=()=>{
      const custom=prefixSelect.value==="__custom__";
      prefixCustom.classList.toggle("hidden",!custom);
      prefixCustom.required=custom;
      if(!custom)prefixCustom.value="";
    };
    prefixSelect.addEventListener("change",()=>{
      syncPrefix();
      if(prefixSelect.value==="__custom__")prefixCustom.focus();
    });
    syncPrefix();
  }

  const emailToggle=q("[data-email-edit-toggle]",root);
  const emailInput=q("[data-email-input]",root);
  if(emailToggle&&emailInput){
    emailToggle.addEventListener("change",()=>{
      const editing=emailToggle.checked;
      emailInput.readOnly=!editing;
      emailInput.setAttribute("aria-readonly",String(!editing));
      emailInput.classList.toggle("is-editing",editing);
      if(editing){
        emailInput.focus();
        emailInput.select();
      }else{
        emailInput.value=emailInput.dataset.originalEmail||"";
      }
    });
  }
}

function profilePrefixValue(form){
  const select=q("[data-prefix-select]",form);
  const custom=q("[data-prefix-custom]",form);
  if(!select)return "";
  if(select.value!=="__custom__")return String(select.value||"").trim();
  return String(custom&&custom.value||"").trim();
}

function passwordFieldsHtml(required){
  return '<div class="form-row span-2 password-grid"><div class="form-field"><label for="account-password">รหัสผ่านใหม่</label><div class="input-with-action"><input id="account-password" name="password" type="password" autocomplete="new-password" minlength="8" '+(required?'required':'')+' data-password-input><button class="password-toggle" type="button" data-password-toggle aria-label="แสดงรหัสผ่าน" aria-pressed="false"><svg class="eye-open" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.7"/></svg><svg class="eye-closed" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 6.2A10 10 0 0 1 12 6c6.1 0 9.5 6 9.5 6a16 16 0 0 1-3.1 3.8M6.1 6.1C3.8 7.8 2.5 12 2.5 12s3.4 6 9.5 6c1.7 0 3.2-.5 4.5-1.2"/><path d="M9.9 9.9A3 3 0 0 0 14.1 14.1"/></svg></button></div></div><div class="form-field"><label for="account-password-confirm">ยืนยันรหัสผ่านใหม่</label><div class="input-with-action"><input id="account-password-confirm" name="confirm_password" type="password" autocomplete="new-password" minlength="8" '+(required?'required':'')+' data-password-input><button class="password-toggle" type="button" data-password-toggle aria-label="แสดงรหัสผ่าน" aria-pressed="false"><svg class="eye-open" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.7"/></svg><svg class="eye-closed" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 6.2A10 10 0 0 1 12 6c6.1 0 9.5 6 9.5 6a16 16 0 0 1-3.1 3.8M6.1 6.1C3.8 7.8 2.5 12 2.5 12s3.4 6 9.5 6c1.7 0 3.2-.5 4.5-1.2"/><path d="M9.9 9.9A3 3 0 0 0 14.1 14.1"/></svg></button></div></div></div>';
}
function bindPasswordToggles(root=document){
  qa("[data-password-toggle]",root).forEach(button=>{
    if(button.dataset.bound==="1")return;
    button.dataset.bound="1";
    button.addEventListener("click",()=>{
      const field=button.closest(".input-with-action, .password-field");
      const input=field&&field.querySelector("[data-password-input]");
      if(!input)return;
      const show=input.type==="password";
      input.type=show?"text":"password";
      button.classList.toggle("is-visible",show);
      button.setAttribute("aria-pressed",String(show));
      button.setAttribute("aria-label",show?"ซ่อนรหัสผ่าน":"แสดงรหัสผ่าน");
    });
  });
}
function activationHtml(){
  const inv=state.pendingInvitation;
  if(!inv)return '<section class="panel"><div class="empty-state"><div class="empty-icon">✓</div><h3>บัญชีพร้อมใช้งานแล้ว</h3><p>ไม่มีคำเชิญที่รอดำเนินการ</p><a class="primary-btn" href="#/overview">ไปหน้าหลัก</a></div></section>';
  const hasActive=state.memberships.some(m=>m.status==="active"),requirePassword=!hasActive&&!isGoogleAuthUser();
  const unbound=inv.invitation_mode==="platform_first_admin"&&!inv.school_id;
  const schoolLabel=unbound?"จะสร้างจากไฟล์ LEC หลังยืนยันบัญชี":(inv.school_name||"-");
  return '<section class="onboarding-shell"><article class="panel onboarding-card"><div class="panel-head"><div><p class="eyebrow">Account activation</p><h2>ตั้งค่าบัญชี LAO-EMS</h2><p class="panel-sub">กรอกโปรไฟล์และ'+(requirePassword?'กำหนดรหัสผ่านใหม่':'ตรวจสอบข้อมูลก่อนรับสิทธิ์ใหม่')+'</p></div></div><div class="invite-summary"><div><small>อีเมล</small><strong>'+esc(state.user.email||inv.email||"-")+'</strong></div><div><small>สถานศึกษา</small><strong>'+esc(schoolLabel)+'</strong></div><div><small>บทบาท</small><strong>'+esc(roleLabels[inv.role_code]||inv.role_code)+'</strong></div></div>'+(unbound?'<div class="notice success">หลังบันทึกบัญชี ระบบจะพาไปหน้า “นำเข้า LEC” เพื่อสร้างข้อมูล อปท. และสถานศึกษาจากไฟล์ต้นทางโดยอัตโนมัติ</div>':'')+'<form id="activation-form" class="form-grid">'+profileFieldsHtml("activation")+passwordFieldsHtml(requirePassword)+'<div class="span-2 notice">'+(requirePassword?'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร และจะใช้เข้าสู่ระบบครั้งถัดไป':'หากต้องการเปลี่ยนรหัสผ่านในครั้งนี้ สามารถกรอกช่องรหัสผ่านใหม่ได้')+'</div><div class="span-2"><button class="primary-btn" type="submit">'+(unbound?'บันทึกโปรไฟล์และไปนำเข้า LEC':'บันทึกโปรไฟล์และเปิดใช้งานบัญชี')+'</button></div></form></article></section>';
}

function profileHtml(){
  const name=displayName(),school=currentSchool();
  const email=state.user&&state.user.email||"-";
  const roles=state.currentMembership?roleNames():(state.isPlatformAdmin?"ผู้ดูแลแพลตฟอร์ม":"ยังไม่มีสิทธิ์");
  const authMethod=isGoogleAuthUser()?"Google":"อีเมลและรหัสผ่าน";

  return '<section class="profile-page">'+
    '<div class="profile-page-head"><div><p class="eyebrow">MY PROFILE</p><h2>โปรไฟล์ของฉัน</h2><p>จัดการข้อมูลส่วนตัว ข้อมูลติดต่อ และความปลอดภัยของบัญชี LAO-EMS</p></div></div>'+
    '<div class="profile-layout">'+
      '<aside class="profile-summary-card">'+
        '<div class="profile-summary-top"><div class="profile-hero-avatar">'+avatarHtml(name,"profile-avatar-media")+'</div><div class="profile-summary-copy"><span class="profile-kicker">บัญชี LAO-EMS</span><h3>'+esc(name)+'</h3><p class="profile-email-text">'+esc(email)+'</p></div></div>'+
        '<div class="profile-tags"><span class="pill success">บัญชีใช้งานได้</span>'+(school?'<span class="pill">'+esc(school.name_th)+'</span>':'')+'</div>'+
        '<div class="profile-summary-list">'+
          '<div><span>สถานศึกษา</span><strong>'+esc(school&&school.name_th||"ยังไม่เลือกสถานศึกษา")+'</strong></div>'+
          '<div><span>สิทธิ์</span><strong>'+esc(roles)+'</strong></div>'+
          '<div><span>วิธีเข้าสู่ระบบ</span><strong>'+esc(authMethod)+'</strong></div>'+
        '</div>'+
      '</aside>'+
      '<form id="profile-form" class="profile-form-shell">'+
        '<section class="profile-section-card">'+
          '<div class="profile-section-head"><div class="profile-section-icon">👤</div><div><p class="eyebrow">ข้อมูลส่วนตัว</p><h3>ข้อมูลบัญชีและการติดต่อ</h3><p>แก้ไขเฉพาะข้อมูลส่วนตัวของบัญชี ข้อมูลทางราชการของโรงเรียนและนักเรียนอ้างอิงจาก LEC</p></div></div>'+
          profileFieldsHtml("profile")+
        '</section>'+
        '<section class="profile-section-card">'+
          '<div class="profile-section-head"><div class="profile-section-icon">🔐</div><div><p class="eyebrow">ความปลอดภัย</p><h3>อีเมลและรหัสผ่าน</h3><p>หากต้องการเปลี่ยนอีเมลหรือรหัสผ่าน ให้ยืนยันด้วยรหัสผ่านปัจจุบันก่อน</p></div></div>'+
          '<div class="profile-security-grid">'+
            '<div class="form-field current-password-field"><label for="current-password">รหัสผ่านปัจจุบัน</label><div class="input-with-action"><input id="current-password" name="current_password" type="password" autocomplete="current-password" data-password-input placeholder="กรอกเมื่อเปลี่ยนอีเมลหรือรหัสผ่าน"><button class="password-toggle" type="button" data-password-toggle aria-label="แสดงรหัสผ่าน" aria-pressed="false"><svg class="eye-open" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.7"/></svg><svg class="eye-closed" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 6.2A10 10 0 0 1 12 6c6.1 0 9.5 6 9.5 6a16 16 0 0 1-3.1 3.8M6.1 6.1C3.8 7.8 2.5 12 2.5 12s3.4 6 9.5 6c1.7 0 3.2-.5 4.5-1.2"/><path d="M9.9 9.9A3 3 0 0 0 14.1 14.1"/></svg></button></div><small>เว้นว่างไว้หากไม่ได้เปลี่ยนอีเมลหรือรหัสผ่าน</small></div>'+
            passwordFieldsHtml(false)+
          '</div>'+
        '</section>'+
        '<div class="profile-save-bar"><div><strong>ตรวจสอบข้อมูลก่อนบันทึก</strong><span>การเปลี่ยนอีเมลอาจต้องยืนยันอีเมลใหม่ตามการตั้งค่าความปลอดภัย</span></div><button class="primary-btn profile-save-btn" type="submit">บันทึกโปรไฟล์</button></div>'+
      '</form>'+
    '</div>'+
  '</section>';
}

async function setupHtml(){
  const school=currentSchool();
  if(isPlatformAdminMode()){
    return '<section class="content-grid"><article class="panel"><div class="panel-head"><div><p class="eyebrow">Platform settings</p><h2>การตั้งค่าระดับแพลตฟอร์ม</h2><p class="panel-sub">การตั้งค่า Google Drive ของแต่ละโรงเรียนดำเนินการโดย School Admin ในมุมมองโรงเรียน</p></div></div><div class="notice">หากบัญชีนี้เป็น School Admin ด้วย ให้สลับมุมมองด้านบนเป็น <strong>School Admin</strong> แล้วเลือกเมนู “ตั้งค่าสถานศึกษา”</div></article></section>';
  }
  if(!school||!isSchoolAdminContext()){
    return '<section class="panel"><div class="empty-state"><div class="empty-icon">🔒</div><h3>สำหรับ School Admin เท่านั้น</h3><p>ต้องมีสิทธิ์ผู้ดูแลสถานศึกษาและนำเข้า LEC สำเร็จก่อนตั้งค่าโรงเรียน</p></div></section>';
  }

  const setupRes=await supabase.rpc("lao_ensure_school_settings",{p_school_id:school.id});
  if(setupRes.error)throw setupRes.error;
  state.schoolSetup=setupRes.data||{};
  const s=state.schoolSetup;
  const status=(ok)=>'<span class="pill '+(ok?"success":"warning")+'">'+(ok?"เสร็จแล้ว":"ต้องดำเนินการ")+'</span>';
  const driveLabel=s.drive_connected?"เชื่อมแล้ว":"ยังไม่เชื่อม";
  const root="/"+esc(s.drive_root_folder_name||"LAO-EMS")+"/";

  return '<section class="setup-hero panel"><div><p class="eyebrow">School onboarding</p><h2>เตรียม '+esc(school.name_th)+' ให้พร้อมใช้งาน</h2><p>ดำเนินการตามลำดับให้ครบก่อนเชิญผู้ใช้ในโรงเรียน</p></div><span class="pill '+(s.can_invite_users?"success":"warning")+'">'+(s.can_invite_users?"พร้อมใช้งาน":"กำลังตั้งค่า")+'</span></section>'+
  '<section class="setup-progress">'+
    '<article class="setup-step '+(s.lec_ready?"done":"")+'"><span>1</span><div><strong>นำเข้า LEC</strong><small>สร้างและยืนยันข้อมูลสถานศึกษาจากแหล่งต้นทาง</small></div>'+status(s.lec_ready)+'</article>'+
    '<article class="setup-step '+(s.settings_ready?"done":"")+'"><span>2</span><div><strong>ตั้งค่าการใช้งาน</strong><small>กำหนดภาษา เขตเวลา และค่าเริ่มต้นของไฟล์</small></div>'+status(s.settings_ready)+'</article>'+
    '<article class="setup-step '+(s.drive_connected?"done":"")+'"><span>3</span><div><strong>Google Drive</strong><small>เชื่อมบัญชีและสร้างโฟลเดอร์หลัก '+root+'</small></div>'+status(s.drive_connected)+'</article>'+
    '<article class="setup-step '+(s.can_invite_users?"done":"")+'"><span>4</span><div><strong>เชิญผู้ใช้</strong><small>ปลดล็อกเมื่อขั้นตอนก่อนหน้าครบ</small></div>'+status(s.can_invite_users)+'</article>'+
  '</section>'+
  '<section class="content-grid"><article class="panel"><div class="panel-head"><div><p class="eyebrow">ค่าการใช้งาน</p><h2>ตั้งค่าพื้นฐานของโรงเรียน</h2><p class="panel-sub">ข้อมูลชื่อโรงเรียน ที่อยู่ และข้อมูลทางราชการไม่แก้ที่หน้านี้ เพราะมาจาก LEC</p></div></div><form id="school-settings-form" class="form-grid compact-settings"><label class="field">เขตเวลา<select name="timezone"><option value="Asia/Bangkok" selected>ประเทศไทย (Asia/Bangkok)</option></select></label><label class="field">ภาษาหลัก<select name="locale"><option value="th-TH" '+(s.locale!=="en-US"?"selected":"")+'>ไทย</option><option value="en-US" '+(s.locale==="en-US"?"selected":"")+'>English</option></select></label><label class="field span-2">การมองเห็นไฟล์เริ่มต้น<select name="default_file_visibility"><option value="internal" '+(s.default_file_visibility==="internal"?"selected":"")+'>ภายในโรงเรียน</option><option value="private" '+(s.default_file_visibility==="private"?"selected":"")+'>เฉพาะผู้เกี่ยวข้อง</option><option value="public" '+(s.default_file_visibility==="public"?"selected":"")+'>สาธารณะ (เฉพาะไฟล์ที่อนุญาต)</option></select><small>สามารถกำหนดเป็นรายไฟล์ได้ภายหลัง</small></label><div class="span-2"><button class="primary-btn" type="submit">บันทึกการตั้งค่า</button></div></form></article>'+
  '<article class="panel drive-setup-card"><div class="panel-head"><div><p class="eyebrow">Google Drive</p><h2>พื้นที่จัดเก็บของสถานศึกษา</h2><p class="panel-sub">หนึ่งโรงเรียนเชื่อม Google Drive หนึ่งบัญชี/Shared Drive เพื่อเก็บไฟล์จริง ส่วน LAO-EMS เก็บ metadata และสิทธิ์การเข้าถึง</p></div>'+status(s.drive_connected)+'</div><div class="drive-root-preview"><span class="drive-icon">▣</span><div><small>โฟลเดอร์หลักของระบบ</small><strong>'+root+'</strong><p>เมื่อเชื่อมสำเร็จ ระบบจะใช้โฟลเดอร์นี้เป็นราก และจะสร้างโฟลเดอร์ย่อยตามโมดูลเมื่อเปิดใช้งานในระยะต่อไป</p></div></div>'+(s.drive_connected?'<div class="drive-connected"><strong>'+esc(s.drive_account_email||"Google Drive")+'</strong><small>เชื่อมเมื่อ '+(s.drive_connected_at?thaiDateTime(s.drive_connected_at):"-")+'</small></div>':'<div class="notice warning"><strong>ยังไม่ได้เชื่อม Google Drive</strong><br>กด “เชื่อม Google Drive” เพื่อเลือกบัญชี Google ของสถานศึกษา ระบบจะขอสิทธิ์เฉพาะไฟล์ที่ LAO-EMS สร้าง และสร้าง '+root+' อัตโนมัติ</div>')+'<div class="action-row">'+(s.drive_connected?'<button class="secondary-btn" type="button" data-drive-refresh>ตรวจสอบสถานะอีกครั้ง</button>':'<button class="primary-btn" type="button" data-drive-connect>เชื่อม Google Drive</button>')+'</div></article></section>'+
  (s.can_invite_users?'<section class="panel"><div class="notice success"><strong>ตั้งค่าครบแล้ว</strong><br>โรงเรียนพร้อมเชิญผู้ใช้และกำหนดสิทธิ์</div><div class="action-row"><a class="primary-btn" href="#/users">ไปที่ผู้ใช้และสิทธิ์</a></div></section>':'');
}


async function organizationHtml(){
  const res=await supabase.from("lao_schools")
    .select("id,name_th,code,organization_id,is_active,source_system,lec_synced_at,lec_source_file_name,lec_province_name_th,lec_district_name_th,lec_organization_name_th,lao_organizations(id,name_th)")
    .order("name_th");
  if(res.error)throw res.error;
  const schools=res.data||[];
  state.orgSchools=schools;

  const rows=schools.map(s=>{
    const synced=s.source_system==="LEC"&&s.lec_synced_at;
    const source=synced?'<span class="pill success">LEC</span>':'<span class="pill warning">รอ LEC</span>';
    const area=[s.lec_district_name_th,s.lec_province_name_th].filter(Boolean).join(" · ")||"-";
    const last=s.lec_synced_at?thaiDateTime(s.lec_synced_at):"ยังไม่เคยนำเข้า";
    return '<tr><td>'+esc(s.lao_organizations&&s.lao_organizations.name_th||s.lec_organization_name_th||"-")+'</td><td><strong>'+esc(s.name_th)+'</strong><br><small>'+esc(s.code||"")+'</small></td><td>'+esc(area)+'</td><td>'+source+'<br><small>'+esc(last)+'</small></td><td><span class="pill success">อ่านจาก LEC</span></td></tr>';
  }).join("");

  const flow='<article class="panel source-only-panel"><div class="panel-head"><div><p class="eyebrow">LEC SOURCE ONLY</p><h2>ไม่กรอก อปท. หรือสถานศึกษาเอง</h2><p class="panel-sub">ข้อมูลทางราชการของ อปท. และสถานศึกษาจะถูกสร้างจากไฟล์ LEC เท่านั้น เพื่อให้ตรงกับระบบกลาง</p></div><span class="source-lock">🔒 LEC เท่านั้น</span></div><div class="onboarding-flow"><div><span>1</span><strong>เชิญ School Admin คนแรก</strong><small>Platform Admin ระบุเฉพาะอีเมลผู้ดูแลคนแรก</small></div><div><span>2</span><strong>ผู้รับยืนยันบัญชี</strong><small>ตั้งค่าโปรไฟล์และรหัสผ่านของตนเอง</small></div><div><span>3</span><strong>นำเข้าไฟล์ LEC</strong><small>ระบบสร้าง อปท. และสถานศึกษาอัตโนมัติจากข้อมูลในไฟล์</small></div></div>'+(state.isPlatformAdmin?'<div class="action-row"><a class="primary-btn" href="#/users">เชิญ School Admin คนแรก</a></div>':'')+'</article>';

  const list=schools.length
    ? '<article class="panel"><div class="panel-head"><div><p class="eyebrow">LEC master data</p><h2>อปท. และสถานศึกษาในระบบ</h2><p class="panel-sub">หน้านี้เป็นแบบอ่านอย่างเดียว หากข้อมูลเปลี่ยนให้แก้ที่ LEC แล้วนำเข้าไฟล์รอบใหม่</p></div></div><div class="table-wrap"><table><thead><tr><th>อปท.</th><th>สถานศึกษา</th><th>พื้นที่</th><th>ข้อมูลต้นทาง</th><th>สถานะ</th></tr></thead><tbody>'+rows+'</tbody></table></div></article>'
    : '<article class="panel"><div class="empty-state"><div class="empty-icon">🏫</div><h3>ยังไม่มีสถานศึกษาจาก LEC</h3><p>ไม่ต้องสร้าง อปท. หรือโรงเรียนด้วยมือ ให้เชิญ School Admin คนแรก แล้วผู้ดูแลโรงเรียนนำเข้าไฟล์ LEC เพื่อสร้างข้อมูลอัตโนมัติ</p>'+(state.isPlatformAdmin?'<a class="primary-btn" href="#/users">เชิญ School Admin คนแรก</a>':'')+'</div></article>';
  return '<section class="content-grid">'+flow+list+'</section>';
}

async function usersHtml(){
  if(!hasRole("platform_admin","school_admin"))return '<section class="panel"><div class="empty-state"><div class="empty-icon">🛡️</div><h3>เมนูนี้สำหรับผู้ดูแล</h3><p>บัญชีผู้ใช้ LAO-EMS เริ่มต้นโดยผู้ดูแลเท่านั้น</p></div></section>';

  const school=currentSchool();

  if(state.isPlatformAdmin&&!school){
    const [linkRes,appRes]=await Promise.all([
      supabase.from("lao_school_admin_invite_links").select("id,token,label,is_active,expires_at,created_at").order("created_at",{ascending:false}).limit(50),
      supabase.from("lao_school_admin_applications").select("id,email,prefix,first_name_th,last_name_th,phone,claimed_organization_name,claimed_school_name,applicant_note,document_object_path,document_file_name,document_mime_type,document_size,status,created_at,reviewed_at,review_note").order("created_at",{ascending:false}).limit(100)
    ]);
    if(linkRes.error)throw linkRes.error;if(appRes.error)throw appRes.error;
    const base=location.origin+location.pathname;
    const links=(linkRes.data||[]).map(x=>{
      const url=base+"#/apply-school-admin/"+x.token;
      const open=x.is_active&&(!x.expires_at||new Date(x.expires_at)>new Date());
      return '<tr><td><strong>'+esc(x.label)+'</strong><br><small>'+thaiDateTime(x.created_at)+'</small></td><td><span class="pill '+(open?"success":"neutral")+'">'+(open?"เปิดรับ":"ปิด")+'</span></td><td><code class="link-code">'+esc(url)+'</code></td><td><div class="row-actions"><button class="secondary-btn compact-btn" type="button" data-copy-admin-link="'+esc(url)+'">คัดลอกลิงก์</button><button class="'+(x.is_active?"danger-btn":"secondary-btn")+' compact-btn" type="button" data-toggle-admin-link="'+x.id+'" data-next-active="'+(!x.is_active)+'">'+(x.is_active?"ปิดรับ":"เปิดรับ")+'</button></div></td></tr>';
    }).join("");
    const apps=(appRes.data||[]).map(x=>{
      const status={pending:["รอตรวจเอกสาร","warning"],approved:["อนุมัติแล้ว","success"],rejected:["ไม่อนุมัติ","danger"]}[x.status]||[x.status,"neutral"];
      const name=[x.prefix,x.first_name_th,x.last_name_th].filter(Boolean).join(" ");
      const actions=x.status==="pending"?'<div class="row-actions"><button class="secondary-btn compact-btn" type="button" data-view-verification="'+x.document_object_path+'">ดูเอกสาร</button><button class="primary-btn compact-btn" type="button" data-approve-admin-app="'+x.id+'">อนุมัติและส่งคำเชิญ</button><button class="danger-btn compact-btn" type="button" data-reject-admin-app="'+x.id+'">ไม่อนุมัติ</button></div>':'<button class="secondary-btn compact-btn" type="button" data-view-verification="'+x.document_object_path+'">ดูเอกสาร</button>';
      return '<tr><td><strong>'+esc(name)+'</strong><br><small>'+esc(x.email)+' · '+esc(x.phone||"-")+'</small></td><td>'+esc(x.claimed_organization_name||"-")+'<br><small>'+esc(x.claimed_school_name||"-")+'</small></td><td>'+esc(x.document_file_name)+'<br><small>'+Math.ceil((x.document_size||0)/1024)+' KB</small></td><td><span class="pill '+status[1]+'">'+status[0]+'</span></td><td>'+actions+'</td></tr>';
    }).join("");
    return '<section class="content-grid">'+
      (!state.currentMembership?'<article class="panel self-school-card"><div class="panel-head"><div><p class="eyebrow">My school</p><h2>ตั้งค่าสถานศึกษาของ Platform Admin</h2><p class="panel-sub">บัญชี Platform Admin สามารถเป็น School Admin ของโรงเรียนตนเองได้ โดยเริ่มจาก LEC เพื่อสร้าง school_id และสิทธิ์โรงเรียน</p></div></div><button class="primary-btn" type="button" data-platform-self-school>เริ่มจาก LEC ของโรงเรียนฉัน</button></article>':'')+
      '<article class="panel"><div class="panel-head"><div><p class="eyebrow">School Admin invitation link</p><h2>ลิงก์รับคำขอ School Admin</h2><p class="panel-sub">คัดลอกลิงก์ส่งให้ผู้ที่จะเป็น School Admin ผู้สมัครต้องแนบเอกสารยืนยันทุกครั้ง และลิงก์สามารถเปิด/ปิดรับคำขอได้</p></div></div><form id="admin-link-form" class="responsive-form-grid admin-link-form"><label class="field">ชื่อ/หมายเหตุของลิงก์<input name="label" value="รับคำขอ School Admin" required></label><label class="field">อายุลิงก์<select name="expires_days"><option value="30">30 วัน</option><option value="7">7 วัน</option><option value="90">90 วัน</option><option value="">ไม่กำหนดวันหมดอายุ</option></select></label><div class="span-all"><button class="primary-btn" type="submit">สร้างลิงก์ใหม่</button></div></form>'+(links?'<div class="table-wrap"><table><thead><tr><th>ลิงก์</th><th>สถานะ</th><th>URL</th><th>จัดการ</th></tr></thead><tbody>'+links+'</tbody></table></div>':'<div class="empty-state compact-empty"><div class="empty-icon">🔗</div><h3>ยังไม่มีลิงก์รับคำขอ</h3></div>')+'</article>'+
      '<article class="panel"><div class="panel-head"><div><p class="eyebrow">Verification queue</p><h2>คำขอ School Admin และเอกสารยืนยัน</h2><p class="panel-sub">ตรวจเอกสารก่อนอนุมัติ เมื่ออนุมัติแล้วระบบจึงส่งคำเชิญบัญชี LAO-EMS ไปยังอีเมลผู้สมัคร</p></div></div>'+(apps?'<div class="table-wrap"><table><thead><tr><th>ผู้สมัคร</th><th>อปท./สถานศึกษา</th><th>เอกสาร</th><th>สถานะ</th><th>ดำเนินการ</th></tr></thead><tbody>'+apps+'</tbody></table></div>':'<div class="empty-state compact-empty"><div class="empty-icon">📎</div><h3>ยังไม่มีคำขอรอตรวจสอบ</h3></div>')+'</article>'+
    '</section>';
  }
  if(!school)return '<section class="panel"><div class="empty-state"><div class="empty-icon">🏫</div><h3>ยังไม่มีสถานศึกษา</h3><p>สถานศึกษาจะถูกสร้างจาก LEC หลัง School Admin คนแรกยืนยันบัญชี</p></div></section>';

  const isLocalAdmin=isSchoolAdminContext();
  if(isLocalAdmin){
    const setupRes=await supabase.rpc("lao_school_setup_status",{p_school_id:school.id});
    if(setupRes.error)throw setupRes.error;
    state.schoolSetup=setupRes.data||null;
    if(!schoolSetupReady()){
      return '<section class="content-grid"><article class="panel"><div class="empty-state"><div class="empty-icon">⚙</div><h3>ตั้งค่าสถานศึกษาให้ครบก่อน</h3><p>ต้องนำเข้า LEC บันทึกค่าพื้นฐาน และเชื่อม Google Drive ก่อนจึงจะเชิญผู้ใช้หรือแต่งตั้งผู้ดูแลร่วมได้</p><a class="primary-btn" href="#/setup">ไปตั้งค่าสถานศึกษา</a></div></article></section>';
    }
  }

  const hasAdminRes=await supabase.rpc("lao_school_has_admin",{p_school_id:school.id});
  if(hasAdminRes.error)throw hasAdminRes.error;
  const schoolHasAdmin=hasAdminRes.data===true;
  const platformMayInvite=false;

  const invRes=await supabase.from("lao_user_invitations")
    .select("id,email,role_code,invitation_mode,status,sent_at,accepted_at")
    .eq("school_id",school.id).order("sent_at",{ascending:false}).limit(100);
  if(invRes.error)throw invRes.error;

  const roleOptions=isLocalAdmin
    ? [["school_admin","ผู้ดูแลสถานศึกษาร่วม"],["school_executive","ผู้บริหารสถานศึกษา"],["registrar","งานทะเบียน"],["academic_officer","งานวิชาการ"],["teacher","ครู"],["staff","บุคลากร"],["student","นักเรียน"],["guardian","ผู้ปกครอง"]]
    : [["school_admin","ผู้ดูแลสถานศึกษาคนแรก"]];
  const canInvite=isLocalAdmin||platformMayInvite;
  const inviteForm=canInvite
    ? '<article class="panel form-card"><div class="panel-head"><div><p class="eyebrow">Admin-managed account</p><h2>เชิญผู้ใช้เข้า LAO-EMS</h2><p class="panel-sub">'+(state.isPlatformAdmin?'Platform Admin เชิญเฉพาะ School Admin คนแรกของสถานศึกษาที่มีอยู่แล้ว':'กรอกอีเมลและกำหนดบทบาท ระบบจะส่งลิงก์ยืนยันไปยังอีเมล')+'</p></div></div><form id="invite-user-form" class="form-grid" style="margin-top:18px"><label class="field">อีเมลผู้ใช้<input name="email" type="email" autocomplete="off" required placeholder="name@example.com"></label><label class="field">บทบาท<select name="role_code" required>'+roleOptions.map(([v,l])=>'<option value="'+v+'">'+l+'</option>').join("")+'</select></label><div class="span-2 notice">ผู้รับยืนยันอีเมล ตั้งค่าโปรไฟล์ และกำหนดรหัสผ่านของตนเองก่อนใช้งาน</div><div class="span-2"><button class="primary-btn" type="submit">ส่งคำเชิญทางอีเมล</button></div></form></article>'
    : '<article class="panel"><div class="notice"><strong>'+((state.isPlatformAdmin&&!schoolHasAdmin)?"การแต่งตั้ง School Admin ต้องผ่านลิงก์และเอกสารยืนยัน":"โรงเรียนมี School Admin แล้ว")+'</strong><br>'+((state.isPlatformAdmin&&!schoolHasAdmin)?"กลับไปมุมมองทุกสถานศึกษา แล้วใช้ “ลิงก์รับคำขอ School Admin” เพื่อให้ผู้สมัครแนบเอกสารก่อนอนุมัติ":"การสร้างผู้ใช้และผู้ดูแลร่วมเป็นหน้าที่ของ School Admin โรงเรียนนี้ Platform Admin ตรวจสอบได้แต่ไม่สร้างผู้ใช้แทน")+'</div></article>';

  const rows=(invRes.data||[]).map(x=>{
    const status={pending:["รอยืนยัน","warning"],onboarding:["รอนำเข้า LEC","warning"],accepted:["เปิดใช้งานแล้ว","success"],revoked:["ยกเลิก","neutral"],failed:["ส่งไม่สำเร็จ","danger"]}[x.status]||[x.status,"neutral"];
    return '<tr><td><strong>'+esc(x.email)+'</strong><br><small>'+thaiDateTime(x.sent_at)+'</small></td><td>'+esc(roleLabels[x.role_code]||x.role_code)+'</td><td><span class="pill '+status[1]+'">'+status[0]+'</span></td><td>'+esc(x.invitation_mode==="platform_first_admin"?"Platform Admin · คนแรก":"School Admin")+'</td></tr>';
  }).join("");
  const history='<article class="panel"><div class="panel-head"><div><p class="eyebrow">Invitation history</p><h2>บัญชีและคำเชิญ · '+esc(school.name_th)+'</h2></div></div>'+(rows?'<div class="table-wrap"><table><thead><tr><th>อีเมล</th><th>บทบาท</th><th>สถานะ</th><th>ผู้รับผิดชอบ</th></tr></thead><tbody>'+rows+'</tbody></table></div>':'<div class="empty-state"><div class="empty-icon">✉️</div><h3>ยังไม่มีคำเชิญ</h3></div>')+'</article>';
  return '<section class="content-grid">'+inviteForm+history+'</section>';
}

function notificationsHtml(){
  const rows=state.notifications.map(n=>{
    const unread=!n.read_at;
    return '<article class="notification-card '+(unread?"unread":"")+'"><div class="notification-icon">🔔</div><div class="notification-copy"><div class="notification-title"><strong>'+esc(n.title)+'</strong>'+(unread?'<span class="pill warning">ใหม่</span>':'')+'</div><p>'+esc(n.body||"")+'</p><small>'+thaiDateTime(n.created_at)+'</small></div>'+(unread?'<button class="secondary-btn" data-notification-read="'+n.id+'">ทำเครื่องหมายว่าอ่านแล้ว</button>':'')+'</article>';
  }).join("");
  return '<section class="panel"><div class="panel-head"><div><p class="eyebrow">Notifications</p><h2>การแจ้งเตือน</h2><p class="panel-sub">แจ้งคำขอสมาชิก การแต่งตั้งผู้ดูแล และเหตุการณ์สำคัญของระบบ</p></div></div>'+(rows?'<div class="notification-list">'+rows+'</div>':'<div class="empty-state"><div class="empty-icon">🔔</div><h3>ยังไม่มีการแจ้งเตือน</h3><p>เมื่อมีรายการที่ต้องดำเนินการ ระบบจะแสดงที่นี่</p></div>')+'</section>';
}

function lecHeaderText(v){return String(v==null?"":v).replace(/\u00a0/g," ").replace(/\s+/g," ").trim();}
function lecHeaderNorm(v){return lecHeaderText(v).replace(/[\s\/\\:;,.()\[\]{}\-_–—]/g,"").toLowerCase();}
function lecCellText(cell){
  if(cell==null)return "";
  if(typeof cell==="string")return cell.trim();
  if(typeof cell==="number")return String(cell);
  if(cell instanceof Date){
    const d=String(cell.getDate()).padStart(2,"0"),m=String(cell.getMonth()+1).padStart(2,"0");
    const y=cell.getFullYear()+543;
    return d+"/"+m+"/"+y;
  }
  return String(cell).trim();
}
function lecWorksheetMatrix(ws){
  if(!ws)return [];
  const maxRows=12000,maxCols=180;
  let matrix=[];

  try{
    const rows=XLSX.utils.sheet_to_json(ws,{
      header:1,
      raw:true,
      defval:"",
      blankrows:true
    });
    if(Array.isArray(rows)&&rows.length){
      const rowLimit=Math.min(rows.length,maxRows);
      let width=0;
      for(let r=0;r<rowLimit;r++)width=Math.max(width,Array.isArray(rows[r])?rows[r].length:0);
      width=Math.min(Math.max(width,1),maxCols);
      matrix=Array.from({length:rowLimit},(_,r)=>{
        const src=Array.isArray(rows[r])?rows[r]:[];
        return Array.from({length:width},(_,c)=>lecCellText(src[c]));
      });
    }
  }catch(_){}

  if(!matrix.length&&ws["!ref"]){
    const range=XLSX.utils.decode_range(ws["!ref"]);
    const rowLimit=Math.min(range.e.r+1,maxRows),colLimit=Math.min(range.e.c+1,maxCols);
    matrix=Array.from({length:rowLimit},()=>Array(colLimit).fill(""));
    for(let r=0;r<rowLimit;r++)for(let col=0;col<colLimit;col++){
      const cell=ws[XLSX.utils.encode_cell({r,col})];
      if(cell){
        const source=cell.v!=null?cell.v:cell.w;
        matrix[r][col]=lecCellText(source);
      }
    }
  }

  if(!matrix.length)return [];
  const width=Math.min(Math.max(...matrix.map(row=>row.length),1),maxCols);
  matrix=matrix.slice(0,maxRows).map(row=>{
    const out=Array.from({length:width},(_,c)=>lecCellText(row[c]));
    return out;
  });

  (ws["!merges"]||[]).forEach(m=>{
    if(m.s.r>=matrix.length||m.s.c>=width)return;
    const value=matrix[m.s.r]&&matrix[m.s.r][m.s.c]||"";
    if(!value)return;
    for(let r=m.s.r;r<=Math.min(m.e.r,matrix.length-1);r++){
      for(let col=m.s.c;col<=Math.min(m.e.c,width-1);col++){
        if(!matrix[r][col])matrix[r][col]=value;
      }
    }
  });
  return matrix;
}

function lecFindHeaderStart(matrix){
  const limit=Math.min(matrix.length,60);
  for(let r=0;r<limit;r++){
    const n=matrix[r].map(lecHeaderNorm);
    const hasStudentNo=n.some(x=>x.includes("เลขประจำตัวนักเรียน"));
    const hasName=n.some(x=>x==="ชื่อ"||x.includes("คำนำหน้า")||x.includes("นามสกุล"));
    if(hasStudentNo&&(n.some(x=>x.includes("ลำดับที่"))||hasName))return r;
  }
  return -1;
}
function lecFlattenHeaders(matrix,start){
  let studentNoCol=-1;
  for(let r=start;r<Math.min(matrix.length,start+5);r++){
    const c=matrix[r].findIndex(v=>lecHeaderNorm(v).includes("เลขประจำตัวนักเรียน"));
    if(c>=0){studentNoCol=c;break;}
  }
  if(studentNoCol<0)throw new Error("ไม่พบคอลัมน์เลขประจำตัวนักเรียน");
  let dataStart=-1;
  for(let r=start+1;r<Math.min(matrix.length,start+12);r++){
    const sid=lecHeaderText(matrix[r][studentNoCol]);
    const first=lecHeaderText(matrix[r][0]);
    if(sid&&(!lecHeaderNorm(sid).includes("เลขประจำตัวนักเรียน"))&&(/^\d+$/.test(first)||/^\d+$/.test(sid))){
      dataStart=r;break;
    }
  }
  if(dataStart<0)dataStart=start+2;
  const colCount=Math.max(...matrix.slice(start,Math.min(dataStart+1,matrix.length)).map(row=>row.length),0);
  const headers=[];
  for(let col=0;col<colCount;col++){
    const parts=[];
    for(let r=start;r<dataStart;r++){
      const v=lecHeaderText(matrix[r][col]);
      if(v&&!parts.includes(v))parts.push(v);
    }
    headers.push(parts.join(" / ")||("คอลัมน์ "+(col+1)));
  }
  return {headers,dataStart,studentNoCol};
}
function lecFindCol(headers,{include=[],exclude=[]}){
  const inc=include.map(lecHeaderNorm),exc=exclude.map(lecHeaderNorm);
  return headers.findIndex(h=>{
    const n=lecHeaderNorm(h);
    return inc.every(x=>n.includes(x))&&!exc.some(x=>n.includes(x));
  });
}
function lecBuildMap(headers){
  const map={};
  const topExclude=["บิดา","มารดา","ผู้ปกครอง","ที่อยู่ตามทะเบียนบ้าน","ที่อยู่ปัจจุบัน"];
  const put=(key,include,exclude=[])=>{const x=lecFindCol(headers,{include,exclude});if(x>=0)map[key]=x;};

  // Official school identity columns from the LEC report.
  put("school_province",["จังหวัด"],topExclude);
  put("school_district",["อำเภอ"],topExclude);
  put("organization_name_th",["อปท"]);
  put("school_name_th",["สถานศึกษา"]);
  put("academic_year_be",["ปีการศึกษา"]);
  put("term_no",["ภาคเรียน"]);

  put("student_no",["เลขประจำตัวนักเรียน"]);
  put("prefix",["คำนำหน้า"],topExclude);
  put("first_name_th",["ชื่อ"],["บิดา","มารดา","ผู้ปกครอง","ชื่อเรื่อง"]);
  put("last_name_th",["นามสกุล"],topExclude);
  put("birth_date",["วันเดือนปี","เกิด"]);
  put("race",["เชื้อชาติ"]);
  put("nationality",["สัญชาติ"]);
  put("religion",["ศาสนา"],["บิดา","มารดา","ผู้ปกครอง"]);
  put("citizen_id",["เลขประจำตัวประช"]);
  put("admission_date",["วันเดือนปี","เข้าศึกษา"]);
  put("height_cm",["ส่วนสูง"]);
  put("weight_kg",["น้ำหนัก"]);
  put("student_condition",["สภาพนักเรียน"]);
  put("family_status",["สถานภาพ"]);
  put("tuition_reimbursement",["สิทธิการเบิกค่าเล่าเรียน"]);
  put("medical_reimbursement",["สิทธิการเบิกค่ารักษาพยาบาล"]);
  let x=lecFindCol(headers,{include:["ระดับชั้น"]}); if(x<0)x=lecFindCol(headers,{include:["ชั้น"],exclude:["คำนำหน้า"]}); if(x>=0)map.grade_level=x;
  x=lecFindCol(headers,{include:["ห้องเรียน"]}); if(x<0)x=lecFindCol(headers,{include:["ห้อง"]}); if(x>=0)map.classroom=x;

  for(const [group,key] of [["บิดา","father"],["มารดา","mother"],["ผู้ปกครอง","guardian"]]){
    for(const [field,labels] of [["prefix",["คำนำหน้า"]],["first_name",["ชื่อ"]],["last_name",["นามสกุล"]],["religion",["ศาสนา"]],["occupation",["อาชีพ"]],["monthly_income",["รายได้"]],["phone",["เบอร์โทร"]],["relationship",["ความเกี่ยวข้อง"]]]){
      const col=lecFindCol(headers,{include:[group,...labels]}); if(col>=0)map[key+"."+field]=col;
    }
  }
  for(const [group,key] of [["ที่อยู่ตามทะเบียนบ้าน","registered_address"],["ที่อยู่ปัจจุบัน","current_address"]]){
    for(const [field,labels] of [["house_no",["เลขที่"]],["moo",["หมู่ที่"]],["road",["ถนน"]],["subdistrict",["ตำบล"]],["district",["อำเภอ"]],["province",["จังหวัด"]],["postal_code",["รหัสไปรษณีย์"]]]){
      const col=lecFindCol(headers,{include:[group,...labels]}); if(col>=0)map[key+"."+field]=col;
    }
  }
  return map;
}
function lecRowObject(headers,row){
  const out={},used={};
  headers.forEach((h,idx)=>{
    let k=h||("คอลัมน์ "+(idx+1)); used[k]=(used[k]||0)+1;
    if(used[k]>1)k=k+" ["+used[k]+"]";
    out[k]=lecCellText(row[idx]);
  });
  return out;
}
function lecMappedValue(row,map,key){
  const col=map[key]; return col==null?undefined:lecCellText(row[col]);
}
function lecBuildCanonical(row,map){
  const c={};
  const set=(key)=>{const v=lecMappedValue(row,map,key);if(v!==undefined)c[key]=v;};
  ["school_province","school_district","organization_name_th","school_name_th","academic_year_be","term_no","student_no","prefix","first_name_th","last_name_th","birth_date","race","nationality","religion","citizen_id","admission_date","height_cm","weight_kg","student_condition","family_status","tuition_reimbursement","medical_reimbursement","grade_level","classroom"].forEach(set);
  for(const group of ["father","mother","guardian"]){
    const o={};
    for(const field of ["prefix","first_name","last_name","religion","occupation","monthly_income","phone","relationship"]){
      const v=lecMappedValue(row,map,group+"."+field); if(v!==undefined)o[field]=v;
    }
    if(Object.values(o).some(v=>v))c[group]=o;
  }
  for(const group of ["registered_address","current_address"]){
    const o={};
    for(const field of ["house_no","moo","road","subdistrict","district","province","postal_code"]){
      const v=lecMappedValue(row,map,group+"."+field); if(v!==undefined)o[field]=v;
    }
    if(Object.values(o).some(v=>v))c[group]=o;
  }
  return c;
}
function lecHeaderMapForServer(headers,map){
  return Object.fromEntries(Object.entries(map).map(([key,col])=>[key,headers[col]||("คอลัมน์ "+(col+1))]));
}
async function lecSha256(buffer){
  if(!crypto||!crypto.subtle)return null;
  const digest=await crypto.subtle.digest("SHA-256",buffer);
  return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,"0")).join("");
}
function lecMetaFind(matrix,headerStart,labels){
  const rows=matrix.slice(0,Math.max(headerStart,0)),normLabels=labels.map(lecHeaderNorm);
  for(const row of rows){
    for(let col=0;col<row.length;col++){
      const raw=lecHeaderText(row[col]); if(!raw)continue;
      const norm=lecHeaderNorm(raw);
      for(let j=0;j<normLabels.length;j++){
        const label=labels[j],nLabel=normLabels[j];
        if(!norm.includes(nLabel))continue;
        const parts=raw.split(/[:：]/);
        if(parts.length>1){
          const tail=parts.slice(1).join(":").trim();
          if(tail)return tail;
        }
        const idx=raw.indexOf(label);
        if(idx>=0){
          const tail=raw.slice(idx+label.length).replace(/^\s*[-–—:]?\s*/,"").trim();
          if(tail)return tail;
        }
        for(let k=col+1;k<Math.min(row.length,col+5);k++){
          const next=lecHeaderText(row[k]); if(next)return next;
        }
      }
    }
  }
  return null;
}
function lecUniqueMappedValues(matrix,dataStart,map,key){
  const values=[],seen=new Set();
  for(let r=dataStart;r<matrix.length;r++){
    const studentNo=lecMappedValue(matrix[r],map,"student_no");
    if(!studentNo)continue;
    const value=lecMappedValue(matrix[r],map,key);
    if(!value)continue;
    const norm=lecHeaderNorm(value);
    if(seen.has(norm))continue;
    seen.add(norm);values.push(value);
    if(values.length>=10)break;
  }
  return values;
}
function lecArabicDigits(value){
  const th="๐๑๒๓๔๕๖๗๘๙";
  return String(value==null?"":value).replace(/[๐-๙]/g,d=>String(th.indexOf(d)));
}
function lecParseAcademicYear(value){
  const text=lecArabicDigits(value);
  const years=(text.match(/(?:24|25|26|27)\d{2}/g)||[]).map(Number);
  return years.find(y=>y>=2400&&y<=2800)||null;
}
function lecParseTerm(value){
  const text=lecArabicDigits(value).trim();
  if(/^[1-4]$/.test(text))return Number(text);
  const m=text.match(/ภาคเรียน(?:ที่)?\s*([1-4])(?:\D|$)/i);
  return m?Number(m[1]):null;
}
function lecPeriodFromFileName(fileName){
  const stem=String(fileName||"").replace(/\.(?:xls|xlsx)$/i,"").trim();
  const m=stem.match(/(?:^|[\s_-])((?:25)?\d{2})[._-]([1-4])$/);
  if(!m)return {academic_year_be:null,term_no:null,source:null};
  let year=Number(m[1]),term=Number(m[2]);
  if(year>=0&&year<=99)year+=2500;
  if(year<2400||year>2800)return {academic_year_be:null,term_no:null,source:null};
  return {academic_year_be:year,term_no:term,source:"filename"};
}
function lecPeriodFromSheet(matrix,headerStart,map,dataStart){
  const yearValues=lecUniqueMappedValues(matrix,dataStart,map,"academic_year_be");
  const termValues=lecUniqueMappedValues(matrix,dataStart,map,"term_no");
  const yearFromRows=yearValues.map(lecParseAcademicYear).filter(Boolean);
  const termFromRows=termValues.map(lecParseTerm).filter(Boolean);
  const topText=matrix.slice(0,Math.max(headerStart,0)).flat().map(lecHeaderText).filter(Boolean).join(" ");
  const academicYearBe=yearFromRows[0]||lecParseAcademicYear(lecMetaFind(matrix,headerStart,["ปีการศึกษา"]))||lecParseAcademicYear(topText);
  const termNo=termFromRows[0]||lecParseTerm(lecMetaFind(matrix,headerStart,["ภาคเรียนที่","ภาคเรียน"]))||lecParseTerm(topText);
  return {
    academic_year_be:academicYearBe,
    term_no:termNo,
    period_conflicts:[
      ...(new Set(yearFromRows).size>1?["ปีการศึกษา"]:[]),
      ...(new Set(termFromRows).size>1?["ภาคเรียน"]:[])
    ]
  };
}
function lecDetectMetadata(matrix,headerStart,map,dataStart){
  const topRows=matrix.slice(0,Math.max(headerStart,0));
  const period=lecPeriodFromSheet(matrix,headerStart,map,dataStart);
  const texts=topRows.flat().map(lecHeaderText).filter(Boolean);
  const schoolValues=lecUniqueMappedValues(matrix,dataStart,map,"school_name_th");
  const orgValues=lecUniqueMappedValues(matrix,dataStart,map,"organization_name_th");
  const provinceValues=lecUniqueMappedValues(matrix,dataStart,map,"school_province");
  const districtValues=lecUniqueMappedValues(matrix,dataStart,map,"school_district");

  const topSchool=lecMetaFind(matrix,headerStart,["ชื่อสถานศึกษา","ชื่อโรงเรียน","สถานศึกษา"]);
  const topOrg=lecMetaFind(matrix,headerStart,["ชื่อ อปท.","ชื่ออปท.","อปท.","อปท"]);
  const topProvince=lecMetaFind(matrix,headerStart,["จังหวัด"]);
  const topDistrict=lecMetaFind(matrix,headerStart,["อำเภอ/เขต","อำเภอ","เขต"]);

  let schoolName=schoolValues[0]||topSchool;
  if(!schoolName)schoolName=texts.find(x=>/^โรงเรียน/.test(x)&&!x.includes("รายงาน")&&!x.includes("ข้อมูลนักเรียน"))||null;

  const conflicts=[];
  if(schoolValues.length>1)conflicts.push("สถานศึกษา");
  if(orgValues.length>1)conflicts.push("อปท.");
  if(provinceValues.length>1)conflicts.push("จังหวัด");
  if(districtValues.length>1)conflicts.push("อำเภอ");

  return {
    school_code:lecMetaFind(matrix,headerStart,["รหัสสถานศึกษา","รหัสโรงเรียน","รหัสสถานศึกษา LEC"]),
    school_name_th:schoolName,
    organization_name_th:orgValues[0]||topOrg||null,
    province_name_th:provinceValues[0]||topProvince||null,
    district_name_th:districtValues[0]||topDistrict||null,
    academic_year_be:period.academic_year_be,
    term_no:period.term_no,
    school_phone:lecMetaFind(matrix,headerStart,["โทรศัพท์สถานศึกษา","โทรศัพท์โรงเรียน","โทรศัพท์","เบอร์โทรศัพท์"]),
    school_email:lecMetaFind(matrix,headerStart,["อีเมลสถานศึกษา","อีเมลโรงเรียน","E-mail","Email"]),
    school_website_url:lecMetaFind(matrix,headerStart,["เว็บไซต์สถานศึกษา","เว็บไซต์โรงเรียน","เว็บไซต์","Website"]),
    school_address_text:lecMetaFind(matrix,headerStart,["ที่อยู่สถานศึกษา","ที่อยู่โรงเรียน"]),
    report_heading:texts.find(x=>x.includes("รายงานรายละเอียดข้อมูลนักเรียน"))||null,
    school_metadata_conflicts:conflicts,
    period_conflicts:period.period_conflicts,
    metadata_sources:{
      school:schoolValues[0]?"column":(topSchool?"report_header":null),
      organization:orgValues[0]?"column":(topOrg?"report_header":null),
      province:provinceValues[0]?"column":(topProvince?"report_header":null),
      district:districtValues[0]?"column":(topDistrict?"report_header":null)
    }
  };
}

function lecSheetProfile(wb,sheetName){
  const ws=wb.Sheets[sheetName];
  if(!ws)return null;
  const matrix=lecWorksheetMatrix(ws);
  const headerStart=lecFindHeaderStart(matrix);
  if(headerStart<0)return {sheetName,valid:false,rowCount:0,missing:["หัวตาราง LEC"],score:0};
  let flat;
  try{flat=lecFlattenHeaders(matrix,headerStart);}catch(e){
    return {sheetName,valid:false,rowCount:0,missing:["เลขประจำตัวนักเรียน"],score:0};
  }

  const headers=flat.headers,map=lecBuildMap(headers);
  const metadata=lecDetectMetadata(matrix,headerStart,map,flat.dataStart);
  const missing=[];

  if(!metadata.province_name_th)missing.push("จังหวัด");
  if(!metadata.district_name_th)missing.push("อำเภอ");
  if(!metadata.organization_name_th)missing.push("อปท.");
  if(!metadata.school_name_th)missing.push("สถานศึกษา");
  if(map.student_no==null)missing.push("เลขประจำตัวนักเรียน");
  if(map.first_name_th==null)missing.push("ชื่อ");
  if(map.last_name_th==null)missing.push("นามสกุล");
  if(metadata.period_conflicts&&metadata.period_conflicts.length)missing.push(...metadata.period_conflicts.map(x=>x+"ไม่สอดคล้อง"));

  let rowCount=0;
  for(let r=flat.dataStart;r<matrix.length;r++)if(lecMappedValue(matrix[r],map,"student_no"))rowCount++;

  const corePresent=7-missing.filter(x=>!x.endsWith("ไม่สอดคล้อง")).length;
  const score=corePresent*100000+Math.min(rowCount,99999);
  return {sheetName,valid:missing.length===0&&rowCount>0,rowCount,missing,score,matrix,headerStart,flat,headers,map,metadata};
}
function lecStandardSheet1PositionalMap(){
  return {
    school_province:1,school_district:2,organization_name_th:3,school_name_th:4,
    student_no:5,prefix:7,first_name_th:8,last_name_th:9,birth_date:10,
    nationality:11,race:12,religion:13,citizen_id:14,admission_date:15,
    grade_level:16,classroom:17,height_cm:20,weight_kg:21,student_condition:22,
    "father.prefix":37,"father.first_name":38,"father.last_name":39,"father.religion":40,
    "father.occupation":41,"father.monthly_income":42,"father.phone":43,
    "mother.prefix":44,"mother.first_name":45,"mother.last_name":46,"mother.religion":47,
    "mother.occupation":48,"mother.monthly_income":49,"mother.phone":50,
    family_status:51,
    "guardian.prefix":52,"guardian.first_name":53,"guardian.last_name":54,"guardian.religion":55,
    "guardian.occupation":56,"guardian.monthly_income":57,"guardian.relationship":58,"guardian.phone":59,
    tuition_reimbursement:60,medical_reimbursement:61,
    "registered_address.house_no":62,"registered_address.moo":63,"registered_address.road":64,
    "registered_address.subdistrict":65,"registered_address.district":66,"registered_address.province":67,
    "current_address.house_no":68,"current_address.moo":69,"current_address.road":70,
    "current_address.subdistrict":71,"current_address.district":72,"current_address.province":73,
    "current_address.postal_code":74
  };
}
function lecStandardSheet1PositionalProfile(wb,sheetName){
  if(String(sheetName||"").trim().toLowerCase()!=="sheet1")return null;
  const ws=wb.Sheets[sheetName];
  if(!ws)return null;
  const matrix=lecWorksheetMatrix(ws);
  const map=lecStandardSheet1PositionalMap(),dataStart=3,studentNoCol=5;
  const width=Math.max(...matrix.slice(0,Math.min(matrix.length,8)).map(row=>row.length),0);

  const headers=Array.from({length:Math.max(width,75)},(_,i)=>"LEC คอลัมน์ "+(i+1));
  const labels={
    0:"ลำดับที่",1:"จังหวัด",2:"อำเภอ",3:"อปท.",4:"สถานศึกษา",5:"เลขประจำตัวนักเรียน",
    7:"คำนำหน้า",8:"ชื่อ",9:"นามสกุล",10:"วัน/เดือน/ปี เกิด",11:"สัญชาติ",12:"เชื้อชาติ",
    13:"ศาสนา",14:"เลขประจำตัวประชาชน",15:"วัน/เดือน/ปี ที่เข้าศึกษา",16:"ชั้นปี",17:"ห้องเรียน",
    20:"ส่วนสูง",21:"น้ำหนัก",22:"สภาพนักเรียน",37:"บิดา / คำนำหน้า",38:"บิดา / ชื่อ",
    39:"บิดา / นามสกุล",40:"บิดา / ศาสนา",41:"บิดา / อาชีพ",42:"บิดา / รายได้/เดือน",
    43:"บิดา / เบอร์โทร",44:"มารดา / คำนำหน้า",45:"มารดา / ชื่อ",46:"มารดา / นามสกุล",
    47:"มารดา / ศาสนา",48:"มารดา / อาชีพ",49:"มารดา / รายได้/เดือน",50:"มารดา / เบอร์โทร",
    51:"สถานภาพ",52:"ผู้ปกครอง / คำนำหน้า",53:"ผู้ปกครอง / ชื่อ",54:"ผู้ปกครอง / นามสกุล",
    55:"ผู้ปกครอง / ศาสนา",56:"ผู้ปกครอง / อาชีพ",57:"ผู้ปกครอง / รายได้/เดือน",
    58:"ผู้ปกครอง / ความเกี่ยวข้อง",59:"ผู้ปกครอง / เบอร์โทร",60:"สิทธิการเบิกค่าเล่าเรียน",
    61:"สิทธิการเบิกค่ารักษาพยาบาล",62:"ที่อยู่ตามทะเบียนบ้าน / เลขที่",63:"ที่อยู่ตามทะเบียนบ้าน / หมู่ที่",
    64:"ที่อยู่ตามทะเบียนบ้าน / ถนน/ตรอก/ซอย",65:"ที่อยู่ตามทะเบียนบ้าน / ตำบล",
    66:"ที่อยู่ตามทะเบียนบ้าน / อำเภอ/เขต",67:"ที่อยู่ตามทะเบียนบ้าน / จังหวัด",
    68:"ที่อยู่ปัจจุบัน / เลขที่",69:"ที่อยู่ปัจจุบัน / หมู่ที่",70:"ที่อยู่ปัจจุบัน / ถนน/ตรอก/ซอย",
    71:"ที่อยู่ปัจจุบัน / ตำบล",72:"ที่อยู่ปัจจุบัน / อำเภอ/เขต",73:"ที่อยู่ปัจจุบัน / จังหวัด",
    74:"ที่อยู่ปัจจุบัน / รหัสไปรษณีย์"
  };
  Object.entries(labels).forEach(([col,label])=>{headers[Number(col)]=label;});

  let rowCount=0,firstDataRow=null;
  const schoolValues=new Set(),districtValues=new Set(),orgValues=new Set(),provinceValues=new Set();
  for(let r=dataStart;r<matrix.length;r++){
    const row=matrix[r]||[];
    const sid=lecCellText(row[5]);
    if(!sid)continue;
    rowCount++;
    if(!firstDataRow)firstDataRow=row;
    const province=lecCellText(row[1]),district=lecCellText(row[2]),org=lecCellText(row[3]),school=lecCellText(row[4]);
    if(province)provinceValues.add(province);
    if(district)districtValues.add(district);
    if(org)orgValues.add(org);
    if(school)schoolValues.add(school);
  }

  const diagnostics={matrix_rows:matrix.length,width,rowCount,expected_data_start_row:4,student_no_column:"F"};
  if(matrix.length<4){
    return {sheetName,valid:false,rowCount:0,missing:["ข้อมูลใน Sheet1 ไม่ถึงแถว 4"],score:0,matrix,headerStart:1,flat:{headers,dataStart,studentNoCol},headers,map,metadata:{},positionalFallback:true,diagnostics};
  }
  if(!rowCount){
    return {sheetName,valid:false,rowCount:0,missing:["ไม่พบเลขประจำตัวนักเรียนในคอลัมน์ F ตั้งแต่แถว 4"],score:0,matrix,headerStart:1,flat:{headers,dataStart,studentNoCol},headers,map,metadata:{},positionalFallback:true,diagnostics};
  }

  const detected=lecDetectMetadata(matrix,1,map,dataStart)||{};
  const metadata={
    ...detected,
    province_name_th:[...provinceValues][0]||detected.province_name_th||null,
    district_name_th:[...districtValues][0]||detected.district_name_th||null,
    organization_name_th:[...orgValues][0]||detected.organization_name_th||null,
    school_name_th:[...schoolValues][0]||detected.school_name_th||null,
    school_metadata_conflicts:[
      ...(provinceValues.size>1?["จังหวัด"]:[]),
      ...(districtValues.size>1?["อำเภอ"]:[]),
      ...(orgValues.size>1?["อปท."]:[]),
      ...(schoolValues.size>1?["สถานศึกษา"]:[])
    ],
    positional_diagnostics:diagnostics
  };

  const missing=[];
  if(!metadata.province_name_th)missing.push("จังหวัด (คอลัมน์ B)");
  if(!metadata.district_name_th)missing.push("อำเภอ (คอลัมน์ C)");
  if(!metadata.organization_name_th)missing.push("อปท. (คอลัมน์ D)");
  if(!metadata.school_name_th)missing.push("สถานศึกษา (คอลัมน์ E)");
  const corrupt=[metadata.province_name_th,metadata.district_name_th,metadata.organization_name_th,metadata.school_name_th]
    .filter(Boolean).some(v=>String(v).includes("�"));
  if(corrupt)missing.push("ข้อความภาษาไทยอ่านไม่สมบูรณ์");

  const corePresent=9-missing.length;
  return {
    sheetName,valid:missing.length===0,rowCount,missing,
    score:corePresent*100000+Math.min(rowCount,99999)+60000,
    matrix,headerStart:1,flat:{headers,dataStart,studentNoCol},headers,map,metadata,
    positionalFallback:true,diagnostics
  };
}


async function parseLecFile(file){
  if(!window.XLSX)throw new Error("ไม่สามารถโหลดตัวอ่านไฟล์ Excel ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่");
  const buffer=await file.arrayBuffer();
  const filePeriod=lecPeriodFromFileName(file.name);
  const isLegacyXls=/\.xls$/i.test(file.name)&&!/\.xlsx$/i.test(file.name);

  const applyPeriod=p=>{
    if(!p)return null;
    if(p.metadata){
      if(!p.metadata.academic_year_be&&filePeriod.academic_year_be)p.metadata.academic_year_be=filePeriod.academic_year_be;
      if(!p.metadata.term_no&&filePeriod.term_no)p.metadata.term_no=filePeriod.term_no;
      if(filePeriod.source&&(filePeriod.academic_year_be||filePeriod.term_no))p.metadata.period_source=filePeriod.source;
      p.missing=(p.missing||[]).filter(x=>x!=="ปีการศึกษา"&&x!=="ภาคเรียน");
      p.periodMissingFromSource={
        academic_year_be:!p.metadata.academic_year_be,
        term_no:!p.metadata.term_no
      };
      p.valid=p.missing.length===0&&p.rowCount>0;
      const corePresent=7-p.missing.filter(x=>!x.endsWith("ไม่สอดคล้อง")).length;
      p.score=(p.score&&p.positionalFallback?p.score:corePresent*100000+Math.min(p.rowCount,99999));
    }
    return p;
  };

  const scanWorkbook=book=>book.SheetNames.map(name=>{
    const isSheet1=String(name).trim().toLowerCase()==="sheet1";
    let p=lecSheetProfile(book,name);
    if(isSheet1&&(!p||!p.valid)){
      const positional=lecStandardSheet1PositionalProfile(book,name);
      if(positional&&(!p||positional.valid||positional.score>p.score))p=positional;
    }
    return applyPeriod(p);
  }).filter(Boolean);

  let wb=XLSX.read(buffer,{type:"array",cellDates:true,...(isLegacyXls?{codepage:874}:{})});
  if(!wb.SheetNames.length)throw new Error("ไฟล์ไม่มีแผ่นงาน");
  let allProfiles=scanWorkbook(wb);

  const hasCandidate=profiles=>profiles.some(x=>x.valid);
  if(isLegacyXls&&!hasCandidate(allProfiles)){
    try{
      const fallbackWb=XLSX.read(buffer,{type:"array",cellDates:true});
      const fallbackProfiles=scanWorkbook(fallbackWb);
      if(hasCandidate(fallbackProfiles)){
        wb=fallbackWb;
        allProfiles=fallbackProfiles;
      }
    }catch(_){}
  }

  const candidates=allProfiles.filter(x=>x.valid).sort((a,b)=>{
    const aSheet1=String(a.sheetName).trim().toLowerCase()==="sheet1"?1:0;
    const bSheet1=String(b.sheetName).trim().toLowerCase()==="sheet1"?1:0;
    return (b.score+(bSheet1*50000))-(a.score+(aSheet1*50000));
  });
  if(!candidates.length){
    const details=allProfiles.map(x=>{
      const base=x.sheetName+": "+((x.missing&&x.missing.length)?("ขาด "+x.missing.join(", ")):"ไม่พบข้อมูลนักเรียน");
      if(x.positionalFallback&&x.diagnostics){
        return base+" [Sheet1 ตรงตำแหน่ง: แถว="+x.diagnostics.matrix_rows+", คอลัมน์="+x.diagnostics.width+", นักเรียน="+x.diagnostics.rowCount+"]";
      }
      return base;
    }).join(" | ");
    const hint=" · ตัวอ่าน v0.2.5 เลือกหัวตาราง RPT318 ตามข้อมูลจริง และรองรับไฟล์ที่ไม่มีปีการศึกษา/ภาคเรียน";
    throw new Error("ยังไม่พบชีต LEC ที่พร้อมนำเข้า"+(details?" — "+details:"")+hint);
  }
  const selected=candidates[0];
  const standardSheet1=String(selected.sheetName).trim().toLowerCase()==="sheet1";

  const matrix=selected.matrix,headers=selected.headers,map=selected.map,flat=selected.flat;
  const metadata={...(selected.metadata||lecDetectMetadata(matrix,selected.headerStart,map,flat.dataStart))};

  if(!metadata.academic_year_be&&filePeriod.academic_year_be){metadata.academic_year_be=filePeriod.academic_year_be;metadata.period_source="filename";}
  if(!metadata.term_no&&filePeriod.term_no){metadata.term_no=filePeriod.term_no;metadata.period_source="filename";}

  const missing=[];
  if(!metadata.province_name_th)missing.push("จังหวัด");
  if(!metadata.district_name_th)missing.push("อำเภอ");
  if(!metadata.organization_name_th)missing.push("อปท.");
  if(!metadata.school_name_th)missing.push("สถานศึกษา");
  if(map.student_no==null)missing.push("เลขประจำตัวนักเรียน");
  if(map.first_name_th==null)missing.push("ชื่อ");
  if(map.last_name_th==null)missing.push("นามสกุล");
  if(missing.length)throw new Error("ชีต "+selected.sheetName+" ยังขาดข้อมูล: "+missing.join(", "));

  const periodMissingFromSource={
    academic_year_be:!metadata.academic_year_be,
    term_no:!metadata.term_no
  };

  const rows=[];
  for(let r=flat.dataStart;r<matrix.length;r++){
    const canonical=lecBuildCanonical(matrix[r],map);
    if(!canonical.student_no)continue;
    rows.push({source_row_no:r+1,raw:lecRowObject(headers,matrix[r]),canonical});
  }
  if(!rows.length)throw new Error("ไม่พบข้อมูลนักเรียนในชีต "+selected.sheetName);

  if(metadata.school_metadata_conflicts&&metadata.school_metadata_conflicts.length){
    throw new Error("ชีต "+selected.sheetName+" มีข้อมูลมากกว่าหนึ่งค่าในช่อง "+metadata.school_metadata_conflicts.join(", ")+" จึงไม่สามารถผูกกับสถานศึกษาเดียวได้");
  }
  if(metadata.period_conflicts&&metadata.period_conflicts.length){
    throw new Error("ชีต "+selected.sheetName+" มี "+metadata.period_conflicts.join(" และ ")+" มากกว่าหนึ่งค่า กรุณาดาวน์โหลดข้อมูล LEC ของรอบที่ถูกต้องใหม่");
  }

  metadata.selected_sheet_name=selected.sheetName;
  metadata.header_main_row=selected.headerStart+1;
  metadata.header_sub_row=selected.headerStart+2;
  metadata.data_start_row=flat.dataStart+1;
  metadata.sheet_selection_rule=selected.positionalFallback?"lec_sheet1_positional_fallback":(standardSheet1?"lec_sheet1_two_row_merged_header":"content_detected_lec_sheet");
  metadata.template_status=standardSheet1?"lec_standard_format":"detected_from_content";
  metadata.xls_codepage=isLegacyXls?"thai_874_retry_enabled":null;
  metadata.parser_version="0.2.5";
  if(!metadata.period_source&&(metadata.academic_year_be||metadata.term_no))metadata.period_source="lec_file";

  return {
    fileName:file.name,fileSize:file.size,sha256:await lecSha256(buffer),
    sheetName:selected.sheetName,
    ignoredSheetCount:Math.max(0,wb.SheetNames.length-1),
    ignoredSheets:wb.SheetNames.filter(name=>name!==selected.sheetName),
    sheetScan:allProfiles.map(x=>({sheetName:x.sheetName,valid:x.valid,rowCount:x.rowCount,missing:x.missing,positionalFallback:Boolean(x.positionalFallback)})),
    headers,map,headerMap:lecHeaderMapForServer(headers,map),
    missingRequired:[],periodMissingFromSource,rows,metadata
  };
}

function lecMaskId(v){
  const s=String(v||"").replace(/\s/g,"");
  if(s.length<8)return s||"-";
  return s.slice(0,4)+"•••••"+s.slice(-4);
}
async function lecHtml(){
  const school=currentSchool();
  const onboarding=Boolean(
    state.viewMode==="user" &&
    state.pendingInvitation &&
    state.pendingInvitation.status==="onboarding" &&
    state.pendingInvitation.invitation_mode==="platform_first_admin" &&
    state.pendingInvitation.role_code==="school_admin" &&
    !state.pendingInvitation.school_id
  );
  const activeSchoolAdmin=Boolean(school&&isSchoolAdminContext());

  if(!onboarding&&!activeSchoolAdmin){
    return '<section class="panel"><div class="empty-state"><div class="empty-icon">🔒</div><h3>หน้านี้สำหรับ School Admin เท่านั้น</h3><p>ผู้ดูแลสถานศึกษาที่ได้รับการอนุมัติจาก Platform Admin จึงจะสามารถนำเข้าข้อมูล LEC ได้</p><a class="secondary-btn" href="#/overview">กลับหน้าหลัก</a></div></section>';
  }

  let historyRows="";
  if(school){
    const history=await supabase.from("lao_lec_import_batches")
      .select("id,academic_year_be,term_no,source_file_name,source_sheet_name,source_row_count,imported_row_count,new_student_count,updated_student_count,missing_from_latest_count,issue_count,status,imported_at")
      .eq("school_id",school.id).order("imported_at",{ascending:false}).limit(30);
    if(history.error)throw history.error;
    historyRows=(history.data||[]).map(b=>'<tr><td><strong>'+b.academic_year_be+' / '+b.term_no+'</strong><br><small>'+thaiDateTime(b.imported_at)+'</small></td><td>'+esc(b.source_file_name)+'<br><small>'+esc(b.source_sheet_name||"ชีตข้อมูล LEC")+'</small></td><td>'+b.imported_row_count+' / '+b.source_row_count+'</td><td>'+b.new_student_count+'</td><td>'+b.updated_student_count+'</td><td>'+b.missing_from_latest_count+'</td><td>'+(b.issue_count?'<span class="pill danger">'+b.issue_count+'</span>':'<span class="pill success">0</span>')+'</td></tr>').join("");
  }

  const title=onboarding?"นำเข้า LEC ครั้งแรก":"นำเข้าข้อมูล LEC";
  const sub=onboarding
    ?"บัญชี School Admin ของคุณได้รับการอนุมัติแล้ว สามารถเลือกไฟล์ LEC และนำเข้าได้ทันที"
    :"เลือกไฟล์จาก LEC ระบบจะตรวจสอบและอัปเดตข้อมูลตามแหล่งต้นทางโดยอัตโนมัติ";

  const sourceInfo='<article class="panel lec-source-info"><div class="panel-head"><div><p class="eyebrow">แหล่งที่มาของข้อมูล</p><h2>ระบบสารสนเทศทางการศึกษาท้องถิ่น (LEC)</h2><p class="panel-sub">LAO-EMS ใช้ไฟล์ XLS/XLSX ที่ดาวน์โหลดจากระบบ LEC เป็นแหล่งข้อมูลต้นทางสำหรับข้อมูล อปท. สถานศึกษา ชั้น ห้อง และข้อมูลนักเรียน โดยรายงาน RPT318 บางรุ่นไม่ได้ส่งปีการศึกษาและภาคเรียนมาในไฟล์ ระบบจึงให้ระบุรอบนำเข้าก่อนบันทึกเมื่อจำเป็น</p></div><span class="source-lock">🔒 LEC เท่านั้น</span></div><div class="lec-source-actions"><a class="primary-btn" href="https://lec.dla.go.th/index.jsp" target="_blank" rel="noopener noreferrer">เปิดระบบ LEC ↗</a><small>เว็บไซต์: lec.dla.go.th · ดาวน์โหลดไฟล์ข้อมูลจาก LEC แล้วกลับมานำเข้าที่หน้านี้</small></div></article>';

  const importBox='<article class="panel"><div class="panel-head"><div><p class="eyebrow">LEC → LAO-EMS</p><h2>'+title+'</h2><p class="panel-sub">'+sub+'</p></div><span class="pill success">School Admin</span></div><form id="lec-import-form" class="form-grid" style="margin-top:18px"><div class="span-2 auto-source-note"><div class="auto-source-icon">✓</div><div><strong>ไม่ต้องกรอกข้อมูลซ้ำ</strong><p>ระบบอ่านสถานศึกษา จังหวัด อำเภอ อปท. ชั้น ห้อง และข้อมูลนักเรียนจากไฟล์ LEC โดยอัตโนมัติ หากไฟล์ไม่ระบุปีการศึกษา/ภาคเรียน ระบบจะให้เลือกเฉพาะรอบนำเข้าก่อนยืนยัน</p></div></div><label class="lec-drop span-2"><input id="lec-file" name="file" type="file" accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required><span class="lec-drop-icon">⇧</span><strong>เลือกไฟล์ XLS / XLSX จาก LEC</strong><small>ระบบจะเลือกชีตข้อมูลที่ครบและแสดงข้อมูลให้ตรวจสอบก่อนบันทึก</small></label><div id="lec-preview" class="span-2"></div><div class="span-2"><button class="primary-btn" type="submit" disabled data-lec-import>ยืนยันนำเข้าจาก LEC</button></div></form></article>';

  const hist=school?'<article class="panel"><div class="panel-head"><div><p class="eyebrow">Import history</p><h2>ประวัติการนำเข้า LEC · '+esc(school.name_th)+'</h2><p class="panel-sub">ข้อมูลเดิมไม่ถูกลบ เมื่อเด็กหายจากไฟล์รอบใหม่จะบันทึกว่า “ไม่พบใน LEC รอบล่าสุด” เท่านั้น</p></div></div>'+(historyRows?'<div class="table-wrap"><table><thead><tr><th>ปี / ภาค</th><th>ไฟล์</th><th>นำเข้า / ทั้งหมด</th><th>นักเรียนใหม่</th><th>อัปเดต</th><th>ไม่พบรอบล่าสุด</th><th>ปัญหา</th></tr></thead><tbody>'+historyRows+'</tbody></table></div>':'<div class="empty-state"><div class="empty-icon">⇧</div><h3>ยังไม่เคยนำเข้า LEC</h3></div>')+'</article>':'';

  return '<section class="source-banner"><div><span class="badge">School Admin · Approved</span><h2>นำเข้าข้อมูลจาก LEC</h2><p>บัญชี School Admin ที่ได้รับการอนุมัติจาก Platform Admin สามารถนำเข้าไฟล์ LEC ได้โดยตรง</p></div><div class="banner-status"><span class="status-pill success">XLS/XLSX</span><span class="status-pill success">กำหนดรอบเมื่อจำเป็น</span><span class="status-pill success">เลือกชีตอัตโนมัติ</span></div></section><section class="lec-page-stack">'+sourceInfo+importBox+hist+'</section>';
}

function lecSchoolFieldLabel(key){
  return {school_code:"รหัสสถานศึกษา",school_name_th:"ชื่อสถานศึกษา",organization_name_th:"อปท.",province_name_th:"จังหวัด",district_name_th:"อำเภอ",school_phone:"โทรศัพท์",school_email:"อีเมล",school_website_url:"เว็บไซต์",school_address_text:"ที่อยู่"}[key]||key;
}
function lecSchoolInfoHtml(preview){
  const check=preview.schoolCheck||{},incoming=check.incoming||preview.metadata||{},diff=check.diff||{};
  const fields=["school_code","school_name_th","organization_name_th","province_name_th","district_name_th","school_phone","school_email","school_website_url","school_address_text"];
  const incomingRows=fields.filter(k=>incoming[k]).map(k=>'<tr><th>'+esc(lecSchoolFieldLabel(k))+'</th><td>'+esc(incoming[k])+'</td></tr>').join("");
  const diffRows=Object.entries(diff).map(([k,v])=>'<tr><th>'+esc(lecSchoolFieldLabel(k))+'</th><td>'+esc(v&&v.current||"-")+'</td><td>'+esc(v&&v.incoming||"-")+'</td></tr>').join("");
  if(check.status==="missing_school_identity"){
    return '<div class="school-verify danger"><strong>ไม่พบชีตข้อมูลสถานศึกษาที่ครบถ้วน</strong><p>ชีตที่นำเข้าต้องมี จังหวัด อำเภอ อปท. สถานศึกษา และข้อมูลนักเรียนครบตามโครงสร้าง LEC</p></div>';
  }
  if(check.status==="school_code_mismatch"||check.status==="school_identity_mismatch"){
    return '<div class="school-verify danger"><strong>ไฟล์นี้อาจเป็นของคนละโรงเรียน</strong><p>ข้อมูลระบุสถานศึกษาใน LEC ไม่ตรงกับโรงเรียนที่ผูกไว้ ระบบจึงหยุดนำเข้าเพื่อป้องกันข้อมูลนักเรียนข้ามโรงเรียน</p>'+(diffRows?'<div class="table-wrap"><table><thead><tr><th>ข้อมูล</th><th>ปัจจุบัน</th><th>จาก LEC</th></tr></thead><tbody>'+diffRows+'</tbody></table></div>':'')+'<small>กรุณาเลือกไฟล์ของโรงเรียนนี้ หรือให้ Platform Admin ตรวจสอบกรณีมีการเปลี่ยนรหัสสถานศึกษาอย่างเป็นทางการ</small></div>';
  }
  if(check.requires_confirmation){
    const accepted=preview.schoolResolution==="accept_new_lec";
    return '<div class="school-verify '+(accepted?"success":"warning")+'"><div class="school-verify-head"><div><strong>'+(check.is_first_import?"ยืนยันการผูกข้อมูลสถานศึกษาครั้งแรก":"พบข้อมูลสถานศึกษาเปลี่ยนจากรอบก่อน")+'</strong><p>'+(accepted?"ยืนยันแล้วว่าจะใช้ข้อมูลจาก LEC รอบใหม่นี้":"ระบบจะไม่ผสมข้อมูลสถานศึกษาเก่ากับข้อมูลนักเรียนจากไฟล์ใหม่")+'</p></div><span class="pill '+(accepted?"success":"warning")+'">'+(accepted?"ยืนยันแล้ว":"ต้องยืนยัน")+'</span></div>'+(diffRows?'<div class="table-wrap"><table><thead><tr><th>ข้อมูล</th><th>ข้อมูลเดิม</th><th>ข้อมูลจาก LEC</th></tr></thead><tbody>'+diffRows+'</tbody></table></div>':'')+(accepted?'<button type="button" class="secondary-btn" data-lec-change-choice>เปลี่ยนการตัดสินใจ</button>':'<div class="choice-grid"><button type="button" class="primary-btn" data-lec-use-new>ใช้ข้อมูลจาก LEC ใหม่และนำเข้าต่อ</button><button type="button" class="secondary-btn" data-lec-keep-old>คงข้อมูลเดิมและยกเลิกการนำเข้ารอบนี้</button></div>')+'</div>';
  }
  const title=check.is_first_import?"ข้อมูลสถานศึกษาที่จะนำเข้าจาก LEC":"ข้อมูลสถานศึกษาตรงกับรอบที่ผูกไว้";
  return '<div class="school-verify success"><strong>'+title+'</strong>'+(incomingRows?'<div class="table-wrap compact-table"><table><tbody>'+incomingRows+'</tbody></table></div>':'')+'</div>';
}
function lecPeriodSelectionState(preview){
  const metadata=preview&&preview.metadata||{};
  const sourceMissing=preview&&preview.periodMissingFromSource||{};
  const year=Number(metadata.academic_year_be);
  const term=Number(metadata.term_no);
  const yearValid=Number.isInteger(year)&&year>=2400&&year<=2800;
  const termValid=Number.isInteger(term)&&term>=1&&term<=4;
  return {
    year,term,yearValid,termValid,
    ready:yearValid&&termValid,
    yearNeedsInput:Boolean(sourceMissing.academic_year_be),
    termNeedsInput:Boolean(sourceMissing.term_no),
    needsInput:Boolean(sourceMissing.academic_year_be||sourceMissing.term_no)
  };
}
function lecPeriodContextHtml(preview){
  const s=lecPeriodSelectionState(preview);
  if(!s.needsInput)return "";
  const yearControl=s.yearNeedsInput
    ?'<label><span>ปีการศึกษา (พ.ศ.)</span><input type="number" min="2400" max="2800" inputmode="numeric" data-lec-period-year placeholder="เช่น 2569" value="'+(s.yearValid?esc(s.year):"")+'"></label>'
    :"";
  const termControl=s.termNeedsInput
    ?'<label><span>ภาคเรียน</span><select data-lec-period-term><option value="">เลือกภาคเรียน</option>'+[1,2,3,4].map(n=>'<option value="'+n+'" '+(s.termValid&&s.term===n?"selected":"")+'>ภาคเรียนที่ '+n+'</option>').join("")+'</select></label>'
    :"";
  return '<div class="lec-period-context '+(s.ready?"success":"warning")+'"><div class="lec-period-context-copy"><strong>'+(s.ready?"กำหนดรอบนำเข้าแล้ว":"ไฟล์ RPT318 นี้ไม่มีข้อมูลรอบการศึกษา")+'</strong><p>'+(s.ready?"ระบบจะใช้ปีการศึกษาและภาคเรียนที่ระบุด้านล่างเป็นบริบทของการนำเข้ารอบนี้ โดยไม่แก้ข้อมูลนักเรียนจาก LEC":"กรุณาระบุเฉพาะปีการศึกษาและภาคเรียนของไฟล์นี้ก่อนนำเข้า ข้อมูลโรงเรียน ชั้น ห้อง และนักเรียนยังอ่านจาก LEC ตามเดิม")+'</p></div><div class="lec-period-input-grid">'+yearControl+termControl+'</div></div>';
}
function renderLecPreview(preview){
  const box=q("#lec-preview"),btn=q("[data-lec-import]"); if(!box||!btn)return;
  const missing=preview.missingRequired||[],check=preview.schoolCheck||{};
  const period=lecPeriodSelectionState(preview);
  const sample=preview.rows.slice(0,5).map(r=>'<tr><td>'+esc(r.canonical.student_no||"-")+'</td><td>'+esc([r.canonical.prefix,r.canonical.first_name_th,r.canonical.last_name_th].filter(Boolean).join(" "))+'</td><td>'+esc(lecMaskId(r.canonical.citizen_id))+'</td><td>'+esc(r.canonical.grade_level||"-")+'</td><td>'+esc(r.canonical.classroom||"-")+'</td></tr>').join("");
  const ignored=preview.ignoredSheets.length?preview.ignoredSheets.map(esc).join(", "):"ไม่มี";
  const sourceOk=check.can_import!==false;
  const confirmOk=!check.requires_confirmation||preview.schoolResolution==="accept_new_lec";
  const ready=missing.length===0&&period.ready&&sourceOk&&confirmOk;
  const status=missing.length||!sourceOk
    ?'<span class="pill danger">ยังนำเข้าไม่ได้</span>'
    :!period.ready
      ?'<span class="pill warning">เลือกรอบนำเข้า</span>'
      :confirmOk
        ?'<span class="pill success">พร้อมนำเข้า</span>'
        :'<span class="pill warning">รอยืนยัน</span>';
  const periodNotice=missing.length
    ?'<div class="notice danger">ไม่พบคอลัมน์จำเป็น: '+missing.map(esc).join(", ")+' กรุณาดาวน์โหลดรายงาน LEC รูปแบบ RPT318 ที่ถูกต้องอีกครั้ง</div>'
    :period.needsInput
      ?(period.ready
        ?'<div class="notice success">ข้อมูลโรงเรียน ชั้น ห้อง และนักเรียนอ่านจาก LEC โดยตรง · รอบนำเข้า '+esc(period.year)+' / '+esc(period.term)+' ระบุโดยผู้ใช้ เพราะไฟล์รุ่นนี้ไม่มีสองค่านี้</div>'
        :'<div class="notice warning"><strong>ต้องระบุรอบนำเข้าก่อน</strong><br>รายงาน RPT318 รุ่นนี้ไม่มีปีการศึกษาและ/หรือภาคเรียนอยู่ในไฟล์ จึงไม่ถือว่าไฟล์เสีย</div>')
      :'<div class="notice success">ตรวจพบข้อมูลโรงเรียน รอบการศึกษา ชั้น ห้อง และนักเรียนจากไฟล์/ชื่อไฟล์ LEC พร้อมนำเข้า</div>';

  box.innerHTML='<div class="lec-preview-card"><div class="lec-preview-head"><div><strong>'+esc(preview.fileName)+'</strong><small>แท็บที่ใช้: '+esc(preview.sheetName)+' · '+preview.rows.length+' รายการ</small></div>'+status+'</div>'+lecPeriodContextHtml(preview)+'<div class="lec-period-summary"><div><small>ปีการศึกษา</small><strong>'+(period.yearValid?esc(period.year):"รอเลือก")+'</strong></div><div><small>ภาคเรียน</small><strong>'+(period.termValid?("ภาคเรียนที่ "+esc(period.term)):"รอเลือก")+'</strong></div><div><small>นักเรียน</small><strong>'+preview.rows.length+' คน</strong></div></div><div class="lec-facts"><span>ชีตข้อมูล: '+esc(preview.sheetName)+'</span><span>'+(preview.metadata.template_status==="lec_standard_format"?"รูปแบบ LEC มาตรฐาน · ":"")+'หัวตาราง: แถว '+esc(preview.metadata.header_main_row||"-")+'–'+esc(preview.metadata.header_sub_row||"-")+' · ข้อมูลเริ่มแถว '+esc(preview.metadata.data_start_row||"-")+'</span><span>อ่านคอลัมน์ '+preview.headers.length+' ช่อง</span><span>ตัวอ่าน: '+esc(preview.metadata.parser_version||"-")+'</span><span>ข้ามชีต: '+ignored+'</span><span>SHA-256: '+esc((preview.sha256||"").slice(0,12))+'…</span></div>'+lecSchoolInfoHtml(preview)+periodNotice+'<div class="table-wrap"><table><thead><tr><th>รหัสนักเรียน</th><th>ชื่อ-สกุล</th><th>เลขประชาชน</th><th>ชั้น</th><th>ห้อง</th></tr></thead><tbody>'+sample+'</tbody></table></div></div>';
  btn.disabled=!ready;

  const periodYear=q("[data-lec-period-year]",box);
  if(periodYear)periodYear.addEventListener("change",()=>{
    const value=Number(periodYear.value);
    preview.metadata.academic_year_be=Number.isInteger(value)&&value>=2400&&value<=2800?value:null;
    preview.metadata.period_source="user_selected_import_context";
    renderLecPreview(preview);
  });
  const periodTerm=q("[data-lec-period-term]",box);
  if(periodTerm)periodTerm.addEventListener("change",()=>{
    const value=Number(periodTerm.value);
    preview.metadata.term_no=Number.isInteger(value)&&value>=1&&value<=4?value:null;
    preview.metadata.period_source="user_selected_import_context";
    renderLecPreview(preview);
  });

  const useNew=q("[data-lec-use-new]",box);
  if(useNew)useNew.addEventListener("click",()=>{preview.schoolResolution="accept_new_lec";renderLecPreview(preview);});
  const changeChoice=q("[data-lec-change-choice]",box);
  if(changeChoice)changeChoice.addEventListener("click",()=>{preview.schoolResolution=null;renderLecPreview(preview);});
  const keepOld=q("[data-lec-keep-old]",box);
  if(keepOld)keepOld.addEventListener("click",()=>{
    state.lecPreview=null;
    const input=q("#lec-file"); if(input)input.value="";
    box.innerHTML='<div class="notice">คงข้อมูลสถานศึกษาเดิมไว้และยกเลิกไฟล์รอบนี้แล้ว หากต้องการนำเข้า ให้ดาวน์โหลดไฟล์ LEC ที่ถูกต้องหรือเลือกไฟล์ใหม่</div>';
    btn.disabled=true;
  });
}

function ensureLecImportProgress(){
  let overlay=q("#lec-import-progress");
  if(overlay)return overlay;
  overlay=document.createElement("div");
  overlay.id="lec-import-progress";
  overlay.className="lec-import-progress hidden";
  overlay.setAttribute("role","dialog");
  overlay.setAttribute("aria-modal","true");
  overlay.setAttribute("aria-labelledby","lec-import-progress-title");
  overlay.innerHTML='<div class="lec-import-progress-card"><div class="lec-import-progress-icon"><span class="spinner"></span></div><p class="eyebrow">LEC → LAO-EMS</p><h2 id="lec-import-progress-title">กำลังนำเข้าข้อมูล</h2><p class="lec-import-progress-warning"><strong>กรุณาอย่าออกจากหน้านี้</strong><br>อย่าปิดแท็บ รีเฟรช หรือเปลี่ยนหน้า จนกว่าระบบจะแจ้งว่านำเข้าเสร็จ</p><div class="lec-import-progress-row"><strong data-lec-progress-label>กำลังเตรียมข้อมูล...</strong><span data-lec-progress-percent>0%</span></div><div class="lec-import-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span data-lec-progress-bar></span></div><small data-lec-progress-detail>ระบบกำลังตรวจสอบไฟล์และเตรียมส่งข้อมูลไปยังฐานข้อมูล</small></div>';
  document.body.appendChild(overlay);
  return overlay;
}
function updateLecImportProgress(percent,label,detail){
  const overlay=ensureLecImportProgress();
  const value=Math.max(0,Math.min(100,Math.round(percent)));
  const bar=q("[data-lec-progress-bar]",overlay),pct=q("[data-lec-progress-percent]",overlay),text=q("[data-lec-progress-label]",overlay),sub=q("[data-lec-progress-detail]",overlay),track=q(".lec-import-progress-track",overlay);
  if(bar)bar.style.width=value+"%";
  if(pct)pct.textContent=value+"%";
  if(text&&label)text.textContent=label;
  if(sub&&detail)sub.textContent=detail;
  if(track)track.setAttribute("aria-valuenow",String(value));
}
function startLecImportProgress(){
  const overlay=ensureLecImportProgress();
  overlay.classList.remove("hidden");
  document.body.classList.add("is-lec-importing");
  state.lecImporting=true;
  updateLecImportProgress(8,"กำลังเตรียมข้อมูล...","ตรวจสอบข้อมูลที่ยืนยันแล้วก่อนส่งนำเข้า");
}
function finishLecImportProgress(success,message){
  const overlay=ensureLecImportProgress();
  updateLecImportProgress(success?100:0,success?"นำเข้าสำเร็จ":"นำเข้าไม่สำเร็จ",message||"");
  if(success){
    overlay.classList.add("is-success");
    setTimeout(()=>{
      overlay.classList.add("hidden");
      overlay.classList.remove("is-success");
      document.body.classList.remove("is-lec-importing");
      state.lecImporting=false;
    },700);
  }else{
    overlay.classList.add("hidden");
    document.body.classList.remove("is-lec-importing");
    state.lecImporting=false;
  }
}
function beginLecEstimatedProgress(){
  let value=18;
  updateLecImportProgress(value,"กำลังส่งข้อมูล...","ส่งข้อมูลนักเรียนและข้อมูลสถานศึกษาไปยังระบบ");
  return setInterval(()=>{
    if(!state.lecImporting)return;
    if(value<62)value+=Math.max(1,Math.round((62-value)*0.12));
    else if(value<88)value+=1;
    value=Math.min(value,88);
    updateLecImportProgress(value,value<62?"กำลังนำเข้าข้อมูล...":"กำลังบันทึกและตรวจสอบความสัมพันธ์...","ความคืบหน้าเป็นค่าประมาณระหว่างรอฐานข้อมูลตอบกลับ ระบบจะแสดง 100% เมื่อบันทึกสำเร็จ");
  },900);
}
function bindLec(){
  const form=q("#lec-import-form"),input=q("#lec-file"); if(!form||!input)return;
  input.addEventListener("change",async()=>{
    state.lecPreview=null; const btn=q("[data-lec-import]"); if(btn)btn.disabled=true;
    const box=q("#lec-preview"); if(box)box.innerHTML='<div class="loading-inline"><span class="spinner"></span>กำลังตรวจโครงสร้างไฟล์ LEC...</div>';
    const file=input.files&&input.files[0]; if(!file){if(box)box.innerHTML="";return;}
    try{
      if(!/\.xlsx?$/i.test(file.name)){throw new Error("รองรับเฉพาะไฟล์ .xls หรือ .xlsx จาก LEC");}
      state.lecPreview=await parseLecFile(file);
      const school=currentSchool();
      const onboarding=Boolean(state.pendingInvitation&&state.pendingInvitation.status==="onboarding"&&state.pendingInvitation.invitation_mode==="platform_first_admin"&&!state.pendingInvitation.school_id);
      if(school){
        const schoolCheck=await supabase.rpc("lao_lec_school_check",{p_school_id:school.id,p_metadata:state.lecPreview.metadata});
        if(schoolCheck.error)throw schoolCheck.error;
        state.lecPreview.schoolCheck=schoolCheck.data||{};
      }else if(onboarding){
        const incoming=state.lecPreview.metadata||{},diff={};
        ["school_name_th","organization_name_th","province_name_th","district_name_th","school_code"].forEach(k=>{if(incoming[k])diff[k]={current:null,incoming:incoming[k]};});
        state.lecPreview.schoolCheck={status:"first_import_confirmation",can_import:true,requires_confirmation:true,hard_block:false,is_first_import:true,incoming,diff};
      }else{
        throw new Error("ยังไม่มีสิทธิ์นำเข้า LEC");
      }
      state.lecPreview.schoolResolution=null;
      renderLecPreview(state.lecPreview);
    }catch(e){if(box)box.innerHTML='<div class="notice danger"><strong>อ่านไฟล์ไม่สำเร็จ</strong><br>'+esc(e.message||e)+'</div>';toast(e.message||String(e),"error");}
  });
  form.addEventListener("submit",async e=>{
    e.preventDefault();
    const p=state.lecPreview,school=currentSchool();
    const onboarding=Boolean(state.pendingInvitation&&state.pendingInvitation.status==="onboarding"&&state.pendingInvitation.invitation_mode==="platform_first_admin"&&!state.pendingInvitation.school_id);
    if(!p||(!school&&!onboarding))return;
    if(p.missingRequired.length){toast("โครงสร้างไฟล์ LEC ไม่ครบ","error");return;}
    const period=lecPeriodSelectionState(p);
    if(!period.ready){toast("กรุณาระบุปีการศึกษาและภาคเรียนของไฟล์นี้ก่อนนำเข้า","error");return;}
    if(p.schoolCheck&&p.schoolCheck.can_import===false){toast("ข้อมูลสถานศึกษาในไฟล์ไม่ตรงกับโรงเรียนนี้","error");return;}
    if(p.schoolCheck&&p.schoolCheck.requires_confirmation&&p.schoolResolution!=="accept_new_lec"){toast("กรุณายืนยันว่าจะใช้ข้อมูลสถานศึกษาจาก LEC ใหม่ก่อน","error");return;}
    if(!confirm("ยืนยันนำเข้า LEC ปีการศึกษา "+p.metadata.academic_year_be+" ภาคเรียนที่ "+p.metadata.term_no+" จำนวน "+p.rows.length+" คน? ระบบจะรักษาประวัติเดิมไว้"))return;
    const btn=q("[data-lec-import]");
    setBusy(btn,true,"กำลังนำเข้า LEC...");
    startLecImportProgress();
    const progressTimer=beginLecEstimatedProgress();
    const rpcName=onboarding?"lao_onboard_school_from_lec":"lao_import_lec_students_auto";
    const rpcArgs=onboarding?{
      p_invitation_id:state.pendingInvitation.id,
      p_file_name:p.fileName,p_file_size:p.fileSize,p_file_sha256:p.sha256,
      p_sheet_name:p.sheetName,p_ignored_sheet_count:p.ignoredSheetCount,
      p_header_map:p.headerMap,p_metadata:{...p.metadata,...(p.schoolResolution?{school_resolution:p.schoolResolution}:{})},p_rows:p.rows
    }:{
      p_school_id:school.id,
      p_file_name:p.fileName,p_file_size:p.fileSize,p_file_sha256:p.sha256,
      p_sheet_name:p.sheetName,p_ignored_sheet_count:p.ignoredSheetCount,
      p_header_map:p.headerMap,p_metadata:{...p.metadata,...(p.schoolResolution?{school_resolution:p.schoolResolution}:{})},p_rows:p.rows
    };
    let res;
    try{
      updateLecImportProgress(20,"กำลังนำเข้าข้อมูล...","กรุณาอย่าออกจากหน้านี้ระหว่างที่ฐานข้อมูลกำลังประมวลผล");
      res=await supabase.rpc(rpcName,rpcArgs);
    }catch(error){
      clearInterval(progressTimer);
      setBusy(btn,false);
      finishLecImportProgress(false,error.message||String(error));
      toast(error.message||String(error),"error");
      return;
    }
    clearInterval(progressTimer);
    setBusy(btn,false);
    if(res.error){
      finishLecImportProgress(false,res.error.message);
      toast(res.error.message,"error");
      return;
    }
    const x=res.data||{};
    updateLecImportProgress(96,"กำลังตรวจสอบผลลัพธ์...","ฐานข้อมูลตอบกลับแล้ว กำลังอัปเดตหน้าจอและสิทธิ์การใช้งาน");
    state.lecPreview=null;
    await loadContext();
    finishLecImportProgress(true,"นำเข้า "+(x.imported_rows||0)+" รายการเรียบร้อย");
    toast((onboarding?"สร้างสถานศึกษาและนำเข้า LEC สำเร็จ: ":"นำเข้า LEC สำเร็จ: ")+(x.imported_rows||0)+" รายการ","success");
    if(onboarding)location.hash="#/setup";
    renderRoute();
  });
}

function studentDetailId(){
  const m=location.hash.match(/^#\/students\/([0-9a-f-]{36})$/i);
  return m?m[1]:null;
}
function genderLabel(value){
  return value==="ชาย"?"ชาย":value==="หญิง"?"หญิง":value||"ไม่ระบุ";
}
function genderClass(value){
  return value==="ชาย"?"male":value==="หญิง"?"female":"neutral";
}
async function studentDetailPageHtml(studentId){
  const school=currentSchool();
  if(!school)return '<section class="panel"><div class="empty-state"><div class="empty-icon">🏫</div><h3>เลือกสถานศึกษาก่อน</h3></div></section>';
  if(!canViewStudentDirectory())return '<section class="panel"><div class="empty-state"><div class="empty-icon">🔒</div><h3>ไม่มีสิทธิ์ดูข้อมูลนักเรียน</h3></div></section>';
  q("[data-page-title]").textContent="ข้อมูลนักเรียน";
  const res=await supabase.rpc("lao_student_detail",{p_school_id:school.id,p_student_id:studentId});
  if(res.error)throw res.error;
  const x=res.data||{};
  const latest=(x.enrollments||[])[0]||{};
  const history=(x.enrollments||[]).map(e=>'<tr><td>'+esc(e.year_be||"-")+'</td><td>'+esc(e.term_no||"-")+'</td><td>'+esc(shortGrade(e.grade_level))+'</td><td>'+esc(e.classroom||"-")+'</td><td>'+esc(studentPresenceLabel(e.presence_status))+'</td><td>'+esc(e.source_row_no||"-")+'</td></tr>').join("");
  const family=(x.family||[]).map(f=>'<article class="lec-person-card"><div class="lec-card-title"><span>'+esc(relationLabel(f.relation_type))+'</span><strong>'+esc(f.full_name||"-")+'</strong></div><dl><div><dt>ศาสนา</dt><dd>'+esc(f.religion||"-")+'</dd></div><div><dt>อาชีพ</dt><dd>'+esc(f.occupation||"-")+'</dd></div><div><dt>รายได้/เดือน</dt><dd>'+esc(money(f.monthly_income))+'</dd></div><div><dt>โทรศัพท์</dt><dd>'+esc(f.phone||"-")+'</dd></div>'+(f.relation_type==="guardian"?'<div><dt>ความเกี่ยวข้อง</dt><dd>'+esc(f.relationship_text||"-")+'</dd></div>':'')+'</dl></article>').join("");
  const addresses=(x.addresses||[]).map(a=>'<article class="lec-address-card"><strong>'+esc(addressLabel(a.address_type))+'</strong><p>'+esc(formatAddress(a))+'</p><div class="lec-mini-grid"><span><small>เลขที่</small>'+esc(a.house_no||"-")+'</span><span><small>หมู่</small>'+esc(a.moo||"-")+'</span><span><small>ถนน/ซอย</small>'+esc(a.road||"-")+'</span><span><small>ตำบล/แขวง</small>'+esc(a.subdistrict||"-")+'</span><span><small>อำเภอ/เขต</small>'+esc(a.district||"-")+'</span><span><small>จังหวัด</small>'+esc(a.province||"-")+'</span><span><small>รหัสไปรษณีย์</small>'+esc(a.postal_code||"-")+'</span></div></article>').join("");
  const measurement=x.measurement||{},benefits=x.benefits||{},source=x.source_import||{};
  const raw=Object.entries(x.source_fields||{}).filter(([key,value])=>hasDisplayValue(value)).sort((a,b)=>a[0].localeCompare(b[0],"th"));
  const rawFields=raw.map(([key,value])=>'<div class="lec-source-field"><dt>'+esc(key)+'</dt><dd>'+esc(typeof value==="object"?JSON.stringify(value):value)+'</dd></div>').join("");

  return '<section class="student-detail-page">'+
    '<div class="student-detail-toolbar"><a class="secondary-btn" href="#/students">← กลับรายชื่อนักเรียน</a><span class="source-badge">ข้อมูลจาก LEC</span></div>'+
    '<section class="student-detail-page-hero"><div class="student-detail-avatar">'+esc((x.first_name_th||"น")[0]||"น")+'</div><div class="student-detail-page-title"><p class="eyebrow">Student record</p><h2>'+esc(x.full_name||"-")+'</h2><p>เลขประจำตัวนักเรียน '+esc(x.student_no||"-")+(latest.grade_level?' · '+esc(shortGrade(latest.grade_level))+(latest.classroom?' / ห้อง '+esc(latest.classroom):''):'')+'</p><div class="student-detail-badges"><span class="pill '+(x.presence_status==="present"?"success":"warning")+'">'+esc(studentPresenceLabel(x.presence_status))+'</span><span class="pill neutral">'+esc(registryLabel(x.registry_status))+'</span></div></div></section>'+
    '<section class="lec-detail-section"><div class="lec-section-head"><div><span>01</span><div><h3>ข้อมูลนักเรียน</h3><p>ข้อมูลประจำตัวและสถานะทะเบียน</p></div></div></div><div class="student-detail-grid">'+
      '<div><small>เลขประชาชน</small><strong>'+esc(x.citizen_id_masked||"-")+'</strong></div>'+
      '<div><small>วันเกิด</small><strong>'+esc(thaiDate(x.birth_date))+'</strong></div>'+
      '<div><small>เชื้อชาติ</small><strong>'+esc(x.race||"-")+'</strong></div>'+
      '<div><small>สัญชาติ</small><strong>'+esc(x.nationality||"-")+'</strong></div>'+
      '<div><small>ศาสนา</small><strong>'+esc(x.religion||"-")+'</strong></div>'+
      '<div><small>วันที่เข้าเรียน</small><strong>'+esc(thaiDate(x.admission_date))+'</strong></div>'+
      '<div><small>สภาพนักเรียน</small><strong>'+esc(x.student_condition||"-")+'</strong></div>'+
      '<div><small>สถานะทะเบียน</small><strong>'+esc(registryLabel(x.registry_status))+'</strong></div>'+
      '<div><small>ชั้นล่าสุด</small><strong>'+esc(shortGrade(latest.grade_level))+'</strong></div>'+
      '<div><small>ห้องล่าสุด</small><strong>'+esc(latest.classroom||"-")+'</strong></div>'+
      '<div><small>ปีการศึกษา</small><strong>'+esc(latest.year_be||"-")+'</strong></div>'+
      '<div><small>ภาคเรียน</small><strong>'+esc(latest.term_no||"-")+'</strong></div>'+
    '</div></section>'+
    '<section class="lec-detail-section"><div class="lec-section-head"><div><span>02</span><div><h3>บิดา มารดา และผู้ปกครอง</h3><p>ข้อมูลบุคคล อาชีพ รายได้ และการติดต่อจาก LEC</p></div></div></div><div class="lec-person-grid">'+(family||'<p class="muted">ไม่มีข้อมูลครอบครัวใน LEC</p>')+'</div></section>'+
    '<section class="lec-detail-section"><div class="lec-section-head"><div><span>03</span><div><h3>ที่อยู่</h3><p>ที่อยู่ตามทะเบียนบ้านและที่อยู่ปัจจุบัน</p></div></div></div><div class="lec-address-grid">'+(addresses||'<p class="muted">ไม่มีข้อมูลที่อยู่ใน LEC</p>')+'</div></section>'+
    '<section class="lec-detail-section"><div class="lec-section-head"><div><span>04</span><div><h3>สุขภาพและสวัสดิการ</h3><p>ค่าร่างกาย สถานภาพครอบครัว และสิทธิการเบิก</p></div></div></div><div class="lec-health-grid">'+
      '<article><small>ส่วนสูง</small><strong>'+esc(measurement.height_cm!=null?measurement.height_cm+" ซม.":"-")+'</strong></article>'+
      '<article><small>น้ำหนัก</small><strong>'+esc(measurement.weight_kg!=null?measurement.weight_kg+" กก.":"-")+'</strong></article>'+
      '<article><small>สถานภาพครอบครัว</small><strong>'+esc(benefits.family_status||"-")+'</strong></article>'+
      '<article><small>สิทธิเบิกค่าเล่าเรียน</small><strong>'+esc(benefits.tuition_reimbursement||"-")+'</strong></article>'+
      '<article><small>สิทธิเบิกค่ารักษาพยาบาล</small><strong>'+esc(benefits.medical_reimbursement||"-")+'</strong></article>'+
    '</div></section>'+
    '<section class="lec-detail-section"><div class="lec-section-head"><div><span>05</span><div><h3>ประวัติการเรียนที่นำเข้า</h3><p>ปีการศึกษา ภาคเรียน ชั้น ห้อง และแถวต้นฉบับ</p></div></div></div>'+(history?'<div class="table-wrap lec-history-table"><table><thead><tr><th>ปี</th><th>ภาคเรียน</th><th>ชั้น</th><th>ห้อง</th><th>สถานะ</th><th>แถว LEC</th></tr></thead><tbody>'+history+'</tbody></table></div>':'<p class="muted">ยังไม่มีประวัติชั้นเรียน</p>')+'</section>'+
    '<section class="lec-detail-section"><div class="lec-section-head"><div><span>06</span><div><h3>แหล่งข้อมูล LEC</h3><p>ตรวจสอบย้อนกลับว่าแต่ละข้อมูลมาจากไฟล์ใด</p></div></div></div><div class="lec-import-grid">'+
      '<div><small>รายงาน</small><strong>'+esc(source.source_report_code||"-")+'</strong></div>'+
      '<div><small>ไฟล์ต้นฉบับ</small><strong>'+esc(source.source_file_name||"-")+'</strong></div>'+
      '<div><small>ชีต</small><strong>'+esc(source.source_sheet_name||"-")+'</strong></div>'+
      '<div><small>แถวในไฟล์</small><strong>'+esc(source.source_row_no||"-")+'</strong></div>'+
      '<div><small>ปี/ภาคเรียน</small><strong>'+esc(source.academic_year_be||"-")+' / '+esc(source.term_no||"-")+'</strong></div>'+
      '<div><small>นำเข้าเมื่อ</small><strong>'+esc(thaiDateTime(source.imported_at))+'</strong></div>'+
      '<div><small>ผลนำเข้า</small><strong>'+esc(source.outcome||"-")+'</strong></div>'+
      '<div><small>หมายเหตุ</small><strong>'+esc(source.issue_message||"-")+'</strong></div>'+
    '</div></section>'+
    '<section class="lec-detail-section lec-source-section"><div class="lec-section-head"><div><span>07</span><div><h3>ข้อมูลต้นฉบับจาก LEC</h3><p>'+raw.length+' ช่องที่มีข้อมูล · เลขประชาชนถูกปิดบัง</p></div></div></div><div class="lec-source-fields">'+(rawFields||'<p class="muted">ไม่มีข้อมูลต้นฉบับ</p>')+'</div></section>'+
  '</section>';
}

async function studentsHtml(){
  const detailId=studentDetailId();
  if(detailId)return await studentDetailPageHtml(detailId);
  q("[data-page-title]").textContent="นักเรียน";
  const school=currentSchool();
  if(!school)return '<section class="panel"><div class="empty-state"><div class="empty-icon">🏫</div><h3>เลือกสถานศึกษาก่อน</h3><p>เลือกโรงเรียนจากช่องบริบทด้านซ้ายเพื่อดูข้อมูลนักเรียนจาก LEC</p></div></section>';
  if(!canViewStudentDirectory())return '<section class="panel"><div class="empty-state"><div class="empty-icon">🔒</div><h3>ไม่มีสิทธิ์ดูทะเบียนนักเรียน</h3><p>เมนูนี้เปิดให้ผู้ดูแล ผู้บริหาร งานทะเบียน วิชาการ ครู และบุคลากรที่ได้รับสิทธิ์เท่านั้น</p></div></section>';

  const f=state.studentFilters||{};
  const res=await supabase.rpc("lao_student_directory",{
    p_school_id:school.id,
    p_search:f.search||null,
    p_year_be:f.year_be?Number(f.year_be):null,
    p_term_no:f.term_no?Number(f.term_no):null,
    p_grade_level:f.grade_level||null,
    p_classroom:f.classroom||null,
    p_presence:f.presence||null,
    p_limit:Number(f.limit||2000),
    p_offset:0
  });
  if(res.error)throw res.error;
  const d=res.data||{},items=d.items||[],stats=d.stats||{},filters=d.filters||{};
  state.studentDirectory=d;
  if(!f.year_be&&d.selected_year)f.year_be=d.selected_year;
  if(!f.term_no&&d.selected_term)f.term_no=d.selected_term;

  const option=(value,label,current)=>'<option value="'+esc(value)+'" '+(String(current??"")===String(value)?"selected":"")+'>'+esc(label)+'</option>';
  const yearOptions=(filters.years||[]).map(y=>option(y,"ปีการศึกษา "+y,d.selected_year)).join("");
  const termOptions=(filters.terms||[]).map(t=>option(t,"ภาคเรียนที่ "+t,d.selected_term)).join("");
  const gradeOptions=(filters.grades||[]).map(g=>option(g,shortGrade(g)+" · "+g,f.grade_level)).join("");
  const roomOptions=(filters.classrooms||[]).map(c=>option(c,"ห้อง "+c,f.classroom)).join("");

  const groups=[];
  items.forEach(item=>{
    const key=(item.grade_level||"-")+"||"+(item.classroom||"-");
    let group=groups.find(g=>g.key===key);
    if(!group){group={key,grade_level:item.grade_level||"-",classroom:item.classroom||"-",items:[]};groups.push(group);}
    group.items.push(item);
  });
  const roster=groups.map(group=>{
    const boys=group.items.filter(x=>x.gender==="ชาย").length;
    const girls=group.items.filter(x=>x.gender==="หญิง").length;
    const rows=group.items.map((x,i)=>'<div class="student-roster-row">'+
      '<span class="roster-index">'+(i+1)+'</span>'+
      '<span class="roster-number">'+esc(x.student_no||"-")+'</span>'+
      '<span class="roster-name"><strong>'+esc(x.full_name||[x.prefix,x.first_name_th,x.last_name_th].filter(Boolean).join(" "))+'</strong></span>'+
      '<span class="gender-badge '+genderClass(x.gender)+'">'+esc(genderLabel(x.gender))+'</span>'+
      '<span class="roster-status '+(x.lec_presence_status==="present"?"is-present":"is-warning")+'">'+esc(studentPresenceLabel(x.lec_presence_status))+'</span>'+
      '<a class="secondary-btn compact-btn roster-open" href="#/students/'+esc(x.student_id)+'">ดูข้อมูลทั้งหมด</a>'+
    '</div>').join("");
    return '<section class="student-room-group"><div class="student-room-head"><div><p class="eyebrow">CLASSROOM</p><h3>'+esc(shortGrade(group.grade_level))+' / ห้อง '+esc(group.classroom)+'</h3></div><div class="student-room-count"><strong>'+group.items.length+' คน</strong><span>ชาย '+boys+' · หญิง '+girls+'</span></div></div>'+
      '<div class="student-roster-list"><div class="student-roster-head"><span>ลำดับ</span><span>เลขประจำตัว</span><span>ชื่อ–สกุล</span><span>เพศ</span><span>สถานะ</span><span></span></div>'+rows+'</div></section>';
  }).join("");

  const total=Number(d.total||0);
  const canResetYear=isSchoolAdminContext()&&Boolean(d.selected_year);
  const resetToolsHtml=canResetYear
    ?'<section class="panel student-year-reset-card"><div class="student-year-reset-head"><div><p class="eyebrow">DATA SAFETY</p><h2>จัดการข้อมูลนักเรียนรายปี</h2><p class="panel-sub">สำหรับข้อมูลทดลองหรือนำเข้าผิด ระบบจะลบเฉพาะข้อมูลนักเรียนและประวัติ LEC ของปีที่เลือก โดยคงปีการศึกษา ภาคเรียน หลักสูตร รายวิชา โปรแกรม เวลาเรียน และภาระงานสอนไว้</p></div><button type="button" class="secondary-btn" data-open-student-year-reset data-year="'+esc(d.selected_year)+'">ตรวจสอบก่อนล้าง</button></div><div class="student-year-reset-panel hidden" data-student-year-reset-panel><div class="student-reset-preview-loading hidden" data-student-reset-preview-loading><span class="spinner"></span>กำลังตรวจสอบข้อมูล...</div><div data-student-reset-preview></div></div></section>'
    :'';
  return '<section class="student-directory">'+
    '<section class="student-summary-grid">'+
      '<article><small>นักเรียนในทะเบียน</small><strong>'+Number(stats.school_total||0).toLocaleString("th-TH")+'</strong><span>คน</span></article>'+
      '<article><small>ปี/ภาคเรียนนี้</small><strong>'+Number(stats.period_total||0).toLocaleString("th-TH")+'</strong><span>คน</span></article>'+
      '<article><small>กำลังเรียน</small><strong>'+Number(stats.present||0).toLocaleString("th-TH")+'</strong><span>คน</span></article>'+
      '<article><small>ไม่พบใน LEC ล่าสุด</small><strong>'+Number(stats.not_in_latest||0).toLocaleString("th-TH")+'</strong><span>คน</span></article>'+
    '</section>'+
    '<section class="panel student-filter-panel"><div class="panel-head"><div><p class="eyebrow">LEC STUDENT REGISTRY</p><h2>ค้นหาและเลือกรายชื่อนักเรียน</h2><p class="panel-sub">แยกตามห้อง ภายในแต่ละห้องเรียงชายก่อนหญิง และเรียงเลขประจำตัวนักเรียนจากน้อยไปมาก</p></div><span class="source-badge">ข้อมูลจาก LEC</span></div>'+
      '<form id="student-filter-form" class="student-filter-grid">'+
        '<label class="student-search-field"><span>ค้นหา</span><input name="search" value="'+esc(f.search||"")+'" placeholder="ชื่อ นามสกุล เลขประจำตัว หรือเลขประชาชน" autocomplete="off"></label>'+
        '<label><span>ปีการศึกษา</span><select name="year_be"><option value="">ล่าสุด</option>'+yearOptions+'</select></label>'+
        '<label><span>ภาคเรียน</span><select name="term_no"><option value="">ล่าสุด</option>'+termOptions+'</select></label>'+
        '<label><span>ระดับชั้น</span><select name="grade_level"><option value="">ทุกชั้น</option>'+gradeOptions+'</select></label>'+
        '<label><span>ห้อง</span><select name="classroom"><option value="">ทุกห้อง</option>'+roomOptions+'</select></label>'+
        '<label><span>สถานะ</span><select name="presence"><option value="">ทุกสถานะ</option>'+option("present","กำลังเรียน",f.presence)+option("not_in_latest_lec","ไม่พบใน LEC ล่าสุด",f.presence)+'</select></label>'+
        '<div class="student-filter-actions"><button class="primary-btn" type="submit">ค้นหา</button><button class="secondary-btn" type="button" data-student-reset>ล้างตัวกรอง</button></div>'+
      '</form>'+
    '</section>'+
    resetToolsHtml+
    '<section class="student-roster-stack"><div class="student-list-head"><div><h2>รายชื่อนักเรียนแยกตามห้อง</h2><p>'+esc(school.name_th||"")+' · ปีการศึกษา '+esc(d.selected_year||"-")+' · ภาคเรียนที่ '+esc(d.selected_term||"-")+'</p></div><strong>'+total.toLocaleString("th-TH")+' คน</strong></div>'+
      (items.length?roster:'<section class="panel"><div class="empty-state compact-empty"><div class="empty-icon">🔎</div><h3>ไม่พบนักเรียนตามเงื่อนไข</h3><p>ลองเปลี่ยนคำค้นหาหรือตัวกรอง</p></div></section>')+
    '</section>'+
  '</section>';
}

function bindStudents(){
  if(studentDetailId())return;
  const form=q("#student-filter-form");
  if(form){
    form.addEventListener("submit",e=>{
      e.preventDefault();
      const fd=new FormData(form);
      state.studentFilters={
        ...state.studentFilters,
        search:String(fd.get("search")||"").trim(),
        year_be:String(fd.get("year_be")||"")||null,
        term_no:String(fd.get("term_no")||"")||null,
        grade_level:String(fd.get("grade_level")||""),
        classroom:String(fd.get("classroom")||""),
        presence:String(fd.get("presence")||""),
        offset:0,
        limit:2000
      };
      renderRoute();
    });
    qa("select",form).forEach(select=>select.addEventListener("change",()=>{if(select.name==="year_be"){form.elements.term_no.value="";form.elements.grade_level.value="";form.elements.classroom.value="";}else if(select.name==="term_no"){form.elements.grade_level.value="";form.elements.classroom.value="";}form.requestSubmit();}));
  }
  const reset=q("[data-student-reset]");
  if(reset)reset.addEventListener("click",()=>{
    state.studentFilters={search:"",year_be:null,term_no:null,grade_level:"",classroom:"",presence:"",offset:0,limit:2000};
    renderRoute();
  });

  const openReset=q("[data-open-student-year-reset]");
  const resetPanel=q("[data-student-year-reset-panel]");
  const previewHost=q("[data-student-reset-preview]");
  const previewLoading=q("[data-student-reset-preview-loading]");
  if(openReset&&resetPanel&&previewHost){
    openReset.addEventListener("click",async()=>{
      const school=currentSchool();
      const year=Number(openReset.dataset.year||0);
      if(!school||!year)return;
      resetPanel.classList.remove("hidden");
      previewHost.innerHTML="";
      if(previewLoading)previewLoading.classList.remove("hidden");
      setBusy(openReset,true,"กำลังตรวจสอบ...");
      try{
        const res=await supabase.rpc("lao_student_year_reset_preview",{p_school_id:school.id,p_year_be:year});
        if(res.error)throw res.error;
        const p=res.data||{};
        const phrase=String(p.confirmation_text||("ลบข้อมูลนักเรียนปี "+year));
        const num=v=>Number(v||0).toLocaleString("th-TH");
        previewHost.innerHTML=
          '<div class="student-reset-warning '+(p.is_current?"is-current":"")+'"><strong>'+(p.is_current?"ปีการศึกษาปัจจุบัน — ตรวจสอบให้แน่ใจก่อนล้าง":"ข้อมูลของปีการศึกษา "+esc(year))+'</strong><p>การดำเนินการนี้ใช้สำหรับข้อมูลทดลองหรือนำเข้าผิด และไม่ลบโครงสร้างวิชาการของปีนี้</p></div>'+
          '<div class="student-reset-preview-grid">'+
            '<article><small>นักเรียน</small><strong>'+num(p.student_count)+'</strong><span>คน</span></article>'+
            '<article><small>รายการลงทะเบียน</small><strong>'+num(p.enrollment_count)+'</strong><span>รายการ</span></article>'+
            '<article><small>ชุดนำเข้า LEC</small><strong>'+num(p.lec_batch_count)+'</strong><span>ชุด</span></article>'+
            '<article><small>แถวต้นฉบับ LEC</small><strong>'+num(p.lec_row_count)+'</strong><span>แถว</span></article>'+
            '<article><small>ห้องจาก LEC</small><strong>'+num(p.lec_class_count)+'</strong><span>ห้อง</span></article>'+
            '<article><small>กิจกรรมรายนักเรียน</small><strong>'+num(p.activity_enrollment_count)+'</strong><span>รายการ</span></article>'+
          '</div>'+
          '<div class="student-reset-preserve"><strong>ข้อมูลที่จะเก็บไว้</strong><span>ปีการศึกษา · ภาคเรียน · หลักสูตร · รายวิชา · โปรแกรม · เวลาเรียน · ภาระงานสอน</span>'+
            (Number(p.protected_lec_class_count||0)>0?'<small>มี '+num(p.protected_lec_class_count)+' ห้องที่ถูกใช้อ้างอิงในภาระงานสอน ระบบจะเก็บห้องเหล่านี้ไว้เพื่อไม่ให้ข้อมูลเดิมเสียหาย</small>':'')+
          '</div>'+
          '<div class="student-reset-confirm"><label class="student-reset-ack"><input type="checkbox" data-student-reset-ack><span>ฉันตรวจสอบแล้วว่าเป็นข้อมูลทดลอง/นำเข้าผิด และต้องการล้างข้อมูลนักเรียนของปีนี้</span></label><label>พิมพ์ข้อความยืนยันให้ตรงกัน<input type="text" autocomplete="off" data-student-reset-confirm-input placeholder="'+esc(phrase)+'"></label><div class="student-reset-phrase">พิมพ์: <strong>'+esc(phrase)+'</strong></div><div class="student-reset-actions"><button type="button" class="secondary-btn" data-close-student-year-reset>ยกเลิก</button><button type="button" class="danger-btn" data-confirm-student-year-reset disabled>ล้างข้อมูลนักเรียนปี '+esc(year)+'</button></div></div>';
        resetPanel.dataset.confirmation=phrase;
        resetPanel.dataset.year=String(year);

        const ack=q("[data-student-reset-ack]",resetPanel);
        const input=q("[data-student-reset-confirm-input]",resetPanel);
        const confirmBtn=q("[data-confirm-student-year-reset]",resetPanel);
        const closeBtn=q("[data-close-student-year-reset]",resetPanel);
        const syncGuard=()=>{
          if(!confirmBtn)return;
          confirmBtn.disabled=!(ack&&ack.checked&&input&&input.value.trim()===phrase);
        };
        if(ack)ack.addEventListener("change",syncGuard);
        if(input)input.addEventListener("input",syncGuard);
        if(closeBtn)closeBtn.addEventListener("click",()=>{resetPanel.classList.add("hidden");previewHost.innerHTML="";});
        if(confirmBtn)confirmBtn.addEventListener("click",async()=>{
          if(confirmBtn.disabled)return;
          if(!window.confirm("ยืนยันล้างข้อมูลนักเรียนปี "+year+" ใช่หรือไม่?\n\nโครงสร้างปีการศึกษาและหลักสูตรจะยังคงอยู่"))return;
          setBusy(confirmBtn,true,"กำลังล้างข้อมูล...");
          try{
            const run=await supabase.rpc("lao_reset_student_year_data",{
              p_school_id:school.id,
              p_year_be:year,
              p_confirmation:input.value.trim()
            });
            if(run.error)throw run.error;
            const out=run.data||{};
            state.studentDirectory=null;
            state.academicData=null;
            state.academicPreset=null;
            state.subjectWorkspaceData=null;
            state.curriculumReadiness=null;
            toast("ล้างข้อมูลนักเรียนปี "+year+" แล้ว · ลบรายการลงทะเบียน "+num(out.student_enrollments_removed)+" รายการ","success");
            renderRoute();
          }catch(err){
            toast(err.message||"ล้างข้อมูลไม่สำเร็จ","error");
            setBusy(confirmBtn,false);
          }
        });
      }catch(err){
        previewHost.innerHTML='<div class="notice danger"><strong>ตรวจสอบข้อมูลไม่ได้</strong><br>'+esc(err.message||"เกิดข้อผิดพลาด")+'</div>';
        toast(err.message||"ตรวจสอบข้อมูลไม่สำเร็จ","error");
      }finally{
        if(previewLoading)previewLoading.classList.add("hidden");
        setBusy(openReset,false);
      }
    });
  }
}


function personnelTypeOptions(selected){
  const rows=[
    ["executive","ผู้บริหาร"],
    ["teacher","ครูผู้สอน"],
    ["educational_staff","บุคลากรทางการศึกษา"],
    ["support_staff","บุคลากรสนับสนุน"],
    ["contract_employee","พนักงานจ้างเหมาบริการ"],
    ["general_employee","พนักงานจ้างทั่วไป"],
    ["other","อื่น ๆ"]
  ];
  return rows.map(([v,l])=>'<option value="'+v+'" '+(selected===v?"selected":"")+'>'+l+'</option>').join("");
}
function personnelStatusOptions(selected){
  const rows=[
    ["active","ปฏิบัติงาน"],
    ["leave","ลา/พักปฏิบัติงาน"],
    ["transferred","ย้าย"],
    ["retired","เกษียณ"],
    ["resigned","ลาออก"],
    ["ended","สิ้นสุดการจ้าง"],
    ["other","อื่น ๆ"]
  ];
  return rows.map(([v,l])=>'<option value="'+v+'" '+(selected===v?"selected":"")+'>'+l+'</option>').join("");
}
function personnelPrefixControls(prefix){
  const raw=String(prefix||"").trim();
  const standard=["","นาย","นาง","นางสาว"];
  const custom=Boolean(raw&&!standard.includes(raw));
  const options=[
    ["","ไม่ระบุ"],["นาย","นาย"],["นาง","นาง"],["นางสาว","นางสาว"],["__custom__","ระบุเอง"]
  ].map(([v,l])=>'<option value="'+v+'" '+((custom&&v==="__custom__")||(!custom&&v===raw)?"selected":"")+'>'+l+'</option>').join("");
  return '<select name="prefix_mode" data-personnel-prefix-select>'+options+'</select>'+
    '<input class="personnel-prefix-custom '+(custom?"":"hidden")+'" name="prefix_custom" data-personnel-prefix-custom value="'+esc(custom?raw:"")+'" placeholder="ระบุคำนำหน้า" maxlength="40" '+(custom?"required":"")+'>';
}

async function loadDepartmentSetupTimeline(departmentCode){
  const school=currentSchool();
  if(!school)return null;
  const res=await supabase.rpc("lao_department_setup_timeline",{
    p_school_id:school.id,
    p_department_code:departmentCode
  });
  if(res.error)throw res.error;
  return res.data||null;
}
function departmentSetupStatusLabel(status){
  return ({completed:"เสร็จแล้ว",skipped:"ข้ามแล้ว",current:"ทำต่อขั้นนี้",queued:"รอคิว"})[status]||status||"-";
}
function departmentSetupTimelineHtml(timeline){
  if(!timeline||!Array.isArray(timeline.steps)||!timeline.steps.length)return "";
  const total=Number(timeline.total_count||timeline.steps.length||0);
  const resolved=Number(timeline.resolved_count||0);
  const pct=total?Math.max(0,Math.min(100,Math.round(resolved*100/total))):100;
  const next=timeline.next_step||null;
  const summary=timeline.is_complete
    ?'<strong>ตั้งค่าตามไทม์ไลน์ครบแล้ว</strong><span>หากข้อมูลจริงเปลี่ยน ระบบจะเปิดขั้นตอนที่เกี่ยวข้องให้ดำเนินการอีกครั้งอัตโนมัติ</span>'
    :'<strong>ครั้งถัดไปทำต่อ: '+esc(next&&next.title||"ขั้นตอนถัดไป")+'</strong><span>ระบบจดจำขั้นตอนที่เสร็จและขั้นตอนที่ข้ามไว้ให้ ไม่ต้องเริ่มใหม่</span>';

  const rows=timeline.steps.map(step=>{
    const status=step.status||"queued";
    const icon=status==="completed"?"✓":status==="skipped"?"↷":status==="current"?"→":"·";
    let action="";
    if(status==="completed"){
      action='<a class="department-step-link" href="'+esc(step.route)+'">เปิดดู</a>';
    }else if(status==="skipped"){
      action=timeline.can_manage
        ?'<button type="button" class="department-step-link department-step-link-button" data-department-setup-action="resume" data-department-code="'+esc(timeline.department_code)+'" data-step-code="'+esc(step.step_code)+'" data-step-route="'+esc(step.route)+'">กลับมาทำ</button>'
        :'<span class="department-step-muted">ข้ามไว้</span>';
    }else if(status==="current"){
      action='<div class="department-step-actions"><a class="department-step-link primary" href="'+esc(step.route)+'">ทำขั้นตอนนี้</a>'+
        (timeline.can_manage&&step.is_skippable?'<button type="button" class="department-step-link department-step-link-button" data-department-setup-action="skip" data-department-code="'+esc(timeline.department_code)+'" data-step-code="'+esc(step.step_code)+'">ข้ามขั้นนี้</button>':'')+
      '</div>';
    }else{
      action='<span class="department-step-muted">รอขั้นก่อนหน้า</span>';
    }
    return '<article class="department-setup-step '+esc(status)+'">'+
      '<div class="department-step-marker"><span>'+icon+'</span><i></i></div>'+
      '<div class="department-step-copy"><div class="department-step-title"><b>'+esc(step.sequence_no)+'</b><strong>'+esc(step.title)+'</strong><span class="department-step-kind '+(step.is_required?"required":"optional")+'">'+(step.is_required?"จำเป็น":"ข้ามได้")+'</span></div><p>'+esc(step.description||"")+'</p></div>'+
      '<span class="department-step-status '+esc(status)+'">'+esc(departmentSetupStatusLabel(status))+'</span>'+
      '<div class="department-step-control">'+action+'</div>'+
    '</article>';
  }).join("");

  return '<section class="department-setup-timeline panel" data-department-timeline="'+esc(timeline.department_code)+'">'+
    '<div class="department-timeline-head"><div><p class="eyebrow">SETUP TIMELINE</p><h2>ไทม์ไลน์ตั้งค่า'+esc(timeline.department_name||"")+'</h2><p>ทำตามลำดับทีละขั้น · ขั้นที่ไม่กระทบงานส่วนอื่นสามารถข้ามและกลับมาทำภายหลังได้</p></div><div class="department-timeline-progress"><strong>'+resolved+'/'+total+'</strong><span>ดำเนินการแล้ว</span></div></div>'+
    '<div class="department-progress-track"><span style="width:'+pct+'%"></span></div>'+
    '<div class="department-resume-card '+(timeline.is_complete?"complete":"")+'"><span>'+(timeline.is_complete?"✓":"▶")+'</span><div>'+summary+'</div>'+(next?'<a class="primary-btn compact-btn" href="'+esc(next.route)+'">ทำต่อ</a>':'')+'</div>'+
    '<div class="department-setup-steps">'+rows+'</div>'+
  '</section>';
}
function bindDepartmentSetupTimeline(){
  qa("[data-department-setup-action]").forEach(btn=>btn.addEventListener("click",async()=>{
    const action=btn.dataset.departmentSetupAction;
    const department=btn.dataset.departmentCode;
    const step=btn.dataset.stepCode;
    const route=btn.dataset.stepRoute||"";
    if(action==="skip"&&!confirm("ข้ามขั้นตอนนี้ไว้ก่อน?\n\nระบบจะจดจำว่าเป็นขั้นตอนที่ข้ามได้ และคุณสามารถกลับมาทำภายหลังโดยข้อมูลส่วนอื่นไม่ถูกลบ"))return;
    setBusy(btn,true,action==="skip"?"กำลังข้าม...":"กำลังเปิด...");
    const res=await supabase.rpc("lao_update_department_setup_step",{
      p_school_id:currentSchool().id,
      p_department_code:department,
      p_step_code:step,
      p_action:action
    });
    setBusy(btn,false);
    if(res.error){toast(res.error.message,"error");return;}
    if(action==="skip"){
      toast("ข้ามขั้นตอนนี้ไว้แล้ว ระบบจะพาไปขั้นตอนถัดไป","success");
      renderRoute();
    }else{
      toast("เปิดขั้นตอนนี้กลับมาดำเนินการแล้ว","success");
      if(route)location.hash=route;else renderRoute();
    }
  }));
}

function personnelNavHtml(active){
  const work=state.personnelWork||{};
  const pending=Number(work.pending_join_requests||0);
  return '<nav class="personnel-subnav" aria-label="งานบุคลากร">'+
    '<a href="#/personnel" class="'+(active==="dashboard"?"active":"")+'">ภาพรวม</a>'+
    '<a href="#/personnel/registry" class="'+(active==="registry"?"active":"")+'">ทะเบียนบุคลากร</a>'+
    (work.can_review?'<a href="#/personnel/requests" class="'+(active==="requests"?"active":"")+'">คำขอเข้าร่วม'+(pending>0?'<span class="subnav-badge">'+pending+'</span>':'')+'</a>':'')+
    (work.can_manage_intake?'<a href="#/personnel/intake" class="'+(active==="intake"?"active":"")+'">รับบุคลากรเข้าระบบ</a>':'')+
    (work.can_assign_authority?'<a href="#/personnel/authorities" class="'+(active==="authorities"?"active":"")+'">ผู้รับผิดชอบงานบุคลากร</a>':'')+
  '</nav>';
}
async function personnelDashboardHtml(){
  const school=currentSchool();
  if(!school)return '<section class="panel"><div class="empty-state"><div class="empty-icon">🏫</div><h3>เลือกสถานศึกษาก่อน</h3></div></section>';
  if(!canViewPersonnel())return '<section class="panel"><div class="empty-state"><div class="empty-icon">🔒</div><h3>ไม่มีสิทธิ์ดูงานบุคลากร</h3></div></section>';

  await loadPersonnelWorkCounts();
  const dir=await supabase.rpc("lao_personnel_directory",{p_school_id:school.id,p_search:null,p_personnel_type:null,p_status:null});
  if(dir.error)throw dir.error;
  const stats=dir.data&&dir.data.stats||{};
  const work=state.personnelWork||{};
  const pending=Number(work.pending_join_requests||0);
  const timeline=await loadDepartmentSetupTimeline("personnel");

  return '<section class="personnel-page">'+personnelNavHtml("dashboard")+
    '<section class="personnel-work-hero"><div><p class="eyebrow">PERSONNEL WORK</p><h2>งานบุคลากร</h2><p>'+esc(school.name_th||"")+' · จัดการทะเบียน การรับบุคลากรเข้าระบบ และงานที่รอดำเนินการตามสิทธิ์ของคุณ</p></div><a class="primary-btn" href="#/personnel/registry">เปิดทะเบียนบุคลากร</a></section>'+
    departmentSetupTimelineHtml(timeline)+
    '<section class="personnel-summary-grid">'+
      '<article><small>บุคลากรทั้งหมด</small><strong>'+Number(stats.total||0).toLocaleString("th-TH")+'</strong><span>คน</span></article>'+
      '<article><small>ปฏิบัติงาน</small><strong>'+Number(stats.active||0).toLocaleString("th-TH")+'</strong><span>คน</span></article>'+
      '<article><small>เชื่อมบัญชี</small><strong>'+Number(stats.linked_accounts||0).toLocaleString("th-TH")+'</strong><span>บัญชี</span></article>'+
      '<article class="'+(pending>0&&work.can_review?"needs-action":"")+'"><small>คำขอรอดำเนินการ</small><strong>'+pending.toLocaleString("th-TH")+'</strong><span>รายการ</span></article>'+
    '</section>'+
    '<section class="personnel-action-grid">'+
      '<a class="personnel-action-card" href="#/personnel/registry"><span>🪪</span><div><strong>ทะเบียนบุคลากร</strong><small>ค้นหา ดู และจัดการข้อมูลหลักของบุคลากร</small></div><em>เปิด</em></a>'+
      (work.can_review?'<a class="personnel-action-card '+(pending>0?"priority":"")+'" href="#/personnel/requests"><span>✅</span><div><strong>คำขอเข้าร่วม'+(pending>0?' · '+pending+' รายการ':'')+'</strong><small>ตรวจข้อมูลที่ผู้สมัครระบุ แก้ไขก่อนอนุมัติ และป้องกันรายการซ้ำ</small></div><em>'+(pending>0?"ตรวจสอบ":"เปิด")+'</em></a>':'')+
      (work.can_manage_intake?'<a class="personnel-action-card" href="#/personnel/intake"><span>🔗</span><div><strong>รับบุคลากรเข้าระบบ</strong><small>เปิด/ปิดลิงก์รับสมัครและคัดลอกลิงก์ส่งในกลุ่มโรงเรียน</small></div><em>ตั้งค่า</em></a>':'')+
      (work.can_assign_authority?'<a class="personnel-action-card" href="#/personnel/authorities"><span>👥</span><div><strong>ผู้รับผิดชอบงานบุคลากร</strong><small>แต่งตั้งหัวหน้างานและเจ้าหน้าที่ พร้อมกำหนดสิทธิ์ที่จำเป็น</small></div><em>จัดการ</em></a>':'')+
    '</section>'+
    (work.can_review&&pending>0?'<section class="notice warning personnel-attention"><strong>มีงานที่ต้องดำเนินการ '+pending+' รายการ</strong><br>มีผู้ยืนยันอีเมลและส่งคำขอเข้าร่วมโรงเรียนแล้ว กรุณาตรวจสอบก่อนอนุมัติ</section>':'')+
  '</section>';
}
async function personnelIntakeHtml(){
  const school=currentSchool();
  if(!school)return '<section class="panel"><div class="empty-state"><h3>เลือกสถานศึกษาก่อน</h3></div></section>';
  const res=await supabase.rpc("lao_personnel_join_settings",{p_school_id:school.id});
  if(res.error)return '<section class="personnel-page">'+personnelNavHtml("intake")+'<section class="panel"><div class="empty-state"><div class="empty-icon">🔒</div><h3>ไม่มีสิทธิ์จัดการลิงก์รับสมัคร</h3></div></section></section>';
  const d=res.data||{};
  const link=d.token?(location.origin+location.pathname+"?personnel_join="+encodeURIComponent(d.token)):"";
  return '<section class="personnel-page">'+personnelNavHtml("intake")+
    '<section class="panel personnel-intake-card"><div class="panel-head"><div><p class="eyebrow">PERSONNEL INTAKE</p><h2>รับบุคลากรเข้าระบบ</h2><p class="panel-sub">ใช้ลิงก์กลางของโรงเรียน 1 ลิงก์ เปิด–ปิดได้ โดยผู้สมัครยืนยันอีเมลก่อนส่งคำขอ</p></div><span class="pill '+(d.is_active?"success":"warning")+'">'+(d.is_active?"เปิดรับสมัคร":"ปิดรับสมัคร")+'</span></div>'+
      '<div class="intake-switch-card"><div><strong>'+ (d.is_active?"ระบบกำลังเปิดรับคำขอ":"ระบบยังไม่รับคำขอใหม่") +'</strong><p>'+(d.is_active?"ส่งลิงก์ให้บุคลากรผ่าน LINE หรือช่องทางภายในโรงเรียนได้ทันที":"เปิดระบบเมื่อต้องการรับบุคลากรใหม่ คำขอเดิมที่รอตรวจจะไม่ถูกลบ")+'</p></div><button type="button" class="'+(d.is_active?"danger-outline-btn":"primary-btn")+'" data-personnel-intake-toggle data-next="'+(!d.is_active)+'">'+(d.is_active?"ปิดรับสมัคร":"เปิดรับสมัคร")+'</button></div>'+
      (d.token?'<div class="intake-link-box"><label>ลิงก์รับบุคลากรเข้าระบบ</label><div><input type="text" readonly value="'+esc(link)+'" data-personnel-join-link><button class="secondary-btn" type="button" data-copy-personnel-link>คัดลอกลิงก์</button></div><small>'+(d.is_active?"ลิงก์นี้พร้อมใช้งาน":"ลิงก์เดิมยังเก็บไว้ แต่ผู้เปิดลิงก์จะสมัครไม่ได้จนกว่าจะเปิดระบบอีกครั้ง")+'</small></div>':'<div class="notice">ยังไม่มีลิงก์ ระบบจะสร้างลิงก์ของโรงเรียนให้อัตโนมัติเมื่อกด “เปิดรับสมัคร” ครั้งแรก</div>')+
      '<div class="intake-pending-row"><span>คำขอที่ยังรอตรวจสอบ</span><strong>'+Number(d.pending_count||0).toLocaleString("th-TH")+' รายการ</strong>'+(Number(d.pending_count||0)>0?'<a href="#/personnel/requests">ไปตรวจคำขอ →</a>':'')+'</div>'+
    '</section>'+
    '<section class="panel"><div class="personnel-section-head"><span>?</span><div><h3>ขั้นตอนสำหรับผู้สมัคร</h3><p>ออกแบบให้ทำตามทีละขั้น เพื่อลดความสับสนของผู้ใช้</p></div></div><div class="intake-howto"><div><b>1</b><strong>เปิดลิงก์และกรอกอีเมล</strong><small>ระบบส่งลิงก์ยืนยันไปที่อีเมล</small></div><div><b>2</b><strong>ยืนยันอีเมล</strong><small>กลับมากรอกชื่อ ตำแหน่ง และวิทยฐานะ</small></div><div><b>3</b><strong>ส่งคำขอ</strong><small>ระบบแจ้งชัดเจนว่าไม่ต้องสมัครซ้ำ</small></div><div><b>4</b><strong>ผู้เกี่ยวข้องตรวจสอบ</strong><small>ฝ่ายบุคลากร / School Admin แก้ข้อมูลก่อนอนุมัติได้</small></div></div></section>'+
  '</section>';
}
async function personnelRequestsHtml(){
  const school=currentSchool();
  if(!school)return '<section class="panel"><div class="empty-state"><h3>เลือกสถานศึกษาก่อน</h3></div></section>';
  const res=await supabase.rpc("lao_personnel_join_requests",{p_school_id:school.id,p_status:"pending_review"});
  if(res.error)return '<section class="personnel-page">'+personnelNavHtml("requests")+'<section class="panel"><div class="empty-state"><div class="empty-icon">🔒</div><h3>ไม่มีสิทธิ์ตรวจคำขอ</h3></div></section></section>';
  const d=res.data||{},items=d.items||[];
  const cards=items.map(r=>{
    const matches=Array.isArray(r.possible_matches)?r.possible_matches:[];
    const exact=matches.find(m=>String(m.email||"").toLowerCase()===String(r.email||"").toLowerCase());
    const matchOptions='<option value="">สร้างทะเบียนบุคลากรใหม่</option>'+matches.map(m=>'<option value="'+esc(m.id)+'" '+(exact&&exact.id===m.id?"selected":"")+'>'+esc(m.full_name||"-")+(m.position_title?' · '+esc(m.position_title):'')+(String(m.email||"").toLowerCase()===String(r.email||"").toLowerCase()?' · อีเมลตรงกัน':'')+'</option>').join("");
    return '<article class="personnel-request-card" data-request-card="'+esc(r.id)+'">'+
      '<div class="personnel-request-head"><div><span class="request-waiting-dot"></span><div><strong>'+esc(r.full_name||"-")+'</strong><small>'+esc(r.email||"-")+' · ส่งเมื่อ '+esc(thaiDateTime(r.submitted_at))+'</small></div></div><span class="pill warning">รอตรวจสอบ</span></div>'+
      '<div class="request-compare-grid"><section><h4>ข้อมูลที่ผู้สมัครระบุ</h4><dl><div><dt>ประเภท</dt><dd>'+esc(personnelTypeLabel(r.personnel_type))+'</dd></div><div><dt>ตำแหน่ง</dt><dd>'+esc(r.position_title||"-")+'</dd></div><div><dt>วิทยฐานะ</dt><dd>'+esc(r.academic_standing||"-")+'</dd></div><div><dt>โทรศัพท์</dt><dd>'+esc(r.phone||"-")+'</dd></div>'+(r.applicant_note?'<div class="wide"><dt>หมายเหตุ</dt><dd>'+esc(r.applicant_note)+'</dd></div>':'')+'</dl></section>'+
      '<form class="request-review-form" data-request-review="'+esc(r.id)+'"><h4>ข้อมูลที่จะบันทึกจริง</h4>'+
        (matches.length?'<label class="field request-existing-match"><span>ตรวจพบข้อมูลเดิมที่อาจตรงกัน</span><select name="existing_personnel_id">'+matchOptions+'</select><small>เลือกบุคลากรเดิมเพื่อเชื่อมบัญชี ป้องกันชื่อซ้ำ หรือเลือกสร้างรายการใหม่</small></label>':'')+
        '<div class="request-edit-grid">'+
          '<label class="field"><span>คำนำหน้า</span><input name="prefix" value="'+esc(r.prefix||"")+'"></label>'+
          '<label class="field"><span>ชื่อ *</span><input name="first_name_th" value="'+esc(r.first_name_th||"")+'" required></label>'+
          '<label class="field"><span>นามสกุล *</span><input name="last_name_th" value="'+esc(r.last_name_th||"")+'" required></label>'+
          '<label class="field"><span>ประเภท</span><select name="personnel_type">'+personnelTypeOptions(r.personnel_type||"other")+'</select></label>'+
          '<label class="field"><span>ตำแหน่ง</span><input name="position_title" value="'+esc(r.position_title||"")+'"></label>'+
          '<label class="field"><span>วิทยฐานะ</span><input name="academic_standing" value="'+esc(r.academic_standing||"")+'"></label>'+
          '<label class="field"><span>เลขประจำตัวบุคลากร</span><input name="employee_no" placeholder="เว้นว่างได้"></label>'+
          '<label class="field"><span>โทรศัพท์</span><input name="phone" value="'+esc(r.phone||"")+'"></label>'+
        '</div>'+
        '<div class="request-approve-row"><button class="primary-btn" type="submit">อนุมัติและเชื่อมบัญชี</button></div>'+
      '</form></div>'+
      '<div class="request-reject-box"><label><span>หากไม่อนุมัติ กรุณาระบุเหตุผล</span><textarea rows="2" data-reject-reason placeholder="เช่น ข้อมูลไม่ตรงกับทะเบียนบุคลากร กรุณาติดต่อฝ่ายบุคลากร"></textarea></label><button class="danger-outline-btn" type="button" data-reject-personnel-request="'+esc(r.id)+'">ไม่อนุมัติ</button></div>'+
    '</article>';
  }).join("");
  return '<section class="personnel-page">'+personnelNavHtml("requests")+
    '<section class="panel"><div class="panel-head"><div><p class="eyebrow">JOIN REQUESTS</p><h2>คำขอเข้าร่วมโรงเรียน</h2><p class="panel-sub">แสดงเฉพาะผู้ที่มีสิทธิ์ตรวจ/อนุมัติ ผู้ใช้อื่นในโรงเรียนไม่เห็นรายการนี้</p></div><span class="pill '+(Number(d.pending_count||0)>0?"warning":"success")+'">'+Number(d.pending_count||0)+' รอตรวจ</span></div>'+
      (items.length?'<div class="personnel-request-stack">'+cards+'</div>':'<div class="empty-state compact-empty"><div class="empty-icon">✓</div><h3>ไม่มีคำขอที่รอตรวจสอบ</h3><p>เมื่อมีผู้ยืนยันอีเมลและส่งคำขอ ระบบจะแจ้งเตือนผู้เกี่ยวข้องอัตโนมัติ</p></div>')+
    '</section>'+
  '</section>';
}


async function personnelAuthoritiesHtml(){
  const school=currentSchool();
  if(!school)return '<section class="panel"><div class="empty-state"><h3>เลือกสถานศึกษาก่อน</h3></div></section>';
  const res=await supabase.rpc("lao_personnel_authority_settings",{p_school_id:school.id});
  if(res.error)return '<section class="personnel-page">'+personnelNavHtml("authorities")+'<section class="panel"><div class="empty-state"><div class="empty-icon">🔒</div><h3>เฉพาะ School Admin</h3><p>การแต่งตั้งผู้รับผิดชอบงานบุคลากรต้องดำเนินการโดยผู้ดูแลสถานศึกษา</p></div></section></section>';
  const items=res.data&&res.data.items||[];
  const rows=items.map(p=>{
    const code=p.is_active?p.authority_code||"none":"none";
    return '<form class="personnel-authority-row" data-authority-personnel="'+esc(p.personnel_id)+'">'+
      '<div class="personnel-authority-person"><div class="personnel-avatar">'+personnelAvatarHtml(p,"personnel-avatar-media")+'</div><div><strong>'+esc(p.full_name||"-")+'</strong><small>'+esc(p.position_title||"-")+(p.academic_standing?' · '+esc(p.academic_standing):'')+' · '+esc(p.email||"-")+'</small></div></div>'+
      '<label><span>หน้าที่ในงานบุคลากร</span><select name="authority_code" data-authority-code><option value="none" '+(code==="none"?"selected":"")+'>ไม่ได้รับมอบหมาย</option><option value="personnel_head" '+(code==="personnel_head"?"selected":"")+'>หัวหน้างานบุคลากร</option><option value="personnel_officer" '+(code==="personnel_officer"?"selected":"")+'>เจ้าหน้าที่งานบุคลากร</option></select></label>'+
      '<label class="authority-check"><input type="checkbox" name="can_edit_personnel" '+(p.can_edit_personnel?"checked":"")+' data-authority-edit><span>แก้ทะเบียน</span></label>'+
      '<label class="authority-check"><input type="checkbox" name="can_review_join" '+(p.can_review_join?"checked":"")+' data-authority-review><span>ตรวจ/อนุมัติคำขอ</span></label>'+
      '<button class="secondary-btn compact-btn" type="submit">บันทึก</button>'+
    '</form>';
  }).join("");
  return '<section class="personnel-page">'+personnelNavHtml("authorities")+
    '<section class="panel"><div class="panel-head"><div><p class="eyebrow">PERSONNEL RESPONSIBILITY</p><h2>ผู้รับผิดชอบงานบุคลากร</h2><p class="panel-sub">หน้าที่นี้แยกจากตำแหน่งราชการ บุคลากรหนึ่งคนสามารถรับผิดชอบหลายฝ่ายได้ในอนาคต</p></div></div>'+
      '<div class="notice"><strong>หลักการสิทธิ์</strong><br>School Admin กำหนดหัวหน้างานหรือเจ้าหน้าที่จากบุคลากรที่เชื่อมบัญชีแล้ว หัวหน้างานบุคลากรจะมีสิทธิ์จัดการทะเบียน เปิด/ปิดรับสมัคร และตรวจคำขอ ส่วนเจ้าหน้าที่กำหนดสิทธิ์ย่อยได้</div>'+
      (items.length?'<div class="personnel-authority-list">'+rows+'</div>':'<div class="empty-state compact-empty"><div class="empty-icon">👥</div><h3>ยังไม่มีบุคลากรที่เชื่อมบัญชี</h3><p>ต้องเชื่อมบัญชี LAO-EMS กับทะเบียนบุคลากรก่อนจึงมอบหมายหน้าที่ได้</p></div>')+
    '</section>'+
  '</section>';
}

async function personnelListHtml(){
  const school=currentSchool();
  if(!school)return '<section class="panel"><div class="empty-state"><div class="empty-icon">🏫</div><h3>เลือกสถานศึกษาก่อน</h3><p>เลือกโรงเรียนจากบริบทด้านซ้ายเพื่อเปิดทะเบียนบุคลากร</p></div></section>';
  if(!canViewPersonnel())return '<section class="panel"><div class="empty-state"><div class="empty-icon">🔒</div><h3>ไม่มีสิทธิ์ดูทะเบียนบุคลากร</h3></div></section>';

  const f=state.personnelFilters||{};
  const res=await supabase.rpc("lao_personnel_directory",{
    p_school_id:school.id,
    p_search:f.search||null,
    p_personnel_type:f.personnel_type||null,
    p_status:f.status||null
  });
  if(res.error)throw res.error;
  const d=res.data||{},items=d.items||[],stats=d.stats||{};
  state.personnelDirectory=d;
  const canManage=Boolean(d.can_manage);

  const rows=items.map((p,i)=>'<div class="personnel-row personnel-row-clickable" role="link" tabindex="0" data-personnel-row-href="#/personnel/'+esc(p.id)+'" aria-label="เปิดข้อมูล '+esc(p.full_name||"บุคลากร")+'">'+
    '<span class="personnel-row-index">'+(i+1)+'</span>'+
    '<div class="personnel-row-person"><div class="personnel-avatar">'+personnelAvatarHtml(p,"personnel-avatar-media")+'</div><div><strong>'+esc(p.full_name||"-")+'</strong><small>'+esc(p.position_title||personnelTypeLabel(p.personnel_type))+(p.academic_standing?' · '+esc(p.academic_standing):'')+'</small></div></div>'+
    '<span class="personnel-type-pill">'+esc(personnelTypeLabel(p.personnel_type))+'</span>'+
    '<div class="personnel-contact"><span>'+esc(p.email||"-")+'</span><small>'+esc(p.phone||"-")+'</small></div>'+
    '<span class="personnel-account '+(p.account_linked?"linked":"")+'">'+(p.account_linked?"✓ เชื่อมบัญชี":"ยังไม่เชื่อม")+'</span>'+
    '<span class="personnel-status '+(p.employment_status==="active"?"active":"")+'">'+esc(employmentStatusLabel(p.employment_status))+'</span>'+
    '<span class="personnel-row-chevron" aria-hidden="true">›</span>'+
  '</div>').join("");

  return '<section class="personnel-page">'+personnelNavHtml("registry")+
    '<section class="personnel-summary-grid">'+
      '<article><small>บุคลากรทั้งหมด</small><strong>'+Number(stats.total||0).toLocaleString("th-TH")+'</strong><span>คน</span></article>'+
      '<article><small>ปฏิบัติงาน</small><strong>'+Number(stats.active||0).toLocaleString("th-TH")+'</strong><span>คน</span></article>'+
      '<article><small>ครูผู้สอน</small><strong>'+Number(stats.teachers||0).toLocaleString("th-TH")+'</strong><span>คน</span></article>'+
      '<article><small>เชื่อมบัญชี LAO-EMS</small><strong>'+Number(stats.linked_accounts||0).toLocaleString("th-TH")+'</strong><span>บัญชี</span></article>'+
    '</section>'+
    '<section class="panel personnel-filter-panel"><div class="panel-head"><div><p class="eyebrow">PERSONNEL REGISTRY</p><h2>ทะเบียนบุคลากร</h2><p class="panel-sub">'+esc(school.name_th||"")+' · ข้อมูลหลักสำหรับเชื่อมต่อระบบวิชาการและภาระงานในขั้นต่อไป</p></div>'+(canManage?'<a class="primary-btn" href="#/personnel/new">＋ เพิ่มบุคลากร</a>':'')+'</div>'+
      '<form id="personnel-filter-form" class="personnel-filter-grid">'+
        '<label class="personnel-search-field"><span>ค้นหา</span><input name="search" value="'+esc(f.search||"")+'" placeholder="ชื่อ นามสกุล ตำแหน่ง อีเมล หรือเลขประจำตัวบุคลากร"></label>'+
        '<label><span>ประเภทบุคลากร</span><select name="personnel_type"><option value="">ทุกประเภท</option>'+personnelTypeOptions(f.personnel_type||"")+'</select></label>'+
        '<label><span>สถานะ</span><select name="status"><option value="">ทุกสถานะ</option>'+personnelStatusOptions(f.status||"")+'</select></label>'+
        '<div class="personnel-filter-actions"><button class="primary-btn" type="submit">ค้นหา</button><button class="secondary-btn" type="button" data-personnel-reset>ล้างตัวกรอง</button></div>'+
      '</form>'+
    '</section>'+
    '<section class="panel personnel-list-panel"><div class="student-list-head"><div><h2>รายชื่อบุคลากร</h2><p>เรียงเป็นแถวแนวนอน · กดที่แถวเพื่อเปิดดูข้อมูล</p></div><strong>'+Number(d.total||0).toLocaleString("th-TH")+' คน</strong></div>'+
      (items.length?'<div class="personnel-list-hint">แตะหรือคลิกแถวที่ต้องการเพื่อดูข้อมูลบุคลากร</div><div class="personnel-list-scroll" role="region" aria-label="รายชื่อบุคลากร" tabindex="0"><div class="personnel-list"><div class="personnel-list-head"><span>ลำดับ</span><span>ชื่อ–สกุล / ตำแหน่ง</span><span>ประเภท</span><span>ติดต่อ</span><span>บัญชี</span><span>สถานะ</span><span aria-hidden="true"></span></div>'+rows+'</div></div>':'<div class="empty-state compact-empty"><div class="empty-icon">🪪</div><h3>ยังไม่พบบุคลากร</h3><p>'+(canManage?'กด “เพิ่มบุคลากร” เพื่อเริ่มทะเบียน':'ยังไม่มีข้อมูลบุคลากรในสถานศึกษานี้')+'</p></div>')+
    '</section>'+
  '</section>';
}
async function personnelDetailHtml(id){
  const school=currentSchool();
  if(!school||!canViewPersonnel())return '<section class="panel"><div class="empty-state"><div class="empty-icon">🔒</div><h3>ไม่สามารถเปิดข้อมูลบุคลากรได้</h3></div></section>';
  const res=await supabase.rpc("lao_personnel_detail",{p_school_id:school.id,p_personnel_id:id});
  if(res.error)throw res.error;
  const p=res.data||{};
  return '<section class="personnel-detail-page">'+
    '<div class="personnel-detail-toolbar"><a class="secondary-btn" href="#/personnel/registry">← กลับทะเบียนบุคลากร</a>'+(p.can_manage?'<a class="primary-btn" href="#/personnel/'+esc(p.id)+'/edit">แก้ไขข้อมูล</a>':'')+'</div>'+
    '<section class="personnel-detail-hero"><div class="personnel-detail-avatar">'+personnelAvatarHtml(p,"personnel-detail-avatar-media")+'</div><div><p class="eyebrow">PERSONNEL RECORD</p><h2>'+esc(p.full_name||"-")+'</h2><p>'+esc(p.position_title||personnelTypeLabel(p.personnel_type))+(p.academic_standing?' · '+esc(p.academic_standing):'')+'</p><div class="personnel-detail-badges"><span class="pill '+(p.employment_status==="active"?"success":"warning")+'">'+esc(employmentStatusLabel(p.employment_status))+'</span><span class="pill">'+esc(personnelTypeLabel(p.personnel_type))+'</span>'+(p.account_linked?'<span class="pill success">เชื่อมบัญชี LAO-EMS</span>':'')+'</div></div></section>'+
    '<section class="personnel-detail-section"><div class="personnel-section-head"><span>01</span><div><h3>ข้อมูลบุคลากร</h3><p>ข้อมูลประจำตัวและประเภทบุคลากร</p></div></div><div class="personnel-detail-grid">'+
      '<div><small>คำนำหน้า</small><strong>'+esc(p.prefix||"-")+'</strong></div>'+
      '<div><small>ชื่อ</small><strong>'+esc(p.first_name_th||"-")+'</strong></div>'+
      '<div><small>นามสกุล</small><strong>'+esc(p.last_name_th||"-")+'</strong></div>'+
      '<div><small>เลขประจำตัวบุคลากร</small><strong>'+esc(p.employee_no||"-")+'</strong></div>'+
      '<div><small>ประเภท</small><strong>'+esc(personnelTypeLabel(p.personnel_type))+'</strong></div>'+
      '<div><small>แหล่งข้อมูล</small><strong>'+esc(personnelSourceLabel(p.source_type))+'</strong></div>'+
    '</div></section>'+
    '<section class="personnel-detail-section"><div class="personnel-section-head"><span>02</span><div><h3>ตำแหน่งและสถานะการปฏิบัติงาน</h3><p>ข้อมูลตำแหน่งทางราชการ/การจ้าง ไม่ใช่ Role การใช้งานระบบ</p></div></div><div class="personnel-detail-grid">'+
      '<div><small>ตำแหน่ง</small><strong>'+esc(p.position_title||"-")+'</strong></div>'+
      '<div><small>วิทยฐานะ</small><strong>'+esc(p.academic_standing||"-")+'</strong></div>'+
      '<div><small>สถานะ</small><strong>'+esc(employmentStatusLabel(p.employment_status))+'</strong></div>'+
      '<div><small>เริ่มปฏิบัติงาน</small><strong>'+esc(thaiDate(p.employment_start_date))+'</strong></div>'+
      '<div><small>สิ้นสุด</small><strong>'+esc(thaiDate(p.employment_end_date))+'</strong></div>'+
      '<div><small>ลำดับแสดงผล</small><strong>'+esc(p.sort_order??"-")+'</strong></div>'+
    '</div></section>'+
    '<section class="personnel-detail-section"><div class="personnel-section-head"><span>03</span><div><h3>ข้อมูลติดต่อและบัญชี</h3><p>ใช้เชื่อมทะเบียนบุคลากรกับบัญชี LAO-EMS เมื่ออีเมลตรงกัน</p></div></div><div class="personnel-detail-grid">'+
      '<div><small>อีเมล</small><strong>'+esc(p.email||"-")+'</strong></div>'+
      '<div><small>โทรศัพท์</small><strong>'+esc(p.phone||"-")+'</strong></div>'+
      '<div><small>บัญชี LAO-EMS</small><strong>'+(p.account_linked?"เชื่อมแล้ว":"ยังไม่เชื่อม")+'</strong></div>'+
      '<div><small>อีเมลบัญชีที่เชื่อม</small><strong>'+esc(p.linked_account_email||"-")+'</strong></div>'+
    '</div></section>'+
    '<section class="personnel-detail-section"><div class="personnel-section-head"><span>04</span><div><h3>หมายเหตุ</h3><p>ข้อมูลเพิ่มเติมภายในทะเบียนบุคลากร</p></div></div><div class="personnel-notes">'+esc(p.notes||"ยังไม่มีหมายเหตุ")+'</div></section>'+
    '<section class="personnel-next-module"><div><strong>ภาระงานสอนและงานที่ได้รับมอบหมาย</strong><p>ส่วนนี้จะเชื่อมจากโครงสร้างหลักสูตรรายปีและโมดูลภาระงานในขั้นถัดไป โดยไม่ต้องกรอกวิชาซ้ำในทะเบียนบุคลากร</p></div><span>ขั้นถัดไป</span></section>'+
  '</section>';
}
async function personnelFormHtml(id){
  const school=currentSchool();
  if(!school)return '<section class="panel"><div class="empty-state"><h3>เลือกสถานศึกษาก่อน</h3></div></section>';
  const manageRes=await supabase.rpc("lao_can_manage_personnel",{p_school_id:school.id});
  if(manageRes.error)throw manageRes.error;
  if(manageRes.data!==true)return '<section class="panel"><div class="empty-state"><div class="empty-icon">🔒</div><h3>ไม่มีสิทธิ์แก้ไขทะเบียนบุคลากร</h3></div></section>';

  let p={personnel_type:"teacher",employment_status:"active"};
  if(id){
    const res=await supabase.rpc("lao_personnel_detail",{p_school_id:school.id,p_personnel_id:id});
    if(res.error)throw res.error;
    p=res.data||p;
  }
  const title=id?"แก้ไขข้อมูลบุคลากร":"เพิ่มบุคลากร";
  return '<section class="personnel-form-page">'+
    '<div class="personnel-detail-toolbar"><a class="secondary-btn" href="'+(id?'#/personnel/'+esc(id):'#/personnel/registry')+'">← ย้อนกลับ</a></div>'+
    '<section class="panel personnel-form-card"><div class="panel-head"><div><p class="eyebrow">PERSONNEL MASTER DATA</p><h2>'+title+'</h2><p class="panel-sub">บันทึกเฉพาะข้อมูลหลักของบุคลากร ส่วนรายวิชา ห้องเรียน และภาระงานจะจัดการในโมดูลวิชาการภายหลัง</p></div></div>'+
      '<form id="personnel-form" class="personnel-form-grid" data-personnel-id="'+esc(id||"")+'">'+
        '<label class="field personnel-prefix-field"><span class="field-label-line">คำนำหน้า</span>'+personnelPrefixControls(p.prefix)+'</label>'+
        '<label class="field"><span class="field-label-line">ชื่อ <span class="required-mark">*</span></span><input name="first_name_th" value="'+esc(p.first_name_th||"")+'" required></label>'+
        '<label class="field"><span class="field-label-line">นามสกุล <span class="required-mark">*</span></span><input name="last_name_th" value="'+esc(p.last_name_th||"")+'" required></label>'+
        '<label class="field"><span class="field-label-line">ประเภทบุคลากร</span><select name="personnel_type">'+personnelTypeOptions(p.personnel_type||"other")+'</select></label>'+
        '<label class="field"><span class="field-label-line">ตำแหน่ง</span><input name="position_title" value="'+esc(p.position_title||"")+'" placeholder="เช่น ครู / รองผู้อำนวยการสถานศึกษา / พนักงานจ้าง"></label>'+
        '<label class="field"><span class="field-label-line">วิทยฐานะ</span><input name="academic_standing" value="'+esc(p.academic_standing||"")+'" placeholder="เช่น ครูชำนาญการพิเศษ"></label>'+
        '<label class="field"><span class="field-label-line">เลขประจำตัวบุคลากร</span><input name="employee_no" value="'+esc(p.employee_no||"")+'"></label>'+
        '<label class="field"><span class="field-label-line">อีเมล</span><input name="email" type="email" value="'+esc(p.email||"")+'" autocomplete="email"><small>ถ้าตรงกับบัญชี LAO-EMS ที่มีสิทธิ์ในโรงเรียน ระบบจะเชื่อมบัญชีให้อัตโนมัติ</small></label>'+
        '<label class="field"><span class="field-label-line">โทรศัพท์</span><input name="phone" type="tel" value="'+esc(p.phone||"")+'" inputmode="tel"></label>'+
        '<label class="field"><span class="field-label-line">สถานะ</span><select name="employment_status">'+personnelStatusOptions(p.employment_status||"active")+'</select></label>'+
        '<label class="field"><span class="field-label-line">วันที่เริ่มปฏิบัติงาน (พ.ศ.)</span>'+buddhistDateControlHtml("employment_start_date",p.employment_start_date||"")+'</label>'+
        '<label class="field"><span class="field-label-line">วันที่สิ้นสุด (พ.ศ.)</span>'+buddhistDateControlHtml("employment_end_date",p.employment_end_date||"")+'</label>'+
        '<label class="field"><span class="field-label-line">ลำดับแสดงผล</span><input name="sort_order" type="number" step="1" value="'+esc(p.sort_order??"")+'" placeholder="เว้นว่างได้"></label>'+
        '<label class="field personnel-form-notes"><span class="field-label-line">หมายเหตุ</span><textarea name="notes" rows="4" placeholder="ข้อมูลเพิ่มเติมภายในทะเบียน">'+esc(p.notes||"")+'</textarea></label>'+
        '<div class="personnel-form-actions"><a class="secondary-btn" href="'+(id?'#/personnel/'+esc(id):'#/personnel/registry')+'">ยกเลิก</a><button class="primary-btn" type="submit">บันทึกข้อมูลบุคลากร</button></div>'+
      '</form>'+
    '</section>'+
  '</section>';
}
async function personnelHtml(){
  const stateRoute=personnelRouteState();
  if(stateRoute.mode==="new")return await personnelFormHtml(null);
  if(stateRoute.mode==="edit")return await personnelFormHtml(stateRoute.id);
  if(stateRoute.mode==="detail")return await personnelDetailHtml(stateRoute.id);
  if(stateRoute.mode==="registry")return await personnelListHtml();
  if(stateRoute.mode==="requests")return await personnelRequestsHtml();
  if(stateRoute.mode==="intake")return await personnelIntakeHtml();
  if(stateRoute.mode==="authorities")return await personnelAuthoritiesHtml();
  return await personnelDashboardHtml();
}
function bindPersonnel(){
  bindDepartmentSetupTimeline();
  const root=q("#main");
  bindAvatarFallback(root||document);

  const filter=q("#personnel-filter-form");
  if(filter){
    filter.addEventListener("submit",e=>{
      e.preventDefault();
      const fd=new FormData(filter);
      state.personnelFilters={
        search:String(fd.get("search")||"").trim(),
        personnel_type:String(fd.get("personnel_type")||""),
        status:String(fd.get("status")||"")
      };
      renderRoute();
    });
    qa("select",filter).forEach(select=>select.addEventListener("change",()=>filter.requestSubmit()));
  }
  const reset=q("[data-personnel-reset]");
  if(reset)reset.addEventListener("click",()=>{
    state.personnelFilters={search:"",personnel_type:"",status:"active"};
    renderRoute();
  });

  qa("[data-personnel-row-href]").forEach(row=>{
    const openRow=()=>{
      const href=row.dataset.personnelRowHref;
      if(href)location.hash=href;
    };
    row.addEventListener("click",e=>{
      if(e.target.closest("a,button,input,select,textarea"))return;
      openRow();
    });
    row.addEventListener("keydown",e=>{
      if(e.key==="Enter"||e.key===" "){
        e.preventDefault();
        openRow();
      }
    });
  });

  const intakeToggle=q("[data-personnel-intake-toggle]");
  if(intakeToggle)intakeToggle.addEventListener("click",async()=>{
    const next=intakeToggle.dataset.next==="true";
    if(!next&&!confirm("ปิดรับสมัครชั่วคราว? ลิงก์เดิมจะยังอยู่และคำขอที่รอตรวจสอบจะไม่ถูกลบ"))return;
    setBusy(intakeToggle,true,next?"กำลังเปิด...":"กำลังปิด...");
    const res=await supabase.rpc("lao_set_personnel_join_open",{p_school_id:currentSchool().id,p_is_active:next});
    setBusy(intakeToggle,false);
    if(res.error){toast(res.error.message,"error");return;}
    await loadPersonnelWorkCounts();
    refreshHeader();
    toast(next?"เปิดรับสมัครแล้ว สามารถคัดลอกลิงก์ส่งให้บุคลากรได้":"ปิดรับสมัครแล้ว คำขอเดิมยังคงอยู่","success");
    renderRoute();
  });

  const copyJoin=q("[data-copy-personnel-link]");
  if(copyJoin)copyJoin.addEventListener("click",async()=>{
    const input=q("[data-personnel-join-link]");
    if(!input)return;
    try{
      await navigator.clipboard.writeText(input.value);
      toast("คัดลอกลิงก์รับสมัครแล้ว","success");
    }catch(_){
      input.select();
      toast("เลือกข้อความลิงก์แล้ว กรุณาคัดลอกด้วยตนเอง","success");
    }
  });

  qa("[data-request-review]").forEach(reviewForm=>reviewForm.addEventListener("submit",async e=>{
    e.preventDefault();
    const fd=new FormData(reviewForm),btn=reviewForm.querySelector("button[type=submit]");
    if(!confirm("ยืนยันอนุมัติบุคลากรรายนี้ และเชื่อมบัญชีกับทะเบียนบุคลากร?"))return;
    setBusy(btn,true,"กำลังอนุมัติ...");
    const res=await supabase.rpc("lao_review_personnel_join_request",{
      p_request_id:reviewForm.dataset.requestReview,
      p_decision:"approved",
      p_existing_personnel_id:String(fd.get("existing_personnel_id")||"")||null,
      p_prefix:String(fd.get("prefix")||"").trim()||null,
      p_first_name_th:String(fd.get("first_name_th")||"").trim(),
      p_last_name_th:String(fd.get("last_name_th")||"").trim(),
      p_phone:String(fd.get("phone")||"").trim()||null,
      p_personnel_type:String(fd.get("personnel_type")||"other"),
      p_position_title:String(fd.get("position_title")||"").trim()||null,
      p_academic_standing:String(fd.get("academic_standing")||"").trim()||null,
      p_employee_no:String(fd.get("employee_no")||"").trim()||null,
      p_rejection_reason:null
    });
    setBusy(btn,false);
    if(res.error){toast(res.error.message,"error");return;}
    await Promise.all([loadPersonnelWorkCounts(),loadNotifications()]);
    refreshHeader();
    toast("อนุมัติและเชื่อมบัญชีเรียบร้อย","success");
    renderRoute();
  }));

  qa("[data-reject-personnel-request]").forEach(btn=>btn.addEventListener("click",async()=>{
    const card=btn.closest("[data-request-card]");
    const reason=String(q("[data-reject-reason]",card)&&q("[data-reject-reason]",card).value||"").trim();
    if(!reason){toast("กรุณาระบุเหตุผลก่อนกดไม่อนุมัติ","error");return;}
    if(!confirm("ยืนยันไม่อนุมัติคำขอนี้?"))return;
    setBusy(btn,true,"กำลังบันทึก...");
    const res=await supabase.rpc("lao_review_personnel_join_request",{
      p_request_id:btn.dataset.rejectPersonnelRequest,
      p_decision:"rejected",
      p_existing_personnel_id:null,
      p_prefix:null,p_first_name_th:null,p_last_name_th:null,p_phone:null,
      p_personnel_type:"other",p_position_title:null,p_academic_standing:null,p_employee_no:null,
      p_rejection_reason:reason
    });
    setBusy(btn,false);
    if(res.error){toast(res.error.message,"error");return;}
    await Promise.all([loadPersonnelWorkCounts(),loadNotifications()]);
    refreshHeader();
    toast("บันทึกผลไม่อนุมัติแล้ว","success");
    renderRoute();
  }));

  qa("[data-authority-personnel]").forEach(authorityForm=>{
    const codeSelect=q("[data-authority-code]",authorityForm);
    const edit=q("[data-authority-edit]",authorityForm);
    const review=q("[data-authority-review]",authorityForm);
    const syncAuthority=()=>{
      const code=codeSelect.value;
      if(code==="none"){
        edit.checked=false;review.checked=false;edit.disabled=true;review.disabled=true;
      }else if(code==="personnel_head"){
        edit.checked=true;review.checked=true;edit.disabled=true;review.disabled=true;
      }else{
        edit.disabled=false;review.disabled=false;
        if(authorityForm.dataset.officerInitialized!=="1"){
          if(!edit.checked&&!review.checked)edit.checked=true;
          authorityForm.dataset.officerInitialized="1";
        }
      }
    };
    codeSelect.addEventListener("change",()=>{
      authorityForm.dataset.officerInitialized="0";
      syncAuthority();
    });
    syncAuthority();
    authorityForm.addEventListener("submit",async e=>{
      e.preventDefault();
      const btn=authorityForm.querySelector("button[type=submit]");
      const code=codeSelect.value;
      if(code==="personnel_head"&&!confirm("ยืนยันมอบหมายเป็นหัวหน้างานบุคลากร? ผู้ใช้นี้จะจัดการทะเบียน เปิด/ปิดรับสมัคร และตรวจคำขอได้"))return;
      setBusy(btn,true,"กำลังบันทึก...");
      const res=await supabase.rpc("lao_save_personnel_authority",{
        p_school_id:currentSchool().id,
        p_personnel_id:authorityForm.dataset.authorityPersonnel,
        p_authority_code:code==="none"?null:code,
        p_can_edit_personnel:code==="personnel_head"?true:edit.checked,
        p_can_review_join:code==="personnel_head"?true:review.checked
      });
      setBusy(btn,false);
      if(res.error){toast(res.error.message,"error");return;}
      await Promise.all([loadPersonnelWorkCounts(),loadNotifications()]);
      refreshHeader();
      toast(code==="none"?"ยกเลิกหน้าที่งานบุคลากรแล้ว":"บันทึกผู้รับผิดชอบงานบุคลากรแล้ว","success");
      renderRoute();
    });
  });

  const form=q("#personnel-form");
  if(form){
    const prefixSelect=q("[data-personnel-prefix-select]",form);
    const prefixCustom=q("[data-personnel-prefix-custom]",form);
    const syncPrefix=()=>{
      if(!prefixSelect||!prefixCustom)return;
      const custom=prefixSelect.value==="__custom__";
      prefixCustom.classList.toggle("hidden",!custom);
      prefixCustom.required=custom;
      if(!custom)prefixCustom.value="";
    };
    if(prefixSelect){
      prefixSelect.addEventListener("change",()=>{
        syncPrefix();
        if(prefixSelect.value==="__custom__"&&prefixCustom)prefixCustom.focus();
      });
      syncPrefix();
    }

    form.addEventListener("submit",async e=>{
      e.preventDefault();
      const fd=new FormData(form);
      const btn=form.querySelector("button[type=submit]");
      const prefix=prefixSelect&&prefixSelect.value==="__custom__"?String(fd.get("prefix_custom")||"").trim():String(prefixSelect&&prefixSelect.value||"").trim();
      const sortRaw=String(fd.get("sort_order")||"").trim();
      setBusy(btn,true,"กำลังบันทึก...");
      const res=await supabase.rpc("lao_save_personnel",{
        p_school_id:currentSchool().id,
        p_personnel_id:form.dataset.personnelId||null,
        p_prefix:prefix||null,
        p_first_name_th:String(fd.get("first_name_th")||"").trim(),
        p_last_name_th:String(fd.get("last_name_th")||"").trim(),
        p_personnel_type:String(fd.get("personnel_type")||"other"),
        p_position_title:String(fd.get("position_title")||"").trim()||null,
        p_academic_standing:String(fd.get("academic_standing")||"").trim()||null,
        p_employee_no:String(fd.get("employee_no")||"").trim()||null,
        p_email:String(fd.get("email")||"").trim()||null,
        p_phone:String(fd.get("phone")||"").trim()||null,
        p_employment_status:String(fd.get("employment_status")||"active"),
        p_employment_start_date:String(fd.get("employment_start_date")||"")||null,
        p_employment_end_date:String(fd.get("employment_end_date")||"")||null,
        p_notes:String(fd.get("notes")||"").trim()||null,
        p_sort_order:sortRaw===""?null:Number(sortRaw)
      });
      setBusy(btn,false);
      if(res.error){toast(res.error.message,"error");return;}
      const saved=res.data||{};
      toast("บันทึกข้อมูลบุคลากรแล้ว","success");
      location.hash="#/personnel/"+saved.id;
    });
  }
}


function academicRouteState(){
  const hash=location.hash||"#/academics";
  if(/^#\/academics\/periods\/?$/i.test(hash))return {mode:"periods"};
  if(/^#\/academics\/programs\/?$/i.test(hash))return {mode:"programs"};
  if(/^#\/academics\/classes\/?$/i.test(hash))return {mode:"classes"};
  if(/^#\/academics\/subjects\/?$/i.test(hash))return {mode:"subjects"};
  if(/^#\/academics\/curriculum\/?$/i.test(hash))return {mode:"curriculum"};
  if(/^#\/academics\/workload\/?$/i.test(hash))return {mode:"workload"};
  return {mode:"dashboard"};
}
function academicGradeCode(label){
  const v=String(label||"").trim();
  let m=v.match(/^อนุบาล\s*(\d+)$/);if(m)return "K"+m[1];
  m=v.match(/^ประถมศึกษาปีที่\s*(\d+)$/);if(m)return "P"+m[1];
  m=v.match(/^มัธยมศึกษาปีที่\s*(\d+)$/);if(m)return "M"+m[1];
  return "";
}
function academicGradeOrder(label){
  const code=academicGradeCode(label);
  const m=code.match(/^([KPM])(\d+)$/);
  if(!m)return 900;
  const base=m[1]==="K"?0:m[1]==="P"?30:90;
  return base+Number(m[2])*10;
}
const academicPresetGradeCodes=["P1","P2","P3","P4","P5","P6","M1","M2","M3","M4","M5","M6"];
function academicSubjectTypeLabel(value){
  return ({basic:"รายวิชาพื้นฐาน",additional:"รายวิชาเพิ่มเติม",activity:"กิจกรรมพัฒนาผู้เรียน",other:"อื่น ๆ"})[value]||value||"-";
}
function academicSubjectTypeOptions(selected){
  return [["basic","รายวิชาพื้นฐาน"],["additional","รายวิชาเพิ่มเติม"],["activity","กิจกรรมพัฒนาผู้เรียน"],["other","อื่น ๆ"]]
    .map(([v,l])=>'<option value="'+v+'" '+(selected===v?"selected":"")+'>'+l+'</option>').join("");
}
function academicNumberText(value){
  if(value==null||value==="")return "";
  return Number(value).toLocaleString("th-TH",{maximumFractionDigits:2});
}
function academicTimeTemplateDiffers(info){
  const a=info&&info.standard_current,b=info&&info.standard_snapshot;
  if(!a||!b)return false;
  return ["period_scope","annual_hours","term_hours","weekly_periods","credits","basis_weeks","time_mode","is_flexible","term_no","note"]
    .some(k=>String(a[k]??"")!==String(b[k]??""));
}
function academicStandardTimeSummary(t){
  if(!t)return "";
  const parts=[];
  if(t.period_scope==="term"){
    if(t.term_hours!=null)parts.push(academicNumberText(t.term_hours)+" ชม./ภาค");
    if(t.credits!=null)parts.push(academicNumberText(t.credits)+" นก.");
  }else if(t.annual_hours!=null){
    parts.push(academicNumberText(t.annual_hours)+" ชม./ปี");
  }
  if(t.time_mode==="integrated")parts.push("บูรณาการ · ไม่นับ ชม.ลงตาราง");
  else if(t.weekly_periods!=null)parts.push(academicNumberText(t.weekly_periods)+" คาบ/สัปดาห์");
  return parts.join(" · ");
}
function academicCurriculumTimeFrameworkHtml(group,gradeLabel){
  if(!group||!group.time_framework)return "";
  const f=group.time_framework;
  const n=v=>Number(v||0).toLocaleString("th-TH",{maximumFractionDigits:2});
  const annual=f.grade_scope==="annual";
  const statusClass=s=>s==="match"?"ok":(s==="below"||s==="above"?"attention":"neutral");
  const scheduled=Number(group.scheduled_hours_total||0);
  const integrated=Number(group.integrated_activity_hours||0);
  const basic=Number(group.basic_hours_total||0);
  const activity=Number(group.learner_activity_hours_total||0);
  const history=Number(group.history_hours_total||0);
  const cards=annual
    ?'<div class="curriculum-framework-card '+statusClass(f.basic_status)+'"><small>รายวิชาพื้นฐาน</small><strong>'+n(basic)+' / '+n(f.basic_hours)+' ชม./ปี</strong><span>'+(f.basic_status==="match"?"ตรงกรอบ":f.basic_status==="below"?"ต่ำกว่ากรอบ":"สูงกว่ากรอบ")+'</span></div>'+
      '<div class="curriculum-framework-card '+statusClass(f.activity_status)+'"><small>กิจกรรมพัฒนาผู้เรียน</small><strong>'+n(activity)+' / '+n(f.learner_activity_hours)+' ชม./ปี</strong><span>รวมกิจกรรมบูรณาการด้วย</span></div>'+
      '<div class="curriculum-framework-card"><small>ชั่วโมงที่นับลงตาราง</small><strong>'+n(scheduled)+' ชม./ปี</strong><span>ไม่รวมกิจกรรมบูรณาการ '+n(integrated)+' ชม.</span></div>'+
      '<div class="curriculum-framework-card '+statusClass(f.history_status)+'"><small>ประวัติศาสตร์</small><strong>'+n(history)+' / '+n(f.history_hours)+' ชม./ปี</strong><span>ตรวจตามกรอบระดับชั้น</span></div>'
    :'<div class="curriculum-framework-card neutral"><small>พื้นฐาน ม.4–ม.6</small><strong>'+n(f.basic_hours)+' ชม./3 ปี</strong><span>ตรวจรวมทั้งช่วง ม.ปลาย</span></div>'+
      '<div class="curriculum-framework-card neutral"><small>กิจกรรมพัฒนาผู้เรียน</small><strong>'+n(f.learner_activity_hours)+' ชม./3 ปี</strong><span>ตรวจรวมทั้งช่วง ม.ปลาย</span></div>'+
      '<div class="curriculum-framework-card neutral"><small>ประวัติศาสตร์</small><strong>'+n(f.history_hours)+' ชม./3 ปี</strong><span>โรงเรียนกระจายตามแผนการเรียน</span></div>'+
      '<div class="curriculum-framework-card"><small>ชั่วโมงที่นับลงตาราง · '+esc(shortGrade(gradeLabel||f.grade_code))+'</small><strong>'+n(scheduled)+' ชม.</strong><span>บูรณาการ '+n(integrated)+' ชม. แยกไม่นับรวม</span></div>';
  return '<section class="curriculum-framework-panel">'+
    '<div class="curriculum-framework-head"><div><strong>กรอบตรวจสอบเวลาเรียน</strong><span>'+esc(f.source_label||"กรอบหลักสูตร")+(annual?' · รายปี':' · ตรวจรวม 3 ปี')+'</span></div><span class="curriculum-framework-rule">รวมเวลาเรียนทั้งหมด: สถานศึกษากำหนด</span></div>'+
    '<div class="curriculum-framework-grid">'+cards+'</div>'+
    '<div class="curriculum-framework-foot"><span>ไม่มีการตั้งเพดานรวมแบบตายตัวในกรอบนี้ ระบบจึงเตือนตามองค์ประกอบที่หลักสูตรกำหนด และใช้ความจุตารางเรียนของโรงเรียนเป็นตัวตรวจอีกชั้นหนึ่ง</span>'+
      (f.source_url?'<a href="'+esc(f.source_url)+'" target="_blank" rel="noopener">อ้างอิง '+esc(f.source_label||"เอกสารหลักสูตร")+' ↗</a>':'')+
    '</div>'+
  '</section>';
}
function academicSchoolTimeSummary(course,standard){
  if(!course)return "ยังไม่กำหนด";
  const parts=[];
  if(standard&&standard.period_scope==="term"){
    const plan=(course.term_plans||[]).find(x=>Number(x.term_no)===Number(standard.term_no))||{};
    if(plan.term_hours!=null)parts.push(academicNumberText(plan.term_hours)+" ชม./ภาค");
    if(course.credits!=null)parts.push(academicNumberText(course.credits)+" นก.");
    if(plan.weekly_periods!=null)parts.push(academicNumberText(plan.weekly_periods)+" คาบ/สัปดาห์");
    else if(standard.time_mode==="integrated")parts.push("บูรณาการ");
  }else{
    const weekly=(course.term_plans||[]).find(x=>x.weekly_periods!=null);
    if(course.annual_hours!=null)parts.push(academicNumberText(course.annual_hours)+" ชม./ปี");
    if(weekly&&weekly.weekly_periods!=null)parts.push(academicNumberText(weekly.weekly_periods)+" คาบ/สัปดาห์");
    else if(standard&&standard.time_mode==="integrated")parts.push("บูรณาการ");
  }
  return parts.join(" · ")||"ยังไม่กำหนด";
}
function academicTimeEditorHtml(course,info){
  const standard=info&&(info.standard_current||info.standard_snapshot);
  if(!standard)return "";
  const plan=standard.period_scope==="term"
    ?(course.term_plans||[]).find(x=>Number(x.term_no)===Number(standard.term_no))||{}
    :(course.term_plans||[]).find(x=>x.weekly_periods!=null)||{};
  const standardText=academicStandardTimeSummary(standard);
  const schoolText=academicSchoolTimeSummary(course,standard);
  const flexible=standard.is_flexible?'<span class="subject-time-flex-note">ปรับตามบริบท/แผนการเรียนได้</span>':'';
  const fields=standard.period_scope==="term"
    ?'<label>ชั่วโมง/ภาค<input name="term_hours" type="number" min="0" step="0.5" value="'+esc(plan.term_hours??"")+'" placeholder="'+esc(standard.term_hours??"")+'"></label>'+
      '<label>หน่วยกิต<input name="credits" type="number" min="0" step="0.5" value="'+esc(course.credits??"")+'" placeholder="'+esc(standard.credits??"")+'"></label>'+
      '<label>คาบ/สัปดาห์<input name="weekly_periods" type="number" min="0" step="0.25" value="'+esc(plan.weekly_periods??"")+'" placeholder="'+(standard.time_mode==="integrated"?"บูรณาการ":esc(standard.weekly_periods??""))+'"></label>'
    :'<label>ชั่วโมง/ปี<input name="annual_hours" type="number" min="0" step="0.5" value="'+esc(course.annual_hours??"")+'" placeholder="'+esc(standard.annual_hours??"")+'"></label>'+
      '<label>คาบ/สัปดาห์<input name="weekly_periods" type="number" min="0" step="0.25" value="'+esc(plan.weekly_periods??"")+'" placeholder="'+(standard.time_mode==="integrated"?"บูรณาการ":esc(standard.weekly_periods??""))+'"></label>';
  return '<form class="subject-time-editor hidden" data-subject-time-form="'+esc(course.id)+'">'+
    '<div class="subject-time-editor-head"><div><strong>แก้เวลาเรียนของโรงเรียน</strong><small>แก้เฉพาะโครงสร้างของโรงเรียน ไม่แก้ฐานมาตรฐานกลาง</small></div>'+flexible+'</div>'+
    '<div class="subject-time-compare compact"><div><small>มาตรฐานกลางขั้นต่ำ</small><strong>'+esc(standardText||"ไม่กำหนด")+'</strong></div><div><small>โรงเรียนใช้</small><strong>'+esc(schoolText)+'</strong></div></div>'+
    '<div class="subject-time-fields">'+fields+'<label class="subject-time-note">หมายเหตุ<input name="note" value="'+esc(info.time_override_note||"")+'" placeholder="เหตุผล/บริบทของโรงเรียน (ถ้ามี)"></label></div>'+
    '<div class="subject-time-editor-actions"><button type="button" class="secondary-btn compact-btn" data-close-subject-time="'+esc(course.id)+'">ปิด</button><button type="button" class="secondary-btn compact-btn" data-reset-subject-time-standard="'+esc(course.id)+'">คืนค่ามาตรฐานกลาง</button><button type="submit" class="primary-btn compact-btn">บันทึกเวลาเรียน</button></div>'+
  '</form>';
}
function academicProgramOptions(data,selected,includeAll=false){
  const rows=(data&&data.programs||[]).filter(p=>p.is_active||p.id===selected);
  return (includeAll?'<option value="">ทุกโปรแกรม</option>':'<option value="">ห้องทั่วไป / ไม่ระบุโปรแกรม</option>')+
    rows.map(p=>'<option value="'+esc(p.id)+'" '+(selected===p.id?"selected":"")+'>'+esc(p.name_th)+(p.code?' · '+esc(p.code):'')+'</option>').join("");
}
function academicSchoolGradeRows(data){
  const rows=new Map();
  (data&&data.classes||[])
    .filter(x=>x&&x.source_type==="lec"&&x.is_active!==false)
    .forEach(x=>{
      const gradeCode=String(x.grade_code||academicGradeCode(x.grade_label)||"").trim().toUpperCase();
      if(!gradeCode)return;
      const gradeLabel=String(x.grade_label||academicGradeLabelFromCode(gradeCode)||gradeCode).trim();
      if(!rows.has(gradeCode))rows.set(gradeCode,{grade_code:gradeCode,grade_label:gradeLabel});
    });
  return Array.from(rows.values()).sort((a,b)=>
    academicGradeOrder(a.grade_label)-academicGradeOrder(b.grade_label)||
    String(a.grade_label).localeCompare(String(b.grade_label),"th")
  );
}
function academicSchoolGradeCodes(data){
  return academicSchoolGradeRows(data).map(x=>x.grade_code);
}
function academicCurriculumGradeRows(data){
  return academicSchoolGradeRows(data).filter(x=>academicPresetGradeCodes.includes(x.grade_code));
}
function academicCurriculumGradeCodes(data){
  return academicCurriculumGradeRows(data).map(x=>x.grade_code);
}
function academicGradeValues(data){
  return academicCurriculumGradeRows(data).map(x=>x.grade_label);
}
function academicSchoolGradeSummary(data){
  const rows=academicSchoolGradeRows(data);
  if(!rows.length)return "ยังไม่มีระดับชั้นจาก LEC";
  const labels=rows.map(x=>shortGrade(x.grade_label));
  if(labels.length<=9)return labels.join(", ");
  return labels.slice(0,5).join(", ")+" … "+labels.slice(-2).join(", ");
}
function academicGradeOptionsHtml(data,selected="",includeAll=false){
  const rows=academicCurriculumGradeRows(data);
  return (includeAll?'<option value="">ทุกระดับชั้นที่โรงเรียนเปิดสอน</option>':'<option value="">เลือกระดับชั้น</option>')+
    rows.map(x=>'<option value="'+esc(x.grade_label)+'" '+(selected===x.grade_label?"selected":"")+'>'+esc(x.grade_label)+'</option>').join("");
}
function academicGradeDatalistHtml(id,data){
  return '<datalist id="'+id+'">'+academicGradeValues(data).map(v=>'<option value="'+esc(v)+'"></option>').join("")+'</datalist>';
}
function academicSelectedYear(data){
  return (data&&data.years||[]).find(y=>y.id===data.selected_year_id)||null;
}
function academicGradeLabelFromCode(code){
  const m=String(code||"").match(/^([KPM])(\d+)$/);
  if(!m)return "";
  const n=m[2];
  if(m[1]==="K")return "อนุบาล "+n;
  if(m[1]==="P")return "ประถมศึกษาปีที่ "+n;
  return "มัธยมศึกษาปีที่ "+n;
}
async function loadAcademicCurriculumPreset(data,programIdOverride){
  const school=currentSchool(),year=academicSelectedYear(data);
  if(!school||!year){
    state.academicPreset=null;
    return null;
  }
  const [res,timeRes]=await Promise.all([
    supabase.rpc("lao_curriculum_preset",{
      p_school_id:school.id,
      p_academic_year_id:year.id,
      p_program_id:programIdOverride!==undefined?(programIdOverride||null):(state.academicFilters&&state.academicFilters.program_id||null)
    }),
    supabase.rpc("lao_central_time_templates",{p_school_id:school.id,p_grade_code:null})
  ]);
  if(res.error){
    state.academicPreset=null;
    return null;
  }
  const schoolGradeSet=new Set(academicCurriculumGradeCodes(data));
  const preset=res.data||null;
  const timeMap=new Map(((timeRes.error?[]:timeRes.data?.items)||[]).map(x=>[x.preset_item_id,x]));
  if(preset){
    preset.items=(preset.items||[]).map(x=>({...x,standard_time:timeMap.get(x.id)||null}));
  }
  if(preset&&schoolGradeSet.size){
    preset.supported_grades=(preset.supported_grades||[]).filter(g=>schoolGradeSet.has(g.grade_code));
    preset.items=(preset.items||[]).filter(g=>schoolGradeSet.has(g.grade_code));
    preset.school_grade_codes=Array.from(schoolGradeSet);
  }
  state.academicPreset=preset;
  const grades=state.academicPreset&&state.academicPreset.supported_grades||[];
  if(!grades.some(g=>g.grade_code===state.academicPresetGrade)){
    state.academicPresetGrade=grades[0]&&grades[0].grade_code||"";
  }
  return state.academicPreset;
}
async function loadAcademicCourseTimeOverview(data){
  const school=currentSchool(),year=academicSelectedYear(data);
  if(!school||!year){
    if(data)data.course_time_overview={items:[]};
    return null;
  }
  const res=await supabase.rpc("lao_course_time_overview",{p_school_id:school.id,p_academic_year_id:year.id});
  data.course_time_overview=res.error?{items:[]}:(res.data||{items:[]});
  return data.course_time_overview;
}
function academicYearSelectorHtml(data){
  const years=data&&data.years||[];
  if(!years.length)return '<span class="academic-year-empty">ยังไม่มีปีการศึกษา</span>';
  return '<label class="academic-year-switch"><span>ปีการศึกษา</span><select data-academic-year-select>'+
    years.map(y=>'<option value="'+esc(y.id)+'" '+(data.selected_year_id===y.id?"selected":"")+'>'+esc(y.year_be)+(y.is_current?' · ปัจจุบัน':'')+'</option>').join("")+
    '</select></label>';
}
function academicNavHtml(active,data){
  const steps=[
    {key:"dashboard",href:"#/academics",label:"ภาพรวม"},
    {key:"periods",href:"#/academics/periods",label:"ปี/ภาคเรียน"},
    {key:"programs",href:"#/academics/programs",label:"หลักสูตร/โปรแกรม"},
    {key:"classes",href:"#/academics/classes",label:"ชั้น/ห้อง"},
    {key:"subjects",href:"#/academics/subjects",label:"รายวิชา"},
    {key:"curriculum",href:"#/academics/curriculum",label:"โครงสร้างเวลาเรียน"},
    {key:"workload",href:"#/academics/workload",label:"ภาระงานสอน"}
  ];
  const attention=Number(state.academicWork&&state.academicWork.attention_count||0);
  return '<div class="academic-toolbar academic-step-toolbar">'+
    '<nav class="academic-subnav academic-step-nav" aria-label="ลำดับขั้นตอนงานวิชาการ">'+
      steps.map((step,index)=>
        '<a href="'+step.href+'" class="academic-step-link '+(active===step.key?"active":"")+'" '+(active===step.key?'aria-current="page"':'')+'>'+
          '<span class="academic-step-node">'+(index+1)+'</span>'+
          '<span class="academic-step-title">'+esc(step.label)+(step.key==="workload"&&attention>0?'<span class="subnav-badge">'+attention+'</span>':'')+'</span>'+
        '</a>'
      ).join("")+
    '</nav>'+
    academicYearSelectorHtml(data)+
  '</div>';
}
async function loadAcademicStructure(){
  const school=currentSchool();
  if(!school)throw new Error("กรุณาเลือกสถานศึกษา");
  if(!canViewAcademic())throw new Error("ไม่มีสิทธิ์ดูข้อมูลงานวิชาการ");
  const res=await supabase.rpc("lao_academic_structure",{
    p_school_id:school.id,
    p_academic_year_id:state.academicYearId||null
  });
  if(res.error)throw res.error;
  state.academicData=res.data||{};
  state.academicData.classes=(state.academicData.classes||[]).filter(x=>x&&x.source_type==="lec"&&x.is_active!==false);
  const schoolGradeSet=new Set(academicSchoolGradeCodes(state.academicData));
  if(schoolGradeSet.size){
    state.academicData.courses=(state.academicData.courses||[]).filter(c=>schoolGradeSet.has(c.grade_code||academicGradeCode(c.grade_label)));
  }
  state.academicData.grade_context={
    source:schoolGradeSet.size?"lec":"pending_lec",
    grade_codes:Array.from(schoolGradeSet),
    grade_labels:academicSchoolGradeRows(state.academicData).map(x=>x.grade_label)
  };
  const nextYear=state.academicData.selected_year_id||null;
  if(state.academicYearId!==nextYear)state.academicTermId=null;
  state.academicYearId=nextYear;
  return state.academicData;
}
async function academicDashboardHtml(data){
  const school=currentSchool(),stats=data.stats||{},year=academicSelectedYear(data),canManage=Boolean(data.can_manage);
  const noYear=!(data.years&&data.years.length);
  const timeline=await loadDepartmentSetupTimeline("academics");
  return '<section class="academic-page">'+academicNavHtml("dashboard",data)+
    '<section class="academic-hero"><div><p class="eyebrow">ACADEMIC STRUCTURE</p><h2>งานวิชาการ</h2><p>'+esc(school&&school.name_th||"")+' · วางข้อมูลต้นทางรายปีเพื่อให้ภาระงานสอน ตารางเรียน และงานวัดผลใช้ข้อมูลชุดเดียวกัน</p></div>'+(canManage?'<a class="primary-btn" href="#/academics/periods">'+(noYear?"เริ่มตั้งค่าปีการศึกษา":"จัดการโครงสร้าง")+'</a>':'')+'</section>'+
    departmentSetupTimelineHtml(timeline)+
    '<section class="academic-stats-grid">'+
      '<article><small>ปีการศึกษา</small><strong>'+(year?esc(year.year_be):"-")+'</strong><span>'+(year&&year.is_current?"ปีปัจจุบัน":"ปีที่เลือก")+'</span></article>'+
      '<article><small>ภาคเรียน</small><strong>'+Number(year&&year.terms&&year.terms.length||0).toLocaleString("th-TH")+'</strong><span>ภาคเรียน</span></article>'+
      '<article><small>ชั้น/ห้อง</small><strong>'+Number(stats.classes||0).toLocaleString("th-TH")+'</strong><span>ห้อง</span></article>'+
      '<article><small>รายวิชา</small><strong>'+Number(stats.subjects||0).toLocaleString("th-TH")+'</strong><span>รายวิชา</span></article>'+
      '<article><small>โครงสร้างรายวิชา</small><strong>'+Number(stats.courses||0).toLocaleString("th-TH")+'</strong><span>รายการ</span></article>'+
    '</section>'+
    (noYear?'<section class="notice warning"><strong>ยังไม่มีโครงสร้างปีการศึกษาที่พร้อมใช้งาน</strong><br>เริ่มจากเพิ่มปีการศึกษา ระบบจะสร้างภาคเรียนที่ 1 และ 2 ให้เป็นค่าเริ่มต้น จากนั้นจึงกำหนดชั้น/ห้องและรายวิชา</section>':'')+
    '<section class="academic-flow-grid">'+
      '<a href="#/academics/periods"><b>01</b><div><strong>ปีการศึกษาและภาคเรียน</strong><small>กำหนดช่วงเวลาและปีปัจจุบัน</small></div></a>'+
      '<a href="#/academics/programs"><b>02</b><div><strong>หลักสูตร / โปรแกรม</strong><small>เช่น ห้องปกติ MEP หรือ MLP — ไม่บังคับ</small></div></a>'+
      '<a href="#/academics/classes"><b>03</b><div><strong>ระดับชั้นและห้อง</strong><small>ห้องจาก LEC ถูกนำมาเป็นฐานโดยไม่ต้องกรอกซ้ำ</small></div></a>'+
      '<a href="#/academics/subjects"><b>04</b><div><strong>ทะเบียนรายวิชา</strong><small>รหัสวิชา ชื่อวิชา กลุ่มสาระ และประเภท</small></div></a>'+
      '<a href="#/academics/curriculum"><b>05</b><div><strong>โครงสร้างเวลาเรียน</strong><small>รายวิชาต่อระดับชั้น ชั่วโมง/ปี และคาบต่อสัปดาห์</small></div></a>'+
      '<a href="#/academics/workload"><b>06</b><div><strong>ภาระงานสอน</strong><small>ครูเสนอภาระงาน หรือฝ่ายวิชาการจัดให้และอนุมัติ</small></div></a>'+
    '</section>'+
    '<section class="academic-next-note"><span>ขั้นถัดไป</span><div><strong>ตารางเรียน / ตารางสอน</strong><p>ใช้ภาระงานสอนที่อนุมัติแล้วเป็นฐานในการจัดตาราง เพื่อลดการกรอกชื่อครู รายวิชา และห้องเรียนซ้ำ</p></div></section>'+
  '</section>';
}
function academicDateAfterWeekdays(startIso,totalDays){
  if(!startIso)return "";
  const d=new Date(startIso+"T12:00:00");
  if(Number.isNaN(d.getTime()))return "";
  const target=Math.max(1,Number(totalDays)||1);
  let count=0;
  while(count<target){
    const day=d.getDay();
    if(day!==0&&day!==6)count++;
    if(count<target)d.setDate(d.getDate()+1);
  }
  const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),day=String(d.getDate()).padStart(2,"0");
  return y+"-"+m+"-"+day;
}
function academicEndDateAfter200Weekdays(startIso){
  return academicDateAfterWeekdays(startIso,200);
}
function academicEndDateAfter100Weekdays(startIso){
  return academicDateAfterWeekdays(startIso,100);
}
function academicPeriodsHtml(data){
  const years=data.years||[],canManage=Boolean(data.can_manage),canDelete=isSchoolAdminContext();
  const yearCards=years.map(y=>{
    const terms=(y.terms||[]).map(t=>'<div class="academic-term-row"><div><strong>'+esc(t.name||("ภาคเรียนที่ "+t.term_no))+'</strong><small>'+(t.starts_on||t.ends_on?esc(thaiDate(t.starts_on))+' – '+esc(thaiDate(t.ends_on)):'ยังไม่กำหนดช่วงวันที่')+'</small></div>'+(t.is_current?'<span class="pill success">ภาคเรียนปัจจุบัน</span>':'')+(canManage?'<div class="academic-period-row-actions"><button type="button" class="text-btn" data-edit-term="'+esc(t.id)+'" data-year-id="'+esc(y.id)+'">แก้ไข</button>'+(canDelete?'<button type="button" class="text-btn danger-text" data-safe-delete-term="'+esc(t.id)+'" data-year-id="'+esc(y.id)+'">ลบ</button>':'')+'</div>':'')+'</div>').join("");
    return '<article class="academic-year-card '+(y.id===data.selected_year_id?"selected":"")+'"><div class="academic-year-head"><div><small>ปีการศึกษา</small><strong>'+esc(y.year_be)+'</strong></div><div class="academic-year-tags">'+(y.is_current?'<span class="pill success">ปีปัจจุบัน</span>':'')+(canManage?'<button type="button" class="secondary-btn compact-btn" data-add-term="'+esc(y.id)+'">＋ เพิ่มภาคเรียน</button><button type="button" class="secondary-btn compact-btn" data-edit-year="'+esc(y.id)+'">แก้ไขปี</button>':'')+(canDelete?'<button type="button" class="danger-btn compact-btn" data-safe-delete-year="'+esc(y.id)+'">ลบปี</button>':'')+'</div></div><div class="academic-year-dates">'+(y.starts_on||y.ends_on?'<span>'+esc(thaiDate(y.starts_on))+' – '+esc(thaiDate(y.ends_on))+'</span>':'<span>ยังไม่กำหนดวันเปิด–ปิดปีการศึกษา</span>')+'</div><div class="academic-term-list">'+(terms||'<div class="academic-empty-line">ยังไม่มีภาคเรียน</div>')+'</div></article>';
  }).join("");
  return '<section class="academic-page">'+academicNavHtml("periods",data)+
    '<section class="panel"><div class="panel-head"><div><p class="eyebrow">ACADEMIC PERIODS</p><h2>ปีการศึกษาและภาคเรียน</h2><p class="panel-sub">ฝ่ายวิชาการเพิ่มปีการศึกษาได้เองก่อนข้อมูล LEC จะออก เมื่อกำหนดวันเริ่ม ระบบสร้างภาคเรียนที่ 1 และ 2 ให้อัตโนมัติ โดยตั้งต้นภาคเรียนละ 100 วันเรียน จ.–ศ. รวม 200 วัน และแก้ไขช่วงวันที่ภายหลังได้</p></div>'+(canManage?'<button type="button" class="secondary-btn" data-new-year-form>＋ เพิ่มปีใหม่</button>':'')+'</div>'+
      '<div class="academic-year-list">'+(yearCards||'<div class="empty-state compact-empty"><div class="empty-icon">📅</div><h3>ยังไม่มีปีการศึกษา</h3></div>')+'</div>'+
      (canDelete?'<div class="academic-delete-policy"><strong>การลบแบบปลอดภัย</strong><span>ระบบจะตรวจข้อมูลเชื่อมโยงก่อนทุกครั้ง หากมีนักเรียน LEC ห้องเรียน รายวิชา เวลาเรียน หรือภาระงานสอน ระบบจะบล็อกการลบโดยอัตโนมัติ</span></div><div class="academic-safe-delete-panel hidden" data-academic-safe-delete-panel></div>':'')+
    '</section>'+
    (canManage?'<section class="academic-edit-grid">'+
      '<article class="panel hidden" data-year-form-panel><div class="panel-head"><div><h2 data-year-form-title>เพิ่มปีการศึกษา</h2><p class="panel-sub">สร้างได้ก่อน LEC เปิดปีใหม่ · ระบบสร้างภาคเรียนที่ 1 และ 2 ให้อัตโนมัติ ภาคเรียนละ 100 วันเรียน · วันที่ทุกช่องใช้ พ.ศ.</p></div></div><form id="academic-year-form" class="academic-form" data-id=""><label>ปีการศึกษา (พ.ศ.) <span class="required-mark">*</span><input name="year_be" type="number" min="2400" max="2800" required placeholder="เช่น 2570"></label><label>วันเริ่มปีการศึกษา (พ.ศ.)'+buddhistDateControlHtml("starts_on","")+'</label><label>วันสิ้นสุดปีการศึกษา (พ.ศ.)'+buddhistDateControlHtml("ends_on","")+'</label><div class="academic-year-auto-note span-all"><strong>ตั้งต้นอัตโนมัติ:</strong> ภาคเรียนที่ 1 = 100 วันเรียน และภาคเรียนที่ 2 = 100 วันเรียน โดยนับวันจันทร์–ศุกร์เบื้องต้น ไม่หักวันหยุดราชการ ช่วงวันที่ของแต่ละภาคเรียนแก้ไขได้ภายหลัง</div><label class="check-row"><input name="is_current" type="checkbox"><span>กำหนดเป็นปีการศึกษาปัจจุบัน</span></label><div class="academic-form-actions"><button type="button" class="secondary-btn" data-reset-year-form>ล้าง</button><button type="submit" class="primary-btn">บันทึกปีการศึกษา</button></div></form></article>'+
      '<article class="panel hidden" data-term-form-panel><div class="panel-head"><div><h2 data-term-form-title>เพิ่ม/แก้ไขภาคเรียน</h2><p class="panel-sub">รองรับภาคเรียนที่ 1–4 สำหรับสถานศึกษาที่มีรูปแบบแตกต่างกัน · เมื่อกำหนดวันเริ่ม ระบบเติมวันสิ้นสุดที่ 100 วันเรียนให้อัตโนมัติ และแก้ไขภายหลังได้ · วันที่ทุกช่องใช้ พ.ศ.</p></div></div><form id="academic-term-form" class="academic-form" data-id=""><label>ปีการศึกษา (พ.ศ.) <span class="required-mark">*</span><select name="academic_year_id" required>'+years.map(y=>'<option value="'+esc(y.id)+'" '+(y.id===data.selected_year_id?"selected":"")+'>'+esc(y.year_be)+'</option>').join("")+'</select></label><label>ภาคเรียนที่ <span class="required-mark">*</span><select name="term_no" required><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option></select></label><label>ชื่อภาคเรียน<input name="name" placeholder="เช่น ภาคเรียนที่ 1"></label><label>วันเริ่ม (พ.ศ.)'+buddhistDateControlHtml("starts_on","")+'</label><label>วันสิ้นสุด (พ.ศ.)'+buddhistDateControlHtml("ends_on","")+'</label><label class="check-row"><input name="is_current" type="checkbox"><span>กำหนดเป็นภาคเรียนปัจจุบัน</span></label><div class="academic-form-actions"><button type="button" class="secondary-btn" data-reset-term-form>ล้าง</button><button type="submit" class="primary-btn" '+(years.length?"":"disabled")+'>บันทึกภาคเรียน</button></div></form></article>'+
    '</section>':'')+
  '</section>';
}
function academicProgramsHtml(data,timeline){
  const items=data.programs||[],canManage=Boolean(data.can_manage);
  const activeItems=items.filter(p=>p.is_active);
  const programStep=(timeline&&timeline.steps||[]).find(x=>x.step_code==="programs")||null;
  const usingGeneralOnly=Boolean(programStep&&programStep.status==="skipped"&&!activeItems.length);
  const rows=items.map(p=>'<div class="academic-simple-row '+(!p.is_active?"muted-row":"")+'"><div><strong>'+esc(p.name_th)+'</strong><small>'+(p.code?'อักษรย่อ '+esc(p.code):'ไม่มีอักษรย่อ')+(p.name_en?' · '+esc(p.name_en):'')+'</small></div><span class="pill '+(p.is_active?"success":"warning")+'">'+(p.is_active?"ใช้งาน":"ปิดใช้งาน")+'</span>'+(canManage?'<button class="secondary-btn compact-btn" type="button" data-edit-program="'+esc(p.id)+'">แก้ไข</button>':'')+'</div>').join("");
  const setupState=activeItems.length
    ?'<div class="academic-program-state success"><span>✓</span><div><strong>ตั้งค่าโปรแกรมพิเศษแล้ว</strong><p>รายการนี้เป็นข้อมูลระดับโรงเรียน ใช้ต่อในปีการศึกษาถัดไปได้ ไม่ต้องสร้างใหม่ทุกปี เว้นแต่มีการเปลี่ยนแปลง</p></div></div>'
    :usingGeneralOnly
      ?'<div class="academic-program-state success"><span>✓</span><div><strong>บันทึกแล้ว: ใช้เฉพาะห้องปกติ / ไม่มีโปรแกรมพิเศษ</strong><p>ไทม์ไลน์ถือว่าขั้นนี้ดำเนินการแล้ว และปีถัดไปไม่ต้องทำซ้ำ หากภายหลังมี MEP / MLP / ห้องพิเศษ ค่อยกด “＋ เพิ่มหลักสูตร / โปรแกรม” ได้</p></div></div>'
      :'<div class="academic-program-state"><span>2</span><div><strong>เลือกวิธีใช้งานของโรงเรียน</strong><p>ถ้ามีเฉพาะห้องปกติ ให้ยืนยันว่าไม่มีโปรแกรมพิเศษเพื่อข้ามขั้นนี้อย่างถูกต้อง หรือเพิ่ม MEP / MLP / ห้องพิเศษเมื่อโรงเรียนมีใช้งานจริง</p></div></div>';

  return '<section class="academic-page">'+academicNavHtml("programs",data)+
    '<section class="panel"><div class="panel-head"><div><p class="eyebrow">SPECIAL PROGRAMS</p><h2>โปรแกรมพิเศษของโรงเรียน</h2><p class="panel-sub">บันทึกเฉพาะโปรแกรมพิเศษที่โรงเรียนมีใช้งานจริง ส่วนห้องปกติไม่ต้องสร้างรายการ</p></div>'+(canManage?'<button type="button" class="primary-btn" data-new-program-form>＋ เพิ่มโปรแกรมพิเศษ</button>':'')+'</div>'+
      setupState+
      '<div class="academic-program-choice-grid">'+
        '<article><span>🏫</span><div><strong>ห้องปกติ</strong><p>ไม่ต้องสร้างรายการ “ปกติ” ระบบจะถือว่าไม่ระบุโปรแกรม และใช้กับห้องทั่วไปทุกปี</p></div>'+(canManage&&!activeItems.length?'<button type="button" class="secondary-btn" data-program-general-only '+(usingGeneralOnly?'disabled':'')+'>'+(usingGeneralOnly?'บันทึกแล้ว':'ใช้ห้องปกติ / ไม่มีโปรแกรมพิเศษ')+'</button>':'')+'</article>'+
        '<article><span>⭐</span><div><strong>มีโปรแกรมพิเศษ</strong><p>เพิ่มเฉพาะรายการที่ต้องแยกจริง เช่น MEP, MLP, ห้องพิเศษ หรือโครงการเฉพาะของโรงเรียน</p></div>'+(canManage?'<button type="button" class="secondary-btn" data-new-program-form>＋ เพิ่มโปรแกรมพิเศษ</button>':'')+'</article>'+
      '</div>'+
      (rows?'<div class="academic-simple-list">'+rows+'</div>':'<div class="empty-state compact-empty"><div class="empty-icon">◫</div><h3>ยังไม่มีโปรแกรมพิเศษ</h3><p>หากโรงเรียนใช้เฉพาะห้องปกติ ให้กด “ใช้ห้องปกติ / ไม่มีโปรแกรมพิเศษ” เพื่อบันทึกขั้นตอนนี้ในไทม์ไลน์</p></div>')+
      '<div class="academic-program-next-year"><strong>ปีการศึกษาถัดไปต้องทำอะไร?</strong><p><b>ไม่ต้องสร้างโปรแกรมใหม่ซ้ำ</b> เพราะรายการโปรแกรมเป็นข้อมูลระดับโรงเรียน ใช้ต่อเนื่องข้ามปีได้ เมื่อสร้างชั้น/ห้องของปีใหม่ ให้เลือกโปรแกรมเดิมกับห้องที่เกี่ยวข้อง หรือเลือก “ห้องทั่วไป / ไม่ระบุโปรแกรม” สำหรับห้องปกติ</p></div>'+
    '</section>'+
    (canManage?'<section class="panel academic-form-panel hidden" data-program-form-panel><div class="panel-head"><div><h2 data-program-form-title>เพิ่มโปรแกรมพิเศษ</h2><p class="panel-sub">บันทึกเฉพาะโปรแกรมพิเศษที่โรงเรียนมีใช้งานจริง · แบบฟอร์มเก็บเฉพาะข้อมูลจำเป็น</p></div></div><form id="academic-program-form" class="academic-form academic-form-3" data-id=""><label>อักษรย่อ<input name="code" maxlength="30" placeholder="เช่น MEP"></label><label>ชื่อภาษาไทย <span class="required-mark">*</span><input name="name_th" required placeholder="เช่น โครงการจัดการเรียนการสอนโดยใช้ภาษาอังกฤษเป็นสื่อ"></label><label>ชื่อภาษาอังกฤษ<input name="name_en" placeholder="เช่น Mini English Program"></label><div class="academic-form-actions span-all"><button type="button" class="secondary-btn" data-reset-program-form>ล้าง</button><button type="submit" class="primary-btn">บันทึกโปรแกรมพิเศษ</button></div></form></section>':'')+
  '</section>';
}
function academicClassesHtml(data){
  const allItems=data.classes||[],canManage=Boolean(data.can_manage),year=academicSelectedYear(data);
  const items=allItems.filter(x=>x.source_type==="lec"&&x.is_active!==false);
  const classStageDefinitions=[
    {key:"K",label:"อนุบาล",match:code=>/^K[1-3]$/.test(code)},
    {key:"PLOW",label:"ประถมต้น",match:code=>/^P[1-3]$/.test(code)},
    {key:"PUP",label:"ประถมปลาย",match:code=>/^P[4-6]$/.test(code)},
    {key:"MLOW",label:"ม.ต้น",match:code=>/^M[1-3]$/.test(code)},
    {key:"MUP",label:"ม.ปลาย",match:code=>/^M[4-6]$/.test(code)}
  ];
  const classStageKey=item=>{
    const code=academicGradeCode(item&&item.grade_label);
    const stage=classStageDefinitions.find(x=>x.match(code));
    return stage?stage.key:"";
  };
  const stageCounts={};
  items.forEach(x=>{
    const key=classStageKey(x);
    if(key)stageCounts[key]=(stageCounts[key]||0)+1;
  });
  const availableStages=classStageDefinitions.filter(x=>stageCounts[x.key]>0);
  if(!state.classStageFilter||!stageCounts[state.classStageFilter]){
    state.classStageFilter=availableStages[0]&&availableStages[0].key||"";
  }
  const currentStage=availableStages.find(x=>x.key===state.classStageFilter)||null;
  const totalNormal=items.filter(x=>!x.program_id);
  const totalSpecial=items.filter(x=>Boolean(x.program_id));
  const totalProgramIds=new Set(totalSpecial.map(x=>x.program_id).filter(Boolean));
  const visibleItems=currentStage?items.filter(x=>classStageKey(x)===currentStage.key):items;
  const normal=visibleItems.filter(x=>!x.program_id);
  const special=visibleItems.filter(x=>Boolean(x.program_id));
  const activePrograms=(data.programs||[]).filter(p=>p.is_active);
  const programOptions=(selected)=>'<option value="">ห้องปกติ / ไม่ระบุโปรแกรม</option>'+activePrograms.map(p=>'<option value="'+esc(p.id)+'" '+(p.id===selected?"selected":"")+'>'+esc(p.name_th)+(p.code?' ('+esc(p.code)+')':'')+'</option>').join("");
  const roomCard=(c,specialRoom)=>'<article class="academic-room-card '+(specialRoom?"special":"normal")+'" data-class-card="'+esc(c.id)+'">'+
    '<div class="academic-room-icon">'+(specialRoom?"⭐":"🏫")+'</div>'+
    '<div class="academic-room-copy"><strong>'+esc(shortGrade(c.grade_label))+'/'+esc(c.section_label)+'</strong><small>'+esc(c.grade_label)+' · ข้อมูลจาก LEC</small>'+(specialRoom?'<span class="academic-room-program">'+esc(c.program_name||"โปรแกรมพิเศษ")+'</span>':'<span class="academic-room-program muted">ห้องปกติ</span>')+'</div>'+
    (canManage&&activePrograms.length?'<div class="academic-room-program-editor"><select data-class-program-select="'+esc(c.id)+'" disabled aria-label="กำหนดโปรแกรม '+esc(shortGrade(c.grade_label))+'/'+esc(c.section_label)+'">'+programOptions(c.program_id||"")+'</select><small data-class-save-status="'+esc(c.id)+'"></small></div>':'')+
  '</article>';

  const normalGrouped={};
  normal.forEach(x=>{(normalGrouped[x.grade_label]||(normalGrouped[x.grade_label]=[])).push(x);});
  const normalGroups=Object.keys(normalGrouped).sort((x,y)=>academicGradeOrder(x)-academicGradeOrder(y)||x.localeCompare(y,"th")).map(grade=>
    '<section class="academic-room-grade"><div class="academic-room-grade-head"><strong>'+esc(grade)+'</strong><span>'+normalGrouped[grade].length+' ห้อง</span></div><div class="academic-room-grid">'+normalGrouped[grade].map(c=>roomCard(c,false)).join("")+'</div></section>'
  ).join("");

  const byProgram={};
  special.forEach(x=>{
    const key=x.program_id||"";
    if(!byProgram[key])byProgram[key]={name:x.program_name||"โปรแกรมพิเศษ",rooms:[]};
    byProgram[key].rooms.push(x);
  });
  const specialGroups=Object.values(byProgram).sort((x,y)=>String(x.name).localeCompare(String(y.name),"th")).map(group=>
    '<section class="academic-program-room-group"><div class="academic-program-room-head"><div><span>⭐</span><div><strong>'+esc(group.name)+'</strong><small>'+group.rooms.length+' ห้องที่กำหนดโปรแกรมนี้</small></div></div></div><div class="academic-room-grid">'+group.rooms.sort((x,y)=>academicGradeOrder(x.grade_label)-academicGradeOrder(y.grade_label)||String(x.section_label).localeCompare(String(y.section_label),"th")).map(c=>roomCard(c,true)).join("")+'</div></section>'
  ).join("");

  const gradeTabsHtml=availableStages.length?'<nav class="academic-grade-tabs academic-stage-tabs" aria-label="เลือกช่วงชั้น">'+availableStages.map(stage=>'<button type="button" class="'+(state.classStageFilter===stage.key?"active":"")+'" data-class-stage-tab="'+esc(stage.key)+'">'+esc(stage.label)+' <span>'+stageCounts[stage.key]+'</span></button>').join("")+'</nav>':'';

  const sourceNotice='<div class="academic-class-source-note"><span>🔗</span><div><strong>ชั้น/ห้องมาจากระบบนักเรียน LEC เท่านั้น</strong><p>หน้านี้ไม่สามารถสร้างห้องใหม่เองได้ หากต้องการเพิ่มห้อง ให้ปรับข้อมูลนักเรียน/ห้องใน LEC แล้วนำเข้าระบบนักเรียน จากนั้นห้องจะปรากฏที่นี่อัตโนมัติ</p></div></div>';

  const editSwitch=canManage&&activePrograms.length?'<section class="academic-program-edit-guard"><div><strong>โหมดกำหนดโปรแกรม</strong><p>ปิดไว้เป็นค่าเริ่มต้นเพื่อป้องกันการเปลี่ยนห้องผิด เปิดเมื่อต้องการแก้ไข แล้วเลือกโปรแกรมจากแต่ละห้อง ระบบจะบันทึกทันที</p></div><label class="academic-edit-switch"><input type="checkbox" data-class-program-edit-switch '+(state.classProgramEditMode?"checked":"")+'><span class="switch-track"><i></i></span><b data-class-program-edit-label>'+(state.classProgramEditMode?"เปิด":"ปิด")+'</b></label></section><div class="academic-program-edit-warning hidden" data-class-program-edit-warning><strong>กำลังอยู่ในโหมดแก้ไขการจัดโปรแกรมห้องเรียน</strong><span>ทุกการเปลี่ยนโปรแกรมจะบันทึกทันที และโหมดนี้จะปิดอัตโนมัติเมื่อออกจากหน้า/โหลดใหม่</span></div>':'';

  return '<section class="academic-page">'+academicNavHtml("classes",data)+
    '<section class="panel academic-class-overview"><div class="panel-head"><div><p class="eyebrow">CLASS SECTIONS · LEC SOURCE</p><h2>ชั้น/ห้องจากระบบนักเรียน</h2><p class="panel-sub">'+(year?'ปีการศึกษา '+esc(year.year_be):'ยังไม่ได้เลือกปีการศึกษา')+' · ใช้ข้อมูลห้องที่พบจากนักเรียนใน LEC เป็นข้อมูลต้นทาง</p></div><span class="pill success">'+items.length+' ห้องจาก LEC</span></div>'+
      '<div class="academic-class-control-grid">'+sourceNotice+editSwitch+'</div>'+
      '<div class="academic-class-stat-grid"><article><small>ห้องทั้งหมด</small><strong>'+items.length+'</strong><span>ห้อง</span></article><article><small>ห้องปกติ</small><strong>'+totalNormal.length+'</strong><span>ห้อง</span></article><article><small>โปรแกรมพิเศษ</small><strong>'+totalSpecial.length+'</strong><span>ห้อง</span></article><article><small>โปรแกรมที่ใช้</small><strong>'+totalProgramIds.size+'</strong><span>โปรแกรม</span></article></div>'+
    '</section>'+
    gradeTabsHtml+
    '<section class="academic-class-filter-summary">'+(currentStage?'<strong>'+esc(currentStage.label)+'</strong><span>'+visibleItems.length+' ห้องจาก LEC ในช่วงชั้นนี้</span>':'<strong>ยังไม่มีข้อมูลช่วงชั้น</strong><span>0 ห้องจาก LEC</span>')+'</section>'+
    '<section class="academic-class-layout">'+
      '<section class="panel academic-class-section normal"><div class="panel-head"><div><p class="eyebrow">GENERAL ROOMS</p><h2>ห้องปกติ</h2><p class="panel-sub">ห้องจาก LEC ที่ยังไม่ได้กำหนดหลักสูตร/โครงการ/โปรแกรมพิเศษ</p></div><span class="pill">'+normal.length+' ห้อง</span></div>'+
        (normalGroups||'<div class="empty-state compact-empty"><div class="empty-icon">✓</div><h3>ไม่มีห้องปกติที่รอกำหนด</h3></div>')+
      '</section>'+
      '<section class="panel academic-class-section special"><div class="panel-head"><div><p class="eyebrow">SPECIAL PROGRAM ROOMS</p><h2>หลักสูตร / โครงการ / โปรแกรมพิเศษ</h2><p class="panel-sub">เมื่อกำหนดโปรแกรมให้ห้อง ห้องนั้นจะแยกมาแสดงในส่วนนี้อัตโนมัติ</p></div><span class="pill">'+special.length+' ห้อง</span></div>'+
        (specialGroups||'<div class="empty-state compact-empty"><div class="empty-icon">⭐</div><h3>ยังไม่มีห้องโปรแกรมพิเศษ</h3><p>'+(activePrograms.length?'เปิด “โหมดกำหนดโปรแกรม” แล้วเลือกโปรแกรมจากห้องปกติ':'เพิ่มหลักสูตร / โปรแกรมก่อน แล้วกลับมากำหนดว่าห้องใดอยู่ในโปรแกรมนั้น')+'</p></div>')+
      '</section>'+
    '</section>'+
    (!activePrograms.length&&canManage?'<section class="notice"><strong>ยังไม่มีโปรแกรมพิเศษที่ใช้งาน</strong><br>หากโรงเรียนมี MEP / MLP / ห้องพิเศษ ให้ไปที่เมนู “หลักสูตร / โปรแกรม” เพื่อเพิ่มก่อน จากนั้นกลับมาหน้านี้เพื่อกำหนดห้อง</section>':'')+
    (!items.length?'<section class="notice warning"><strong>ยังไม่พบชั้น/ห้องจาก LEC ในปีการศึกษานี้</strong><br>ให้นำเข้าข้อมูลนักเรียนจาก LEC ก่อน ระบบจะสร้างรายการห้องจากข้อมูลนักเรียนโดยอัตโนมัติ</section>':'')+
  '</section>';
}
function academicSubjectsHtml(data,timeline){
  const canManage=Boolean(data.can_manage),canEdit=canManage&&Boolean(state.subjectEditMode),year=academicSelectedYear(data),preset=state.academicPreset||{};
  const readiness=state.curriculumReadiness||{groups:[],exclusions:[],total_groups:0,confirmed_groups:0,groups_with_courses:0};
  const classes=(data.classes||[]).filter(x=>x.source_type==="lec"&&x.is_active!==false);
  const allCourses=data.courses||[];
  const activeCourses=allCourses.filter(c=>c.is_active!==false);
  const programs=(data.programs||[]).filter(p=>p.is_active);
  const actualPrograms=programs.filter(p=>classes.some(c=>c.program_id===p.id));
  if(state.subjectProgramId&&!actualPrograms.some(p=>p.id===state.subjectProgramId))state.subjectProgramId="";
  const selectedProgram=actualPrograms.find(p=>p.id===state.subjectProgramId)||null;
  const targetLabel=selectedProgram?selectedProgram.name_th:"ห้องปกติ";
  const targetClasses=classes.filter(c=>selectedProgram?c.program_id===selectedProgram.id:!c.program_id);
  const supportedGradeSet=new Set((preset.supported_grades||[]).map(g=>g.grade_code));
  const targetGrades=(targetClasses.length
    ?Array.from(new Set(targetClasses.map(c=>c.grade_label).filter(Boolean)))
    :(preset.supported_grades||[]).map(g=>g.grade_label).filter(Boolean))
    .filter(g=>supportedGradeSet.has(academicGradeCode(g)))
    .sort((x,y)=>academicGradeOrder(x)-academicGradeOrder(y)||x.localeCompare(y,"th"));
  const targetGradeCodes=targetGrades.map(g=>academicGradeCode(g)).filter(Boolean);
  if(!targetGradeCodes.includes(state.academicPresetGrade))state.academicPresetGrade=targetGradeCodes[0]||"";
  const gradeCode=state.academicPresetGrade||"";
  const gradeLabel=gradeCode?academicGradeLabelFromCode(gradeCode):"";
  const scope=["core","activity"].includes(state.subjectCatalogScope)?state.subjectCatalogScope:"core";
  state.subjectCatalogScope=scope;
  const scopeLabel=scope==="activity"?"กิจกรรมพัฒนาผู้เรียน":"วิชาพื้นฐาน";
  const setupTab=["target","grade","type"].includes(state.subjectSetupTab)?state.subjectSetupTab:"target";
  state.subjectSetupTab=setupTab;
  const targetRooms=targetClasses.filter(c=>c.grade_label===gradeLabel)
    .sort((a,b)=>String(a.section_label||"").localeCompare(String(b.section_label||""),"th",{numeric:true}));
  const targetRoomCount=targetRooms.length;
  const targetRoomLabels=targetRooms.map(c=>shortGrade(c.grade_label)+"/"+String(c.section_label||"").trim()).filter(Boolean);
  const targetRoomPreview=targetRoomLabels.length<=6?targetRoomLabels.join(" · "):targetRoomLabels.slice(0,5).join(" · ")+" · และอีก "+(targetRoomLabels.length-5)+" ห้อง";
  const copyYears=(data.years||[]).filter(y=>year&&y.id!==year.id&&Number(y.year_be)<Number(year.year_be))
    .sort((a,b)=>Number(b.year_be)-Number(a.year_be));
  if(state.subjectCopyYearId&&!copyYears.some(y=>y.id===state.subjectCopyYearId))state.subjectCopyYearId="";
  if(!state.subjectCopyYearId&&copyYears.length)state.subjectCopyYearId=copyYears[0].id;
  const earlyChildhoodCount=classes.filter(c=>String(academicGradeCode(c.grade_label)||"").startsWith("K")).length;
  const typeLabel={basic:"วิชาพื้นฐาน",additional:"วิชาเพิ่มเติม",activity:"กิจกรรมพัฒนาผู้เรียน",other:"อื่น ๆ"};
  const subtypeLabel={
    elective_free:"เลือกเสรี",
    career:"อาชีพ",
    language:"ภาษา",
    program_specific:"เฉพาะโปรแกรม",
    local:"ท้องถิ่น",
    special_focus:"จุดเน้นพิเศษ",
    other_additional:"เพิ่มเติมอื่น ๆ",
    school_additional_activity:"กิจกรรมเพิ่มเติมของสถานศึกษา"
  };
  const scopeMatches=type=>(scope==="core"&&type==="basic")||scope===type;
  const logicalKey=x=>{
    const code=String(x.subject_code||"").trim().toLowerCase(),name=String(x.subject_name||x.name_th||"").trim().toLowerCase(),type=x.subject_type||"";
    if(type==="activity"&&code)return "activity|"+code+"|"+name;
    if(code)return "code|"+code;
    return "name|"+type+"|"+name;
  };

  const excludedIds=new Set((readiness.exclusions||[])
    .filter(x=>selectedProgram&&x.program_id===selectedProgram.id&&x.grade_code===gradeCode)
    .map(x=>x.subject_id));
  const baseInherited=selectedProgram
    ?activeCourses.filter(c=>c.grade_code===gradeCode&&!c.program_id&&(c.subject_type==="basic"||c.subject_type==="activity")&&!excludedIds.has(c.subject_id))
    :[];
  const directCourses=activeCourses.filter(c=>c.grade_code===gradeCode&&c.program_id===(selectedProgram?selectedProgram.id:null));
  const merged=new Map();
  baseInherited.forEach(c=>merged.set(logicalKey(c),{...c,_origin:"inherited"}));
  directCourses.forEach(c=>merged.set(logicalKey(c),{...c,_origin:"direct"}));
  const selectedCourses=Array.from(merged.values()).sort((x,y)=>Number(x.sort_order||0)-Number(y.sort_order||0)||String(x.subject_name||"").localeCompare(String(y.subject_name||""),"th"));
  // ฐานรายวิชาโรงเรียนแสดงทุกรายวิชาของระดับชั้น ไม่ใช้ตัวกรองประเภทจากคลัง
  const shownCourses=selectedCourses;
  const subjectWorkspace=state.subjectWorkspaceData||{parallel_groups:[],status:null,subject_sources:[]};
  const parallelGroups=subjectWorkspace.parallel_groups||[];
  const sourceBySubjectId=new Map((subjectWorkspace.subject_sources||[]).map(x=>[x.subject_id,x]));
  const courseTimeById=new Map(((data.course_time_overview&&data.course_time_overview.items)||[]).map(x=>[x.course_id,x]));
  const parallelByCourseId=new Map();
  parallelGroups.forEach(g=>(g.members||[]).forEach(m=>parallelByCourseId.set(m.course_id,g)));
  const groupEligibleCourses=shownCourses.filter(c=>c._origin==="direct"&&!parallelByCourseId.has(c.id));
  const selectedKeys=new Set(selectedCourses.map(logicalKey));

  const allCatalog=(preset.items||[]).filter(x=>x.grade_code===gradeCode);
  // คลังกลางต้องอ้างอิงเฉพาะข้อมูลส่วนกลางเท่านั้น
  // วิชาพื้นฐานรับเฉพาะรายการ national core และแสดงครบแม้โรงเรียนจะนำไปใช้แล้ว
  const catalogMatches=x=>
    scope==="core"
      ?x.subject_type==="basic"&&x.is_national_core===true
      :x.subject_type===scope;
  const centralCatalog=allCatalog.filter(catalogMatches);
  const centralItemKeys=new Set(
    allCatalog
      .filter(x=>(x.subject_type==="basic"&&x.is_national_core===true)||x.subject_type==="activity")
      .map(logicalKey)
  );
  const centralActivityCodeCounts=new Map();
  allCatalog.filter(x=>x.subject_type==="activity"&&x.subject_code).forEach(x=>{
    const key=String(x.subject_code).trim().toLowerCase();
    centralActivityCodeCounts.set(key,(centralActivityCodeCounts.get(key)||0)+1);
  });
  const activityCodeCounts=new Map();
  selectedCourses.filter(c=>c.subject_type==="activity"&&c.subject_code).forEach(c=>{
    const key=String(c.subject_code).trim().toLowerCase();
    activityCodeCounts.set(key,(activityCodeCounts.get(key)||0)+1);
  });

  const selectedCardHtml=c=>{
    const inherited=c._origin==="inherited";
    const pg=parallelByCourseId.get(c.id)||null;
    const canGroup=canEdit&&!inherited&&!pg;
    const isCentralItem=centralItemKeys.has(logicalKey(c));
    const sourceInfo=sourceBySubjectId.get(c.subject_id)||{};
    const sourceKind=sourceInfo.source_kind||(isCentralItem?"official_central":"school_local");
    const subtypeText=subtypeLabel[sourceInfo.subject_subtype]||"";
    const timeInfo=courseTimeById.get(c.id)||null;
    const standard=timeInfo&&(timeInfo.standard_current||timeInfo.standard_snapshot)||null;
    const standardText=academicStandardTimeSummary(standard);
    const schoolText=academicSchoolTimeSummary(c,standard);
    return '<article class="subject-selected-card '+(pg?"in-parallel-group":"")+' '+(timeInfo&&timeInfo.time_customized?"time-customized":"")+'">'+
      (canGroup&&state.subjectParallelSelectionMode?'<label class="subject-group-check" title="เลือกเพื่อรวมเป็นกลุ่มเวลาเดียวกัน"><input type="checkbox" data-parallel-course="'+esc(c.id)+'"><span></span></label>':'')+
      '<div class="subject-card-main"><div class="subject-code-box">'+esc(c.subject_code||"—")+'</div><div class="subject-card-copy"><strong>'+esc(c.subject_name)+'</strong><small>'+(c.learning_area?esc(c.learning_area):esc(typeLabel[c.subject_type]||"อื่น ๆ"))+(subtypeText?' · '+esc(subtypeText):'')+'</small></div></div>'+
      (standard?'<div class="subject-time-compare"><div><small>มาตรฐานกลางขั้นต่ำ</small><strong>'+esc(standardText||"ไม่กำหนด")+'</strong></div><div><small>โรงเรียนใช้</small><strong>'+esc(schoolText)+'</strong></div></div>':'<div class="subject-time-compare single"><div><small>เวลาเรียนของโรงเรียน</small><strong>'+esc(schoolText)+'</strong></div></div>')+
      '<div class="subject-card-action">'+
        (sourceKind==="official_central"?'<span class="subject-origin central-core">มาตรฐานกลาง</span>':'')+
        (academicTimeTemplateDiffers(timeInfo)?'<span class="subject-origin time-revision">มาตรฐานกลางมีการปรับ</span>':'')+
        (timeInfo&&timeInfo.time_customized?'<span class="subject-origin time-override">ปรับจากมาตรฐาน</span>':standard?'<span class="subject-origin time-standard">เวลาเรียนตามมาตรฐาน</span>':'')+
        (sourceKind==="shared_catalog"?'<span class="subject-origin shared-catalog">คลังร่วม'+(sourceInfo.shared_source_school?' · '+esc(sourceInfo.shared_source_school):'')+(Number(sourceInfo.shared_usage_count||0)>0?' · '+Number(sourceInfo.shared_usage_count).toLocaleString("th-TH")+' รร.':'')+'</span>':'')+
        (sourceKind==="school_local"?'<span class="subject-origin school-local">โรงเรียนสร้างเอง'+(sourceInfo.source_shared_subject_id?' · เผยแพร่คลังร่วม':'')+'</span>':'')+
        (pg?'<span class="subject-origin grouped">กลุ่ม '+esc(pg.name)+' · นับ '+Number(pg.weekly_periods||0).toLocaleString("th-TH")+' คาบ</span>':'')+
        (!pg&&c.subject_type==="activity"&&c.subject_code&&(activityCodeCounts.get(String(c.subject_code).trim().toLowerCase())||0)>1?'<span class="subject-origin grouped">รหัสเดียวกัน · นับรวม 1 ช่องเวลา</span>':'')+
        (inherited?'<span class="subject-origin inherited">รับจากห้องปกติ</span>':'')+
        (canEdit&&!inherited&&standard?'<button type="button" class="secondary-btn compact-btn subject-time-btn" data-edit-subject-time="'+esc(c.id)+'">แก้เวลาเรียน</button>':'')+
        (canEdit?'<button type="button" class="subject-remove-btn" data-remove-curriculum-subject="'+esc(c.id)+'">'+(inherited?"นำออกจากโปรแกรม":"นำออก")+'</button>':'')+
      '</div>'+
      (!inherited&&standard?academicTimeEditorHtml(c,timeInfo):'')+
    '</article>';
  };
  const selectedByType={
    basic:shownCourses.filter(c=>c.subject_type==="basic"),
    additional:shownCourses.filter(c=>c.subject_type==="additional"),
    activity:shownCourses.filter(c=>c.subject_type==="activity"),
    other:shownCourses.filter(c=>c.subject_type==="other")
  };
  const selectedGroupHtml=(type,title,note)=>'<section class="subject-type-section"><div class="subject-type-head"><div><h3>'+title+'</h3><p>'+note+'</p></div><span>'+selectedByType[type].length+' รายการ</span></div>'+
    (selectedByType[type].length?'<div class="subject-selected-list">'+selectedByType[type].map(selectedCardHtml).join("")+'</div>':'<div class="subject-type-empty">ยังไม่มีรายการในหมวดนี้</div>')+
  '</section>';

  const centralRows=centralCatalog.map(x=>{
    const isSelected=selectedKeys.has(logicalKey(x));
    const activityCode=String(x.subject_code||"").trim().toLowerCase();
    const isMultiActivity=x.subject_type==="activity"&&activityCode&&(centralActivityCodeCounts.get(activityCode)||0)>1;
    const centralTime=academicStandardTimeSummary(x.standard_time);
    return '<article class="subject-library-card '+(isSelected?"is-selected":"")+'" data-subject-library-item data-search-text="'+esc(((x.subject_code||"")+" "+x.subject_name+" "+(x.learning_area||"")+" "+centralTime+" ส่วนกลาง").toLowerCase())+'">'+
      '<div class="subject-library-source central">ส่วนกลาง</div>'+
      '<div class="subject-card-main"><div class="subject-code-box">'+esc(x.subject_code||"—")+'</div><div class="subject-card-copy"><strong>'+esc(x.subject_name)+'</strong><small>'+esc(typeLabel[x.subject_type]||"อื่น ๆ")+(x.learning_area?' · '+esc(x.learning_area):'')+(x.term_no?' · ภาคเรียนที่ '+esc(x.term_no):' · รายปี')+'</small>'+(centralTime?'<span class="subject-central-time"><b>มาตรฐานเวลา</b> '+esc(centralTime)+(x.standard_time&&x.standard_time.basis_weeks?' · ฐาน '+esc(x.standard_time.basis_weeks)+' สัปดาห์/'+(x.standard_time.period_scope==="term"?"ภาค":"ปี"):'')+(x.standard_time&&x.standard_time.is_flexible?' · ปรับได้ตามบริบท':'')+'</span>':'')+(isMultiActivity?'<span class="subject-library-multi">รหัสเดียวกัน · เลือกได้หลายรายการ</span>':'')+'</div></div>'+
      (isSelected
        ?'<span class="subject-library-used">✓ อยู่ในหลักสูตรแล้ว</span>'
        :canEdit?'<button type="button" class="subject-add-btn" data-add-central-subject="'+esc(x.id||'')+'">＋ เพิ่ม</button>':'')+
    '</article>';
  }).join("");

  const gradeTabs=targetGrades.map(g=>{
    const code=academicGradeCode(g)||"",rooms=targetClasses.filter(c=>c.grade_label===g).length;
    return '<button type="button" class="'+(code===gradeCode?"active":"")+'" data-subject-context-grade="'+esc(code)+'">'+esc(shortGrade(g))+(rooms?' <span>'+rooms+'</span>':'')+'</button>';
  }).join("");
  const targetTabs='<button type="button" class="'+(!selectedProgram?"active":"")+'" data-subject-target="">ห้องปกติ <span>'+classes.filter(c=>!c.program_id).length+'</span></button>'+
    actualPrograms.map(p=>'<button type="button" class="'+(selectedProgram&&p.id===selectedProgram.id?"active":"")+'" data-subject-target="'+esc(p.id)+'">'+esc(p.name_th)+' <span>'+classes.filter(c=>c.program_id===p.id).length+'</span></button>').join("");
  const scopeTabs=[["core","วิชาพื้นฐาน"],["activity","กิจกรรมพัฒนาผู้เรียน"]]
    .map(([v,l])=>'<button type="button" class="'+(scope===v?"active":"")+'" data-subject-catalog-scope="'+v+'">'+l+'</button>').join("");

  const currentGroup=(readiness.groups||[]).find(g=>g.grade_code===gradeCode&&(g.program_id||"")===(selectedProgram?selectedProgram.id:""))||null;
  const scheduleSettings=readiness.schedule_settings||{configured:false};
  const totalGroups=Number(readiness.total_groups||0),confirmedGroups=Number(readiness.confirmed_groups||0);
  const completionPct=totalGroups?Math.round(confirmedGroups*100/totalGroups):0;
  const issueCount=currentGroup?Number(currentGroup.missing_time_count||0):0;
  const recommendedMissing=currentGroup?Number(currentGroup.central_core_missing_count||0)+Number(currentGroup.default_activity_missing_count||0):0;
  const weeklyTotal=currentGroup?Number(currentGroup.weekly_periods_total||0):0;
  const weeklyCapacity=currentGroup&&currentGroup.periods_per_week_capacity!=null?Number(currentGroup.periods_per_week_capacity):null;
  const periodGap=currentGroup&&currentGroup.periods_per_week_gap!=null?Number(currentGroup.periods_per_week_gap):null;
  const parallelVariants=currentGroup?Number(currentGroup.parallel_variant_count||0):0;
  const parallelMismatch=currentGroup?Number(currentGroup.parallel_mismatch_count||0):0;
  const currentStatus=currentGroup&&currentGroup.status||"empty";
  const currentStatusLabel={
    confirmed:"ยืนยันครบแล้ว",
    ready_to_confirm:"คาบครบ · พร้อมยืนยัน",
    needs_schedule_settings:"ยังไม่กำหนดเวลาเรียนของโรงเรียน",
    needs_time:"ยังมีรายวิชาที่ไม่กำหนดคาบ",
    parallel_time_mismatch:"วิชาทางเลือกกำหนดคาบไม่เท่ากัน",
    needs_periods:"คาบต่อสัปดาห์ยังไม่ครบ",
    over_periods:"คาบต่อสัปดาห์เกิน",
    empty:"ยังไม่มีรายวิชา"
  }[currentStatus]||"รอตรวจ";
  const currentStatusClass=currentStatus==="confirmed"?"success":currentStatus==="ready_to_confirm"?"info":"warning";
  const workspaceView=["selected","library"].includes(state.subjectWorkspaceView)?state.subjectWorkspaceView:"selected";
  state.subjectWorkspaceView=workspaceView;
  const timelineSteps=timeline&&timeline.steps||[];
  const stepChip=code=>{
    const x=timelineSteps.find(v=>v.step_code===code);
    if(!x)return "";
    const icon=x.status==="completed"?"✓":x.status==="current"?"●":"○";
    return '<span class="subject-timeline-step '+esc(x.status||"queued")+'">'+icon+' '+esc(x.title||"")+'</span>';
  };
  const allSchoolGrades=Array.from(new Set(classes.map(c=>c.grade_label).filter(Boolean)));
  const customDefaultType=scope==="core"?"basic":(["activity","additional","other"].includes(scope)?scope:"additional");
  const catalogSetupHtml='<section class="subject-catalog-setup">'+
    '<nav class="subject-setup-menu" aria-label="ตัวกรองรายการรายวิชาจากคลัง">'+
      '<button type="button" class="'+(setupTab==="target"?"active":"")+'" data-subject-setup-tab="target"><span>กลุ่มห้อง</span><strong>'+esc(targetLabel)+'</strong></button>'+
      '<button type="button" class="'+(setupTab==="grade"?"active":"")+'" data-subject-setup-tab="grade"><span>ระดับชั้น</span><strong>'+esc(gradeLabel?shortGrade(gradeLabel):"ยังไม่มี")+'</strong></button>'+
      '<button type="button" class="'+(setupTab==="type"?"active":"")+'" data-subject-setup-tab="type"><span>ประเภทวิชา</span><strong>'+esc(scopeLabel)+'</strong></button>'+
    '</nav>'+
    '<div class="subject-setup-panel">'+
      (setupTab==="target"
        ?'<div class="subject-setup-panel-head"><strong>เลือกกลุ่มห้อง</strong><small>เลือกบริบทที่จะนำรายวิชาจากคลังไปใช้</small></div><div class="subject-target-tabs">'+targetTabs+'</div>'
        :setupTab==="grade"
          ?'<div class="subject-setup-panel-head"><strong>เลือกระดับชั้น</strong><small>แสดงเฉพาะระดับที่มีห้องจริงใน '+esc(targetLabel)+'</small></div><div class="subject-grade-tabs">'+(gradeTabs||'<span class="muted">ยังไม่มีระดับชั้นสำหรับโครงสร้างรายวิชาในกลุ่มนี้</span>')+'</div>'
          :'<div class="subject-setup-panel-head"><strong>เลือกประเภทวิชาในคลัง</strong><small>ตัวกรองนี้มีผลเฉพาะรายการรายวิชาจากคลัง ไม่กรองฐานรายวิชาโรงเรียน</small></div><div class="subject-scope-tabs">'+scopeTabs+'</div>')+
    '</div>'+
    (earlyChildhoodCount?'<div class="subject-early-note">ระดับอนุบาลใช้หลักสูตรการศึกษาปฐมวัย จึงแยกออกจากหน้านี้</div>':'')+
  '</section>';

  const parallelGroupCards=parallelGroups.map(g=>
    '<article class="parallel-group-card"><div><strong>'+esc(g.name)+'</strong><small>'+(g.members||[]).map(m=>esc(m.subject_name)).join(' · ')+'</small></div><span>'+Number(g.weekly_periods||0).toLocaleString("th-TH")+' คาบ/สัปดาห์</span>'+(canEdit?'<button type="button" class="text-btn danger" data-delete-parallel-group="'+esc(g.id)+'">ยกเลิกกลุ่ม</button>':'')+'</article>'
  ).join("");
  const parallelTools=canEdit&&shownCourses.length>1
    ?'<section class="subject-parallel-tools '+(state.subjectParallelSelectionMode?"is-selecting":"")+'"><div class="subject-parallel-head"><div><strong>กลุ่มรายวิชาทางเลือก / เรียนเวลาเดียวกัน</strong><small>'+(state.subjectParallelSelectionMode?"เลือกอย่างน้อย 2 รายวิชาที่เรียนในช่วงเวลาเดียวกัน แล้วกดรวมเป็นกลุ่ม":"หลายรหัสที่เรียนในช่วงเดียวกันให้นับเวลาเพียงครั้งเดียว")+'</small></div>'+
      (groupEligibleCourses.length>1
        ?(state.subjectParallelSelectionMode
          ?'<div class="parallel-selection-actions"><button type="button" class="secondary-btn compact-btn" data-cancel-parallel-selection>ยกเลิกการเลือก</button><button type="button" class="primary-btn compact-btn" data-open-parallel-group disabled>รวมวิชาที่เลือก <span data-parallel-selected-count>0</span></button></div>'
          :'<button type="button" class="secondary-btn compact-btn" data-start-parallel-selection>เลือกวิชาเพื่อรวมกลุ่ม</button>')
        :'')+
      '</div>'+
      (state.subjectParallelSelectionMode?'<div class="parallel-selection-banner"><strong>โหมดเลือกวิชา</strong><span>ช่องสี่เหลี่ยมจะแสดงเฉพาะตอนนี้ และใช้สำหรับ “รวมเวลา” เท่านั้น ไม่ใช่การลบหลายรายการ</span></div>':'')+
      (parallelGroupCards?'<div class="parallel-group-list">'+parallelGroupCards+'</div>':'')+
      '<form class="parallel-group-form hidden" data-parallel-group-form><div class="parallel-group-form-grid"><label>ชื่อกลุ่ม<input name="name" required placeholder="เช่น เลือกเสรี ป.6 กลุ่ม 1"></label><label>คาบ/สัปดาห์<input name="weekly_periods" type="number" min="0.25" max="20" step="0.25" required placeholder="เช่น 2"></label></div><div class="parallel-group-picked" data-parallel-picked-text></div><div class="parallel-group-actions"><button type="button" class="text-btn" data-close-parallel-group>ยกเลิก</button><button type="submit" class="primary-btn">บันทึกกลุ่มเวลาเดียวกัน</button></div></form>'+
    '</section>'
    :(parallelGroupCards?'<section class="subject-parallel-tools"><div class="subject-parallel-head"><div><strong>กลุ่มรายวิชาทางเลือก / เรียนเวลาเดียวกัน</strong><small>ระบบนับเวลาของแต่ละกลุ่มเพียงครั้งเดียว</small></div></div><div class="parallel-group-list">'+parallelGroupCards+'</div></section>':'');

  const centralOnlyCount=centralCatalog.length;
  const centralRowsOnly=centralRows;
  const compactReadiness='<section class="subject-readiness-strip '+currentStatusClass+'"><div><strong>'+esc(shortGrade(gradeLabel))+' · '+esc(targetLabel)+'</strong><span>'+esc(currentStatusLabel)+(weeklyCapacity!=null?' · '+weeklyTotal.toLocaleString("th-TH")+' / '+weeklyCapacity.toLocaleString("th-TH")+' คาบ/สัปดาห์':'')+'</span></div><a href="#/academics/curriculum">ตรวจโครงสร้างเวลาเรียน →</a></section>';
  const curriculumFrameworkHtml=academicCurriculumTimeFrameworkHtml(currentGroup,gradeLabel);
  const schoolGroups=
    selectedGroupHtml("basic","รายวิชาพื้นฐาน","รายวิชาที่ใช้ตามโครงสร้างหลักสูตรของระดับชั้นนี้")+
    selectedGroupHtml("additional","รายวิชาเพิ่มเติม","รายวิชาที่สถานศึกษากำหนดเพิ่มเติมตามหลักสูตรสถานศึกษา")+
    selectedGroupHtml("activity","กิจกรรมพัฒนาผู้เรียน","แนะแนว กิจกรรมนักเรียน ชุมนุม และกิจกรรมเพื่อสังคมฯ")+
    (selectedByType.other.length?selectedGroupHtml("other","อื่น ๆ","รายการเฉพาะที่โรงเรียนกำหนด"):"");

  const editGuardHtml=canManage?'<section class="subject-edit-guard '+(canEdit?"is-open":"is-locked")+'"><div class="subject-edit-guard-copy"><strong>'+(canEdit?"เปิดการแก้ไขรายวิชาแล้ว":"รายการรายวิชาถูกล็อก")+'</strong><p>'+(canEdit?"สามารถเพิ่ม คัดลอก นำออก และจัดกลุ่มเวลาได้จนกว่าจะปิดสวิตช์หรือออกจากหน้านี้":"เปิดสวิตช์เมื่อต้องการเปลี่ยนข้อมูล เพื่อป้องกันการแก้ไขโดยไม่ตั้งใจ")+'</p></div><label class="academic-edit-switch subject-edit-switch"><input type="checkbox" data-subject-edit-switch '+(canEdit?"checked":"")+'><span class="switch-track"><i></i></span><b>'+(canEdit?"เปิด":"ปิด")+'</b></label></section>':'';

  const roomImpactHtml=gradeCode?'<section class="subject-room-impact"><div><strong>ใช้กับห้องใดบ้าง</strong><p>'+(targetRoomCount?esc(targetRoomPreview):"ยังไม่พบห้องจาก LEC ในบริบทนี้")+'</p><small>รายวิชาจะใช้กับทุกห้องในระดับชั้นและกลุ่มห้อง/โปรแกรมที่เลือก หากต้องการหลักสูตรต่างกันให้แยกเป็นโปรแกรม/กลุ่มห้อง ไม่แยกรายวิชาทีละห้อง</small></div><span>'+targetRoomCount+' ห้อง</span></section>':'';

  const copyYearHtml=canManage&&year&&gradeCode?'<section class="subject-copy-year"><div class="subject-copy-year-copy"><strong>คัดลอกจากปีการศึกษาก่อน</strong><p>คัดลอกเฉพาะ '+esc(shortGrade(gradeLabel))+' · '+esc(targetLabel)+' รวมคาบ/ภาคและกลุ่มรายวิชาทางเลือก โดยผสานกับรายการเดิมและไม่ลบวิชาที่มีอยู่</p></div>'+(copyYears.length?'<div class="subject-copy-year-actions"><label>ปีต้นทาง<select data-subject-copy-year>'+copyYears.map(y=>'<option value="'+esc(y.id)+'" '+(state.subjectCopyYearId===y.id?"selected":"")+'>'+esc(y.year_be)+'</option>').join("")+'</select></label><button type="button" class="secondary-btn compact-btn" data-copy-subject-year '+(canEdit?"":"disabled")+'>คัดลอกมาใช้</button></div>':'<span class="muted">ยังไม่มีปีการศึกษาก่อนหน้าให้คัดลอก</span>')+'</section>':'';

  return '<section class="academic-page subjects-workspace subjects-workspace-v2">'+academicNavHtml("subjects",data)+
    '<section class="panel subjects-v2-head"><div><p class="eyebrow">SUBJECTS</p><h2>รายวิชา</h2><p class="panel-sub">ค้นหาจากคลังมาตรฐานกลาง คลังรายวิชาร่วม และคลังของโรงเรียนก่อนเพิ่ม เพื่อลดรหัสและชื่อวิชาซ้ำ</p></div><div class="subjects-context-chips">'+
      (year?'<span>ปี '+esc(year.year_be)+'</span>':'')+'<span>'+allSchoolGrades.length+' ระดับชั้น</span><span>'+classes.length+' ห้อง</span>'+
    '</div></section>'+
    '<section class="panel subjects-v2-context">'+
      (actualPrograms.length?'<div class="subjects-v2-context-row"><div><strong>กลุ่มห้อง / โปรแกรม</strong><small>เลือกบริบทที่จะจัดรายวิชา</small></div><div class="subject-target-tabs">'+targetTabs+'</div></div>':'')+
      '<div class="subjects-v2-context-row"><div><strong>ระดับชั้น</strong><small>แสดงเฉพาะระดับที่มีห้องจริงจาก LEC</small></div><div class="subject-grade-tabs">'+(gradeTabs||'<span class="muted">ยังไม่มีระดับชั้น</span>')+'</div></div>'+
      (earlyChildhoodCount?'<div class="subject-early-note">ระดับอนุบาลใช้หลักสูตรการศึกษาปฐมวัย จึงแยกออกจากหน้ารายวิชาขั้นพื้นฐาน</div>':'')+
    '</section>'+
    editGuardHtml+
    roomImpactHtml+
    copyYearHtml+
    compactReadiness+
    '<section class="panel subject-workspace-panel subjects-v2-panel">'+
      '<nav class="subject-workspace-tabs subjects-v2-tabs">'+
        '<button type="button" class="'+(workspaceView==="selected"?"active":"")+'" data-subject-workspace-view="selected">หลักสูตรของโรงเรียน <span>'+selectedCourses.length+'</span></button>'+
        '<button type="button" class="'+(workspaceView==="library"?"active":"")+'" data-subject-workspace-view="library">คลังมาตรฐานส่วนกลาง <span>'+centralOnlyCount+'</span></button>'+
      '</nav>'+
      (workspaceView==="selected"
        ?'<div class="subject-workspace-content subjects-v2-content">'+
          '<div class="subject-workspace-head"><div><h2>'+esc(shortGrade(gradeLabel))+' · '+esc(targetLabel)+'</h2><p>ค้นหาจากทุกคลังก่อนเพิ่ม หากไม่พบจึงสร้างใหม่และเก็บที่มาของรายวิชาอัตโนมัติ</p></div><div class="subject-workspace-head-actions"><button type="button" class="primary-btn compact-btn" data-open-subject-finder '+(canEdit?"":"disabled")+'>＋ เพิ่มรายวิชา</button><button type="button" class="secondary-btn compact-btn" data-open-subject-library>คลังมาตรฐานกลาง</button><button type="button" class="secondary-btn compact-btn" data-export-subjects>ส่งออก CSV</button></div></div>'+
          parallelTools+
          schoolGroups+
          (canEdit&&gradeCode?'<section id="subject-finder-panel" class="subject-finder-panel hidden"><div class="subject-custom-form-head"><div><strong>ค้นหาก่อนเพิ่มรายวิชา</strong><small>ค้นพร้อมกันจากคลังมาตรฐานกลาง · คลังรายวิชาร่วม · คลังของโรงเรียน</small></div><button type="button" class="text-btn" data-close-subject-finder>ปิด</button></div><form id="subject-finder-form" class="subject-finder-form"><label class="wide">รหัสหรือชื่อรายวิชา <span class="required-mark">*</span><input name="query" required autocomplete="off" placeholder="เช่น อ31205 หรือ ภาษาอังกฤษเพื่อการสื่อสาร"></label><label>ประเภท<select name="subject_type"><option value="">ทุกประเภท</option><option value="basic">วิชาพื้นฐาน</option><option value="additional">วิชาเพิ่มเติม</option><option value="activity">กิจกรรมพัฒนาผู้เรียน</option></select></label><button type="submit" class="primary-btn compact-btn">ค้นหา</button></form><div class="subject-finder-hint">ระบบตรวจทั้งรหัสตรง ชื่อตรง ชื่อใกล้เคียง กลุ่มสาระ และชื่อเรียกอื่น เพื่อช่วยลดรายการซ้ำ</div><div class="subject-finder-results" data-subject-finder-results><div class="subject-finder-empty">พิมพ์รหัสหรือชื่อวิชาแล้วกดค้นหา</div></div><div class="subject-finder-create hidden" data-subject-finder-create><span>ไม่พบรายการที่ต้องการ?</span><button type="button" class="secondary-btn compact-btn" data-show-create-subject>สร้างรายวิชาใหม่</button></div></section><form id="subject-library-custom-form" class="subject-custom-form hidden"><div class="subject-custom-form-head"><div><strong>สร้างรายการใหม่ของโรงเรียน</strong><small>ใช้เมื่อค้นจากทุกคลังแล้วไม่พบรายการที่ต้องการ · ผูกกับ '+esc(shortGrade(gradeLabel))+' · '+esc(targetLabel)+'</small></div><button type="button" class="text-btn" data-close-custom-subject>ปิด</button></div><div class="subject-custom-grid"><label>ประเภท <select name="subject_type" required><option value="additional">วิชาเพิ่มเติม</option><option value="activity">กิจกรรมพัฒนาผู้เรียน</option></select></label><label>ประเภทย่อย<select name="subject_subtype"><option value="">ไม่ระบุ</option><option value="elective_free">เลือกเสรี</option><option value="career">อาชีพ</option><option value="language">ภาษา</option><option value="program_specific">เฉพาะโปรแกรม</option><option value="local">ท้องถิ่น</option><option value="special_focus">จุดเน้นพิเศษ</option><option value="school_additional_activity">กิจกรรมเพิ่มเติมของสถานศึกษา</option><option value="other_additional">เพิ่มเติมอื่น ๆ</option></select></label><label>รหัสวิชา<input name="subject_code" placeholder="เช่น อ31205"></label><label class="wide">ชื่อรายวิชา <span class="required-mark">*</span><input name="subject_name" required></label><label class="wide">กลุ่มสาระ / หมวด<input name="learning_area" placeholder="เช่น ภาษาต่างประเทศ"></label><label class="wide">ชื่อเรียกอื่น / คำค้น<input name="aliases" placeholder="คั่นด้วยเครื่องหมายจุลภาค เช่น อังกฤษสื่อสาร, English Communication"></label><label>กรอบ/รุ่นหลักสูตร<input name="curriculum_version" placeholder="เช่น หลักสูตรสถานศึกษา 2569"></label><label class="subject-share-check"><input type="checkbox" name="share_to_catalog" checked><span>เผยแพร่เข้าคลังรายวิชาร่วม ให้โรงเรียนอื่นค้นหาและเลือกใช้ได้</span></label></div><div class="subject-custom-note">รายวิชาพื้นฐานไม่สร้างใหม่จากหน้านี้ ให้เลือกจากคลังมาตรฐานกลาง ส่วนรายการใหม่จะบันทึกในคลังโรงเรียนและเก็บแหล่งที่มาเพื่อใช้อ้างอิงย้อนหลัง</div><div class="subject-custom-actions"><button type="button" class="text-btn" data-back-to-subject-search>กลับไปค้นหา</button><button type="submit" class="primary-btn">สร้างและเพิ่มในชั้นนี้</button></div></form>':'')+
        '</div>'
        :'<div class="subject-workspace-content subjects-v2-content subject-library-content">'+
          '<div class="subject-ministry-note"><div><strong>คลังมาตรฐานส่วนกลาง · '+esc(scopeLabel)+'</strong><p>'+(scope==="activity"?'กิจกรรมนักเรียนที่ใช้รหัสเดียวกันถูกแยกเป็นคนละตัวเลือก โรงเรียนเพิ่มได้หลายรายการตามที่เปิดสอนจริง ระบบนับเวลาเป็นช่องเดียวเมื่อใช้รหัสเดียวกัน และ ปพ.1 จะใช้ชื่อกิจกรรมที่ลงทะเบียนให้ผู้เรียนรายคนนั้น':'รวบรวมรหัส ชื่อรายวิชา และเวลาเรียนมาตรฐานกลางขั้นต่ำตามแม่แบบหลักสูตรแกนกลาง 2551/ฉบับปรับปรุง 2560 เมื่อโรงเรียนเพิ่มรายวิชา ระบบจะคัดลอกเวลาเรียนเป็นค่าเริ่มต้นของโรงเรียน และโรงเรียนสามารถปรับเฉพาะค่าของตนเองได้ภายหลัง')+'</p><a href="https://www.academic.obec.go.th/web/mission/view/34" target="_blank" rel="noopener">อ้างอิงหลักสูตรแกนกลางและเอกสาร สพฐ. ↗</a></div><span>ส่วนกลาง</span></div>'+
          '<div class="subject-library-toolbar"><div class="subject-scope-tabs">'+scopeTabs+'</div>'+(centralOnlyCount>4?'<label class="subject-library-search"><input type="search" data-subject-library-search placeholder="ค้นหารหัส ชื่อวิชา หรือกลุ่มสาระ"></label>':'')+'</div>'+
          (scope==="additional"
            ?'<div class="subject-guidance-box"><strong>รายวิชาเพิ่มเติม</strong><p>ไม่มีรายการบังคับชุดเดียวสำหรับทุกโรงเรียน ให้สร้างในแท็บ “หลักสูตรของโรงเรียน” ตามหลักสูตรสถานศึกษา</p>'+(canManage?'<button type="button" class="primary-btn compact-btn" data-subject-workspace-view="selected">ไปสร้างวิชาเพิ่มเติม</button>':'')+'</div>'
            :'<div class="subject-library-list" data-subject-library-list>'+centralRowsOnly+
              (!centralOnlyCount?'<div class="empty-state compact-empty"><div class="empty-icon">✓</div><h3>ไม่มีรายการที่ยังเพิ่มได้</h3><p>รายการของ '+esc(shortGrade(gradeLabel))+' ในหมวดนี้ถูกนำมาใช้ในหลักสูตรโรงเรียนแล้ว</p></div>':'')+
            '</div><div class="subject-library-no-results hidden" data-subject-library-no-results>ไม่พบรายวิชาที่ค้นหา</div>')+
        '</div>')+
    '</section>'+
  '</section>';
}
function academicCurriculumHtml(data){
  const courseTimeById=new Map(((data.course_time_overview&&data.course_time_overview.items)||[]).map(x=>[x.course_id,x]));
  const readiness=state.curriculumReadiness||{groups:[]};
  const schoolGradeSet=new Set(academicCurriculumGradeCodes(data));
  const items=(data.courses||[]).filter(c=>schoolGradeSet.has(c.grade_code||academicGradeCode(c.grade_label)));
  const subjects=(data.subjects||[]).filter(s=>s.is_active),year=academicSelectedYear(data),canManage=Boolean(data.can_manage);
  const f=state.academicFilters||{};
  if(f.grade_label&&!academicGradeValues(data).includes(f.grade_label))state.academicFilters={...f,grade_label:""};
  const currentFilters=state.academicFilters||{};
  const filtered=items
    .filter(x=>(!currentFilters.grade_label||x.grade_label===currentFilters.grade_label)&&(!currentFilters.program_id||x.program_id===currentFilters.program_id))
    .sort((a,b)=>academicGradeOrder(a.grade_label)-academicGradeOrder(b.grade_label)||(Number(a.sort_order||0)-Number(b.sort_order||0))||String(a.subject_name||"").localeCompare(String(b.subject_name||""),"th"));
  const gradeOptions=academicGradeValues(data);
  const terms=year&&year.terms||[];
  const schoolGrades=academicCurriculumGradeRows(data);
  const filterGradeCode=academicGradeCode(currentFilters.grade_label);
  if(!schoolGrades.some(g=>g.grade_code===state.academicPresetGrade)){
    state.academicPresetGrade=(filterGradeCode&&schoolGrades.some(g=>g.grade_code===filterGradeCode)?filterGradeCode:(schoolGrades[0]&&schoolGrades[0].grade_code))||"";
  }
  const activeSchoolGrade=schoolGrades.find(g=>g.grade_code===state.academicPresetGrade)||schoolGrades[0]||null;
  const selectedProgram=(data.programs||[]).find(p=>p.id===currentFilters.program_id)||null;
  const selectedProgramLabel=selectedProgram?selectedProgram.name_th:"ห้องปกติ";
  const selectedFrameworkGroup=activeSchoolGrade
    ?(readiness.groups||[]).find(g=>g.grade_code===activeSchoolGrade.grade_code&&(g.program_id||"")===(selectedProgram?selectedProgram.id:""))||null
    :null;
  const curriculumFrameworkHtml=academicCurriculumTimeFrameworkHtml(selectedFrameworkGroup,activeSchoolGrade&&activeSchoolGrade.grade_label);
  const courseInContext=(c,gradeCode)=>c.is_active!==false&&c.grade_code===gradeCode&&(
    selectedProgram
      ?(c.program_id===selectedProgram.id||(!c.program_id&&(c.subject_type==="basic"||c.subject_type==="activity")))
      :!c.program_id
  );
  const schoolBaseCourses=activeSchoolGrade
    ?items.filter(c=>courseInContext(c,activeSchoolGrade.grade_code))
      .sort((a,b)=>Number(a.sort_order||0)-Number(b.sort_order||0)||String(a.subject_name||"").localeCompare(String(b.subject_name||""),"th"))
    :[];
  const schoolBaseRows=schoolBaseCourses.map((c,index)=>{
    const ti=courseTimeById.get(c.id)||null,standard=ti&&(ti.standard_current||ti.standard_snapshot)||null;
    const standardText=academicStandardTimeSummary(standard),schoolText=academicSchoolTimeSummary(c,standard);
    return '<div class="curriculum-preset-row is-present '+(ti&&ti.time_customized?"time-customized":"")+'">'+
      '<span class="preset-order">'+(index+1)+'</span>'+
      '<span class="preset-code">'+esc(c.subject_code||"—")+'</span>'+
      '<div class="preset-subject"><strong>'+esc(c.subject_name)+'</strong><small>'+esc(c.learning_area||academicSubjectTypeLabel(c.subject_type))+(c.program_name?' · '+esc(c.program_name):'')+'</small>'+(standard?'<em>มาตรฐาน: '+esc(standardText)+(academicTimeTemplateDiffers(ti)?' · มีมาตรฐานฉบับใหม่':'')+'</em>':'')+'</div>'+
      '<span class="preset-weekly">'+esc(schoolText)+'</span>'+
      '<span class="preset-annual">'+(standard?(ti&&ti.time_customized?'ปรับจากมาตรฐาน':'ตามมาตรฐาน'):'กำหนดโดยโรงเรียน')+'</span>'+
      '<span class="pill '+(ti&&ti.time_customized?"warning":"success")+'">'+(ti&&ti.time_customized?"โรงเรียนปรับแล้ว":"อยู่ในฐานโรงเรียน")+'</span>'+
    '</div>';
  }).join("");

  const rows=filtered.map((c,index)=>{
    const ti=courseTimeById.get(c.id)||null,standard=ti&&(ti.standard_current||ti.standard_snapshot)||null;
    const termText=(c.term_plans||[]).map(t=>'ภาค '+t.term_no+': '+(t.term_hours!=null?Number(t.term_hours).toLocaleString("th-TH")+' ชม. · ':'')+(t.weekly_periods!=null?Number(t.weekly_periods).toLocaleString("th-TH")+' คาบ/สัปดาห์':'บูรณาการ')).join(' · ');
    const schoolText=academicSchoolTimeSummary(c,standard),standardText=academicStandardTimeSummary(standard);
    return '<div class="academic-course-row '+(!c.is_active?"muted-row":"")+' '+(ti&&ti.time_customized?"time-customized":"")+'">'+
      '<div class="academic-course-grade"><strong>'+esc(shortGrade(c.grade_label))+'</strong><small>ลำดับ '+(index+1)+' · '+esc(c.program_name||"ทั่วไป")+'</small></div>'+
      '<div class="academic-course-subject"><strong>'+esc(c.subject_code?c.subject_code+" "+c.subject_name:c.subject_name)+'</strong><small>'+esc(c.learning_area||academicSubjectTypeLabel(c.subject_type))+'</small>'+(standard?'<em>มาตรฐานกลาง: '+esc(standardText)+(academicTimeTemplateDiffers(ti)?' · มีมาตรฐานฉบับใหม่':'')+'</em>':'')+'</div>'+
      '<div class="academic-course-hours"><strong>'+esc(schoolText)+'</strong><small>'+(ti&&ti.time_customized?'โรงเรียนปรับจากมาตรฐาน':standard?'โรงเรียนใช้ค่ามาตรฐาน':'เวลาเรียนของโรงเรียน')+'</small></div>'+
      '<div class="academic-course-term"><span>'+esc(termText||"ยังไม่กำหนดคาบรายภาค")+'</span></div>'+
      (canManage?'<div class="academic-course-actions"><button type="button" class="icon-btn compact-order-btn" data-move-course="'+esc(c.id)+'" data-direction="up" title="เลื่อนขึ้น" aria-label="เลื่อนขึ้น">↑</button><button type="button" class="icon-btn compact-order-btn" data-move-course="'+esc(c.id)+'" data-direction="down" title="เลื่อนลง" aria-label="เลื่อนลง">↓</button><button type="button" class="secondary-btn compact-btn" data-edit-course="'+esc(c.id)+'">แก้ไข</button>'+(standard?'<button type="button" class="secondary-btn compact-btn" data-reset-course-time-standard="'+esc(c.id)+'">คืนมาตรฐาน</button>':'')+'</div>':'')+
    '</div>';
  }).join("");

  const termInputs=terms.map(t=>'<div class="academic-term-plan-box"><strong>'+esc(t.name||("ภาคเรียนที่ "+t.term_no))+'</strong><label>คาบ/สัปดาห์<input name="weekly_'+esc(t.id)+'" type="number" min="0" step="0.25" placeholder="เช่น 5"></label><label>ชั่วโมง/ภาค<input name="hours_'+esc(t.id)+'" type="number" min="0" step="0.5" placeholder="เว้นว่างได้"></label></div>').join("");
  const schoolGradeButtons=schoolGrades.map(g=>{
    const count=items.filter(c=>courseInContext(c,g.grade_code)).length;
    return '<button type="button" class="curriculum-grade-choice '+(activeSchoolGrade&&activeSchoolGrade.grade_code===g.grade_code?"active":"")+'" data-preset-grade="'+esc(g.grade_code)+'"><strong>'+esc(shortGrade(g.grade_label))+'</strong><small>'+count+' รายวิชาในฐานโรงเรียน</small><em>'+count+'</em></button>';
  }).join("");

  return '<section class="academic-page">'+academicNavHtml("curriculum",data)+
    (year?'<section class="panel curriculum-preset-panel"><div class="panel-head"><div><p class="eyebrow">SCHOOL SUBJECT BASE</p><h2>ฐานรายวิชาตามระดับชั้นของโรงเรียน</h2><p class="panel-sub">แสดงเฉพาะรายวิชาที่เพิ่มเข้าฐานข้อมูลของโรงเรียนแล้วเท่านั้น รายการที่ยังอยู่เฉพาะคลังกลางจะไม่แสดงในส่วนนี้</p></div><span class="pill neutral">'+esc(selectedProgramLabel)+'</span></div>'+
      '<div class="curriculum-grade-choices">'+schoolGradeButtons+'</div>'+
      (activeSchoolGrade?'<div class="curriculum-preset-summary"><div><small>ระดับชั้น</small><strong>'+esc(activeSchoolGrade.grade_label)+'</strong></div><div><small>รายวิชาในฐานโรงเรียน</small><strong>'+Number(schoolBaseCourses.length).toLocaleString("th-TH")+'</strong></div><div><small>บริบท</small><strong>'+esc(selectedProgramLabel)+'</strong></div></div>':'')+
      (schoolBaseRows?'<div class="curriculum-preset-list">'+schoolBaseRows+'</div>':'<div class="empty-state compact-empty"><div class="empty-icon">📚</div><h3>ยังไม่มีรายวิชาในฐานของระดับชั้นนี้</h3><p>เพิ่มรายวิชาจากคลังกลางหรือสร้างรายวิชาของโรงเรียนก่อน</p></div>')+
      '<div class="curriculum-preset-actions"><div class="notice"><strong>ฐานกลางแยกจากฐานโรงเรียน</strong><br>ระบบจะไม่นำรายวิชาจากคลังกลางเข้ามาปะปนหรือเพิ่มอัตโนมัติ เมื่อเลือกเพิ่มแล้วจึงจะปรากฏในฐานรายวิชาของโรงเรียน</div>'+(canManage?'<a class="primary-btn" href="#/academics/subjects">＋ เพิ่มจากคลังรายวิชากลาง</a>':'')+'</div>'+
    '</section>':'')+
    curriculumFrameworkHtml+
    '<section class="panel"><div class="panel-head"><div><p class="eyebrow">CURRICULUM STRUCTURE</p><h2>โครงสร้างเวลาเรียน</h2><p class="panel-sub">'+(year?'ปีการศึกษา '+esc(year.year_be):'ยังไม่ได้เลือกปี')+' · เปรียบเทียบ “มาตรฐานกลาง” กับ “เวลาเรียนที่โรงเรียนใช้จริง” ได้ในรายการเดียว โรงเรียนแก้ค่าของตนเองได้โดยไม่เปลี่ยนฐานกลาง</p></div><span class="pill">'+items.length+' รายการ</span></div>'+
      '<form id="academic-course-filter" class="academic-course-filter"><label>ระดับชั้น<select name="grade_label">'+academicGradeOptionsHtml(data,currentFilters.grade_label||"",true)+'</select></label><label>โปรแกรม<select name="program_id">'+academicProgramOptions(data,currentFilters.program_id||"",true)+'</select></label><button class="secondary-btn" type="button" data-reset-course-filter>ล้างตัวกรอง</button></form>'+
      (rows?'<div class="academic-course-list">'+rows+'</div>':'<div class="empty-state compact-empty"><div class="empty-icon">📚</div><h3>'+(items.length?'ไม่พบรายการตามระดับชั้น/โปรแกรมที่เลือก':'ยังไม่มีโครงสร้างเวลาเรียน')+'</h3><p>ใช้ชุดวิชาหลักด้านบน หรือเพิ่มรายวิชาเองด้านล่าง</p></div>')+
    '</section>'+
    (canManage&&year?'<section class="panel curriculum-quick-add-panel"><div class="panel-head"><div><p class="eyebrow">ADD MISSING SUBJECT</p><h2>เพิ่มรายวิชาที่ขาดเอง</h2><p class="panel-sub">กรอกรหัสและชื่อวิชาได้ทันที ถ้ารหัสมีอยู่ในทะเบียนรายวิชา ระบบจะนำรายการเดิมมาใช้โดยไม่สร้างซ้ำ</p></div><a class="secondary-btn compact-btn" href="#/academics/subjects">เปิดทะเบียนรายวิชา</a></div>'+
      '<form id="academic-quick-course-form" class="academic-form academic-form-3">'+
        '<label>โปรแกรม<select name="program_id">'+academicProgramOptions(data,currentFilters.program_id||"",false)+'</select></label>'+
        '<label>ระดับชั้น <span class="required-mark">*</span><select name="grade_label" required>'+academicGradeOptionsHtml(data,currentFilters.grade_label||activeSchoolGrade&&activeSchoolGrade.grade_label||gradeOptions[0]||"",false)+'</select></label>'+
        '<label>ลำดับ<input name="sort_order" type="number" min="0" placeholder="อัตโนมัติ"></label>'+
        '<label>รหัสวิชา<input name="subject_code" placeholder="เช่น ท15101"></label>'+
        '<label>ชื่อรายวิชา <span class="required-mark">*</span><input name="subject_name" required placeholder="ชื่อรายวิชา"></label>'+
        '<label>ประเภท<select name="subject_type">'+academicSubjectTypeOptions("basic")+'</select></label>'+
        '<label>กลุ่มสาระ / หมวด<input name="learning_area" placeholder="เว้นว่างได้"></label>'+
        '<label>คาบ/สัปดาห์<input name="weekly_periods" type="number" min="0.25" step="0.25" placeholder="เช่น 5"></label>'+
        '<label>เวลาเรียน (ชม./ปี)<input name="annual_hours" type="number" min="0.5" step="0.5" placeholder="เช่น 200"></label>'+
        '<div class="academic-form-actions span-all"><button type="reset" class="secondary-btn">ล้าง</button><button type="submit" class="primary-btn">＋ เพิ่มรายวิชาในระดับชั้นนี้</button></div>'+
      '</form>'+
    '</section>':'')+
    (canManage&&year?'<section class="panel academic-form-panel curriculum-existing-subject-panel"><div class="panel-head"><div><h2 data-course-form-title>เลือกจากทะเบียนรายวิชา</h2><p class="panel-sub">สำหรับรายวิชาที่มีในทะเบียนอยู่แล้ว สามารถเลือกมาเพิ่มในระดับชั้นได้โดยไม่ต้องพิมพ์รหัสและชื่อใหม่</p></div></div>'+
      (subjects.length?'<form id="academic-course-form" class="academic-form academic-course-form" data-id=""><input type="hidden" name="academic_year_id" value="'+esc(year.id)+'"><label>โปรแกรม<select name="program_id">'+academicProgramOptions(data,currentFilters.program_id||"",false)+'</select></label><label>ระดับชั้น <span class="required-mark">*</span><select name="grade_label" required>'+academicGradeOptionsHtml(data,currentFilters.grade_label||activeSchoolGrade&&activeSchoolGrade.grade_label||gradeOptions[0]||"",false)+'</select></label><label>รายวิชา <span class="required-mark">*</span><select name="subject_id" required><option value="">เลือกรายวิชา</option>'+subjects.map(s=>'<option value="'+esc(s.id)+'">'+esc(s.subject_code?s.subject_code+" · "+s.name_th:s.name_th)+'</option>').join("")+'</select></label><label>ชั่วโมง/ปี<input name="annual_hours" type="number" min="0" step="0.5" placeholder="เช่น 200"></label><label>หน่วยกิต<input name="credits" type="number" min="0" step="0.5" placeholder="ใช้เมื่อหลักสูตรกำหนด"></label><label>ลำดับ<input name="sort_order" type="number" value="0"></label><label class="check-row"><input name="is_active" type="checkbox" checked><span>ใช้งาน</span></label><label class="span-all">หมายเหตุ<textarea name="notes" rows="2"></textarea></label><div class="span-all"><div class="academic-term-plan-title">คาบ/ชั่วโมงแยกตามภาคเรียน</div><div class="academic-term-plan-grid">'+(termInputs||'<div class="notice warning">ปีการศึกษานี้ยังไม่มีภาคเรียน กรุณาเพิ่มภาคเรียนก่อน</div>')+'</div></div><div class="academic-form-actions span-all"><button type="button" class="secondary-btn" data-reset-course-form>ล้าง</button><button type="submit" class="primary-btn">บันทึกโครงสร้างรายวิชา</button></div></form>':'<div class="notice warning"><strong>ยังไม่มีทะเบียนรายวิชา</strong><br>เพิ่มวิชาใหม่จากแบบฟอร์มด้านบนได้ทันที</div>')+
    '</section>':'')+
  '</section>';
}

function teachingWorkloadStatusLabel(value){
  return ({draft:"ฉบับร่าง",submitted:"รอตรวจสอบ",approved:"อนุมัติแล้ว",returned:"ส่งกลับแก้ไข",cancelled:"ยกเลิก"})[value]||value||"-";
}
function teachingWorkloadStatusClass(value){
  return value==="approved"?"success":value==="submitted"?"warning":value==="returned"?"danger":"";
}
function teachingRoleLabel(value){
  return ({main:"ครูผู้สอนหลัก",co_teacher:"ครูผู้สอนร่วม",support:"ผู้ช่วย/สนับสนุนการสอน"})[value]||value||"-";
}
function teachingRoleOptions(selected){
  return [["main","ครูผู้สอนหลัก"],["co_teacher","ครูผู้สอนร่วม"],["support","ผู้ช่วย/สนับสนุนการสอน"]]
    .map(([v,l])=>'<option value="'+v+'" '+(selected===v?"selected":"")+'>'+l+'</option>').join("");
}
function workloadSelectedYear(page){
  return (page.years||[]).find(y=>y.id===page.selected_year_id)||null;
}
function workloadSelectedTerm(page){
  const y=workloadSelectedYear(page);
  return y&&(y.terms||[]).find(t=>t.id===page.selected_term_id)||null;
}
async function loadTeachingWorkloadPage(){
  const school=currentSchool();
  if(!school)throw new Error("กรุณาเลือกสถานศึกษา");
  const res=await supabase.rpc("lao_teaching_workload_page",{
    p_school_id:school.id,
    p_academic_year_id:state.academicYearId||null,
    p_term_id:state.academicTermId||null,
    p_status:null,
    p_personnel_id:null
  });
  if(res.error)throw res.error;
  state.teachingWorkloadData=res.data||{};
  state.academicTermId=state.teachingWorkloadData.selected_term_id||null;
  return state.teachingWorkloadData;
}
function teachingOfferingOptions(page,selectedKey){
  const rows=page.offerings||[];
  return '<option value="">เลือกรายวิชาและห้อง</option>'+rows.map(o=>{
    const subject=(o.subject_code?o.subject_code+" · ":"")+o.subject_name;
    const tail=(o.program_name?" · "+o.program_name:"")+(o.suggested_weekly_periods!=null?" · โครงสร้าง "+Number(o.suggested_weekly_periods).toLocaleString("th-TH")+" คาบ/สัปดาห์":"");
    return '<option value="'+esc(o.key)+'" data-periods="'+esc(o.suggested_weekly_periods==null?"":o.suggested_weekly_periods)+'" '+(o.key===selectedKey?"selected":"")+'>'+esc(subject+" · "+o.class_short+tail)+'</option>';
  }).join("");
}
function teachingWorkloadRowHtml(page,item,index){
  const key=item?(item.course_id+"|"+item.class_section_id):"";
  return '<div class="teaching-editor-row" data-teaching-row>'+
    '<span class="teaching-row-no" data-teaching-row-no>'+(index+1)+'</span>'+
    '<label class="teaching-offering-field"><span>รายวิชา / ชั้นเรียน</span><select data-teaching-offering required>'+teachingOfferingOptions(page,key)+'</select></label>'+
    '<label><span>คาบ/สัปดาห์</span><input data-teaching-periods type="number" min="0.5" step="0.5" required value="'+esc(item&&item.weekly_periods!=null?item.weekly_periods:"")+'" placeholder="เช่น 5"></label>'+
    '<label><span>หน้าที่</span><select data-teaching-role>'+teachingRoleOptions(item&&item.teaching_role||"main")+'</select></label>'+
    '<label class="teaching-note-field"><span>หมายเหตุ</span><input data-teaching-note value="'+esc(item&&item.notes||"")+'" placeholder="เว้นว่างได้"></label>'+
    '<button type="button" class="icon-btn teaching-remove-btn" data-remove-teaching-row aria-label="ลบรายการ" title="ลบรายการ">×</button>'+
  '</div>';
}
function workloadItemListHtml(items){
  if(!items||!items.length)return '<div class="academic-empty-line">ยังไม่มีรายการสอน</div>';
  return '<div class="teaching-item-list">'+items.map(i=>
    '<div class="teaching-item"><div><strong>'+esc((i.subject_code?i.subject_code+" · ":"")+i.subject_name)+'</strong><small>'+esc(i.class_short)+(i.program_name?' · '+esc(i.program_name):'')+' · '+esc(teachingRoleLabel(i.teaching_role))+'</small></div><span>'+Number(i.weekly_periods||0).toLocaleString("th-TH")+' คาบ/สัปดาห์</span></div>'
  ).join("")+'</div>';
}
function workloadEditorHtml(page,workload,personnel){
  const canManage=Boolean(page.can_manage);
  if(!personnel)return canManage
    ?'<section class="panel teaching-editor-panel"><div class="empty-state compact-empty"><div class="empty-icon">👤</div><h3>เลือกบุคลากรเพื่อจัดภาระงานสอน</h3><p>เลือกจากรายชื่อด้านบน ระบบจะแสดงรายการเดิมของภาคเรียนนี้ถ้ามี</p></div></section>'
    :'<section class="panel teaching-editor-panel"><div class="empty-state compact-empty"><div class="empty-icon">🔗</div><h3>ยังไม่เชื่อมบัญชีกับทะเบียนบุคลากร</h3><p>กรุณาติดต่อฝ่ายบุคลากรเพื่อเชื่อมบัญชีก่อนเสนอภาระงานสอน</p></div></section>';

  const status=workload&&workload.status||"draft";
  const locked=!canManage&&["submitted","approved"].includes(status);
  if(locked){
    return '<section class="panel teaching-editor-panel"><div class="panel-head"><div><p class="eyebrow">MY TEACHING LOAD</p><h2>'+esc(personnel.full_name||workload.personnel_name||"ภาระงานสอน")+'</h2><p class="panel-sub">สถานะ: '+esc(teachingWorkloadStatusLabel(status))+'</p></div><span class="pill '+teachingWorkloadStatusClass(status)+'">'+esc(teachingWorkloadStatusLabel(status))+'</span></div>'+
      workloadItemListHtml(workload.items||[])+
      '<div class="teaching-total-bar"><span>รวมภาระงานสอน</span><strong>'+Number(workload.total_weekly_periods||0).toLocaleString("th-TH")+' คาบ/สัปดาห์</strong></div>'+
      (status==="submitted"?'<div class="notice warning">ส่งให้ฝ่ายวิชาการตรวจสอบแล้ว ระหว่างนี้ไม่สามารถแก้ไขได้</div>':'<div class="notice success">รายการนี้ได้รับการอนุมัติแล้ว หากต้องแก้ไขให้ติดต่อฝ่ายวิชาการ</div>')+
    '</section>';
  }

  const offerings=page.offerings||[];
  const items=workload&&workload.items&&workload.items.length?workload.items:[null];
  return '<section class="panel teaching-editor-panel" id="teaching-workload-editor"><div class="panel-head"><div><p class="eyebrow">'+(canManage?"ACADEMIC ASSIGNMENT":"MY TEACHING LOAD")+'</p><h2>'+(canManage?"จัดภาระงานสอนให้ "+esc(personnel.full_name):"ภาระงานสอนของฉัน")+'</h2><p class="panel-sub">'+(canManage?"บันทึกโดยฝ่ายวิชาการจะอนุมัติทันที":"บันทึกฉบับร่างได้ก่อน แล้วจึงส่งให้ฝ่ายวิชาการตรวจสอบ")+'</p></div>'+(workload?'<span class="pill '+teachingWorkloadStatusClass(status)+'">'+esc(teachingWorkloadStatusLabel(status))+'</span>':'')+'</div>'+
    (status==="returned"&&workload&&workload.review_note?'<div class="notice danger"><strong>ฝ่ายวิชาการส่งกลับให้แก้ไข</strong><br>'+esc(workload.review_note)+'</div>':'')+
    (!offerings.length?'<div class="notice warning"><strong>ยังไม่มีรายวิชาที่พร้อมจัดภาระงาน</strong><br>ฝ่ายวิชาการต้องกำหนด “โครงสร้างเวลาเรียน” ของปีการศึกษานี้ก่อน จึงจะเลือกรายวิชาและห้องได้</div>':
    '<form id="teaching-workload-form" data-workload-id="'+esc(workload&&workload.id||"")+'" data-personnel-id="'+esc(personnel.id)+'">'+
      '<div class="teaching-editor-head"><div><strong>รายการสอน</strong><small>เลือกได้เฉพาะรายวิชาและห้องที่อยู่ในโครงสร้างวิชาการ</small></div><button type="button" class="secondary-btn compact-btn" data-add-teaching-row>＋ เพิ่มรายการ</button></div>'+
      '<div class="teaching-editor-rows" data-teaching-rows>'+items.map((it,i)=>teachingWorkloadRowHtml(page,it,i)).join("")+'</div>'+
      '<label class="form-field teaching-workload-note"><span>หมายเหตุภาพรวม</span><textarea name="note" rows="2" placeholder="เว้นว่างได้">'+esc(workload&&workload.note||"")+'</textarea></label>'+
      '<div class="teaching-editor-actions">'+
        (canManage
          ?'<button type="submit" class="primary-btn" data-workload-action="approve">บันทึกและอนุมัติ</button>'
          :'<button type="submit" class="secondary-btn" data-workload-action="draft">บันทึกฉบับร่าง</button><button type="submit" class="primary-btn" data-workload-action="submit">ส่งให้ฝ่ายวิชาการตรวจสอบ</button>')+
      '</div>'+
    '</form>')+
  '</section>';
}
function teachingWorkloadCardsHtml(page){
  const workloads=page.workloads||[],canViewAll=Boolean(page.can_view_all),filter=state.teachingWorkloadStatus||"";
  const visible=workloads.filter(w=>!filter||w.status===filter);
  if(!canViewAll)return "";
  const cards=visible.map(w=>
    '<article class="teaching-workload-card '+(w.status==="submitted"?"needs-review":"")+'" data-workload-card="'+esc(w.id)+'">'+
      '<div class="teaching-workload-card-head"><div><strong>'+esc(w.personnel_name||"-")+'</strong><small>'+esc(w.position_title||"")+(w.academic_standing?' · '+esc(w.academic_standing):'')+'</small></div><span class="pill '+teachingWorkloadStatusClass(w.status)+'">'+esc(teachingWorkloadStatusLabel(w.status))+'</span></div>'+
      workloadItemListHtml(w.items||[])+
      '<div class="teaching-card-footer"><div><small>รวม</small><strong>'+Number(w.total_weekly_periods||0).toLocaleString("th-TH")+' คาบ/สัปดาห์</strong></div><div class="teaching-card-actions">'+
        (page.can_manage&&w.status==="submitted"?'<button type="button" class="secondary-btn compact-btn" data-edit-workload-personnel="'+esc(w.personnel_id)+'">ตรวจ/แก้ไข</button><button type="button" class="danger-outline-btn compact-btn" data-return-workload="'+esc(w.id)+'">ส่งกลับแก้ไข</button><button type="button" class="primary-btn compact-btn" data-approve-workload="'+esc(w.id)+'">อนุมัติ</button>':'')+
        (page.can_manage&&w.status!=="submitted"?'<button type="button" class="secondary-btn compact-btn" data-edit-workload-personnel="'+esc(w.personnel_id)+'">เปิดรายการ</button>':'')+
      '</div></div>'+
      (w.review_note?'<div class="teaching-review-note"><strong>หมายเหตุการตรวจ:</strong> '+esc(w.review_note)+'</div>':'')+
    '</article>'
  ).join("");
  return '<section class="panel teaching-workload-list-panel"><div class="panel-head"><div><p class="eyebrow">TEACHING WORKLOADS</p><h2>ภาระงานสอนของบุคลากร</h2><p class="panel-sub">รายการรอตรวจจะแจ้งเตือนเฉพาะ School Admin และงานวิชาการ</p></div><label class="teaching-status-filter">สถานะ<select data-workload-status-filter><option value="">ทั้งหมด</option>'+["submitted","approved","returned","draft"].map(v=>'<option value="'+v+'" '+(filter===v?"selected":"")+'>'+teachingWorkloadStatusLabel(v)+'</option>').join("")+'</select></label></div>'+
    (cards?'<div class="teaching-workload-stack">'+cards+'</div>':'<div class="empty-state compact-empty"><div class="empty-icon">✓</div><h3>ไม่มีรายการตามสถานะที่เลือก</h3></div>')+
  '</section>';
}
async function academicWorkloadHtml(data){
  const page=await loadTeachingWorkloadPage();
  const year=workloadSelectedYear(page),term=workloadSelectedTerm(page);
  const personnel=page.can_manage
    ?(page.personnel||[]).find(p=>p.id===state.teachingWorkloadPersonnelId)||null
    :page.own_personnel;
  const workload=personnel?(page.workloads||[]).find(w=>w.personnel_id===personnel.id)||null:null;
  const pending=Number(page.stats&&page.stats.submitted||0);
  const approved=Number(page.stats&&page.stats.approved||0);
  const termOptions=year&&year.terms||[];

  return '<section class="academic-page teaching-workload-page">'+academicNavHtml("workload",data)+
    '<section class="panel teaching-workload-overview"><div class="panel-head"><div><p class="eyebrow">TEACHING WORKLOAD</p><h2>ภาระงานสอน</h2><p class="panel-sub">'+(year?'ปีการศึกษา '+esc(year.year_be):'ยังไม่มีปีการศึกษา')+' · เลือกภาคเรียนเพื่อจัดหรือเสนอภาระงานสอน</p></div>'+
      (termOptions.length?'<label class="teaching-term-switch">ภาคเรียน<select data-workload-term>'+termOptions.map(t=>'<option value="'+esc(t.id)+'" '+(page.selected_term_id===t.id?"selected":"")+'>'+esc(t.name||("ภาคเรียนที่ "+t.term_no))+(t.is_current?' · ปัจจุบัน':'')+'</option>').join("")+'</select></label>':'')+
    '</div>'+
      (page.can_view_all?'<div class="teaching-workload-stats"><article><small>รอตรวจสอบ</small><strong>'+pending.toLocaleString("th-TH")+'</strong><span>รายการ</span></article><article><small>อนุมัติแล้ว</small><strong>'+approved.toLocaleString("th-TH")+'</strong><span>รายการ</span></article><article><small>มีภาระงานแล้ว</small><strong>'+Number(page.stats&&page.stats.personnel_with_workload||0).toLocaleString("th-TH")+'</strong><span>คน</span></article></div>':'')+
      (!term?'<div class="notice warning">ปีการศึกษานี้ยังไม่มีภาคเรียน กรุณากำหนดภาคเรียนก่อน</div>':'')+
    '</section>'+
    (page.can_manage&&term?'<section class="panel teaching-personnel-picker"><div><strong>จัดภาระงานโดยฝ่ายวิชาการ</strong><small>เลือกบุคลากรได้แม้ยังไม่ได้เชื่อมบัญชี LAO-EMS</small></div><label>บุคลากร<select data-workload-personnel><option value="">เลือกบุคลากร</option>'+(page.personnel||[]).map(p=>'<option value="'+esc(p.id)+'" '+(personnel&&personnel.id===p.id?"selected":"")+'>'+esc(p.full_name)+(p.position_title?' · '+esc(p.position_title):'')+(p.account_linked?'':' · ยังไม่เชื่อมบัญชี')+'</option>').join("")+'</select></label></section>':'')+
    (term?workloadEditorHtml(page,workload,personnel):'')+
    (term?teachingWorkloadCardsHtml(page):'')+
  '</section>';
}
function bindTeachingWorkloadControls(){
  const page=state.teachingWorkloadData||{};
  const school=currentSchool();

  const termSelect=q("[data-workload-term]");
  if(termSelect)termSelect.addEventListener("change",()=>{
    state.academicTermId=termSelect.value||null;
    state.teachingWorkloadPersonnelId=null;
    state.teachingWorkloadData=null;
    renderRoute();
  });

  const personnelSelect=q("[data-workload-personnel]");
  if(personnelSelect)personnelSelect.addEventListener("change",()=>{
    state.teachingWorkloadPersonnelId=personnelSelect.value||null;
    renderRoute();
  });

  const statusFilter=q("[data-workload-status-filter]");
  if(statusFilter)statusFilter.addEventListener("change",()=>{
    state.teachingWorkloadStatus=statusFilter.value||"";
    renderRoute();
  });

  const rowsBox=q("[data-teaching-rows]");
  function renumberRows(){
    if(!rowsBox)return;
    qa("[data-teaching-row]",rowsBox).forEach((row,i)=>{
      const no=q("[data-teaching-row-no]",row);if(no)no.textContent=String(i+1);
      const remove=q("[data-remove-teaching-row]",row);if(remove)remove.disabled=qa("[data-teaching-row]",rowsBox).length<=1;
    });
  }
  function bindRow(row){
    if(!row||row.dataset.bound==="1")return;
    row.dataset.bound="1";
    const offering=q("[data-teaching-offering]",row),periods=q("[data-teaching-periods]",row),remove=q("[data-remove-teaching-row]",row);
    if(offering)offering.addEventListener("change",()=>{
      const opt=offering.options[offering.selectedIndex];
      if(periods&&!periods.value&&opt&&opt.dataset.periods)periods.value=opt.dataset.periods;
    });
    if(remove)remove.addEventListener("click",()=>{row.remove();renumberRows();});
  }
  if(rowsBox)qa("[data-teaching-row]",rowsBox).forEach(bindRow);
  renumberRows();

  const addRow=q("[data-add-teaching-row]");
  if(addRow&&rowsBox)addRow.addEventListener("click",()=>{
    const wrap=document.createElement("div");
    wrap.innerHTML=teachingWorkloadRowHtml(page,null,qa("[data-teaching-row]",rowsBox).length);
    const row=wrap.firstElementChild;
    rowsBox.appendChild(row);bindRow(row);renumberRows();
    const sel=q("[data-teaching-offering]",row);if(sel)sel.focus();
  });

  const form=q("#teaching-workload-form");
  if(form){
    form.addEventListener("submit",async e=>{
      e.preventDefault();
      const action=e.submitter&&e.submitter.dataset.workloadAction||"draft";
      const rowEls=qa("[data-teaching-row]",form);
      const items=[];
      const seen=new Set();
      for(const row of rowEls){
        const key=String(q("[data-teaching-offering]",row).value||"");
        if(!key){toast("กรุณาเลือกรายวิชาและชั้นเรียนให้ครบ","error");return;}
        if(seen.has(key)){toast("มีรายวิชาและชั้นเรียนซ้ำ กรุณาตรวจรายการ","error");return;}
        seen.add(key);
        const parts=key.split("|");
        const periods=Number(q("[data-teaching-periods]",row).value||0);
        if(!Number.isFinite(periods)||periods<=0){toast("คาบต่อสัปดาห์ต้องมากกว่า 0","error");return;}
        items.push({
          course_id:parts[0],class_section_id:parts[1],weekly_periods:periods,
          teaching_role:q("[data-teaching-role]",row).value||"main",
          notes:String(q("[data-teaching-note]",row).value||"").trim()
        });
      }
      const confirmText=action==="submit"?"ส่งภาระงานสอนให้ฝ่ายวิชาการตรวจสอบ?":action==="approve"?"บันทึกและอนุมัติภาระงานสอนของบุคลากรรายนี้?":null;
      if(confirmText&&!confirm(confirmText))return;
      const btn=e.submitter;setBusy(btn,true,action==="approve"?"กำลังอนุมัติ...":action==="submit"?"กำลังส่ง...":"กำลังบันทึก...");
      const fd=new FormData(form);
      const res=await supabase.rpc("lao_save_teaching_workload",{
        p_school_id:school.id,
        p_workload_id:form.dataset.workloadId||null,
        p_personnel_id:form.dataset.personnelId||null,
        p_term_id:page.selected_term_id||null,
        p_note:String(fd.get("note")||"").trim()||null,
        p_items:items,
        p_action:action
      });
      setBusy(btn,false);
      if(res.error){toast(res.error.message,"error");return;}
      await Promise.all([loadAcademicWorkCounts(),loadNotifications()]);
      refreshHeader();
      toast(action==="approve"?"บันทึกและอนุมัติภาระงานสอนแล้ว":action==="submit"?"ส่งภาระงานสอนให้ฝ่ายวิชาการแล้ว":"บันทึกฉบับร่างแล้ว","success");
      renderRoute();
    });
  }

  qa("[data-edit-workload-personnel]").forEach(btn=>btn.addEventListener("click",()=>{
    state.teachingWorkloadPersonnelId=btn.dataset.editWorkloadPersonnel||null;
    renderRoute();
    setTimeout(()=>{const editor=q("#teaching-workload-editor");if(editor)editor.scrollIntoView({behavior:"smooth",block:"start"});},120);
  }));

  qa("[data-approve-workload]").forEach(btn=>btn.addEventListener("click",async()=>{
    if(!confirm("ยืนยันอนุมัติภาระงานสอนรายการนี้?"))return;
    setBusy(btn,true,"กำลังอนุมัติ...");
    const res=await supabase.rpc("lao_review_teaching_workload",{p_workload_id:btn.dataset.approveWorkload,p_decision:"approved",p_review_note:null});
    setBusy(btn,false);
    if(res.error){toast(res.error.message,"error");return;}
    await Promise.all([loadAcademicWorkCounts(),loadNotifications()]);refreshHeader();
    toast("อนุมัติภาระงานสอนแล้ว","success");renderRoute();
  }));

  qa("[data-return-workload]").forEach(btn=>btn.addEventListener("click",async()=>{
    const note=prompt("ระบุสิ่งที่ต้องแก้ไขก่อนส่งกลับ");
    if(note===null)return;
    if(!String(note).trim()){toast("กรุณาระบุสิ่งที่ต้องแก้ไข","error");return;}
    setBusy(btn,true,"กำลังส่งกลับ...");
    const res=await supabase.rpc("lao_review_teaching_workload",{p_workload_id:btn.dataset.returnWorkload,p_decision:"returned",p_review_note:String(note).trim()});
    setBusy(btn,false);
    if(res.error){toast(res.error.message,"error");return;}
    await Promise.all([loadAcademicWorkCounts(),loadNotifications()]);refreshHeader();
    toast("ส่งกลับให้แก้ไขแล้ว","success");renderRoute();
  }));
}

async function academicsHtml(){
  const school=currentSchool();
  if(!school)return '<section class="panel"><div class="empty-state"><div class="empty-icon">🏫</div><h3>เลือกสถานศึกษาก่อน</h3><p>เลือกโรงเรียนเพื่อเปิดงานวิชาการ</p></div></section>';
  if(!canViewAcademic())return '<section class="panel"><div class="empty-state"><div class="empty-icon">🔒</div><h3>ไม่มีสิทธิ์ดูงานวิชาการ</h3></div></section>';
  let data=await loadAcademicStructure();
  const mode=academicRouteState().mode;
  if(mode==="periods")return academicPeriodsHtml(data);
  if(mode==="programs"){
    const timeline=await loadDepartmentSetupTimeline("academics");
    return academicProgramsHtml(data,timeline);
  }
  if(mode==="classes")return academicClassesHtml(data);
  if(mode==="subjects"){
    await Promise.all([loadAcademicCurriculumPreset(data,state.subjectProgramId),loadAcademicCourseTimeOverview(data)]);
    const readyRes=await supabase.rpc("lao_curriculum_readiness",{
      p_school_id:school.id,
      p_academic_year_id:data.selected_year_id
    });
    state.curriculumReadiness=readyRes.error?null:(readyRes.data||null);
    const classes=(data.classes||[]).filter(x=>x.source_type==="lec"&&x.is_active!==false);
    const targetProgram=state.subjectProgramId||null;
    const targetClasses=classes.filter(c=>targetProgram?c.program_id===targetProgram:!c.program_id);
    const supported=new Set((state.academicPreset?.supported_grades||[]).map(g=>g.grade_code));
    const gradeCodes=Array.from(new Set(targetClasses.map(c=>c.grade_code||academicGradeCode(c.grade_label)).filter(code=>supported.has(code))));
    if(!gradeCodes.includes(state.academicPresetGrade))state.academicPresetGrade=gradeCodes[0]||"";
    if(state.academicPresetGrade){
      const wsRes=await supabase.rpc("lao_subject_workspace",{
        p_school_id:school.id,
        p_academic_year_id:data.selected_year_id,
        p_program_id:targetProgram,
        p_grade_code:state.academicPresetGrade
      });
      state.subjectWorkspaceData=wsRes.error?null:(wsRes.data||null);
    }else{
      state.subjectWorkspaceData=null;
    }
    const timeline=await loadDepartmentSetupTimeline("academics");
    return academicSubjectsHtml(data,timeline);
  }
  if(mode==="curriculum"){
    const [timeOverview,readyRes]=await Promise.all([
      loadAcademicCourseTimeOverview(data),
      supabase.rpc("lao_curriculum_readiness",{p_school_id:school.id,p_academic_year_id:data.selected_year_id})
    ]);
    state.curriculumReadiness=readyRes.error?null:(readyRes.data||null);
    return academicCurriculumHtml(data);
  }
  if(mode==="workload")return await academicWorkloadHtml(data);
  return await academicDashboardHtml(data);
}
function academicSetFormValue(form,name,value){
  const el=form&&form.elements&&form.elements[name];
  if(!el)return;
  if(el.type==="checkbox")el.checked=Boolean(value);
  else if(el.matches&&el.matches("[data-be-date-value]"))setBuddhistDateControlValue(el.closest("[data-be-date-control]"),value==null?"":String(value),false);
  else el.value=value==null?"":String(value);
}
function academicResetForm(form,titleSelector,title){
  if(!form)return;
  form.reset();
  refreshBuddhistDatePickers(form);
  form.dataset.id="";
  const h=q(titleSelector);
  if(h)h.textContent=title;
}
function academicScrollToForm(form){
  if(!form)return;
  form.scrollIntoView({behavior:"smooth",block:"center"});
}
function bindAcademics(){
  bindDepartmentSetupTimeline();
  const data=state.academicData||{};
  const school=currentSchool();
  bindTeachingWorkloadControls();
  const yearSelect=q("[data-academic-year-select]");
  if(yearSelect)yearSelect.addEventListener("change",()=>{
    state.academicYearId=yearSelect.value||null;
    state.academicTermId=null;
    state.teachingWorkloadData=null;
    state.teachingWorkloadPersonnelId=null;
    state.academicFilters={grade_label:"",program_id:""};
    state.subjectEditMode=false;
    state.subjectCopyYearId="";
    renderRoute();
  });

  const yearForm=q("#academic-year-form");
  const yearPanel=q("[data-year-form-panel]");
  const termPanel=q("[data-term-form-panel]");
  const showAcademicPeriodPanel=(panel)=>{
    if(yearPanel)yearPanel.classList.toggle("hidden",panel!=="year");
    if(termPanel)termPanel.classList.toggle("hidden",panel!=="term");
  };
  const prepareNewYear=()=>{
    academicResetForm(yearForm,"[data-year-form-title]","เพิ่มปีการศึกษา");
    if(yearForm){
      const maxYear=Math.max(0,...(data.years||[]).map(y=>Number(y.year_be)||0));
      const currentBe=new Date().getFullYear()+543;
      academicSetFormValue(yearForm,"year_be",Math.max(maxYear?maxYear+1:0,currentBe));
      academicSetFormValue(yearForm,"is_current",false);
      yearForm.dataset.autoEnd="true";
      academicScrollToForm(yearForm);
    }
  };
  if(yearForm){
    const startInput=yearForm.elements.namedItem("starts_on");
    const endInput=yearForm.elements.namedItem("ends_on");
    if(startInput&&endInput){
      startInput.addEventListener("change",()=>{
        if(yearForm.dataset.id)return;
        if(yearForm.dataset.autoEnd!=="false")setBuddhistDateControlValue(endInput.closest("[data-be-date-control]"),academicEndDateAfter200Weekdays(startInput.value),false);
      });
      endInput.addEventListener("change",()=>{
        if(!yearForm.dataset.id)yearForm.dataset.autoEnd="false";
      });
    }
  }
  qa("[data-new-year-form]").forEach(btn=>btn.addEventListener("click",()=>{
    prepareNewYear();
    showAcademicPeriodPanel("year");
  }));
  qa("[data-reset-year-form]").forEach(btn=>btn.addEventListener("click",()=>{
    prepareNewYear();
    showAcademicPeriodPanel("year");
  }));
  qa("[data-edit-year]").forEach(btn=>btn.addEventListener("click",()=>{
    const y=(data.years||[]).find(x=>x.id===btn.dataset.editYear);if(!y||!yearForm)return;
    showAcademicPeriodPanel("year");
    yearForm.dataset.id=y.id;
    yearForm.dataset.autoEnd="false";
    academicSetFormValue(yearForm,"year_be",y.year_be);
    academicSetFormValue(yearForm,"starts_on",y.starts_on);
    academicSetFormValue(yearForm,"ends_on",y.ends_on);
    academicSetFormValue(yearForm,"is_current",y.is_current);
    const h=q("[data-year-form-title]");if(h)h.textContent="แก้ไขปีการศึกษา "+y.year_be;
    academicScrollToForm(yearForm);
  }));
  if(yearForm)yearForm.addEventListener("submit",async e=>{
    e.preventDefault();
    const fd=new FormData(yearForm),btn=yearForm.querySelector('button[type="submit"]');
    setBusy(btn,true,"กำลังบันทึก...");
    const res=await supabase.rpc("lao_save_academic_year",{
      p_school_id:school.id,
      p_academic_year_id:yearForm.dataset.id||null,
      p_year_be:Number(fd.get("year_be")),
      p_starts_on:String(fd.get("starts_on")||"")||null,
      p_ends_on:String(fd.get("ends_on")||"")||null,
      p_is_current:fd.get("is_current")==="on"
    });
    setBusy(btn,false);
    if(res.error){toast(res.error.message,"error");return;}
    if(!yearForm.dataset.id)state.academicYearId=res.data&&res.data.id||state.academicYearId;
    toast(yearForm.dataset.id?"บันทึกปีการศึกษาแล้ว · เติมช่วงภาคเรียนที่ยังว่างเป็น 100 วันเรียน":"บันทึกปีการศึกษาแล้ว · สร้างภาคเรียนที่ 1–2 ภาคเรียนละ 100 วันเรียน","success");renderRoute();
  });

  const termForm=q("#academic-term-form");
  const resetTerm=()=>{
    academicResetForm(termForm,"[data-term-form-title]","เพิ่ม/แก้ไขภาคเรียน");
    if(termForm){
      termForm.dataset.autoEnd="true";
      if(data.selected_year_id)academicSetFormValue(termForm,"academic_year_id",data.selected_year_id);
    }
  };
  if(termForm){
    const termStart=termForm.elements.namedItem("starts_on");
    const termEnd=termForm.elements.namedItem("ends_on");
    if(termStart&&termEnd){
      termStart.addEventListener("change",()=>{
        if(termForm.dataset.autoEnd!=="false"&&termStart.value){
          setBuddhistDateControlValue(termEnd.closest("[data-be-date-control]"),academicEndDateAfter100Weekdays(termStart.value),false);
        }
      });
      termEnd.addEventListener("change",()=>{termForm.dataset.autoEnd="false";});
    }
  }
  qa("[data-reset-term-form]").forEach(btn=>btn.addEventListener("click",()=>{resetTerm();showAcademicPeriodPanel("term");academicScrollToForm(termForm);}));
  qa("[data-add-term]").forEach(btn=>btn.addEventListener("click",()=>{
    const y=(data.years||[]).find(x=>x.id===btn.dataset.addTerm);if(!y||!termForm)return;
    resetTerm();
    const used=new Set((y.terms||[]).map(t=>Number(t.term_no)));
    const next=[1,2,3,4].find(n=>!used.has(n))||1;
    showAcademicPeriodPanel("term");
    academicSetFormValue(termForm,"academic_year_id",y.id);
    academicSetFormValue(termForm,"term_no",next);
    academicSetFormValue(termForm,"name","ภาคเรียนที่ "+next);
    academicSetFormValue(termForm,"is_current",false);
    const h=q("[data-term-form-title]");if(h)h.textContent="เพิ่มภาคเรียน ปีการศึกษา "+y.year_be;
    academicScrollToForm(termForm);
  }));
  qa("[data-edit-term]").forEach(btn=>btn.addEventListener("click",()=>{
    const y=(data.years||[]).find(x=>x.id===btn.dataset.yearId);
    const t=y&&(y.terms||[]).find(x=>x.id===btn.dataset.editTerm);if(!t||!termForm)return;
    showAcademicPeriodPanel("term");
    termForm.dataset.id=t.id;
    termForm.dataset.autoEnd=t.ends_on?"false":"true";
    academicSetFormValue(termForm,"academic_year_id",y.id);
    academicSetFormValue(termForm,"term_no",t.term_no);
    academicSetFormValue(termForm,"name",t.name);
    academicSetFormValue(termForm,"starts_on",t.starts_on);
    academicSetFormValue(termForm,"ends_on",t.ends_on);
    if(t.starts_on&&!t.ends_on){
      const termEnd=termForm.elements.namedItem("ends_on");
      if(termEnd)setBuddhistDateControlValue(termEnd.closest("[data-be-date-control]"),academicEndDateAfter100Weekdays(t.starts_on),false);
    }
    academicSetFormValue(termForm,"is_current",t.is_current);
    const h=q("[data-term-form-title]");if(h)h.textContent="แก้ไข "+(t.name||("ภาคเรียนที่ "+t.term_no));
    academicScrollToForm(termForm);
  }));
  if(termForm)termForm.addEventListener("submit",async e=>{
    e.preventDefault();
    const fd=new FormData(termForm),btn=termForm.querySelector('button[type="submit"]');
    setBusy(btn,true,"กำลังบันทึก...");
    const res=await supabase.rpc("lao_save_term",{
      p_school_id:school.id,p_term_id:termForm.dataset.id||null,
      p_academic_year_id:String(fd.get("academic_year_id")||"")||null,
      p_term_no:Number(fd.get("term_no")),
      p_name:String(fd.get("name")||"").trim()||null,
      p_starts_on:String(fd.get("starts_on")||"")||null,
      p_ends_on:String(fd.get("ends_on")||"")||null,
      p_is_current:fd.get("is_current")==="on"
    });
    setBusy(btn,false);
    if(res.error){toast(res.error.message,"error");return;}
    toast("บันทึกภาคเรียนแล้ว","success");renderRoute();
  });

  const safeDeletePanel=q("[data-academic-safe-delete-panel]");
  const academicDeleteBlockerLabels={
    student_enrollments:"ข้อมูลนักเรียน/การลงทะเบียน",
    lec_batches:"ชุดนำเข้า LEC",
    student_activities:"กิจกรรมรายนักเรียน",
    class_sections:"ชั้น/ห้อง",
    curriculum_courses:"โครงสร้างรายวิชา",
    teaching_workloads:"ภาระงานสอน",
    schedule_settings:"การตั้งค่าเวลาเรียน",
    default_initializations:"ข้อมูลตั้งต้นหลักสูตร",
    grade_initializations:"ข้อมูลตั้งต้นระดับชั้น",
    program_exclusions:"ข้อยกเว้นรายวิชา",
    structure_confirmations:"การยืนยันโครงสร้าง",
    parallel_groups:"กลุ่มรายวิชาทางเลือก",
    course_term_plans:"แผนเวลาเรียนรายภาค"
  };
  const academicInlineCleanupKeys=new Set([
    "schedule_settings",
    "default_initializations",
    "grade_initializations",
    "program_exclusions",
    "structure_confirmations",
    "parallel_groups"
  ]);
  const academicDeletePreviewHtml=(p,kind)=>{
    const blockers=Object.entries(p.blockers||{}).filter(([,count])=>Number(count||0)>0);
    const title=kind==="year"?"ลบปีการศึกษา "+p.year_be:"ลบ "+(p.name||("ภาคเรียนที่ "+p.term_no))+" · ปีการศึกษา "+p.year_be;
    if(!p.can_delete){
      const cleanable=kind==="year"?blockers.filter(([key])=>academicInlineCleanupKeys.has(key)):[];
      const protectedBlockers=blockers.filter(([key])=>!academicInlineCleanupKeys.has(key));
      const cleanupPhrase=kind==="year"?"ลบข้อมูลเชื่อมโยงปี "+p.year_be:"";
      const cleanupHtml=cleanable.length
        ?'<div class="academic-linked-cleanup"><div class="academic-linked-cleanup-head"><strong>ต้องการลบส่วนที่เชื่อมโยงด้วยหรือไม่?</strong><span>เลือกได้เฉพาะข้อมูลตั้งค่าที่ระบบอนุญาตให้ลบจากหน้านี้</span></div><div class="academic-linked-cleanup-options">'+cleanable.map(([key,count])=>'<label><input type="checkbox" value="'+esc(key)+'" data-linked-cleanup-category checked><span>'+esc(academicDeleteBlockerLabels[key]||key)+' <b>'+Number(count).toLocaleString("th-TH")+' รายการ</b></span></label>').join("")+'</div><div class="academic-linked-cleanup-safe-note">ข้อมูลนักเรียน, LEC, ชั้น/ห้อง, โครงสร้างรายวิชา และภาระงานสอนจะไม่ถูกลบจากขั้นตอนนี้</div><label class="academic-delete-confirm-label">พิมพ์ข้อความยืนยัน<input type="text" autocomplete="off" data-linked-cleanup-confirm placeholder="'+esc(cleanupPhrase)+'"></label><div class="academic-delete-phrase">พิมพ์: <strong>'+esc(cleanupPhrase)+'</strong></div><button type="button" class="danger-btn" data-run-linked-cleanup disabled>ลบข้อมูลเชื่อมโยงที่เลือก</button></div>'
        :'';
      const protectedHtml=protectedBlockers.length?'<div class="academic-linked-protected"><strong>ข้อมูลที่ต้องจัดการจากโมดูลต้นทาง</strong><span>'+protectedBlockers.map(([key,count])=>esc(academicDeleteBlockerLabels[key]||key)+' '+Number(count).toLocaleString("th-TH")+' รายการ').join(" · ")+'</span></div>':'';
      return '<div class="academic-delete-preview is-blocked"><div class="academic-delete-preview-head"><div><strong>ยังไม่อนุญาตให้ลบปี/ภาคเรียน</strong><h3>'+esc(title)+'</h3></div><span class="pill danger">ป้องกันข้อมูล</span></div><p>พบข้อมูลที่เชื่อมโยงกับรายการนี้ ระบบจะไม่ลบปีหรือภาคเรียนจนกว่าจะจัดการข้อมูลที่เชื่อมโยงก่อน</p><div class="academic-delete-blockers">'+blockers.map(([key,count])=>'<span><b>'+Number(count).toLocaleString("th-TH")+'</b> '+esc(academicDeleteBlockerLabels[key]||key)+'</span>').join("")+'</div>'+(kind==="year"&&Number((p.blockers||{}).student_enrollments||0)>0?'<div class="notice warning"><strong>หากเป็นข้อมูลนักเรียนทดลอง</strong><br>ไปที่หน้า “นักเรียน” แล้วใช้ “จัดการข้อมูลนักเรียนรายปี” ล้างข้อมูลของปีนี้ก่อน จากนั้นกลับมาตรวจสอบการลบปีอีกครั้ง</div>':'')+protectedHtml+cleanupHtml+'<div class="academic-delete-actions"><button type="button" class="secondary-btn" data-close-academic-delete>ปิด</button></div></div>';
    }
    const extra=kind==="year"&&Number(p.term_count||0)>0?'<p class="academic-delete-note">ภาคเรียนที่ว่างอยู่ '+Number(p.term_count).toLocaleString("th-TH")+' รายการจะถูกลบพร้อมปีการศึกษา</p>':'';
    return '<div class="academic-delete-preview is-safe"><div class="academic-delete-preview-head"><div><strong>ตรวจสอบแล้ว ลบได้</strong><h3>'+esc(title)+'</h3></div><span class="pill success">ไม่มีข้อมูลเชื่อมโยง</span></div><p>ระบบตรวจแล้วว่าไม่มีข้อมูลสำคัญเชื่อมโยงกับรายการนี้</p>'+extra+'<label class="academic-delete-ack"><input type="checkbox" data-academic-delete-ack><span>ฉันตรวจสอบแล้วและต้องการลบรายการนี้</span></label><label class="academic-delete-confirm-label">พิมพ์ข้อความยืนยัน<input type="text" autocomplete="off" data-academic-delete-confirm placeholder="'+esc(p.confirmation_text||"")+'"></label><div class="academic-delete-phrase">พิมพ์: <strong>'+esc(p.confirmation_text||"")+'</strong></div><div class="academic-delete-actions"><button type="button" class="secondary-btn" data-close-academic-delete>ยกเลิก</button><button type="button" class="danger-btn" data-run-academic-delete disabled>ลบอย่างถาวร</button></div></div>';
  };
  const bindAcademicDeletePanel=(p,kind,id)=>{
    if(!safeDeletePanel)return;
    const close=q("[data-close-academic-delete]",safeDeletePanel);
    if(close)close.addEventListener("click",()=>{safeDeletePanel.classList.add("hidden");safeDeletePanel.innerHTML="";});

    const cleanupChecks=qa("[data-linked-cleanup-category]",safeDeletePanel);
    const cleanupInput=q("[data-linked-cleanup-confirm]",safeDeletePanel);
    const cleanupRun=q("[data-run-linked-cleanup]",safeDeletePanel);
    if(cleanupRun&&cleanupInput&&kind==="year"){
      const cleanupPhrase="ลบข้อมูลเชื่อมโยงปี "+p.year_be;
      const syncCleanup=()=>{
        const selected=cleanupChecks.some(x=>x.checked);
        cleanupRun.disabled=!(selected&&cleanupInput.value.trim()===cleanupPhrase);
      };
      cleanupChecks.forEach(x=>x.addEventListener("change",syncCleanup));
      cleanupInput.addEventListener("input",syncCleanup);
      cleanupRun.addEventListener("click",async()=>{
        if(cleanupRun.disabled)return;
        const categories=cleanupChecks.filter(x=>x.checked).map(x=>x.value);
        setBusy(cleanupRun,true,"กำลังลบข้อมูลเชื่อมโยง...");
        try{
          const res=await supabase.rpc("lao_clear_academic_year_linked_settings_safe",{
            p_school_id:school.id,
            p_academic_year_id:id,
            p_categories:categories,
            p_confirmation:cleanupInput.value.trim()
          });
          if(res.error)throw res.error;
          const out=res.data||{};
          const next=out.preview||{};
          safeDeletePanel.innerHTML=academicDeletePreviewHtml(next,"year");
          bindAcademicDeletePanel(next,"year",id);
          toast("ลบข้อมูลเชื่อมโยงที่เลือกแล้ว ระบบตรวจสอบสถานะใหม่เรียบร้อย","success");
        }catch(err){
          toast(err.message||"ลบข้อมูลเชื่อมโยงไม่สำเร็จ","error");
          setBusy(cleanupRun,false);
        }
      });
      syncCleanup();
    }

    if(!p.can_delete)return;
    const ack=q("[data-academic-delete-ack]",safeDeletePanel);
    const input=q("[data-academic-delete-confirm]",safeDeletePanel);
    const run=q("[data-run-academic-delete]",safeDeletePanel);
    const phrase=String(p.confirmation_text||"");
    const sync=()=>{if(run)run.disabled=!(ack&&ack.checked&&input&&input.value.trim()===phrase);};
    if(ack)ack.addEventListener("change",sync);
    if(input)input.addEventListener("input",sync);
    if(run)run.addEventListener("click",async()=>{
      if(run.disabled)return;
      setBusy(run,true,"กำลังลบ...");
      try{
        const rpc=kind==="year"?"lao_delete_academic_year_safe":"lao_delete_term_safe";
        const params=kind==="year"
          ?{p_school_id:school.id,p_academic_year_id:id,p_confirmation:input.value.trim()}
          :{p_school_id:school.id,p_term_id:id,p_confirmation:input.value.trim()};
        const res=await supabase.rpc(rpc,params);
        if(res.error)throw res.error;
        state.academicData=null;
        state.academicYearId=null;
        state.academicTermId=null;
        state.teachingWorkloadData=null;
        state.subjectWorkspaceData=null;
        state.curriculumReadiness=null;
        toast(kind==="year"?"ลบปีการศึกษาแล้ว":"ลบภาคเรียนแล้ว","success");
        renderRoute();
      }catch(err){
        toast(err.message||"ลบข้อมูลไม่สำเร็จ","error");
        setBusy(run,false);
      }
    });
  };
  const openAcademicDeletePreview=async(kind,id,button)=>{
    if(!safeDeletePanel||!school||!id)return;
    safeDeletePanel.classList.remove("hidden");
    safeDeletePanel.innerHTML='<div class="academic-delete-loading"><span class="spinner"></span>กำลังตรวจสอบข้อมูลเชื่อมโยง...</div>';
    safeDeletePanel.scrollIntoView({behavior:"smooth",block:"center"});
    setBusy(button,true,"กำลังตรวจ...");
    try{
      const rpc=kind==="year"?"lao_academic_year_delete_preview":"lao_term_delete_preview";
      const params=kind==="year"
        ?{p_school_id:school.id,p_academic_year_id:id}
        :{p_school_id:school.id,p_term_id:id};
      const res=await supabase.rpc(rpc,params);
      if(res.error)throw res.error;
      const p=res.data||{};
      safeDeletePanel.innerHTML=academicDeletePreviewHtml(p,kind);
      bindAcademicDeletePanel(p,kind,id);
    }catch(err){
      safeDeletePanel.innerHTML='<div class="notice danger"><strong>ตรวจสอบการลบไม่ได้</strong><br>'+esc(err.message||"เกิดข้อผิดพลาด")+'</div><div class="academic-delete-actions"><button type="button" class="secondary-btn" data-close-academic-delete>ปิด</button></div>';
      const close=q("[data-close-academic-delete]",safeDeletePanel);
      if(close)close.addEventListener("click",()=>{safeDeletePanel.classList.add("hidden");safeDeletePanel.innerHTML="";});
      toast(err.message||"ตรวจสอบการลบไม่สำเร็จ","error");
    }finally{
      setBusy(button,false);
    }
  };
  qa("[data-safe-delete-year]").forEach(btn=>btn.addEventListener("click",()=>openAcademicDeletePreview("year",btn.dataset.safeDeleteYear,btn)));
  qa("[data-safe-delete-term]").forEach(btn=>btn.addEventListener("click",()=>openAcademicDeletePreview("term",btn.dataset.safeDeleteTerm,btn)));

  const programForm=q("#academic-program-form");
  const programPanel=q("[data-program-form-panel]");
  const resetProgram=()=>academicResetForm(programForm,"[data-program-form-title]","เพิ่มโปรแกรมพิเศษ");
  const showProgramForm=()=>{
    if(programPanel)programPanel.classList.remove("hidden");
    academicScrollToForm(programForm);
  };
  qa("[data-new-program-form]").forEach(btn=>btn.addEventListener("click",()=>{
    resetProgram();
    showProgramForm();
  }));
  qa("[data-program-general-only]").forEach(btn=>btn.addEventListener("click",async()=>{
    if(!school)return;
    setBusy(btn,true,"กำลังบันทึก...");
    const res=await supabase.rpc("lao_update_department_setup_step",{
      p_school_id:school.id,
      p_department_code:"academics",
      p_step_code:"programs",
      p_action:"skip"
    });
    setBusy(btn,false);
    if(res.error){toast(res.error.message,"error");return;}
    toast("บันทึกแล้ว: ใช้ห้องปกติ / ไม่มีโปรแกรมพิเศษ","success");
    renderRoute();
  }));
  qa("[data-reset-program-form]").forEach(btn=>btn.addEventListener("click",()=>{resetProgram();showProgramForm();}));
  qa("[data-edit-program]").forEach(btn=>btn.addEventListener("click",()=>{
    const p=(data.programs||[]).find(x=>x.id===btn.dataset.editProgram);if(!p||!programForm)return;
    programForm.dataset.id=p.id;
    ["code","name_th","name_en"].forEach(k=>academicSetFormValue(programForm,k,p[k]));
    const h=q("[data-program-form-title]");if(h)h.textContent="แก้ไข "+p.name_th;
    showProgramForm();
  }));
  if(programForm)programForm.addEventListener("submit",async e=>{
    e.preventDefault();
    const fd=new FormData(programForm),btn=programForm.querySelector('button[type="submit"]');
    const currentProgram=(data.programs||[]).find(x=>x.id===programForm.dataset.id)||null;
    setBusy(btn,true,"กำลังบันทึก...");
    const res=await supabase.rpc("lao_save_academic_program",{
      p_school_id:school.id,p_program_id:programForm.dataset.id||null,
      p_code:String(fd.get("code")||"").trim()||null,
      p_name_th:String(fd.get("name_th")||"").trim(),
      p_name_en:String(fd.get("name_en")||"").trim()||null,
      p_description:currentProgram&&currentProgram.description||null,
      p_is_active:currentProgram?currentProgram.is_active:true,
      p_sort_order:currentProgram?Number(currentProgram.sort_order||0):0
    });
    setBusy(btn,false);
    if(res.error){toast(res.error.message,"error");return;}
    toast("บันทึกโปรแกรมพิเศษแล้ว","success");renderRoute();
  });

  qa("[data-class-stage-tab]").forEach(btn=>btn.addEventListener("click",()=>{
    state.classStageFilter=btn.dataset.classStageTab||"";
    renderRoute();
  }));

  const classProgramSwitch=q("[data-class-program-edit-switch]");
  const classProgramWarning=q("[data-class-program-edit-warning]");
  const classProgramLabel=q("[data-class-program-edit-label]");
  const classProgramSelects=qa("[data-class-program-select]");
  const setClassProgramEditMode=enabled=>{
    classProgramSelects.forEach(sel=>{sel.disabled=!enabled;});
    if(classProgramWarning)classProgramWarning.classList.toggle("hidden",!enabled);
    if(classProgramLabel)classProgramLabel.textContent=enabled?"เปิด":"ปิด";
    q(".academic-page")?.classList.toggle("class-program-editing",enabled);
  };
  if(classProgramSwitch){
    classProgramSwitch.checked=Boolean(state.classProgramEditMode);
    setClassProgramEditMode(Boolean(state.classProgramEditMode));
    classProgramSwitch.addEventListener("change",()=>{
      state.classProgramEditMode=classProgramSwitch.checked;
      setClassProgramEditMode(state.classProgramEditMode);
    });
  }
  classProgramSelects.forEach(sel=>sel.addEventListener("change",async()=>{
    if(!classProgramSwitch||!classProgramSwitch.checked){
      sel.value=sel.dataset.lastValue||sel.value;
      return;
    }
    const classId=sel.dataset.classProgramSelect;
    const c=(data.classes||[]).find(x=>x.id===classId&&x.source_type==="lec");
    if(!c)return;
    const oldValue=c.program_id||"";
    const newValue=String(sel.value||"");
    if(newValue===oldValue)return;
    sel.disabled=true;
    const status=q('[data-class-save-status="'+CSS.escape(classId)+'"]');
    if(status){status.textContent="กำลังบันทึก...";status.className="saving";}
    const res=await supabase.rpc("lao_assign_class_program",{
      p_school_id:school.id,
      p_class_section_id:classId,
      p_program_id:newValue||null
    });
    if(res.error){
      sel.value=oldValue;
      sel.disabled=false;
      if(status){status.textContent="บันทึกไม่สำเร็จ";status.className="error";}
      toast(res.error.message,"error");
      return;
    }
    const program=(data.programs||[]).find(p=>p.id===newValue);
    c.program_id=newValue||null;
    c.program_name=program?program.name_th:null;
    if(status){status.textContent="บันทึกแล้ว"+(program?" · "+program.name_th:" · ห้องปกติ");status.className="saved";}
    toast("บันทึกแล้ว · "+shortGrade(c.grade_label)+"/"+c.section_label+" → "+(program?program.name_th:"ห้องปกติ"),"success");
    setTimeout(()=>renderRoute(),450);
  }));

  qa("[data-subject-setup-tab]").forEach(btn=>btn.addEventListener("click",()=>{
    state.subjectSetupTab=btn.dataset.subjectSetupTab||"target";
    renderRoute();
  }));
  qa("[data-subject-context-grade]").forEach(btn=>btn.addEventListener("click",()=>{
    const gradeCode=btn.dataset.subjectContextGrade||"";
    state.academicPresetGrade=gradeCode;
    state.academicFilters={
      grade_label:academicGradeLabelFromCode(gradeCode),
      program_id:state.subjectProgramId||""
    };
    state.subjectWorkspaceData=null;
    state.subjectEditMode=false;
    state.subjectParallelSelectionMode=false;
    renderRoute();
  }));
  qa("[data-subject-target]").forEach(btn=>btn.addEventListener("click",()=>{
    state.subjectProgramId=btn.dataset.subjectTarget||"";
    state.academicFilters={
      grade_label:"",
      program_id:state.subjectProgramId||""
    };
    state.subjectWorkspaceData=null;
    state.academicPreset=null;
    state.subjectEditMode=false;
    state.subjectParallelSelectionMode=false;
    renderRoute();
  }));
  qa("[data-subject-catalog-scope]").forEach(btn=>btn.addEventListener("click",()=>{
    state.subjectCatalogScope=btn.dataset.subjectCatalogScope||"all";
    state.subjectSetupTab="type";
    state.subjectWorkspaceView="library";
    state.subjectParallelSelectionMode=false;
    renderRoute();
  }));
  qa("[data-subject-workspace-view]").forEach(btn=>btn.addEventListener("click",()=>{
    state.subjectWorkspaceView=btn.dataset.subjectWorkspaceView||"selected";
    state.subjectParallelSelectionMode=false;
    renderRoute();
  }));
  qa("[data-open-subject-library]").forEach(btn=>btn.addEventListener("click",()=>{
    state.subjectWorkspaceView="library";
    state.subjectParallelSelectionMode=false;
    renderRoute();
  }));
  const subjectFinder=q("#subject-finder-panel");
  const customSubjectForm=q("#subject-library-custom-form");
  const openSubjectFinder=()=>{
    if(!subjectFinder)return;
    subjectFinder.classList.remove("hidden");
    customSubjectForm?.classList.add("hidden");
    subjectFinder.querySelector('input[name="query"]')?.focus();
  };
  qa("[data-open-subject-finder]").forEach(btn=>btn.addEventListener("click",openSubjectFinder));
  qa("[data-close-subject-finder]").forEach(btn=>btn.addEventListener("click",()=>subjectFinder?.classList.add("hidden")));
  qa("[data-show-create-subject]").forEach(btn=>btn.addEventListener("click",()=>{
    subjectFinder?.classList.add("hidden");
    customSubjectForm?.classList.remove("hidden");
    customSubjectForm?.querySelector('input[name="subject_name"]')?.focus();
  }));
  qa("[data-back-to-subject-search]").forEach(btn=>btn.addEventListener("click",openSubjectFinder));

  const subjectEditSwitch=q("[data-subject-edit-switch]");
  if(subjectEditSwitch)subjectEditSwitch.addEventListener("change",()=>{
    state.subjectEditMode=subjectEditSwitch.checked;
    if(!state.subjectEditMode)state.subjectParallelSelectionMode=false;
    renderRoute();
  });

  const subjectCopyYear=q("[data-subject-copy-year]");
  if(subjectCopyYear)subjectCopyYear.addEventListener("change",()=>{
    state.subjectCopyYearId=subjectCopyYear.value||"";
  });

  const copySubjectYear=q("[data-copy-subject-year]");
  if(copySubjectYear)copySubjectYear.addEventListener("click",async()=>{
    if(!state.subjectEditMode){toast("กรุณาเปิดสวิตช์การแก้ไขก่อน","error");return;}
    const sourceYear=(data.years||[]).find(y=>y.id===state.subjectCopyYearId);
    const targetYear=(data.years||[]).find(y=>y.id===data.selected_year_id);
    if(!sourceYear||!targetYear){toast("กรุณาเลือกปีการศึกษาต้นทาง","error");return;}
    const gradeLabel=academicGradeLabelFromCode(state.academicPresetGrade||"");
    const targetProgram=(data.programs||[]).find(p=>p.id===state.subjectProgramId)||null;
    const contextLabel=shortGrade(gradeLabel)+" · "+(targetProgram?targetProgram.name_th:"ห้องปกติ");
    if(!confirm("คัดลอกรายวิชา "+contextLabel+" จากปีการศึกษา "+sourceYear.year_be+" มาใช้ในปี "+targetYear.year_be+" ?\n\nระบบจะผสานกับรายการเดิม ไม่ลบวิชาที่มีอยู่"))return;
    setBusy(copySubjectYear,true,"กำลังคัดลอก...");
    const res=await supabase.rpc("lao_copy_curriculum_group_from_year",{
      p_school_id:school.id,
      p_source_academic_year_id:sourceYear.id,
      p_target_academic_year_id:targetYear.id,
      p_program_id:state.subjectProgramId||null,
      p_grade_code:state.academicPresetGrade||""
    });
    setBusy(copySubjectYear,false);
    if(res.error){toast(res.error.message,"error");return;}
    const x=res.data||{};
    toast("คัดลอกจากปี "+sourceYear.year_be+" แล้ว · เพิ่ม "+Number(x.inserted_courses||0)+" · อัปเดต "+Number(x.updated_courses||0)+" รายการ","success");
    refreshSubjects();
  });

  const scheduleForm=q("[data-schedule-settings-form]");
  const showScheduleForm=()=>scheduleForm?.classList.remove("hidden");
  qa("[data-toggle-schedule-settings]").forEach(btn=>btn.addEventListener("click",showScheduleForm));
  qa("[data-close-schedule-settings]").forEach(btn=>btn.addEventListener("click",()=>scheduleForm?.classList.add("hidden")));
  if(scheduleForm)scheduleForm.addEventListener("submit",async e=>{
    e.preventDefault();
    const fd=new FormData(scheduleForm),btn=scheduleForm.querySelector('button[type="submit"]');
    setBusy(btn,true,"กำลังบันทึก...");
    const res=await supabase.rpc("lao_save_academic_schedule_settings",{
      p_school_id:school.id,
      p_academic_year_id:data.selected_year_id,
      p_school_days_per_week:Number(fd.get("school_days_per_week")),
      p_periods_per_day:Number(fd.get("periods_per_day")),
      p_minutes_per_period:Number(fd.get("minutes_per_period")),
      p_instructional_weeks_per_year:Number(fd.get("instructional_weeks_per_year"))
    });
    setBusy(btn,false);
    if(res.error){toast(res.error.message,"error");return;}
    state.curriculumReadiness=null;
    toast("บันทึกโครงสร้างเวลาเรียนแล้ว","success");
    renderRoute();
  });

  const librarySearch=q("[data-subject-library-search]");
  if(librarySearch)librarySearch.addEventListener("input",()=>{
    const needle=String(librarySearch.value||"").trim().toLowerCase();
    let visible=0;
    qa("[data-subject-library-item]").forEach(card=>{
      const show=!needle||String(card.dataset.searchText||"").includes(needle);
      card.classList.toggle("hidden",!show);
      if(show)visible++;
    });
    const noResults=q("[data-subject-library-no-results]");
    if(noResults)noResults.classList.toggle("hidden",visible>0||!needle);
  });

  const refreshSubjects=(preservePosition=false)=>{
    const keepView=state.subjectWorkspaceView;
    const scrollTop=window.scrollY;
    state.academicData=null;
    state.academicPreset=null;
    state.curriculumReadiness=null;
    state.subjectWorkspaceData=null;
    state.subjectWorkspaceView=keepView;
    const rendered=renderRoute();
    if(preservePosition&&rendered&&typeof rendered.then==="function"){
      rendered.then(()=>window.requestAnimationFrame(()=>{
        window.scrollTo({top:scrollTop,behavior:"auto"});
      }));
    }
    return rendered;
  };

  qa("[data-edit-subject-time]").forEach(btn=>btn.addEventListener("click",()=>{
    const form=q('[data-subject-time-form="'+btn.dataset.editSubjectTime+'"]');
    if(form)form.classList.toggle("hidden");
  }));
  qa("[data-close-subject-time]").forEach(btn=>btn.addEventListener("click",()=>{
    const form=q('[data-subject-time-form="'+btn.dataset.closeSubjectTime+'"]');
    if(form)form.classList.add("hidden");
  }));
  qa("[data-subject-time-form]").forEach(form=>form.addEventListener("submit",async e=>{
    e.preventDefault();
    if(!state.subjectEditMode){toast("กรุณาเปิดสวิตช์การแก้ไขก่อน","error");return;}
    const fd=new FormData(form),btn=form.querySelector('button[type="submit"]');
    const numOrNull=v=>String(v??"").trim()===""?null:Number(v);
    setBusy(btn,true,"กำลังบันทึก...");
    const res=await supabase.rpc("lao_update_course_time_override",{
      p_school_id:school.id,
      p_course_id:form.dataset.subjectTimeForm,
      p_annual_hours:numOrNull(fd.get("annual_hours")),
      p_term_hours:numOrNull(fd.get("term_hours")),
      p_weekly_periods:numOrNull(fd.get("weekly_periods")),
      p_credits:numOrNull(fd.get("credits")),
      p_note:String(fd.get("note")||"").trim()||null
    });
    setBusy(btn,false);
    if(res.error){toast(res.error.message,"error");return;}
    toast("บันทึกเวลาเรียนของโรงเรียนแล้ว · ฐานมาตรฐานกลางไม่เปลี่ยน","success");
    refreshSubjects(true);
  }));
  qa("[data-reset-subject-time-standard]").forEach(btn=>btn.addEventListener("click",async()=>{
    if(!state.subjectEditMode){toast("กรุณาเปิดสวิตช์การแก้ไขก่อน","error");return;}
    if(!confirm("คืนเวลาเรียนของรายวิชานี้เป็นค่ามาตรฐานกลางปัจจุบัน?\n\nค่าที่โรงเรียนปรับไว้จะถูกแทนที่เฉพาะรายวิชานี้"))return;
    setBusy(btn,true,"กำลังคืนค่า...");
    const res=await supabase.rpc("lao_reset_course_time_to_standard",{p_school_id:school.id,p_course_id:btn.dataset.resetSubjectTimeStandard});
    setBusy(btn,false);
    if(res.error){toast(res.error.message,"error");return;}
    toast("คืนค่าเวลาเรียนตามมาตรฐานกลางแล้ว","success");
    refreshSubjects(true);
  }));

  qa("[data-add-central-subject]").forEach(btn=>btn.addEventListener("click",async()=>{
    if(!state.subjectEditMode){toast("กรุณาเปิดสวิตช์การแก้ไขก่อน","error");return;}
    const item=(state.academicPreset?.items||[]).find(x=>x.id===btn.dataset.addCentralSubject);
    if(!item)return;
    setBusy(btn,true,"กำลังเพิ่ม...");
    const res=await supabase.rpc("lao_adopt_subject_catalog_item",{
      p_school_id:school.id,
      p_academic_year_id:data.selected_year_id,
      p_program_id:state.subjectProgramId||null,
      p_grade_code:state.academicPresetGrade||"",
      p_source_kind:"official_central",
      p_source_id:item.id
    });
    setBusy(btn,false);
    if(res.error){toast(res.error.message,"error");return;}
    toast("เพิ่ม “"+item.subject_name+"” แล้ว · อยู่ในแท็บเดิม","success");
    refreshSubjects(true);
  }));

  qa("[data-add-school-subject]").forEach(btn=>btn.addEventListener("click",async()=>{
    if(!state.subjectEditMode){toast("กรุณาเปิดสวิตช์การแก้ไขก่อน","error");return;}
    const subject=(data.subjects||[]).find(x=>x.id===btn.dataset.addSchoolSubject);
    if(!subject)return;
    setBusy(btn,true,"กำลังเพิ่ม...");
    const res=await supabase.rpc("lao_add_curriculum_library_item",{
      p_school_id:school.id,
      p_academic_year_id:data.selected_year_id,
      p_program_id:state.subjectProgramId||null,
      p_grade_code:state.academicPresetGrade||"",
      p_source_kind:"school",
      p_source_id:subject.id
    });
    setBusy(btn,false);
    if(res.error){toast(res.error.message,"error");return;}
    toast("เพิ่ม “"+subject.name_th+"” แล้ว · อยู่ในแท็บเดิม","success");
    refreshSubjects(true);
  }));

  qa("[data-remove-curriculum-subject]").forEach(btn=>btn.addEventListener("click",async()=>{
    if(!state.subjectEditMode){toast("กรุณาเปิดสวิตช์การแก้ไขก่อน","error");return;}
    if(!confirm("นำรายการนี้ออกจาก "+academicGradeLabelFromCode(state.academicPresetGrade||"")+" · "+((data.programs||[]).find(p=>p.id===state.subjectProgramId)?.name_th||"ห้องปกติ")+" ?\n\nรายการจะยังอยู่ในคลังและเพิ่มกลับได้ภายหลัง"))return;
    setBusy(btn,true,"กำลังนำออก...");
    const res=await supabase.rpc("lao_remove_curriculum_item",{
      p_school_id:school.id,
      p_academic_year_id:data.selected_year_id,
      p_program_id:state.subjectProgramId||null,
      p_grade_code:state.academicPresetGrade||"",
      p_course_id:btn.dataset.removeCurriculumSubject
    });
    setBusy(btn,false);
    if(res.error){toast(res.error.message,"error");return;}
    toast("นำออกแล้ว · รายการยังอยู่ในคลังและหน้าปัจจุบันไม่เปลี่ยน","success");
    refreshSubjects(true);
  }));

  const finderForm=q("#subject-finder-form");
  const finderResults=q("[data-subject-finder-results]");
  const finderCreate=q("[data-subject-finder-create]");
  const sourceLabel={official_central:"มาตรฐานกลาง",shared_catalog:"คลังรายวิชาร่วม",school_library:"คลังของโรงเรียน"};
  const finderTypeLabel={basic:"วิชาพื้นฐาน",additional:"วิชาเพิ่มเติม",activity:"กิจกรรมพัฒนาผู้เรียน",other:"อื่น ๆ"};
  const finderSubtypeLabel={elective_free:"เลือกเสรี",career:"อาชีพ",language:"ภาษา",program_specific:"เฉพาะโปรแกรม",local:"ท้องถิ่น",special_focus:"จุดเน้นพิเศษ",other_additional:"เพิ่มเติมอื่น ๆ",school_additional_activity:"กิจกรรมเพิ่มเติมของสถานศึกษา"};
  const renderFinderResults=(rows,query)=>{
    if(!finderResults)return;
    if(!rows.length){
      finderResults.innerHTML='<div class="subject-finder-empty">ไม่พบรายการที่ตรงหรือใกล้เคียงกับ “'+esc(query)+'”</div>';
      finderCreate?.classList.remove("hidden");
      return;
    }
    finderResults.innerHTML=rows.map(x=>
      '<article class="subject-finder-card '+(x.already_in_curriculum?"is-used":"")+'">'+
        '<div class="subject-finder-card-source"><span class="subject-origin '+(x.source_kind==="official_central"?"central-core":x.source_kind==="shared_catalog"?"shared-catalog":"school-local")+'">'+esc(sourceLabel[x.source_kind]||x.source_kind)+'</span>'+(x.source_school_name&&x.source_kind==="shared_catalog"?'<small>'+esc(x.source_school_name)+'</small>':'')+'</div>'+
        '<div class="subject-card-main"><div class="subject-code-box">'+esc(x.subject_code||"—")+'</div><div class="subject-card-copy"><strong>'+esc(x.name_th)+'</strong><small>'+esc(finderTypeLabel[x.subject_type]||x.subject_type)+(x.learning_area?' · '+esc(x.learning_area):'')+(x.subject_subtype&&finderSubtypeLabel[x.subject_subtype]?' · '+esc(finderSubtypeLabel[x.subject_subtype]):'')+'</small></div></div>'+
        '<div class="subject-finder-meta">'+(x.usage_count?'<span>ใช้ร่วม '+Number(x.usage_count).toLocaleString("th-TH")+' รร.</span>':'')+(x.exact_match?'<span class="exact">ตรงกับคำค้น</span>':'')+'</div>'+
        (x.already_in_curriculum?'<span class="subject-library-used">✓ อยู่ในหลักสูตรแล้ว</span>':'<button type="button" class="subject-add-btn" data-adopt-subject-source-kind="'+esc(x.source_kind)+'" data-adopt-subject-source-id="'+esc(x.source_id)+'">＋ ใช้รายการนี้</button>')+
      '</article>'
    ).join("");
    finderCreate?.classList.remove("hidden");
    qa("[data-adopt-subject-source-id]",finderResults).forEach(btn=>btn.addEventListener("click",async()=>{
      if(!state.subjectEditMode){toast("กรุณาเปิดสวิตช์การแก้ไขก่อน","error");return;}
      setBusy(btn,true,"กำลังเพิ่ม...");
      const res=await supabase.rpc("lao_adopt_subject_catalog_item",{
        p_school_id:school.id,
        p_academic_year_id:data.selected_year_id,
        p_program_id:state.subjectProgramId||null,
        p_grade_code:state.academicPresetGrade||"",
        p_source_kind:btn.dataset.adoptSubjectSourceKind,
        p_source_id:btn.dataset.adoptSubjectSourceId
      });
      setBusy(btn,false);
      if(res.error){toast(res.error.message,"error");return;}
      toast("เพิ่มรายวิชาเข้าหลักสูตรโรงเรียนแล้ว · อยู่ในแท็บเดิม","success");
      refreshSubjects(true);
    }));
  };
  if(finderForm)finderForm.addEventListener("submit",async e=>{
    e.preventDefault();
    const fd=new FormData(finderForm),btn=finderForm.querySelector('button[type="submit"]');
    const query=String(fd.get("query")||"").trim();
    if(!query){toast("กรุณาระบุรหัสหรือชื่อรายวิชา","error");return;}
    setBusy(btn,true,"กำลังค้นหา...");
    if(finderResults)finderResults.innerHTML='<div class="subject-finder-empty">กำลังค้นหาจาก 3 แหล่ง...</div>';
    finderCreate?.classList.add("hidden");
    const res=await supabase.rpc("lao_search_subject_catalog",{
      p_school_id:school.id,
      p_academic_year_id:data.selected_year_id,
      p_program_id:state.subjectProgramId||null,
      p_grade_code:state.academicPresetGrade||"",
      p_query:query,
      p_subject_type:String(fd.get("subject_type")||"")||null,
      p_subject_subtype:null,
      p_limit:40
    });
    setBusy(btn,false);
    if(res.error){if(finderResults)finderResults.innerHTML='<div class="subject-finder-empty error">'+esc(res.error.message)+'</div>';toast(res.error.message,"error");return;}
    renderFinderResults(res.data?.results||[],query);
  });

  qa("[data-close-custom-subject]").forEach(btn=>btn.addEventListener("click",()=>customSubjectForm?.classList.add("hidden")));
  if(customSubjectForm)customSubjectForm.addEventListener("submit",async e=>{
    e.preventDefault();
    if(!state.subjectEditMode){toast("กรุณาเปิดสวิตช์การแก้ไขก่อน","error");return;}
    const fd=new FormData(customSubjectForm),btn=customSubjectForm.querySelector('button[type="submit"]');
    const name=String(fd.get("subject_name")||"").trim();
    const gradeCode=state.academicPresetGrade||"";
    const gradeLabel=academicGradeLabelFromCode(gradeCode);
    if(!name){toast("กรุณาระบุชื่อรายวิชา/กิจกรรม","error");return;}
    if(!gradeCode||!gradeLabel){toast("กรุณาเลือกระดับชั้นก่อนสร้างรายวิชา","error");return;}
    const aliases=String(fd.get("aliases")||"").split(",").map(x=>x.trim()).filter(Boolean);
    setBusy(btn,true,"กำลังตรวจซ้ำและบันทึก...");
    const res=await supabase.rpc("lao_create_school_subject_and_add",{
      p_school_id:school.id,
      p_academic_year_id:data.selected_year_id,
      p_program_id:state.subjectProgramId||null,
      p_grade_code:gradeCode,
      p_subject_code:String(fd.get("subject_code")||"").trim()||null,
      p_subject_name:name,
      p_learning_area:String(fd.get("learning_area")||"").trim()||null,
      p_subject_type:String(fd.get("subject_type")||"additional"),
      p_subject_subtype:String(fd.get("subject_subtype")||"").trim()||null,
      p_aliases:aliases,
      p_share_to_catalog:fd.get("share_to_catalog")==="on",
      p_curriculum_version:String(fd.get("curriculum_version")||"").trim()||null
    });
    setBusy(btn,false);
    if(res.error){toast(res.error.message,"error");return;}
    toast("สร้างรายวิชาและเพิ่มให้ "+shortGrade(gradeLabel)+(res.data?.shared_catalog_id?" · เผยแพร่คลังร่วมแล้ว":"")+" · อยู่ในแท็บเดิม","success");
    refreshSubjects(true);
  });

  const confirmStructure=q("[data-confirm-curriculum-structure]");
  if(confirmStructure)confirmStructure.addEventListener("click",async()=>{
    if(!confirm("ยืนยันว่าโครงสร้างรายวิชาและเวลาเรียนของบริบทที่เลือกครบตามหลักสูตรสถานศึกษาแล้ว?"))return;
    setBusy(confirmStructure,true,"กำลังยืนยัน...");
    const res=await supabase.rpc("lao_confirm_curriculum_group",{
      p_school_id:school.id,
      p_academic_year_id:data.selected_year_id,
      p_program_id:state.subjectProgramId||null,
      p_grade_code:state.academicPresetGrade||""
    });
    setBusy(confirmStructure,false);
    if(res.error){toast(res.error.message,"error");return;}
    toast("ยืนยันโครงสร้างเรียบร้อยแล้ว","success");
    refreshSubjects();
  });

  qa("[data-start-parallel-selection]").forEach(btn=>btn.addEventListener("click",()=>{
    if(!state.subjectEditMode){toast("กรุณาเปิดสวิตช์การแก้ไขก่อน","error");return;}
    state.subjectParallelSelectionMode=true;
    refreshSubjects(true);
  }));
  qa("[data-cancel-parallel-selection]").forEach(btn=>btn.addEventListener("click",()=>{
    state.subjectParallelSelectionMode=false;
    refreshSubjects(true);
  }));

  const parallelChecks=qa("[data-parallel-course]");
  const parallelOpen=q("[data-open-parallel-group]");
  const parallelForm=q("[data-parallel-group-form]");
  const parallelPicked=q("[data-parallel-picked-text]");
  const updateParallelSelection=()=>{
    const checked=parallelChecks.filter(x=>x.checked);
    const count=q("[data-parallel-selected-count]");
    if(count)count.textContent=String(checked.length);
    if(parallelOpen)parallelOpen.disabled=checked.length<2;
    if(parallelPicked){
      const names=checked.map(ch=>ch.closest(".subject-selected-card")?.querySelector(".subject-card-copy strong")?.textContent||"").filter(Boolean);
      parallelPicked.textContent=names.length?"เลือกแล้ว: "+names.join(" · "):"";
    }
  };
  parallelChecks.forEach(ch=>ch.addEventListener("change",updateParallelSelection));
  if(parallelOpen)parallelOpen.addEventListener("click",()=>{
    if(parallelChecks.filter(x=>x.checked).length<2)return;
    parallelForm?.classList.remove("hidden");
    updateParallelSelection();
    parallelForm?.querySelector('input[name="name"]')?.focus();
  });
  qa("[data-close-parallel-group]").forEach(btn=>btn.addEventListener("click",()=>parallelForm?.classList.add("hidden")));
  if(parallelForm)parallelForm.addEventListener("submit",async e=>{
    e.preventDefault();
    if(!state.subjectEditMode){toast("กรุณาเปิดสวิตช์การแก้ไขก่อน","error");return;}
    const ids=parallelChecks.filter(x=>x.checked).map(x=>x.dataset.parallelCourse);
    if(ids.length<2){toast("กรุณาเลือกอย่างน้อย 2 รายวิชา","error");return;}
    const fd=new FormData(parallelForm),btn=parallelForm.querySelector('button[type="submit"]');
    setBusy(btn,true,"กำลังบันทึก...");
    const res=await supabase.rpc("lao_create_curriculum_parallel_group",{
      p_school_id:school.id,
      p_academic_year_id:data.selected_year_id,
      p_program_id:state.subjectProgramId||null,
      p_grade_code:state.academicPresetGrade||"",
      p_name:String(fd.get("name")||"").trim(),
      p_weekly_periods:Number(fd.get("weekly_periods")),
      p_course_ids:ids
    });
    setBusy(btn,false);
    if(res.error){toast(res.error.message,"error");return;}
    state.subjectParallelSelectionMode=false;
    toast("สร้างกลุ่มเวลาเดียวกันแล้ว · ระบบนับคาบเพียงครั้งเดียว","success");
    refreshSubjects(true);
  });
  qa("[data-delete-parallel-group]").forEach(btn=>btn.addEventListener("click",async()=>{
    if(!state.subjectEditMode){toast("กรุณาเปิดสวิตช์การแก้ไขก่อน","error");return;}
    if(!confirm("ยกเลิกการรวมเวลาในกลุ่มนี้? รายวิชายังคงอยู่ตามเดิม"))return;
    setBusy(btn,true,"กำลังยกเลิก...");
    const res=await supabase.rpc("lao_delete_curriculum_parallel_group",{p_school_id:school.id,p_group_id:btn.dataset.deleteParallelGroup});
    setBusy(btn,false);
    if(res.error){toast(res.error.message,"error");return;}
    toast("ยกเลิกกลุ่มเวลาเดียวกันแล้ว","success");
    refreshSubjects();
  }));

  const exportSubjects=q("[data-export-subjects]");
  if(exportSubjects)exportSubjects.addEventListener("click",()=>{
    const gradeLabel=academicGradeLabelFromCode(state.academicPresetGrade||"");
    const selectedProgram=(data.programs||[]).find(p=>p.id===state.subjectProgramId)||null;
    const raw=(data.courses||[]).filter(c=>c.is_active!==false&&c.grade_label===gradeLabel);
    const map=new Map();
    if(selectedProgram){
      raw.filter(c=>!c.program_id&&(c.subject_type==="basic"||c.subject_type==="activity")).forEach(c=>map.set(c.subject_id||c.subject_code||c.subject_name,c));
      raw.filter(c=>c.program_id===selectedProgram.id).forEach(c=>map.set(c.subject_id||c.subject_code||c.subject_name,c));
    }else{
      raw.filter(c=>!c.program_id).forEach(c=>map.set(c.subject_id||c.subject_code||c.subject_name,c));
    }
    const rows=Array.from(map.values());
    const csvRows=[["รหัสวิชา","ชื่อรายวิชา","ประเภท","กลุ่มสาระ","ชั่วโมง/ปี","คาบ/สัปดาห์"]];
    rows.forEach(c=>{
      const weekly=(c.term_plans||[]).find(t=>t.weekly_periods!=null);
      csvRows.push([c.subject_code||"",c.subject_name||"",academicSubjectTypeLabel(c.subject_type),c.learning_area||"",c.annual_hours??"",weekly?weekly.weekly_periods:""]);
    });
    const csv="\uFEFF"+csvRows.map(r=>r.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(",")).join("\r\n");
    const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});
    const url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download="รายวิชา_"+shortGrade(gradeLabel)+"_"+(selectedProgram?selectedProgram.code||selectedProgram.name_th:"ห้องปกติ")+".csv";
    document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
  });

  const subjectForm=q("#academic-subject-form");
  const subjectPanel=q("[data-subject-form-panel]");
  const showSubjectForm=()=>{if(subjectPanel)subjectPanel.classList.remove("hidden");academicScrollToForm(subjectForm);};
  const resetSubject=()=>{
    academicResetForm(subjectForm,"[data-subject-form-title]","เพิ่มรายวิชา");
    if(subjectForm){academicSetFormValue(subjectForm,"subject_type","basic");academicSetFormValue(subjectForm,"sort_order",0);academicSetFormValue(subjectForm,"is_active",true);}
  };
  qa("[data-new-subject-form]").forEach(btn=>btn.addEventListener("click",()=>{resetSubject();showSubjectForm();}));
  qa("[data-reset-subject-form]").forEach(btn=>btn.addEventListener("click",()=>{resetSubject();showSubjectForm();}));
  qa("[data-edit-subject]").forEach(btn=>btn.addEventListener("click",()=>{
    const x=(data.subjects||[]).find(v=>v.id===btn.dataset.editSubject);if(!x||!subjectForm)return;
    subjectForm.dataset.id=x.id;
    ["subject_code","name_th","name_en","learning_area","subject_type","sort_order"].forEach(k=>academicSetFormValue(subjectForm,k,x[k]));
    academicSetFormValue(subjectForm,"is_active",x.is_active);
    const h=q("[data-subject-form-title]");if(h)h.textContent="แก้ไข "+x.name_th;
    showSubjectForm();
  }));
  if(subjectForm)subjectForm.addEventListener("submit",async e=>{
    e.preventDefault();
    const fd=new FormData(subjectForm),btn=subjectForm.querySelector('button[type="submit"]');
    setBusy(btn,true,"กำลังบันทึก...");
    const res=await supabase.rpc("lao_save_subject",{
      p_school_id:school.id,p_subject_id:subjectForm.dataset.id||null,
      p_subject_code:String(fd.get("subject_code")||"").trim()||null,
      p_name_th:String(fd.get("name_th")||"").trim(),
      p_name_en:String(fd.get("name_en")||"").trim()||null,
      p_learning_area:String(fd.get("learning_area")||"").trim()||null,
      p_subject_type:String(fd.get("subject_type")||"basic"),
      p_is_active:fd.get("is_active")==="on",p_sort_order:Number(fd.get("sort_order")||0)
    });
    setBusy(btn,false);
    if(res.error){toast(res.error.message,"error");return;}
    toast("บันทึกรายวิชาแล้ว","success");renderRoute();
  });

  const courseFilter=q("#academic-course-filter");
  if(courseFilter){
    qa("select",courseFilter).forEach(el=>el.addEventListener("change",()=>{
      const fd=new FormData(courseFilter);
      const gradeLabel=String(fd.get("grade_label")||"");
      state.academicFilters={grade_label:gradeLabel,program_id:String(fd.get("program_id")||"")};
      const gradeCode=academicGradeCode(gradeLabel);
      if(academicCurriculumGradeCodes(data).includes(gradeCode))state.academicPresetGrade=gradeCode;
      state.academicPreset=null;
      renderRoute();
    }));
  }
  const resetCourseFilter=q("[data-reset-course-filter]");
  if(resetCourseFilter)resetCourseFilter.addEventListener("click",()=>{
    state.academicFilters={grade_label:"",program_id:""};
    state.academicPreset=null;
    renderRoute();
  });

  qa("[data-preset-grade]").forEach(btn=>btn.addEventListener("click",()=>{
    state.academicPresetGrade=btn.dataset.presetGrade||"";
    state.academicFilters={
      grade_label:academicGradeLabelFromCode(state.academicPresetGrade),
      program_id:state.academicFilters&&state.academicFilters.program_id||""
    };
    renderRoute();
  }));

  const quickCourseForm=q("#academic-quick-course-form");
  if(quickCourseForm)quickCourseForm.addEventListener("submit",async e=>{
    e.preventDefault();
    const fd=new FormData(quickCourseForm),btn=quickCourseForm.querySelector('button[type="submit"]');
    const grade=String(fd.get("grade_label")||"").trim();
    const code=String(fd.get("subject_code")||"").trim();
    const name=String(fd.get("subject_name")||"").trim();
    if(!grade||!name){toast("กรุณาระบุระดับชั้นและชื่อรายวิชา","error");return;}
    const numOrNull=v=>String(v||"").trim()===""?null:Number(v);
    setBusy(btn,true,"กำลังเพิ่มรายวิชา...");
    const res=await supabase.rpc("lao_quick_add_curriculum_subject",{
      p_school_id:school.id,
      p_academic_year_id:data.selected_year_id,
      p_program_id:String(fd.get("program_id")||"")||null,
      p_grade_label:grade,
      p_subject_code:code||null,
      p_subject_name:name,
      p_learning_area:String(fd.get("learning_area")||"").trim()||null,
      p_subject_type:String(fd.get("subject_type")||"basic"),
      p_weekly_periods:numOrNull(fd.get("weekly_periods")),
      p_annual_hours:numOrNull(fd.get("annual_hours")),
      p_sort_order:numOrNull(fd.get("sort_order"))
    });
    setBusy(btn,false);
    if(res.error){toast(res.error.message,"error");return;}
    state.academicFilters={grade_label:grade,program_id:String(fd.get("program_id")||"")};
    const gradeCode=academicGradeCode(grade);
    if(academicCurriculumGradeCodes(data).includes(gradeCode))state.academicPresetGrade=gradeCode;
    state.academicPreset=null;
    toast((res.data&&res.data.subject_created?"สร้างทะเบียนรายวิชาและเพิ่มในโครงสร้างแล้ว":"เพิ่มรายวิชาในโครงสร้างแล้ว"),"success");
    renderRoute();
  });

  qa("[data-move-course]").forEach(btn=>btn.addEventListener("click",async()=>{
    const direction=btn.dataset.direction;
    setBusy(btn,true,direction==="up"?"กำลังเลื่อนขึ้น...":"กำลังเลื่อนลง...");
    const res=await supabase.rpc("lao_move_curriculum_course",{
      p_school_id:school.id,
      p_course_id:btn.dataset.moveCourse,
      p_direction:direction
    });
    setBusy(btn,false);
    if(res.error){toast(res.error.message,"error");return;}
    if(res.data&&res.data.moved)renderRoute();
  }));

  const courseForm=q("#academic-course-form");
  const selectedYear=academicSelectedYear(data);
  const resetCourse=()=>{
    academicResetForm(courseForm,"[data-course-form-title]","เพิ่มรายวิชาในโครงสร้าง");
    if(courseForm){
      academicSetFormValue(courseForm,"academic_year_id",data.selected_year_id);
      academicSetFormValue(courseForm,"sort_order",0);
      academicSetFormValue(courseForm,"is_active",true);
    }
  };
  qa("[data-reset-course-form]").forEach(btn=>btn.addEventListener("click",()=>{resetCourse();academicScrollToForm(courseForm);}));
  qa("[data-reset-course-time-standard]").forEach(btn=>btn.addEventListener("click",async()=>{
    if(!confirm("คืนเวลาเรียนของรายวิชานี้เป็นมาตรฐานกลางปัจจุบัน?\n\nค่าที่โรงเรียนเคยปรับจะถูกแทนที่เฉพาะรายวิชานี้"))return;
    setBusy(btn,true,"กำลังคืนค่า...");
    const res=await supabase.rpc("lao_reset_course_time_to_standard",{p_school_id:school.id,p_course_id:btn.dataset.resetCourseTimeStandard});
    setBusy(btn,false);
    if(res.error){toast(res.error.message,"error");return;}
    toast("คืนค่าเวลาเรียนตามมาตรฐานกลางแล้ว","success");
    renderRoute();
  }));
  qa("[data-edit-course]").forEach(btn=>btn.addEventListener("click",()=>{
    const c=(data.courses||[]).find(x=>x.id===btn.dataset.editCourse);if(!c||!courseForm)return;
    courseForm.dataset.id=c.id;
    ["academic_year_id","program_id","grade_label","subject_id","annual_hours","credits","notes","sort_order"].forEach(k=>academicSetFormValue(courseForm,k,c[k]));
    academicSetFormValue(courseForm,"is_active",c.is_active);
    (selectedYear&&selectedYear.terms||[]).forEach(t=>{
      const plan=(c.term_plans||[]).find(p=>p.term_id===t.id)||{};
      academicSetFormValue(courseForm,"weekly_"+t.id,plan.weekly_periods);
      academicSetFormValue(courseForm,"hours_"+t.id,plan.term_hours);
    });
    const h=q("[data-course-form-title]");if(h)h.textContent="แก้ไข "+(c.subject_code?c.subject_code+" ":"")+c.subject_name+" · "+shortGrade(c.grade_label);
    academicScrollToForm(courseForm);
  }));
  if(courseForm)courseForm.addEventListener("submit",async e=>{
    e.preventDefault();
    const fd=new FormData(courseForm),btn=courseForm.querySelector('button[type="submit"]'),grade=String(fd.get("grade_label")||"").trim();
    const termPlans=(selectedYear&&selectedYear.terms||[]).map(t=>({
      term_id:t.id,
      weekly_periods:String(fd.get("weekly_"+t.id)||"").trim(),
      term_hours:String(fd.get("hours_"+t.id)||"").trim()
    }));
    const numOrNull=v=>String(v||"").trim()===""?null:Number(v);
    setBusy(btn,true,"กำลังบันทึก...");
    const res=await supabase.rpc("lao_save_curriculum_course",{
      p_school_id:school.id,p_course_id:courseForm.dataset.id||null,
      p_academic_year_id:String(fd.get("academic_year_id")||"")||null,
      p_program_id:String(fd.get("program_id")||"")||null,
      p_grade_code:academicGradeCode(grade)||null,p_grade_label:grade,
      p_subject_id:String(fd.get("subject_id")||"")||null,
      p_annual_hours:numOrNull(fd.get("annual_hours")),
      p_credits:numOrNull(fd.get("credits")),
      p_notes:String(fd.get("notes")||"").trim()||null,
      p_is_active:fd.get("is_active")==="on",p_sort_order:Number(fd.get("sort_order")||0),
      p_term_plans:termPlans
    });
    setBusy(btn,false);
    if(res.error){toast(res.error.message,"error");return;}
    state.academicFilters={grade_label:grade,program_id:String(fd.get("program_id")||"")};
    const gradeCode=academicGradeCode(grade);
    if(academicCurriculumGradeCodes(data).includes(gradeCode))state.academicPresetGrade=gradeCode;
    state.academicPreset=null;
    toast("บันทึกโครงสร้างเวลาเรียนแล้ว","success");renderRoute();
  });
}

function placeholderHtml(route){
  const meta=routeMeta[route]||routeMeta.overview;
  const phase={personnel:"Phase 2",students:"Phase 2",academics:"Phase 3",assessment:"Phase 4",documents:"Phase 1–5",website:"Phase 5",forms:"Phase 5",reports:"Phase 7"}[route]||"Roadmap";
  return '<section class="placeholder-page"><span class="placeholder-icon">◫</span><p class="eyebrow">'+phase+'</p><h2>'+esc(meta[0])+'</h2><p>'+esc(meta[1])+'<br>โมดูลนี้จะเริ่มหลังข้อมูลต้นทางที่จำเป็นก่อนหน้าพร้อม เพื่อไม่สร้างข้อมูลซ้ำหรือความสัมพันธ์ที่ต้องรื้อภายหลัง</p><a class="primary-btn" href="#/overview">กลับหน้าภาพรวม</a></section>';
}

function bindOrganizationForms(){}

function readFunctionError(error){
  if(error&&error.context&&typeof error.context.json==="function"){
    return error.context.json().then(x=>x&&x.error?x.error:error.message).catch(()=>error.message);
  }
  return Promise.resolve(error&&error.message||"ไม่สามารถดำเนินการได้");
}
function bindPlatformAdminApplications(){
  const selfBtn=q("[data-platform-self-school]");
  if(selfBtn)selfBtn.addEventListener("click",async()=>{
    setBusy(selfBtn,true,"กำลังเตรียม...");
    const res=await supabase.rpc("lao_platform_begin_school_onboarding");
    setBusy(selfBtn,false);
    if(res.error){toast(res.error.message,"error");return;}
    localStorage.setItem("lao_view_mode","user");state.viewMode="user";
    await loadContext();location.hash="#/lec";
  });
  const form=q("#admin-link-form");
  if(form)form.addEventListener("submit",async e=>{
    e.preventDefault();
    const fd=new FormData(form),btn=form.querySelector("button[type=submit]"),days=Number(fd.get("expires_days")||0);
    const expires=days?new Date(Date.now()+days*86400000).toISOString():null;
    setBusy(btn,true,"กำลังสร้าง...");
    const res=await supabase.rpc("lao_create_school_admin_invite_link",{p_label:String(fd.get("label")||"").trim(),p_expires_at:expires});
    setBusy(btn,false);
    if(res.error){toast(res.error.message,"error");return;}
    const url=location.origin+location.pathname+"#/apply-school-admin/"+res.data.token;
    try{await navigator.clipboard.writeText(url);toast("สร้างและคัดลอกลิงก์แล้ว","success");}catch{toast("สร้างลิงก์แล้ว","success");}
    renderRoute();
  });
  qa("[data-copy-admin-link]").forEach(btn=>btn.addEventListener("click",async()=>{
    try{await navigator.clipboard.writeText(btn.dataset.copyAdminLink);toast("คัดลอกลิงก์แล้ว","success");}catch{toast("อุปกรณ์นี้ไม่อนุญาตให้คัดลอกอัตโนมัติ","error");}
  }));
  qa("[data-toggle-admin-link]").forEach(btn=>btn.addEventListener("click",async()=>{
    setBusy(btn,true,"กำลังบันทึก...");
    const res=await supabase.rpc("lao_set_school_admin_invite_link_active",{p_link_id:btn.dataset.toggleAdminLink,p_is_active:btn.dataset.nextActive==="true"});
    setBusy(btn,false);
    if(res.error){toast(res.error.message,"error");return;}
    toast(res.data.is_active?"เปิดรับคำขอแล้ว":"ปิดรับคำขอแล้ว","success");renderRoute();
  }));
  qa("[data-view-verification]").forEach(btn=>btn.addEventListener("click",async()=>{
    setBusy(btn,true,"กำลังเปิด...");
    const res=await supabase.storage.from("lao-ems-admin-verification").createSignedUrl(btn.dataset.viewVerification,300);
    setBusy(btn,false);
    if(res.error){toast(res.error.message,"error");return;}
    window.open(res.data.signedUrl,"_blank","noopener,noreferrer");
  }));
  qa("[data-approve-admin-app]").forEach(btn=>btn.addEventListener("click",async()=>{
    if(!confirm("ยืนยันว่าตรวจเอกสารแล้ว และส่งคำเชิญ School Admin ไปยังอีเมลผู้สมัคร?"))return;
    setBusy(btn,true,"กำลังอนุมัติ...");
    const res=await supabase.functions.invoke("lao-invite-user",{body:{application_id:btn.dataset.approveAdminApp}});
    setBusy(btn,false);
    if(res.error){toast(await readFunctionError(res.error),"error");return;}
    toast("อนุมัติและส่งคำเชิญแล้ว","success");renderRoute();
  }));
  qa("[data-reject-admin-app]").forEach(btn=>btn.addEventListener("click",async()=>{
    const note=prompt("เหตุผล/หมายเหตุการไม่อนุมัติ (ไม่บังคับ)")||"";
    if(!confirm("ยืนยันไม่อนุมัติคำขอนี้?"))return;
    setBusy(btn,true,"กำลังบันทึก...");
    const res=await supabase.rpc("lao_reject_school_admin_application",{p_application_id:btn.dataset.rejectAdminApp,p_note:note});
    setBusy(btn,false);
    if(res.error){toast(res.error.message,"error");return;}
    toast("บันทึกผลไม่อนุมัติแล้ว","success");renderRoute();
  }));
}
function bindInvites(){
  const form=q("#invite-user-form"); if(!form)return;
  form.addEventListener("submit",async e=>{
    e.preventDefault();
    const school=currentSchool(),fd=new FormData(form),btn=form.querySelector("button[type=submit]");
    if(!school&&!state.isPlatformAdmin)return;
    setBusy(btn,true,"กำลังส่งอีเมล...");
    const res=await supabase.functions.invoke("lao-invite-user",{body:{
      email:String(fd.get("email")||"").trim(),
      school_id:school?school.id:null,
      role_code:String(fd.get("role_code")||"school_admin")
    }});
    setBusy(btn,false);
    if(res.error){toast(await readFunctionError(res.error),"error");return;}
    toast("ส่งคำเชิญไปที่ "+String(fd.get("email"))+" แล้ว","success");
    form.reset();renderRoute();
  });
}
function bindActivation(){
  const form=q("#activation-form"); if(!form)return;
  bindPasswordToggles(form);
  bindProfileFields(form);
  form.addEventListener("submit",async e=>{
    e.preventDefault();
    const fd=new FormData(form),btn=form.querySelector("button[type=submit]");
    const password=String(fd.get("password")||""),confirmPassword=String(fd.get("confirm_password")||"");
    const mustSet=!state.memberships.some(m=>m.status==="active")&&!isGoogleAuthUser();
    if(mustSet&&!password){toast("กรุณากำหนดรหัสผ่านใหม่","error");return;}
    if(password&&password.length<8){toast("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร","error");return;}
    if(password!==confirmPassword){toast("รหัสผ่านทั้งสองช่องไม่ตรงกัน","error");return;}
    setBusy(btn,true,"กำลังเปิดใช้งานบัญชี...");
    const prefix=profilePrefixValue(form),first=String(fd.get("first_name")||"").trim(),last=String(fd.get("last_name")||"").trim(),phone=String(fd.get("phone")||"").trim();
    if(password){
      const authRes=await supabase.auth.updateUser({password,data:{prefix,first_name_th:first,last_name_th:last,display_name:[prefix,first,last].filter(Boolean).join(" "),phone}});
      if(authRes.error){setBusy(btn,false);toast(authMessage(authRes.error.message),"error");return;}
    }
    const complete=await supabase.rpc("lao_complete_invitation",{p_prefix:prefix||null,p_first_name_th:first,p_last_name_th:last,p_phone:phone||null});
    if(complete.error){setBusy(btn,false);toast(complete.error.message,"error");return;}
    const needsLec=Boolean(complete.data&&complete.data.needs_lec);
    toast(needsLec?"ยืนยันบัญชีแล้ว กรุณานำเข้าไฟล์ LEC":"เปิดใช้งานบัญชีเรียบร้อย","success");
    await loadContext();location.hash=needsLec?"#/lec":"#/overview";renderRoute();
  });
}
function bindProfile(){
  const form=q("#profile-form"); if(!form)return;
  bindPasswordToggles(form);
  bindProfileFields(form);
  bindAvatarFallback(q(".profile-page")||document);
  form.addEventListener("submit",async e=>{
    e.preventDefault();
    const fd=new FormData(form),btn=form.querySelector("button[type=submit]");
    const currentPassword=String(fd.get("current_password")||"");
    const password=String(fd.get("password")||""),confirmPassword=String(fd.get("confirm_password")||"");
    const oldEmail=String(state.user&&state.user.email||"").trim().toLowerCase();
    const emailEditing=Boolean(q("[data-email-edit-toggle]",form)&&q("[data-email-edit-toggle]",form).checked);
    const newEmail=emailEditing?String(fd.get("new_email")||oldEmail).trim().toLowerCase():oldEmail;
    const emailChanged=emailEditing&&newEmail!==oldEmail,passwordChanged=Boolean(password);
    if(passwordChanged&&password.length<8){toast("รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร","error");return;}
    if(password!==confirmPassword){toast("รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน","error");return;}
    if((emailChanged||passwordChanged)&&!currentPassword){toast("กรุณากรอกรหัสผ่านปัจจุบันก่อนเปลี่ยนอีเมลหรือรหัสผ่าน","error");return;}
    const prefix=profilePrefixValue(form),first=String(fd.get("first_name")||"").trim(),last=String(fd.get("last_name")||"").trim(),phone=String(fd.get("phone")||"").trim();
    setBusy(btn,true,"กำลังบันทึก...");
    if(emailChanged||passwordChanged){
      state.reauthenticating=true;
      const verify=await supabase.auth.signInWithPassword({email:oldEmail,password:currentPassword});
      state.reauthenticating=false;
      if(verify.error){setBusy(btn,false);toast("รหัสผ่านปัจจุบันไม่ถูกต้อง","error");return;}
    }
    const pr=await supabase.rpc("lao_ensure_profile",{p_prefix:prefix||null,p_first_name_th:first,p_last_name_th:last,p_display_name:[prefix,first,last].filter(Boolean).join(" "),p_phone:phone||null});
    if(pr.error){setBusy(btn,false);toast(pr.error.message,"error");return;}
    const update={data:{prefix,first_name_th:first,last_name_th:last,display_name:[prefix,first,last].filter(Boolean).join(" "),phone}};
    if(emailChanged)update.email=newEmail;
    if(passwordChanged)update.password=password;
    const au=await supabase.auth.updateUser(update);
    setBusy(btn,false);
    if(au.error){toast(authMessage(au.error.message),"error");return;}
    await loadContext();
    toast(emailChanged?"บันทึกแล้ว กรุณาตรวจอีเมลเพื่อยืนยันอีเมลใหม่หากระบบร้องขอ":"บันทึกโปรไฟล์แล้ว","success");
    renderRoute();
  });
}

function bindSetup(){
  const form=q("#school-settings-form");
  if(form)form.addEventListener("submit",async e=>{
    e.preventDefault();
    const school=currentSchool();if(!school)return;
    const fd=new FormData(form),btn=form.querySelector("button[type=submit]");
    setBusy(btn,true,"กำลังบันทึก...");
    const res=await supabase.rpc("lao_save_school_settings",{
      p_school_id:school.id,
      p_timezone:String(fd.get("timezone")||"Asia/Bangkok"),
      p_locale:String(fd.get("locale")||"th-TH"),
      p_default_file_visibility:String(fd.get("default_file_visibility")||"internal")
    });
    setBusy(btn,false);
    if(res.error){toast(res.error.message,"error");return;}
    state.schoolSetup=res.data||null;
    toast("บันทึกการตั้งค่าสถานศึกษาแล้ว","success");
    refreshHeader();renderRoute();
  });

  const connect=q("[data-drive-connect]");
  if(connect)connect.addEventListener("click",async()=>{
    const school=currentSchool();if(!school)return;
    setBusy(connect,true,"กำลังเริ่มการเชื่อม...");
    const res=await supabase.functions.invoke("lao-drive-oauth",{body:{school_id:school.id}});
    setBusy(connect,false);
    if(res.error){
      const msg=await readFunctionError(res.error);
      toast(msg||"Google Drive OAuth ยังไม่ได้เปิดใช้งาน","error");
      return;
    }
    const url=res.data&&res.data.authorization_url;
    if(url)location.href=url;
    else toast("ไม่พบลิงก์เชื่อม Google Drive","error");
  });

  const refresh=q("[data-drive-refresh]");
  if(refresh)refresh.addEventListener("click",async()=>{
    const school=currentSchool();if(!school)return;
    setBusy(refresh,true,"กำลังทดสอบ Google Drive...");
    try{
      const res=await supabase.functions.invoke("lao-drive-oauth",{body:{school_id:school.id,action:"test"}});
      if(res.error)throw new Error(await readFunctionError(res.error));
      await loadSchoolSetupStatus();
      toast((res.data&&res.data.message)||"Google Drive ใช้งานได้","success");
      renderRoute();
    }catch(e){toast(e.message||String(e),"error");}
    finally{setBusy(refresh,false);}
  });
}
function bindNotifications(){
  qa("[data-notification-read]").forEach(btn=>btn.addEventListener("click",async()=>{
    setBusy(btn,true,"กำลังบันทึก...");
    const res=await supabase.from("lao_notifications").update({read_at:new Date().toISOString()}).eq("id",btn.dataset.notificationRead).eq("user_id",state.user.id);
    if(res.error){setBusy(btn,false);toast(res.error.message,"error");return;}
    await loadNotifications();refreshHeader();renderRoute();
  }));
}

function dismissBootScreen(){
  const boot=q("#boot-screen");
  if(!boot||boot.classList.contains("hidden")||boot.classList.contains("is-leaving"))return;
  boot.classList.add("is-leaving");
  window.setTimeout(()=>boot.classList.add("hidden"),180);
}

async function renderRoute(){
  if(!state.user)return;
  const renderId=++state.routeRenderId;
  let route=routeName();
  const invitationStatus=state.pendingInvitation&&state.pendingInvitation.status;
  const invitationRouteApplies=!state.isPlatformAdmin||state.viewMode==="user";
  if(invitationRouteApplies&&invitationStatus==="pending"&&route!=="activate"){location.hash="#/activate";route="activate";}
  if(invitationRouteApplies&&invitationStatus==="onboarding"&&route!=="lec"){location.hash="#/lec";route="lec";}
  if(route==="lec"){
    const approvedFirstSchoolAdmin=Boolean(
      state.viewMode==="user" &&
      state.pendingInvitation &&
      state.pendingInvitation.status==="onboarding" &&
      state.pendingInvitation.invitation_mode==="platform_first_admin" &&
      state.pendingInvitation.role_code==="school_admin"
    );
    const activeSchoolAdmin=isSchoolAdminContext();
    if(!approvedFirstSchoolAdmin&&!activeSchoolAdmin){
      location.hash="#/overview";
      route="overview";
      toast("หน้านำเข้า LEC สำหรับ School Admin ที่ได้รับอนุมัติเท่านั้น","error");
    }
  }
  if(route==="users"&&isSchoolAdminContext()&&!schoolSetupReady()){
    location.hash="#/setup";
    route="setup";
    toast("กรุณาตั้งค่าสถานศึกษาและ Google Drive ให้ครบก่อนเชิญผู้ใช้","error");
  }

  const meta=routeMeta[route]||routeMeta.overview,main=q("#main");
  q("[data-page-title]").textContent=meta[0];
  qa("[data-route]").forEach(a=>a.classList.toggle("active",a.dataset.route===route));
  main.classList.add("route-pending");
  main.setAttribute("aria-busy","true");

  let html="",bind=null;
  try{
    if(route==="overview"){
      html=installCardHtml()+((state.isPlatformAdmin&&state.viewMode==="admin")?adminOverviewHtml():await overviewHtml());
      bind=()=>{bindOverview();bindDepartmentSetupTimeline();bindPwaInstallCard();};
    }
    else if(route==="membership"){html=membershipHtml();}
    else if(route==="activate"){html=activationHtml();bind=bindActivation;}
    else if(route==="profile"){html=profileHtml();bind=bindProfile;}
    else if(route==="notifications"){html=notificationsHtml();bind=bindNotifications;}
    else if(route==="setup"){html=await setupHtml();bind=bindSetup;}
    else if(route==="organization"){html=await organizationHtml();bind=bindOrganizationForms;}
    else if(route==="lec"){html=await lecHtml();bind=bindLec;}
    else if(route==="users"){html=await usersHtml();bind=()=>{bindInvites();bindPlatformAdminApplications();};}
    else if(route==="personnel"){html=await personnelHtml();bind=bindPersonnel;}
    else if(route==="students"){html=await studentsHtml();bind=bindStudents;}
    else if(route==="academics"){html=await academicsHtml();bind=bindAcademics;}
    else html=placeholderHtml(route);

    if(renderId!==state.routeRenderId)return;
    main.innerHTML=html;
    bindBuddhistDatePickers(main);
    if(bind)bind();
  }catch(e){
    console.error(e);
    if(renderId!==state.routeRenderId)return;
    main.innerHTML='<section class="panel"><div class="notice danger"><strong>โหลดข้อมูลไม่สำเร็จ</strong><br>'+esc(e.message||e)+'</div></section>';
  }finally{
    if(renderId===state.routeRenderId){
      main.classList.remove("route-pending");
      main.removeAttribute("aria-busy");
    }
  }
}
async function showApp(session){
  state.session=session;state.user=session.user;
  try{
    await detectPwaInstalled();
    await loadContext();
    if(!location.hash)location.hash=state.pendingInvitation?"#/activate":"#/overview";
    await renderRoute();
    q("#auth-screen").classList.add("hidden");
    q("#app-shell").classList.remove("hidden");
    dismissBootScreen();
    const driveNotice=sessionStorage.getItem("lao_drive_notice");
    if(driveNotice){
      sessionStorage.removeItem("lao_drive_notice");
      const msg=sessionStorage.getItem("lao_drive_message");sessionStorage.removeItem("lao_drive_message");
      toast(driveNotice==="connected"?"เชื่อม Google Drive และเตรียม /LAO-EMS/ แล้ว":(msg||"เชื่อม Google Drive ไม่สำเร็จ"),driveNotice==="connected"?"success":"error");
    }
  }
  catch(e){
    console.error(e);
    if(e&&(e.message==="LAO_ACCESS_REQUIRED"||e.message==="LAO_EMAIL_NOT_AUTHORIZED")){
      localStorage.setItem("lao_legacy_session_rejected","1");
      sessionStorage.setItem(e.message==="LAO_EMAIL_NOT_AUTHORIZED"?"lao_email_denied_notice":"lao_access_denied_notice","1");
      try{await supabase.auth.signOut({scope:"local"});}catch(_){}
      clearLaoAuthSession();
      location.reload();
      return;
    }
    const main=q("#main");
    if(main&&!main.innerHTML.trim())main.innerHTML='<section class="panel"><div class="notice danger"><strong>โหลดข้อมูลไม่สำเร็จ</strong><br>'+esc(e.message||e)+'</div></section>';
    q("#auth-screen").classList.add("hidden");
    q("#app-shell").classList.remove("hidden");
    dismissBootScreen();
    toast("โหลดข้อมูลผู้ใช้ไม่สำเร็จ: "+e.message,"error");
  }
}
function showAuth(){
  q("#app-shell").classList.add("hidden");q("#auth-screen").classList.remove("hidden");
  dismissBootScreen();
  const joinToken=personnelJoinToken(),token=schoolAdminApplyToken(),signin=q("#signin-form"),application=q("#school-admin-application"),joinBox=q("#personnel-join-screen");
  if(joinToken){
    if(signin)signin.classList.add("hidden");
    if(application)application.classList.add("hidden");
    if(joinBox){joinBox.classList.remove("hidden");renderPublicPersonnelJoin(joinToken,null);}
  }else if(token){
    if(signin)signin.classList.add("hidden");
    if(joinBox)joinBox.classList.add("hidden");
    if(application){application.classList.remove("hidden");renderPublicSchoolAdminApplication(token);}
  }else{
    if(signin)signin.classList.remove("hidden");
    if(application)application.classList.add("hidden");
    if(joinBox)joinBox.classList.add("hidden");
  }
}

window.addEventListener("beforeunload",event=>{
  if(!state.lecImporting)return;
  event.preventDefault();
  event.returnValue="";
});
document.addEventListener("click",event=>{
  if(!state.lecImporting)return;
  const target=event.target&&event.target.closest?event.target.closest("a[href^='#/'],[data-view-mode],[data-signout]"):null;
  if(!target)return;
  event.preventDefault();
  event.stopPropagation();
  toast("กำลังนำเข้า LEC กรุณารอจนกว่าระบบจะแจ้งว่าเสร็จ","error");
},true);

async function init(){
  renderAppVersion();
  void checkLatestVersion();
  bindStaticUI();
  bindManualRefresh();
  bindPullToRefresh();
  bindPwaRuntime();
  bindAttentionRefresh();
  const savedEmail=localStorage.getItem("lao_saved_email");
  const remember=localStorage.getItem("lao_remember_login")==="1";
  const signInForm=q("#signin-form");
  if(signInForm){
    signInForm.elements.email.value=savedEmail||"";
    signInForm.elements.remember_login.checked=remember;
  }
  const res=await supabase.auth.getSession();
  const query=new URLSearchParams(location.search);
  const refreshToken=query.get("lao_refresh");
  if(refreshToken){
    query.delete("lao_refresh");
    const rest=query.toString();
    history.replaceState(null,"",location.pathname+(rest?"?"+rest:"")+location.hash);
  }
  const driveResult=query.get("drive");
  if(driveResult){
    history.replaceState(null,"",location.pathname+location.hash);
    sessionStorage.setItem("lao_drive_notice",driveResult==="connected"?"connected":"error");
    if(query.get("message"))sessionStorage.setItem("lao_drive_message",query.get("message"));
  }
  if(personnelJoinToken())await showPersonnelJoin(res.data.session||null);
  else if(schoolAdminApplyToken())showAuth();
  else if(res.data.session)await showApp(res.data.session);else{
    showAuth();
    if(sessionStorage.getItem("lao_email_denied_notice")==="1"){
      sessionStorage.removeItem("lao_email_denied_notice");
      toast("อีเมล Google นี้ยังไม่มีสิทธิ์ใน LAO-EMS กรุณาใช้อีเมลที่ผู้ดูแลบันทึกไว้ในระบบ","error");
    }else if(sessionStorage.getItem("lao_access_denied_notice")==="1"){
      sessionStorage.removeItem("lao_access_denied_notice");
      toast("บัญชีนี้ยังไม่ได้รับคำเชิญจากผู้ดูแล LAO-EMS","error");
    }
  }
  supabase.auth.onAuthStateChange(async(event,session)=>{
    if(event==="SIGNED_OUT"||!session){state.session=state.user=state.profile=state.currentMembership=null;state.memberships=[];showAuth();return;}
    if(event==="SIGNED_IN"&&state.reauthenticating)return;
    if(personnelJoinToken()){await showPersonnelJoin(session);return;}
    if(event==="SIGNED_IN")await showApp(session);
  });
}
init();
