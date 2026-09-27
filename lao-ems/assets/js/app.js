import { supabase } from "./supabase.js";

const state={session:null,user:null,profile:null,memberships:[],currentMembership:null,organizations:[],schools:[],adminSchools:[],adminSchool:null,orgSchools:[],notifications:[],isPlatformAdmin:false,viewMode:"user"};

const routeMeta={
  overview:["ภาพรวมระบบ","ภาพรวมการเชื่อมข้อมูลและลำดับการพัฒนา"],
  membership:["สถานะการเข้าใช้งาน","สมัครเข้าร่วมสถานศึกษาและติดตามการอนุมัติ"],
  notifications:["การแจ้งเตือน","คำขอ การอนุมัติ และการเปลี่ยนแปลงที่เกี่ยวข้องกับบัญชีของคุณ"],
  setup:["ตั้งค่าพื้นฐาน","ปีการศึกษา ภาคเรียน และสถานะการเชื่อมระบบ"],
  organization:["อปท. และสถานศึกษา","โครงสร้างองค์กรและโรงเรียนในแพลตฟอร์ม"],
  users:["ผู้ใช้และสิทธิ์","คำขอเข้าใช้งาน บทบาท และขอบเขตสิทธิ์"],
  personnel:["บุคลากร","ข้อมูลบุคลากรต้นทางสำหรับทุกระบบ"],
  students:["นักเรียน","Student master record และความสัมพันธ์ผู้ปกครอง"],
  academics:["วิชาการ","หลักสูตร ชั้นเรียน รายวิชา และครูผู้สอน"],
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
  ["🪪","Personnel","บุคลากร ตำแหน่ง วิทยฐานะ ภาระงาน","Phase 2"],
  ["🎓","Student Registry","นักเรียน ผู้ปกครอง ห้องเรียน ประวัติการศึกษา","Phase 2"],
  ["📚","Academic","หลักสูตร รายวิชา ตารางเรียน ครูผู้สอน","Phase 3"],
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
function displayName(){
  const p=state.profile||{};
  return p.display_name||[p.prefix,p.first_name_th,p.last_name_th].filter(Boolean).join(" ")||(state.user&&state.user.email)||"ผู้ใช้งาน";
}
function initials(name){
  const parts=String(name||"ผู้").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]&&parts[0][0])||"ผู้")+((parts[1]&&parts[1][0])||"");
}
function currentSchool(){
  if(state.isPlatformAdmin&&state.viewMode==="admin")return state.adminSchool||null;
  return state.currentMembership&&state.currentMembership.lao_schools||null;
}
function currentOrg(){
  if(state.isPlatformAdmin&&state.viewMode==="admin")return state.adminSchool&&state.adminSchool.lao_organizations||null;
  return state.currentMembership&&state.currentMembership.lao_organizations||null;
}

function bindStaticUI(){
  qa("[data-auth-tab]").forEach(btn=>btn.addEventListener("click",()=>{
    qa("[data-auth-tab]").forEach(x=>x.classList.toggle("active",x===btn));
    q("#signin-form").classList.toggle("hidden",btn.dataset.authTab!=="signin");
    q("#signup-form").classList.toggle("hidden",btn.dataset.authTab!=="signup");
  }));
  q("#signin-form").addEventListener("submit",signIn);
  q("#signup-form").addEventListener("submit",signUp);
  qa("[data-password-toggle]").forEach(button=>button.addEventListener("click",()=>{
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
  window.addEventListener("hashchange",()=>{renderRoute();close();});
  q("[data-signout]").addEventListener("click",async()=>{await supabase.auth.signOut();});
  q("#tenant-select").addEventListener("change",e=>{
    const value=e.target.value;
    if(state.isPlatformAdmin&&state.viewMode==="admin"){
      const id=value.startsWith("admin:")?value.slice(6):"";
      state.adminSchool=state.adminSchools.find(s=>s.id===id)||null;
      if(state.adminSchool)localStorage.setItem("lao_admin_school",state.adminSchool.id);
      else localStorage.removeItem("lao_admin_school");
      refreshHeader();renderRoute();return;
    }
    const m=state.memberships.find(x=>x.id===value&&x.status==="active");
    if(m){state.currentMembership=m;localStorage.setItem("lao_current_membership",m.id);refreshHeader();renderRoute();}
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
async function signUp(event){
  event.preventDefault();
  const form=event.currentTarget,btn=form.querySelector("button[type=submit]"),fd=new FormData(form);
  const pass=String(fd.get("password")),confirm=String(fd.get("confirm_password"));
  if(pass!==confirm){toast("รหัสผ่านทั้งสองช่องไม่ตรงกัน","error");return;}
  const prefix=String(fd.get("prefix")||"").trim(),first=String(fd.get("first_name")).trim(),last=String(fd.get("last_name")).trim(),phone=String(fd.get("phone")||"").trim();
  setBusy(btn,true,"กำลังสร้างบัญชี...");
  const res=await supabase.auth.signUp({
    email:String(fd.get("email")).trim(),
    password:pass,
    options:{data:{prefix:prefix,first_name_th:first,last_name_th:last,display_name:[prefix,first,last].filter(Boolean).join(" "),phone:phone}}
  });
  setBusy(btn,false);
  if(res.error){toast(authMessage(res.error.message),"error");return;}
  form.reset();
  if(res.data.session){toast("สร้างบัญชีสำเร็จ กรุณาส่งคำขอเข้าร่วมสถานศึกษา","success");}
  else{toast("สร้างบัญชีแล้ว กรุณาตรวจสอบอีเมลเพื่อยืนยันบัญชีก่อนเข้าสู่ระบบ","success");}
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
    .select("id,organization_id,code,name_th,name_en,short_name,slug,phone,email,website_url,address_text,is_active,lao_organizations(id,name_th,name_en)")
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
async function loadContext(){
  await ensureProfile();
  const profileRes=await supabase.from("lao_profiles").select("*").eq("user_id",state.user.id).maybeSingle();
  if(profileRes.error)throw profileRes.error;
  state.profile=profileRes.data;
  const adminRes=await supabase.rpc("lao_is_platform_admin");
  if(adminRes.error)throw adminRes.error;
  state.isPlatformAdmin=adminRes.data===true;
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
  refreshHeader();
  renderTenants();
}
function refreshHeader(){
  const name=displayName();
  q("[data-profile-name]").textContent=name;
  q("[data-avatar]").textContent=initials(name).slice(0,2);
  q("[data-profile-role]").textContent=state.isPlatformAdmin?(state.viewMode==="admin"?"ผู้ดูแลแพลตฟอร์ม · Admin":"ผู้ดูแลแพลตฟอร์ม · มุมมองผู้ใช้"):state.currentMembership?roleNames():state.memberships.some(m=>m.status==="pending")?"รออนุมัติสิทธิ์":"ยังไม่ได้ขอสิทธิ์";

  const switcher=q("[data-view-switch]");
  if(switcher)switcher.classList.toggle("hidden",!state.isPlatformAdmin);
  qa("[data-view-mode]").forEach(button=>button.classList.toggle("active",button.dataset.viewMode===state.viewMode));

  const adminMode=state.isPlatformAdmin&&state.viewMode==="admin";
  qa("[data-admin-menu]").forEach(item=>{
    item.classList.toggle("hidden",!(adminMode||(!state.isPlatformAdmin&&hasRole("organization_admin","school_admin"))));
  });

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
    ["personnel","🪪","บุคลากร"],["students","🎓","นักเรียน"],["academics","📚","วิชาการ"],
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
  if(!active.length){select.innerHTML='<option value="">ยังไม่มีสิทธิ์สถานศึกษา</option>';return;}
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
  '<li><span>1</span><div><strong>อปท. และสถานศึกษา</strong><small>เพิ่ม/แก้ไขโครงสร้างองค์กรและโรงเรียน</small></div><em>จัดการได้</em></li>'+
  '<li><span>2</span><div><strong>ผู้ใช้และสิทธิ์</strong><small>ตรวจคำขอ อนุมัติ และกำหนดบทบาท</small></div><em>จัดการได้</em></li>'+
  '<li><span>3</span><div><strong>ปีการศึกษาและภาคเรียน</strong><small>ตั้งค่าพื้นฐานก่อนเริ่มข้อมูลวิชาการ</small></div><em>จัดการได้</em></li>'+
  '<li><span>4</span><div><strong>Google Drive</strong><small>เชื่อมบัญชีแยกตามโรงเรียน</small></div><em>ขั้นถัดไป</em></li></ol></article>'+
  '<article class="panel"><div class="panel-head"><div><p class="eyebrow">System status</p><h2>สถานะทางเทคนิค</h2></div></div><ul class="status-list">'+
  '<li><span>✓</span><div><strong>Supabase ISSQL</strong><small>ใช้ namespace lao_ แยกจากระบบเดิม</small></div><span class="pill success">พร้อม</span></li>'+
  '<li><span>✓</span><div><strong>RLS / Role + Scope</strong><small>แยกสิทธิ์ตาม อปท. และสถานศึกษา</small></div><span class="pill success">พร้อม</span></li>'+
  '<li><span>✓</span><div><strong>Audit Log</strong><small>รองรับการตรวจสอบเหตุการณ์สำคัญ</small></div><span class="pill success">พร้อม</span></li>'+
  '<li><span>→</span><div><strong>Google OAuth</strong><small>ใช้สำหรับเชื่อม Drive ของแต่ละโรงเรียน</small></div><span class="pill warning">รอดำเนินการ</span></li></ul></article></section>'+
  '<section class="module-section"><div class="section-head"><div><p class="eyebrow">Roadmap</p><h2>โมดูลทั้งหมด</h2></div></div><div class="module-grid">'+moduleHtml+'</div></section>';
}

function overviewHtml(){
  const active=state.memberships.filter(m=>m.status==="active").length;
  const pending=state.memberships.filter(m=>m.status==="pending").length;
  const tenant=(currentSchool()&&currentSchool().name_th)||(currentOrg()&&currentOrg().name_th)||"ยังไม่ได้เลือกสถานศึกษา";
  const name=displayName();
  const accessText=state.isPlatformAdmin?"ผู้ดูแลแพลตฟอร์ม":state.currentMembership?roleNames():pending?"กำลังรออนุมัติ":"ยังไม่มีสิทธิ์ใช้งานสถานศึกษา";
  const nextAction=state.isPlatformAdmin
    ? '<a class="primary-btn" href="#/organization">จัดการ อปท. และสถานศึกษา</a>'
    : active
      ? '<a class="primary-btn" href="#/membership">ดูสิทธิ์ของฉัน</a>'
      : '<a class="primary-btn" href="#/membership">'+(pending?"ตรวจสอบสถานะคำขอ":"ขอสิทธิ์เข้าร่วมสถานศึกษา")+'</a>';

  return '<section class="system-banner"><div><span class="badge">LAO-EMS</span><h2>สวัสดี '+esc(name)+'</h2><p>ยินดีต้อนรับสู่ระบบสารสนเทศเพื่อการบริหารจัดการศึกษาขององค์กรปกครองส่วนท้องถิ่น</p></div></section>'+
  '<section class="stats-grid">'+
    '<article class="stat-card"><span class="stat-icon">🏫</span><div><small>สถานศึกษา</small><strong>'+esc(tenant)+'</strong><p>'+(active||state.isPlatformAdmin?"ข้อมูลจะแสดงตามสิทธิ์ของคุณ":"กรุณาขอสิทธิ์เข้าร่วมสถานศึกษา")+'</p></div></article>'+
    '<article class="stat-card"><span class="stat-icon">👤</span><div><small>สิทธิ์การใช้งาน</small><strong>'+esc(accessText)+'</strong><p>'+esc(state.currentMembership?roleNames():"")+'</p></div></article>'+
    '<article class="stat-card"><span class="stat-icon">'+(pending?"⏳":"✓")+'</span><div><small>สถานะคำขอ</small><strong>'+(pending?pending+" คำขอรออนุมัติ":"ไม่มีคำขอค้าง")+'</strong><p>ตรวจสอบได้จากเมนูสิทธิ์การเข้าใช้งาน</p></div></article>'+
  '</section>'+
  '<section class="panel"><div class="panel-head"><div><p class="eyebrow">เริ่มใช้งาน</p><h2>สิ่งที่ต้องดำเนินการ</h2></div></div>'+
  (state.isPlatformAdmin
    ? '<div class="notice">คุณเป็นผู้ดูแลแพลตฟอร์ม สามารถเพิ่ม อปท. สถานศึกษา และตรวจสอบสิทธิ์ผู้ใช้งานได้</div>'
    : active
      ? '<div class="notice success">บัญชีของคุณพร้อมใช้งาน ระบบจะแสดงเมนูและข้อมูลตามหน้าที่ที่ได้รับอนุญาต</div>'
      : pending
        ? '<div class="notice warning">คำขอของคุณถูกส่งแล้ว กรุณารอผู้ดูแลสถานศึกษาตรวจสอบและอนุมัติ</div>'
        : '<div class="notice">บัญชีของคุณสร้างเรียบร้อยแล้ว ขั้นตอนถัดไปคือขอสิทธิ์เข้าร่วมสถานศึกษา</div>')+
  '<div class="action-row">'+nextAction+'</div></section>';
}

function membershipHtml(){
  const statusMap={pending:["รออนุมัติ","warning"],active:["ใช้งานได้","success"],rejected:["ไม่อนุมัติ","danger"],suspended:["ระงับ","danger"],ended:["สิ้นสุด","neutral"]};
  const rows=state.memberships.map(m=>{
    const s=statusMap[m.status]||[m.status,"neutral"];
    return '<tr><td>'+esc(m.lao_organizations&&m.lao_organizations.name_th||"-")+'</td><td>'+esc(m.lao_schools&&m.lao_schools.name_th||"ระดับ อปท.")+'</td><td>'+esc(roleLabels[m.requested_role_code]||m.requested_role_code||"-")+'</td><td><span class="pill '+s[1]+'">'+s[0]+'</span></td><td>'+new Date(m.requested_at).toLocaleDateString("th-TH")+'</td></tr>';
  }).join("");
  const orgOptions=state.organizations.map(o=>'<option value="'+o.id+'">'+esc(o.name_th)+'</option>').join("");
  const form=state.organizations.length?'<form id="membership-form" class="form-grid" style="margin-top:18px"><label class="field">อปท.<select name="organization_id" id="membership-org" required><option value="">เลือก อปท.</option>'+orgOptions+'</select></label><label class="field">สถานศึกษา<select name="school_id" id="membership-school" required disabled><option value="">เลือกสถานศึกษา</option></select></label><label class="field">ขอใช้งานในฐานะ<select name="role_code" required><option value="">เลือกบทบาท</option><option value="school_admin">ผู้ดูแลสถานศึกษา</option><option value="school_executive">ผู้บริหารสถานศึกษา</option><option value="registrar">งานทะเบียน</option><option value="academic_officer">งานวิชาการ</option><option value="teacher">ครู</option><option value="staff">บุคลากร</option><option value="student">นักเรียน</option><option value="guardian">ผู้ปกครอง</option></select></label><label class="field">ข้อมูลประกอบคำขอ<input name="note" placeholder="เช่น ตำแหน่ง / ชั้นเรียน / ความสัมพันธ์"></label><div class="span-2 notice">การเลือกบทบาทเป็นเพียง <strong>คำขอ</strong> ผู้ดูแลต้องตรวจสอบก่อนให้สิทธิ์</div><div class="span-2"><button class="primary-btn" type="submit">ส่งคำขอ</button></div></form>':'<div class="empty-state" style="margin-top:18px"><div class="empty-icon">🏛</div><h3>ยังไม่มี อปท. หรือสถานศึกษาในระบบ</h3><p>ผู้ดูแลแพลตฟอร์มต้องเพิ่มข้อมูลองค์กรและสถานศึกษาก่อนจึงจะส่งคำขอได้</p></div>';
  const history=rows?'<div class="table-wrap"><table><thead><tr><th>อปท.</th><th>สถานศึกษา</th><th>บทบาทที่ขอ</th><th>สถานะ</th><th>วันที่ขอ</th></tr></thead><tbody>'+rows+'</tbody></table></div>':'<div class="empty-state" style="margin-top:18px"><div class="empty-icon">🔐</div><h3>ยังไม่มีคำขอ</h3><p>เลือก อปท. และสถานศึกษาเพื่อเริ่มต้น</p></div>';
  return '<section class="content-grid"><article class="panel form-card"><div class="panel-head"><div><p class="eyebrow">Membership request</p><h2>ขอสิทธิ์เข้าร่วมสถานศึกษา</h2><p class="panel-sub">การสมัครบัญชีและการได้สิทธิ์โรงเรียนเป็นคนละขั้นตอน</p></div></div>'+form+'</article><article class="panel"><div class="panel-head"><div><p class="eyebrow">My access</p><h2>สถานะสิทธิ์ของฉัน</h2></div></div>'+history+'</article></section>';
}

function setupHtml(){
  const school=currentSchool();
  const canAdmin=school&&hasRole("platform_admin","organization_admin","school_admin");
  const form=canAdmin?'<form id="year-form" class="form-grid" style="margin-top:18px"><label class="field">ปีการศึกษา พ.ศ.<input name="year_be" type="number" min="2400" max="2800" required placeholder="2570"></label><label class="field">สถานะ<select name="is_current"><option value="false">ปีทั่วไป</option><option value="true">ปีการศึกษาปัจจุบัน</option></select></label><div class="span-2"><button class="primary-btn" type="submit">เพิ่มปีการศึกษา</button></div></form>':'<div class="empty-state" style="margin-top:18px"><div class="empty-icon">🗓</div><h3>ยังไม่เปิดการตั้งค่า</h3><p>ต้องมีสิทธิ์ผู้ดูแลสถานศึกษาและเลือกสถานศึกษาก่อน</p></div>';
  return '<section class="content-grid"><article class="panel"><div class="panel-head"><div><p class="eyebrow">Foundation</p><h2>สถานะระบบพื้นฐาน</h2></div></div><ul class="status-list"><li><span>✓</span><div><strong>Supabase ISSQL</strong><small>ใช้ฐานเดิมโดยแยกด้วย lao_</small></div><span class="pill success">พร้อม</span></li><li><span>✓</span><div><strong>Authentication</strong><small>บัญชีกลาง + Membership ของ LAO-EMS</small></div><span class="pill success">พร้อม</span></li><li><span>✓</span><div><strong>RLS</strong><small>ตรวจสิทธิ์ตาม อปท. และสถานศึกษา</small></div><span class="pill success">พร้อม</span></li><li><span>→</span><div><strong>Google Drive</strong><small>'+(school?"จะเชื่อม Drive ของ "+esc(school.name_th):"เลือกสถานศึกษาก่อนเชื่อม Drive")+'</small></div><span class="pill warning">รอเชื่อม</span></li></ul></article><article class="panel"><div class="panel-head"><div><p class="eyebrow">Academic calendar</p><h2>ปีการศึกษาและภาคเรียน</h2></div></div>'+form+'</article></section>';
}

async function organizationHtml(){
  const res=await supabase.from("lao_schools")
    .select("id,name_th,name_en,short_name,code,slug,organization_id,phone,email,website_url,address_text,is_active,lao_organizations(id,name_th)")
    .order("name_th");
  if(res.error)throw res.error;
  const schools=res.data||[];
  state.orgSchools=schools;

  const cr=await supabase.from("lao_change_requests")
    .select("id,school_id,before_data,proposed_data,reason,status,requested_at,reviewed_at,review_note,lao_schools(name_th)")
    .order("created_at",{ascending:false}).limit(50);
  if(cr.error)throw cr.error;
  const changes=cr.data||[];

  let manage="";
  if(state.isPlatformAdmin){
    manage+='<article class="panel"><div class="panel-head"><div><p class="eyebrow">Platform setup</p><h2>เพิ่มองค์กรปกครองส่วนท้องถิ่น</h2><p class="panel-sub">Platform Admin ดูแลโครงสร้างส่วนกลาง ส่วนการบริหารสมาชิกประจำวันเป็นหน้าที่ของแต่ละโรงเรียน</p></div></div><form id="organization-form" class="form-grid" style="margin-top:18px"><label class="field">ชื่อ อปท. (ไทย)<input name="name_th" required></label><label class="field">ชื่อภาษาอังกฤษ<input name="name_en"></label><label class="field">รหัสหน่วยงาน<input name="code"></label><label class="field">ประเภท<select name="organization_type"><option value="municipality">เทศบาล</option><option value="pao">องค์การบริหารส่วนจังหวัด</option><option value="sao">องค์การบริหารส่วนตำบล</option><option value="special_local_government">องค์กรปกครองส่วนท้องถิ่นรูปแบบพิเศษ</option><option value="local_government">อื่น ๆ</option></select></label><div class="span-2"><button class="primary-btn" type="submit">เพิ่ม อปท.</button></div></form></article>';
  }
  if(state.isPlatformAdmin||hasRole("organization_admin")){
    const opts=state.organizations.map(o=>'<option value="'+o.id+'">'+esc(o.name_th)+'</option>').join("");
    manage+='<article class="panel"><div class="panel-head"><div><p class="eyebrow">School setup</p><h2>เพิ่มสถานศึกษา</h2><p class="panel-sub">เมื่อสร้างโรงเรียนแล้ว ผู้ใช้คนแรกที่ขอเป็นผู้ดูแลสถานศึกษาจะรอ Platform Admin อนุมัติ</p></div></div><form id="school-form" class="form-grid" style="margin-top:18px"><label class="field">อปท.<select name="organization_id" required><option value="">เลือก อปท.</option>'+opts+'</select></label><label class="field">รหัสสถานศึกษา<input name="code"></label><label class="field">ชื่อสถานศึกษา (ไทย)<input name="name_th" required></label><label class="field">ชื่อภาษาอังกฤษ<input name="name_en"></label><label class="field">ชื่อย่อ<input name="short_name"></label><label class="field">Slug<input name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required placeholder="t1-nakhonnok"></label><div class="span-2"><button class="primary-btn" type="submit">เพิ่มสถานศึกษา</button></div></form></article>';
  }

  const rows=schools.map(s=>{
    const localCanEdit=!state.isPlatformAdmin&&currentSchool()&&currentSchool().id===s.id&&hasRole("school_admin");
    let actions='-';
    if(state.isPlatformAdmin){
      actions='<div class="action-row compact"><button class="secondary-btn" data-school-edit="'+s.id+'" data-mode="proposal">เสนอแก้ไข</button><button class="danger-outline-btn" data-school-edit="'+s.id+'" data-mode="emergency">แก้ฉุกเฉิน</button></div>';
    }else if(localCanEdit){
      actions='<button class="secondary-btn" data-school-edit="'+s.id+'" data-mode="direct">แก้ไขข้อมูล</button>';
    }
    return '<tr><td>'+esc(s.lao_organizations&&s.lao_organizations.name_th||"-")+'</td><td><strong>'+esc(s.name_th)+'</strong><br><small>'+esc(s.name_en||"")+'</small></td><td><code>'+esc(s.slug)+'</code></td><td><span class="pill '+(s.is_active?"success":"neutral")+'">'+(s.is_active?"ใช้งาน":"ปิดใช้งาน")+'</span></td><td>'+actions+'</td></tr>';
  }).join("");
  const list=schools.length
    ? '<article class="panel"><div class="panel-head"><div><p class="eyebrow">Multi-school</p><h2>องค์กรและสถานศึกษาในระบบ</h2><p class="panel-sub">Platform Admin เข้าถึงได้ทุกโรงเรียน แต่การแก้ไขข้อมูลโรงเรียนใช้กระบวนการเสนอ → โรงเรียนอนุมัติเป็นค่าเริ่มต้น</p></div></div><div class="table-wrap"><table><thead><tr><th>อปท.</th><th>สถานศึกษา</th><th>Slug</th><th>สถานะ</th><th>ดำเนินการ</th></tr></thead><tbody>'+rows+'</tbody></table></div></article>'
    : '<article class="panel"><div class="empty-state"><div class="empty-icon">🏫</div><h3>ยังไม่มีสถานศึกษา</h3><p>เพิ่ม อปท. และสถานศึกษาเพื่อเริ่มใช้งานระบบหลายโรงเรียน</p></div></article>';

  const pending=changes.filter(x=>x.status==="pending");
  const changeRows=changes.map(x=>{
    const canReview=!state.isPlatformAdmin&&currentSchool()&&currentSchool().id===x.school_id&&hasRole("school_admin")&&x.status==="pending";
    const statusLabel={pending:"รอตรวจสอบ",approved:"อนุมัติแล้ว",rejected:"ปฏิเสธ",cancelled:"ยกเลิก"}[x.status]||x.status;
    const action=canReview?'<div class="action-row compact"><button class="primary-btn" data-change-approve="'+x.id+'">ยอมรับ</button><button class="danger-btn" data-change-reject="'+x.id+'">ปฏิเสธ</button></div>':'<span class="pill '+(x.status==="approved"?"success":x.status==="rejected"?"danger":x.status==="pending"?"warning":"neutral")+'">'+statusLabel+'</span>';
    return '<tr><td><strong>'+esc(x.lao_schools&&x.lao_schools.name_th||"-")+'</strong><br><small>'+new Date(x.requested_at).toLocaleString("th-TH")+'</small></td><td>'+esc(x.reason)+'</td><td>'+action+'</td></tr>';
  }).join("");
  const changePanel=changes.length?'<article class="panel"><div class="panel-head"><div><p class="eyebrow">Change approval</p><h2>ข้อเสนอแก้ไขข้อมูลสถานศึกษา</h2><p class="panel-sub">'+(state.isPlatformAdmin?"ติดตามข้อเสนอที่ส่งให้โรงเรียนพิจารณา":"ตรวจสอบข้อเสนอจาก Platform Admin ก่อนนำไปใช้จริง")+'</p></div><span class="counter">'+pending.length+' รอตรวจสอบ</span></div><div class="table-wrap"><table><thead><tr><th>สถานศึกษา / เวลา</th><th>เหตุผล</th><th>สถานะ / ดำเนินการ</th></tr></thead><tbody>'+changeRows+'</tbody></table></div></article>':'';

  const dialog='<dialog id="school-edit-dialog" class="edit-dialog"><form id="school-edit-form" method="dialog"><div class="dialog-head"><div><p class="eyebrow" data-school-edit-eyebrow>School data</p><h2 data-school-edit-title>แก้ไขข้อมูลสถานศึกษา</h2></div><button type="button" class="icon-btn" data-dialog-close aria-label="ปิด">×</button></div><input type="hidden" name="school_id"><input type="hidden" name="mode"><div class="form-grid"><label class="field">รหัสสถานศึกษา<input name="code"></label><label class="field">ชื่อสถานศึกษา (ไทย)<input name="name_th" required></label><label class="field">ชื่อภาษาอังกฤษ<input name="name_en"></label><label class="field">ชื่อย่อ<input name="short_name"></label><label class="field">โทรศัพท์<input name="phone"></label><label class="field">อีเมล<input name="email" type="email"></label><label class="field span-2">เว็บไซต์<input name="website_url" type="url"></label><label class="field span-2">ที่อยู่<textarea name="address_text" rows="3"></textarea></label><label class="field span-2" data-reason-field>เหตุผล<textarea name="reason" rows="3" placeholder="ระบุเหตุผลเพื่อใช้ใน Audit Log และการพิจารณา"></textarea></label></div><div class="dialog-actions"><button type="button" class="secondary-btn" data-dialog-close>ยกเลิก</button><button type="submit" class="primary-btn" data-school-save>บันทึก</button></div></form></dialog>';

  return '<section class="content-grid">'+manage+list+changePanel+'</section>'+dialog;
}

async function usersHtml(){
  if(!hasRole("platform_admin","organization_admin","school_admin"))return '<section class="panel"><div class="empty-state"><div class="empty-icon">🛡️</div><h3>เมนูนี้สำหรับผู้ดูแล</h3><p>บัญชีของคุณยังไม่มีสิทธิ์ตรวจสอบคำขอของผู้ใช้อื่น</p><a class="primary-btn" href="#/membership">ดูสิทธิ์ของฉัน</a></div></section>';
  const res=await supabase.from("lao_memberships").select("id,user_id,requested_role_code,request_note,status,requested_at,lao_organizations(name_th),lao_schools(name_th)").eq("status","pending").order("requested_at");
  if(res.error)throw res.error;
  if(!res.data.length)return '<section class="panel"><div class="empty-state"><div class="empty-icon">✓</div><h3>ไม่มีคำขอค้าง</h3><p>Platform Admin อนุมัติเฉพาะผู้ดูแลคนแรกของแต่ละโรงเรียน ส่วนคำขออื่นเป็นหน้าที่ของผู้ดูแลโรงเรียน</p></div></section>';

  const userIds=Array.from(new Set(res.data.map(m=>m.user_id)));
  const profileRes=await supabase.from("lao_profiles").select("user_id,display_name,first_name_th,last_name_th").in("user_id",userIds);
  if(profileRes.error)throw profileRes.error;
  const profileMap=Object.fromEntries((profileRes.data||[]).map(p=>[p.user_id,p]));

  const modes=await Promise.all(res.data.map(async m=>{
    const r=await supabase.rpc("lao_membership_review_mode",{p_membership_id:m.id});
    return [m.id,r.error?"view_only":r.data];
  }));
  const modeMap=Object.fromEntries(modes);

  const ordered=[...res.data].sort((x,y)=>(modeMap[x.id]==="view_only")-(modeMap[y.id]==="view_only"));
  const rows=ordered.map(m=>{
    const p=profileMap[m.user_id]||{},name=p.display_name||[p.first_name_th,p.last_name_th].filter(Boolean).join(" ")||m.user_id;
    const mode=modeMap[m.id]||"view_only";
    const canReview=mode==="platform_first_admin"||mode==="school_admin";
    const responsibility=mode==="platform_first_admin"?"Platform Admin · แอดมินคนแรก":mode==="school_admin"?"ผู้ดูแลโรงเรียน":"ผู้ดูแลโรงเรียนรับผิดชอบ";
    const action=canReview
      ? '<div class="action-row compact"><button class="primary-btn" data-approve="'+m.id+'" data-role="'+esc(m.requested_role_code)+'">อนุมัติ</button><button class="danger-btn" data-reject="'+m.id+'">ไม่อนุมัติ</button></div>'
      : '<span class="pill neutral">ดูได้อย่างเดียว</span>';
    return '<tr><td><strong>'+esc(name)+'</strong><br><small>'+new Date(m.requested_at).toLocaleString("th-TH")+'</small></td><td>'+esc(m.lao_schools&&m.lao_schools.name_th||m.lao_organizations&&m.lao_organizations.name_th||"-")+'</td><td>'+esc(roleLabels[m.requested_role_code]||m.requested_role_code||"-")+'</td><td><strong>'+esc(responsibility)+'</strong><br><small>'+esc(m.request_note||"-")+'</small></td><td>'+action+'</td></tr>';
  }).join("");

  return '<section class="panel"><div class="panel-head"><div><p class="eyebrow">Approval responsibility</p><h2>คำขอที่รอตรวจสอบ</h2><p class="panel-sub">Platform Admin อนุมัติเฉพาะ School Admin คนแรกของโรงเรียน หลังจากนั้นโรงเรียนบริหารสมาชิกและผู้ดูแลร่วมเอง</p></div><span class="counter">'+res.data.length+' คำขอ</span></div><div class="table-wrap"><table><thead><tr><th>ผู้ขอ</th><th>สถานศึกษา</th><th>บทบาท</th><th>ผู้รับผิดชอบ</th><th>ดำเนินการ</th></tr></thead><tbody>'+rows+'</tbody></table></div></section>';
}

function notificationsHtml(){
  const rows=state.notifications.map(n=>{
    const unread=!n.read_at;
    return '<article class="notification-card '+(unread?"unread":"")+'"><div class="notification-icon">🔔</div><div class="notification-copy"><div class="notification-title"><strong>'+esc(n.title)+'</strong>'+(unread?'<span class="pill warning">ใหม่</span>':'')+'</div><p>'+esc(n.body||"")+'</p><small>'+new Date(n.created_at).toLocaleString("th-TH")+'</small></div>'+(unread?'<button class="secondary-btn" data-notification-read="'+n.id+'">ทำเครื่องหมายว่าอ่านแล้ว</button>':'')+'</article>';
  }).join("");
  return '<section class="panel"><div class="panel-head"><div><p class="eyebrow">Notifications</p><h2>การแจ้งเตือน</h2><p class="panel-sub">แจ้งคำขอสมาชิก การแต่งตั้งผู้ดูแล และข้อเสนอแก้ไขข้อมูลสถานศึกษา</p></div></div>'+(rows?'<div class="notification-list">'+rows+'</div>':'<div class="empty-state"><div class="empty-icon">🔔</div><h3>ยังไม่มีการแจ้งเตือน</h3><p>เมื่อมีรายการที่ต้องดำเนินการ ระบบจะแสดงที่นี่</p></div>')+'</section>';
}

function placeholderHtml(route){
  const meta=routeMeta[route]||routeMeta.overview;
  const phase={personnel:"Phase 2",students:"Phase 2",academics:"Phase 3",assessment:"Phase 4",documents:"Phase 1–5",website:"Phase 5",forms:"Phase 5",reports:"Phase 7"}[route]||"Roadmap";
  return '<section class="placeholder-page"><span class="placeholder-icon">◫</span><p class="eyebrow">'+phase+'</p><h2>'+esc(meta[0])+'</h2><p>'+esc(meta[1])+'<br>โมดูลนี้จะเริ่มหลังข้อมูลต้นทางที่จำเป็นก่อนหน้าพร้อม เพื่อไม่สร้างข้อมูลซ้ำหรือความสัมพันธ์ที่ต้องรื้อภายหลัง</p><a class="primary-btn" href="#/overview">กลับหน้าภาพรวม</a></section>';
}

function bindOrganizationForms(){
  const orgForm=q("#organization-form");
  if(orgForm)orgForm.addEventListener("submit",async e=>{
    e.preventDefault();const fd=new FormData(orgForm),btn=orgForm.querySelector("button[type=submit]");
    setBusy(btn,true,"กำลังบันทึก...");
    const payload={name_th:String(fd.get("name_th")).trim(),name_en:String(fd.get("name_en")||"").trim()||null,code:String(fd.get("code")||"").trim()||null,organization_type:String(fd.get("organization_type"))};
    const res=await supabase.from("lao_organizations").insert(payload);
    setBusy(btn,false);if(res.error){toast(res.error.message,"error");return;}
    toast("เพิ่ม อปท. แล้ว","success");await loadOrganizations();renderRoute();
  });
  const schoolForm=q("#school-form");
  if(schoolForm)schoolForm.addEventListener("submit",async e=>{
    e.preventDefault();const fd=new FormData(schoolForm),btn=schoolForm.querySelector("button[type=submit]");
    const slug=String(fd.get("slug")).trim().toLowerCase();
    if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)){toast("Slug ใช้ได้เฉพาะ a-z, 0-9 และขีดกลาง","error");return;}
    setBusy(btn,true,"กำลังบันทึก...");
    const payload={organization_id:fd.get("organization_id"),code:String(fd.get("code")||"").trim()||null,name_th:String(fd.get("name_th")).trim(),name_en:String(fd.get("name_en")||"").trim()||null,short_name:String(fd.get("short_name")||"").trim()||null,slug:slug};
    const res=await supabase.from("lao_schools").insert(payload);
    setBusy(btn,false);if(res.error){toast(res.error.message,"error");return;}
    toast("เพิ่มสถานศึกษาแล้ว","success");await loadAdminSchools();renderTenants();renderRoute();
  });

  const dialog=q("#school-edit-dialog"),editForm=q("#school-edit-form");
  const closeDialog=()=>{if(dialog&&dialog.open)dialog.close();};
  qa("[data-dialog-close]").forEach(b=>b.addEventListener("click",closeDialog));
  qa("[data-school-edit]").forEach(btn=>btn.addEventListener("click",()=>{
    const s=state.orgSchools.find(x=>x.id===btn.dataset.schoolEdit);
    if(!s||!dialog||!editForm)return;
    const mode=btn.dataset.mode;
    editForm.elements.school_id.value=s.id;
    editForm.elements.mode.value=mode;
    ["code","name_th","name_en","short_name","phone","email","website_url","address_text"].forEach(k=>{editForm.elements[k].value=s[k]||"";});
    editForm.elements.reason.value="";
    q("[data-school-edit-title]").textContent=mode==="proposal"?"เสนอแก้ไขข้อมูล "+s.name_th:mode==="emergency"?"แก้ไขฉุกเฉิน "+s.name_th:"แก้ไขข้อมูล "+s.name_th;
    q("[data-school-edit-eyebrow]").textContent=mode==="proposal"?"รอโรงเรียนอนุมัติก่อนมีผล":mode==="emergency"?"มีผลทันที + แจ้งเตือนโรงเรียน":"School Admin";
    q("[data-reason-field]").classList.toggle("hidden",mode==="direct");
    editForm.elements.reason.required=mode!=="direct";
    q("[data-school-save]").textContent=mode==="proposal"?"ส่งข้อเสนอ":mode==="emergency"?"ยืนยันแก้ไขฉุกเฉิน":"บันทึกการแก้ไข";
    dialog.showModal();
  }));

  if(editForm)editForm.addEventListener("submit",async e=>{
    e.preventDefault();
    const fd=new FormData(editForm),btn=q("[data-school-save]");
    const schoolId=String(fd.get("school_id")),mode=String(fd.get("mode"));
    const patch={};
    ["code","name_th","name_en","short_name","phone","email","website_url","address_text"].forEach(k=>patch[k]=String(fd.get(k)||"").trim()||null);
    const reason=String(fd.get("reason")||"").trim()||null;
    if(mode==="emergency"&&!confirm("การแก้ไขฉุกเฉินจะมีผลทันทีและแจ้งผู้ดูแลโรงเรียน ยืนยันดำเนินการ?"))return;
    setBusy(btn,true,mode==="proposal"?"กำลังส่งข้อเสนอ...":"กำลังบันทึก...");
    let res;
    if(mode==="proposal")res=await supabase.rpc("lao_propose_school_change",{p_school_id:schoolId,p_patch:patch,p_reason:reason});
    else if(mode==="emergency")res=await supabase.rpc("lao_emergency_update_school",{p_school_id:schoolId,p_patch:patch,p_reason:reason});
    else res=await supabase.rpc("lao_school_admin_update_school",{p_school_id:schoolId,p_patch:patch,p_reason:reason});
    setBusy(btn,false);
    if(res.error){toast(res.error.message,"error");return;}
    closeDialog();
    toast(mode==="proposal"?"ส่งข้อเสนอให้ผู้ดูแลโรงเรียนแล้ว":mode==="emergency"?"แก้ไขฉุกเฉินแล้วและแจ้งโรงเรียนแล้ว":"บันทึกข้อมูลแล้ว","success");
    await Promise.all([loadAdminSchools(),loadNotifications()]);renderTenants();renderRoute();
  });

  qa("[data-change-approve]").forEach(btn=>btn.addEventListener("click",async()=>{
    if(!confirm("ยืนยันยอมรับข้อเสนอแก้ไขนี้? เมื่อยอมรับแล้วข้อมูลจริงจะถูกปรับทันที"))return;
    setBusy(btn,true,"กำลังอนุมัติ...");
    const res=await supabase.rpc("lao_review_school_change",{p_change_request_id:btn.dataset.changeApprove,p_decision:"approved",p_review_note:null});
    setBusy(btn,false);if(res.error){toast(res.error.message,"error");return;}
    toast("อนุมัติและปรับข้อมูลแล้ว","success");await loadNotifications();renderRoute();
  }));
  qa("[data-change-reject]").forEach(btn=>btn.addEventListener("click",async()=>{
    const note=prompt("เหตุผลที่ปฏิเสธ (ไม่บังคับ)")||null;
    if(!confirm("ยืนยันปฏิเสธข้อเสนอแก้ไขนี้?"))return;
    setBusy(btn,true,"กำลังบันทึก...");
    const res=await supabase.rpc("lao_review_school_change",{p_change_request_id:btn.dataset.changeReject,p_decision:"rejected",p_review_note:note});
    setBusy(btn,false);if(res.error){toast(res.error.message,"error");return;}
    toast("ปฏิเสธข้อเสนอแล้ว","success");await loadNotifications();renderRoute();
  }));
}

function bindMembership(){
  const org=q("#membership-org"),school=q("#membership-school"),form=q("#membership-form");
  if(!form)return;
  org.addEventListener("change",async()=>{
    school.disabled=true;school.innerHTML='<option value="">กำลังโหลด...</option>';
    try{
      const list=await loadSchools(org.value);
      school.innerHTML='<option value="">เลือกสถานศึกษา</option>'+list.map(s=>'<option value="'+s.id+'">'+esc(s.name_th)+'</option>').join("");
    }catch(e){school.innerHTML='<option value="">โหลดไม่สำเร็จ</option>';toast(e.message,"error");}
    school.disabled=false;
  });
  form.addEventListener("submit",async e=>{
    e.preventDefault();
    const fd=new FormData(form),btn=form.querySelector("button[type=submit]");
    setBusy(btn,true,"กำลังส่งคำขอ...");
    const res=await supabase.rpc("lao_request_membership",{p_organization_id:fd.get("organization_id"),p_school_id:fd.get("school_id"),p_requested_role_code:fd.get("role_code"),p_request_note:String(fd.get("note")||"").trim()||null});
    setBusy(btn,false);
    if(res.error){toast(res.error.message,"error");return;}
    toast("ส่งคำขอแล้ว กรุณารอผู้ดูแลตรวจสอบ","success");
    await loadContext();renderRoute();
  });
}
function bindYear(){
  const form=q("#year-form");if(!form)return;
  form.addEventListener("submit",async e=>{
    e.preventDefault();const fd=new FormData(form),btn=form.querySelector("button");
    setBusy(btn,true,"กำลังบันทึก...");
    const res=await supabase.from("lao_academic_years").insert({school_id:currentSchool().id,year_be:Number(fd.get("year_be")),is_current:fd.get("is_current")==="true"});
    setBusy(btn,false);
    if(res.error){toast(res.error.message,"error");return;}
    toast("เพิ่มปีการศึกษาแล้ว","success");form.reset();
  });
}
function bindApprovals(){
  qa("[data-approve]").forEach(btn=>btn.addEventListener("click",async()=>{
    const first=btn.dataset.role==="school_admin"&&state.isPlatformAdmin;
    if(!confirm(first?"ยืนยันแต่งตั้งผู้ใช้นี้เป็นผู้ดูแลสถานศึกษาคนแรก? หลังจากนี้โรงเรียนจะรับผิดชอบอนุมัติสมาชิกเอง":"ยืนยันว่าได้ตรวจสอบบุคคลนี้แล้ว และต้องการอนุมัติสิทธิ์ตามบทบาทที่ขอ?"))return;
    setBusy(btn,true,"กำลังอนุมัติ...");
    const res=await supabase.rpc("lao_review_membership",{p_membership_id:btn.dataset.approve,p_decision:"active",p_role_codes:[btn.dataset.role]});
    if(res.error){setBusy(btn,false);toast(res.error.message,"error");return;}
    toast(first?"แต่งตั้งผู้ดูแลสถานศึกษาคนแรกแล้ว":"อนุมัติสิทธิ์แล้ว","success");
    await loadNotifications();refreshHeader();renderRoute();
  }));
  qa("[data-reject]").forEach(btn=>btn.addEventListener("click",async()=>{
    if(!confirm("ยืนยันไม่อนุมัติคำขอนี้?"))return;
    setBusy(btn,true,"กำลังบันทึก...");
    const res=await supabase.rpc("lao_review_membership",{p_membership_id:btn.dataset.reject,p_decision:"rejected",p_role_codes:[]});
    if(res.error){setBusy(btn,false);toast(res.error.message,"error");return;}
    toast("บันทึกการไม่อนุมัติแล้ว");await loadNotifications();refreshHeader();renderRoute();
  }));
}
function bindNotifications(){
  qa("[data-notification-read]").forEach(btn=>btn.addEventListener("click",async()=>{
    setBusy(btn,true,"กำลังบันทึก...");
    const res=await supabase.from("lao_notifications").update({read_at:new Date().toISOString()}).eq("id",btn.dataset.notificationRead).eq("user_id",state.user.id);
    if(res.error){setBusy(btn,false);toast(res.error.message,"error");return;}
    await loadNotifications();refreshHeader();renderRoute();
  }));
}

async function renderRoute(){
  if(!state.user)return;
  const route=routeName(),meta=routeMeta[route]||routeMeta.overview,main=q("#main");
  q("[data-page-title]").textContent=meta[0];
  qa("[data-route]").forEach(a=>a.classList.toggle("active",a.dataset.route===route));
  main.innerHTML='<section class="panel"><div class="loading-inline"><span class="spinner"></span>กำลังโหลด...</div></section>';
  try{
    if(route==="overview")main.innerHTML=(state.isPlatformAdmin&&state.viewMode==="admin")?adminOverviewHtml():overviewHtml();
    else if(route==="membership"){main.innerHTML=membershipHtml();bindMembership();}
    else if(route==="notifications"){main.innerHTML=notificationsHtml();bindNotifications();}
    else if(route==="setup"){main.innerHTML=setupHtml();bindYear();}
    else if(route==="organization"){main.innerHTML=await organizationHtml();bindOrganizationForms();}
    else if(route==="users"){main.innerHTML=await usersHtml();bindApprovals();}
    else main.innerHTML=placeholderHtml(route);
  }catch(e){
    console.error(e);
    main.innerHTML='<section class="panel"><div class="notice danger"><strong>โหลดข้อมูลไม่สำเร็จ</strong><br>'+esc(e.message||e)+'</div></section>';
  }
}
async function showApp(session){
  state.session=session;state.user=session.user;
  q("#auth-screen").classList.add("hidden");q("#app-shell").classList.remove("hidden");
  try{await loadContext();if(!location.hash)location.hash="#/overview";await renderRoute();}
  catch(e){console.error(e);toast("โหลดข้อมูลผู้ใช้ไม่สำเร็จ: "+e.message,"error");}
}
function showAuth(){q("#app-shell").classList.add("hidden");q("#auth-screen").classList.remove("hidden");}

async function init(){
  bindStaticUI();
  const savedEmail=localStorage.getItem("lao_saved_email");
  const remember=localStorage.getItem("lao_remember_login")==="1";
  const signInForm=q("#signin-form");
  if(signInForm){
    signInForm.elements.email.value=savedEmail||"";
    signInForm.elements.remember_login.checked=remember;
  }
  const res=await supabase.auth.getSession();
  q("#boot-screen").classList.add("hidden");
  if(res.data.session)await showApp(res.data.session);else showAuth();
  supabase.auth.onAuthStateChange(async(event,session)=>{
    if(event==="SIGNED_OUT"||!session){state.session=state.user=state.profile=state.currentMembership=null;state.memberships=[];showAuth();return;}
    if(event==="SIGNED_IN")await showApp(session);
  });
}
init();
