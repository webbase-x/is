import { supabase, clearLaoAuthSession } from "./supabase.js?v=20260927-2";

const state={session:null,user:null,profile:null,memberships:[],currentMembership:null,organizations:[],schools:[],adminSchools:[],adminSchool:null,orgSchools:[],notifications:[],pendingInvitation:null,schoolSetup:null,lecPreview:null,isPlatformAdmin:false,viewMode:"user"};

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
function schoolAdminApplyToken(){
  const m=location.hash.match(/^#\/apply-school-admin\/([A-Za-z0-9_-]{20,})$/);
  return m?m[1]:null;
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
function currentSchool(){
  if(state.isPlatformAdmin&&state.viewMode==="admin")return state.adminSchool||null;
  return state.currentMembership&&state.currentMembership.lao_schools||null;
}
function currentOrg(){
  if(state.isPlatformAdmin&&state.viewMode==="admin")return state.adminSchool&&state.adminSchool.lao_organizations||null;
  return state.currentMembership&&state.currentMembership.lao_organizations||null;
}

function bindStaticUI(){
  q("#signin-form").addEventListener("submit",signIn);
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
  window.addEventListener("hashchange",()=>{if(state.user)renderRoute();else showAuth();close();});
  q("[data-signout]").addEventListener("click",()=>{
    localStorage.setItem("lao_legacy_session_rejected","1");
    clearLaoAuthSession();
    location.reload();
  });
  const profileButton=q(".profile-btn");
  if(profileButton)profileButton.addEventListener("click",()=>{location.hash="#/profile";});
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
async function loadSchoolSetupStatus(){
  const m=state.currentMembership;
  if(!m||m.status!=="active"||!roleCodes(m).includes("school_admin")||!m.school_id){state.schoolSetup=null;return null;}
  const res=await supabase.rpc("lao_school_setup_status",{p_school_id:m.school_id});
  if(res.error)throw res.error;
  state.schoolSetup=res.data||null;
  return state.schoolSetup;
}
async function loadContext(){
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
  refreshHeader();
  renderTenants();
}
function refreshHeader(){
  const name=displayName();
  q("[data-profile-name]").textContent=name;
  q("[data-avatar]").textContent=initials(name).slice(0,2);
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
      button.textContent=(roleCodes(state.currentMembership).includes("school_admin")||(state.pendingInvitation&&state.pendingInvitation.role_code==="school_admin"))?"School":"User";
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

function overviewHtml(){
  const active=state.memberships.filter(m=>m.status==="active").length;
  const tenant=(currentSchool()&&currentSchool().name_th)||(currentOrg()&&currentOrg().name_th)||"ยังไม่ได้ผูกสถานศึกษา";
  const name=displayName();
  const schoolAdmin=isSchoolAdminContext();
  const accessText=isPlatformAdminMode()?"ผู้ดูแลแพลตฟอร์ม":schoolAdmin?"ผู้ดูแลสถานศึกษา":state.currentMembership?roleNames():"ยังไม่มีสิทธิ์ใช้งาน";
  let nextAction="";
  let notice="";
  if(isPlatformAdminMode()){
    nextAction='<a class="primary-btn" href="#/users">เชิญ School Admin คนแรก</a>';
    notice='<div class="notice">มุมมอง Platform Admin ใช้สำหรับกำกับระบบและแต่งตั้ง School Admin คนแรกของแต่ละโรงเรียน</div>';
  }else if(state.isPlatformAdmin&&state.viewMode==="user"&&!state.currentMembership){
    nextAction='<button class="primary-btn" type="button" data-platform-self-school>ตั้งค่าสถานศึกษาของฉันจาก LEC</button>';
    notice='<div class="notice"><strong>บัญชีนี้เป็น Platform Admin แล้ว</strong><br>หากต้องการทำงานในฐานะ School Admin ของโรงเรียนตนเอง ให้เริ่มจาก LEC ระบบจะสร้าง school_id และผูกสิทธิ์ School Admin ให้อัตโนมัติ</div>';
  }else if(schoolAdmin&&!schoolSetupReady()){
    nextAction='<a class="primary-btn" href="#/setup">ตั้งค่าสถานศึกษาให้ครบ</a>';
    notice='<div class="notice warning"><strong>ยังเปิดการเชิญผู้ใช้ไม่ได้</strong><br>หลังนำเข้า LEC แล้ว ให้ตรวจการตั้งค่าและเชื่อม Google Drive ก่อน ระบบจึงจะเปิดเมนูผู้ใช้และสิทธิ์</div>';
  }else if(schoolAdmin){
    nextAction='<a class="primary-btn" href="#/users">เชิญและจัดการผู้ใช้</a>';
    notice='<div class="notice success">สถานศึกษาพร้อมใช้งาน สามารถเชิญผู้ใช้และกำหนดสิทธิ์ภายในโรงเรียนได้แล้ว</div>';
  }else if(active){
    nextAction='<a class="primary-btn" href="#/membership">ดูสิทธิ์ของฉัน</a>';
    notice='<div class="notice success">บัญชีของคุณพร้อมใช้งาน ระบบจะแสดงข้อมูลตามบทบาทที่ผู้ดูแลกำหนดให้</div>';
  }else{
    notice='<div class="notice">บัญชี LAO-EMS ใช้ระบบคำเชิญจากผู้ดูแล หากยังไม่มีสิทธิ์ กรุณาติดต่อผู้ดูแลสถานศึกษาของคุณ</div>';
  }

  return '<section class="system-banner"><div><span class="badge">LAO-EMS</span><h2>สวัสดี '+esc(name)+'</h2><p>ระบบสารสนเทศเพื่อการบริหารจัดการศึกษาขององค์กรปกครองส่วนท้องถิ่น</p></div></section>'+
  '<section class="stats-grid">'+
    '<article class="stat-card"><span class="stat-icon">🏫</span><div><small>สถานศึกษา</small><strong>'+esc(tenant)+'</strong><p>ข้อมูลโรงเรียนและนักเรียนอ้างอิงจาก LEC</p></div></article>'+
    '<article class="stat-card"><span class="stat-icon">👤</span><div><small>สิทธิ์การใช้งาน</small><strong>'+esc(accessText)+'</strong><p>'+esc(state.currentMembership?roleNames():"")+'</p></div></article>'+
    (schoolAdmin?'<article class="stat-card"><span class="stat-icon">'+(schoolSetupReady()?"✓":"⚙")+'</span><div><small>ความพร้อมของโรงเรียน</small><strong>'+(schoolSetupReady()?"พร้อมเชิญผู้ใช้":"กำลังตั้งค่า")+'</strong><p>'+(state.schoolSetup&&state.schoolSetup.drive_connected?"Google Drive เชื่อมแล้ว":"ต้องเชื่อม Google Drive")+'</p></div></article>':'')+
  '</section>'+
  '<section class="panel"><div class="panel-head"><div><p class="eyebrow">เริ่มใช้งาน</p><h2>สิ่งที่ต้องดำเนินการ</h2></div></div>'+notice+(nextAction?'<div class="action-row">'+nextAction+'</div>':'')+'</section>';
}

function membershipHtml(){
  const statusMap={pending:["รออนุมัติ","warning"],active:["ใช้งานได้","success"],rejected:["ไม่อนุมัติ","danger"],suspended:["ระงับ","danger"],ended:["สิ้นสุด","neutral"]};
  const rows=state.memberships.map(m=>{
    const s=statusMap[m.status]||[m.status,"neutral"];
    return '<tr><td>'+esc(m.lao_organizations&&m.lao_organizations.name_th||"-")+'</td><td>'+esc(m.lao_schools&&m.lao_schools.name_th||"-")+'</td><td>'+esc(roleLabels[m.requested_role_code]||m.requested_role_code||"-")+'</td><td><span class="pill '+s[1]+'">'+s[0]+'</span></td><td>'+new Date(m.requested_at).toLocaleDateString("th-TH")+'</td></tr>';
  }).join("");
  const history=rows?'<div class="table-wrap"><table><thead><tr><th>อปท.</th><th>สถานศึกษา</th><th>บทบาท</th><th>สถานะ</th><th>เริ่มต้น</th></tr></thead><tbody>'+rows+'</tbody></table></div>':'<div class="empty-state"><div class="empty-icon">🔐</div><h3>ยังไม่มีสิทธิ์สถานศึกษา</h3><p>บัญชี LAO-EMS สร้างและกำหนดสิทธิ์โดยผู้ดูแลเท่านั้น</p></div>';
  return '<section class="content-grid"><article class="panel"><div class="panel-head"><div><p class="eyebrow">My access</p><h2>สิทธิ์การเข้าใช้งานของฉัน</h2><p class="panel-sub">ผู้ใช้ไม่ต้องสมัครเข้าร่วมโรงเรียนเอง ผู้ดูแลสถานศึกษาจะเป็นผู้เชิญและกำหนดบทบาทให้</p></div></div>'+history+'</article></section>';
}

function profileNeedsSetup(){
  const p=state.profile||{};
  return !String(p.first_name_th||"").trim()||!String(p.last_name_th||"").trim();
}
function profileFieldsHtml(context){
  const p=state.profile||{},pre=esc(p.prefix||""),first=esc(p.first_name_th||""),last=esc(p.last_name_th||""),phone=esc(p.phone||"");
  const email=esc(state.user&&state.user.email||"");
  return '<div class="profile-fields">'+
    (context==="profile"?'<label class="field profile-email">อีเมลบัญชี<input value="'+email+'" readonly aria-readonly="true"><small>อีเมลใช้สำหรับเข้าสู่ระบบและเปลี่ยนได้ผ่านกระบวนการยืนยันบัญชีเท่านั้น</small></label>':'')+
    '<div class="profile-name-grid"><label class="field profile-prefix">คำนำหน้า<select name="prefix"><option value="">ไม่ระบุ</option>'+["นาย","นาง","นางสาว","เด็กชาย","เด็กหญิง"].map(x=>'<option '+(pre===x?'selected':'')+'>'+x+'</option>').join("")+'</select></label><label class="field">ชื่อ <span class="required-mark">*</span><input name="first_name" value="'+first+'" required autocomplete="given-name" placeholder="ชื่อ"></label><label class="field">นามสกุล <span class="required-mark">*</span><input name="last_name" value="'+last+'" required autocomplete="family-name" placeholder="นามสกุล"></label></div>'+
    '<label class="field profile-phone">เบอร์โทรศัพท์<input name="phone" type="tel" value="'+phone+'" autocomplete="tel" inputmode="tel" placeholder="เช่น 0812345678"><small>ใช้สำหรับข้อมูลติดต่อภายในระบบ ไม่แสดงต่อสาธารณะโดยอัตโนมัติ</small></label>'+
  '</div>';
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
  const hasActive=state.memberships.some(m=>m.status==="active"),requirePassword=!hasActive;
  const unbound=inv.invitation_mode==="platform_first_admin"&&!inv.school_id;
  const schoolLabel=unbound?"จะสร้างจากไฟล์ LEC หลังยืนยันบัญชี":(inv.school_name||"-");
  return '<section class="onboarding-shell"><article class="panel onboarding-card"><div class="panel-head"><div><p class="eyebrow">Account activation</p><h2>ตั้งค่าบัญชี LAO-EMS</h2><p class="panel-sub">กรอกโปรไฟล์และ'+(requirePassword?'กำหนดรหัสผ่านใหม่':'ตรวจสอบข้อมูลก่อนรับสิทธิ์ใหม่')+'</p></div></div><div class="invite-summary"><div><small>อีเมล</small><strong>'+esc(state.user.email||inv.email||"-")+'</strong></div><div><small>สถานศึกษา</small><strong>'+esc(schoolLabel)+'</strong></div><div><small>บทบาท</small><strong>'+esc(roleLabels[inv.role_code]||inv.role_code)+'</strong></div></div>'+(unbound?'<div class="notice success">หลังบันทึกบัญชี ระบบจะพาไปหน้า “นำเข้า LEC” เพื่อสร้างข้อมูล อปท. และสถานศึกษาจากไฟล์ต้นทางโดยอัตโนมัติ</div>':'')+'<form id="activation-form" class="form-grid">'+profileFieldsHtml("activation")+passwordFieldsHtml(requirePassword)+'<div class="span-2 notice">'+(requirePassword?'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร และจะใช้เข้าสู่ระบบครั้งถัดไป':'หากต้องการเปลี่ยนรหัสผ่านในครั้งนี้ สามารถกรอกช่องรหัสผ่านใหม่ได้')+'</div><div class="span-2"><button class="primary-btn" type="submit">'+(unbound?'บันทึกโปรไฟล์และไปนำเข้า LEC':'บันทึกโปรไฟล์และเปิดใช้งานบัญชี')+'</button></div></form></article></section>';
}

function profileHtml(){
  const name=displayName(),school=currentSchool();
  return '<section class="profile-layout"><article class="panel profile-summary"><div class="profile-hero-avatar">'+esc(initials(name).slice(0,2))+'</div><div><p class="eyebrow">MY PROFILE</p><h2>'+esc(name)+'</h2><p>'+esc(state.user&&state.user.email||"")+'</p><div class="profile-tags"><span class="pill success">บัญชีใช้งานได้</span>'+(school?'<span class="pill">'+esc(school.name_th)+'</span>':'')+'</div></div></article><article class="panel form-card profile-form-card"><div class="panel-head"><div><p class="eyebrow">ข้อมูลส่วนตัว</p><h2>โปรไฟล์ของฉัน</h2><p class="panel-sub">กรอกเฉพาะข้อมูลส่วนตัวของบัญชี ข้อมูลทางราชการของโรงเรียนและนักเรียนมาจาก LEC</p></div></div><form id="profile-form" class="form-grid profile-form">'+profileFieldsHtml("profile")+'<div class="span-2 form-section"><strong>ความปลอดภัยของบัญชี</strong><p class="panel-sub">เว้นช่องรหัสผ่านว่างไว้หากไม่ต้องการเปลี่ยน</p></div>'+passwordFieldsHtml(false)+'<div class="span-2 profile-form-actions"><button class="primary-btn" type="submit">บันทึกโปรไฟล์</button></div></form></article></section>';
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
  '<article class="panel drive-setup-card"><div class="panel-head"><div><p class="eyebrow">Google Drive</p><h2>พื้นที่จัดเก็บของสถานศึกษา</h2><p class="panel-sub">หนึ่งโรงเรียนเชื่อม Google Drive หนึ่งบัญชี/Shared Drive เพื่อเก็บไฟล์จริง ส่วน LAO-EMS เก็บ metadata และสิทธิ์การเข้าถึง</p></div>'+status(s.drive_connected)+'</div><div class="drive-root-preview"><span class="drive-icon">▣</span><div><small>โฟลเดอร์หลักของระบบ</small><strong>'+root+'</strong><p>เมื่อเชื่อมสำเร็จ ระบบจะใช้โฟลเดอร์นี้เป็นราก และจะสร้างโฟลเดอร์ย่อยตามโมดูลเมื่อเปิดใช้งานในระยะต่อไป</p></div></div>'+(s.drive_connected?'<div class="drive-connected"><strong>'+esc(s.drive_account_email||"Google Drive")+'</strong><small>เชื่อมเมื่อ '+(s.drive_connected_at?new Date(s.drive_connected_at).toLocaleString("th-TH"):"-")+'</small></div>':'<div class="notice warning"><strong>ยังไม่ได้เชื่อม Google Drive</strong><br>การเชื่อม Google Drive ยังไม่พร้อมใช้งานสำหรับสถานศึกษานี้ เมื่อผู้ดูแลแพลตฟอร์มเปิดใช้งานแล้ว ระบบจะเชื่อมบัญชีและสร้าง '+root+' อัตโนมัติได้</div>')+'<div class="action-row">'+(s.drive_connected?'<button class="secondary-btn" type="button" data-drive-refresh>ตรวจสอบสถานะอีกครั้ง</button>':'<button class="primary-btn" type="button" data-drive-connect>เชื่อม Google Drive</button>')+'</div></article></section>'+
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
    const last=s.lec_synced_at?new Date(s.lec_synced_at).toLocaleString("th-TH"):"ยังไม่เคยนำเข้า";
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
    const invRes=await supabase.from("lao_user_invitations")
      .select("id,email,role_code,invitation_mode,status,sent_at,accepted_at")
      .is("school_id",null).eq("invitation_mode","platform_first_admin")
      .order("sent_at",{ascending:false}).limit(100);
    if(invRes.error)throw invRes.error;

    const rows=(invRes.data||[]).map(x=>{
      const status={pending:["รอยืนยันอีเมล","warning"],onboarding:["รอนำเข้า LEC","warning"],accepted:["เปิดใช้งานแล้ว","success"],revoked:["ยกเลิก","neutral"],failed:["ส่งไม่สำเร็จ","danger"]}[x.status]||[x.status,"neutral"];
      return '<tr><td><strong>'+esc(x.email)+'</strong><br><small>'+new Date(x.sent_at).toLocaleString("th-TH")+'</small></td><td>ผู้ดูแลสถานศึกษาคนแรก</td><td><span class="pill '+status[1]+'">'+status[0]+'</span></td><td>รอผูกสถานศึกษาจาก LEC</td></tr>';
    }).join("");

    return '<section class="content-grid"><article class="panel form-card"><div class="panel-head"><div><p class="eyebrow">First School Admin</p><h2>เชิญ School Admin คนแรก</h2><p class="panel-sub">ไม่ต้องสร้าง อปท. หรือสถานศึกษาก่อน ระบุเฉพาะอีเมล ผู้รับจะยืนยันบัญชีแล้วนำเข้า LEC เพื่อสร้างสถานศึกษาจริง</p></div></div><form id="invite-user-form" class="form-grid" style="margin-top:18px"><label class="field span-2">อีเมลผู้ดูแลสถานศึกษาคนแรก<input name="email" type="email" autocomplete="off" required placeholder="name@example.com"></label><input type="hidden" name="role_code" value="school_admin"><div class="span-2 notice">ข้อมูลชื่อ อปท. ชื่อสถานศึกษา จังหวัด อำเภอ ปีการศึกษา และข้อมูลนักเรียนจะมาจาก LEC เท่านั้น ไม่มีการกรอกเองในขั้นตอนนี้</div><div class="span-2"><button class="primary-btn" type="submit">ส่งคำเชิญทางอีเมล</button></div></form></article><article class="panel"><div class="panel-head"><div><p class="eyebrow">Pending school onboarding</p><h2>คำเชิญที่ยังไม่ผูก LEC</h2></div></div>'+(rows?'<div class="table-wrap"><table><thead><tr><th>อีเมล</th><th>บทบาท</th><th>สถานะ</th><th>สถานศึกษา</th></tr></thead><tbody>'+rows+'</tbody></table></div>':'<div class="empty-state"><div class="empty-icon">✉️</div><h3>ยังไม่มีคำเชิญ</h3><p>ส่งคำเชิญให้ผู้ดูแลคนแรกของแต่ละโรงเรียนได้จากแบบฟอร์มด้านบน</p></div>')+'</article></section>';
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
  const platformMayInvite=state.isPlatformAdmin&&!schoolHasAdmin;

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
    : '<article class="panel"><div class="notice"><strong>โรงเรียนมี School Admin แล้ว</strong><br>การสร้างผู้ใช้และผู้ดูแลร่วมเป็นหน้าที่ของ School Admin โรงเรียนนี้ Platform Admin ตรวจสอบได้แต่ไม่สร้างผู้ใช้แทน</div></article>';

  const rows=(invRes.data||[]).map(x=>{
    const status={pending:["รอยืนยัน","warning"],onboarding:["รอนำเข้า LEC","warning"],accepted:["เปิดใช้งานแล้ว","success"],revoked:["ยกเลิก","neutral"],failed:["ส่งไม่สำเร็จ","danger"]}[x.status]||[x.status,"neutral"];
    return '<tr><td><strong>'+esc(x.email)+'</strong><br><small>'+new Date(x.sent_at).toLocaleString("th-TH")+'</small></td><td>'+esc(roleLabels[x.role_code]||x.role_code)+'</td><td><span class="pill '+status[1]+'">'+status[0]+'</span></td><td>'+esc(x.invitation_mode==="platform_first_admin"?"Platform Admin · คนแรก":"School Admin")+'</td></tr>';
  }).join("");
  const history='<article class="panel"><div class="panel-head"><div><p class="eyebrow">Invitation history</p><h2>บัญชีและคำเชิญ · '+esc(school.name_th)+'</h2></div></div>'+(rows?'<div class="table-wrap"><table><thead><tr><th>อีเมล</th><th>บทบาท</th><th>สถานะ</th><th>ผู้รับผิดชอบ</th></tr></thead><tbody>'+rows+'</tbody></table></div>':'<div class="empty-state"><div class="empty-icon">✉️</div><h3>ยังไม่มีคำเชิญ</h3></div>')+'</article>';
  return '<section class="content-grid">'+inviteForm+history+'</section>';
}

function notificationsHtml(){
  const rows=state.notifications.map(n=>{
    const unread=!n.read_at;
    return '<article class="notification-card '+(unread?"unread":"")+'"><div class="notification-icon">🔔</div><div class="notification-copy"><div class="notification-title"><strong>'+esc(n.title)+'</strong>'+(unread?'<span class="pill warning">ใหม่</span>':'')+'</div><p>'+esc(n.body||"")+'</p><small>'+new Date(n.created_at).toLocaleString("th-TH")+'</small></div>'+(unread?'<button class="secondary-btn" data-notification-read="'+n.id+'">ทำเครื่องหมายว่าอ่านแล้ว</button>':'')+'</article>';
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
  if(!ws||!ws["!ref"])return [];
  const range=XLSX.utils.decode_range(ws["!ref"]);
  const maxRows=Math.min(range.e.r+1,12000),maxCols=Math.min(range.e.c+1,180);
  const matrix=Array.from({length:maxRows},()=>Array(maxCols).fill(""));
  for(let r=0;r<maxRows;r++)for(let col=0;col<maxCols;col++){
    const cell=ws[XLSX.utils.encode_cell({r,col})];
    if(cell)matrix[r][col]=lecCellText(cell.w!=null?cell.w:cell.v);
  }
  (ws["!merges"]||[]).forEach(m=>{
    if(m.s.r>=maxRows||m.s.c>=maxCols)return;
    const value=matrix[m.s.r][m.s.c];
    if(!value)return;
    for(let r=m.s.r;r<=Math.min(m.e.r,maxRows-1);r++){
      for(let col=m.s.c;col<=Math.min(m.e.c,maxCols-1);col++)matrix[r][col]=value;
    }
  });
  return matrix;
}
function lecFindHeaderStart(matrix){
  const limit=Math.min(matrix.length,50);
  for(let r=0;r<limit;r++){
    const n=matrix[r].map(lecHeaderNorm);
    if(n.some(x=>x.includes("ลำดับที่"))&&n.some(x=>x.includes("เลขประจำตัวนักเรียน")))return r;
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
  let schoolName=schoolValues[0]||lecMetaFind(matrix,headerStart,["ชื่อสถานศึกษา","ชื่อโรงเรียน"]);
  if(!schoolName)schoolName=texts.find(x=>/^โรงเรียน/.test(x)&&!x.includes("รายงาน")&&!x.includes("ข้อมูลนักเรียน"))||null;
  const conflicts=[];
  if(schoolValues.length>1)conflicts.push("สถานศึกษา");
  if(orgValues.length>1)conflicts.push("อปท.");
  if(provinceValues.length>1)conflicts.push("จังหวัด");
  if(districtValues.length>1)conflicts.push("อำเภอ");
  return {
    school_code:lecMetaFind(matrix,headerStart,["รหัสสถานศึกษา","รหัสโรงเรียน","รหัสสถานศึกษา LEC"]),
    school_name_th:schoolName,
    organization_name_th:orgValues[0]||null,
    province_name_th:provinceValues[0]||null,
    district_name_th:districtValues[0]||null,
    academic_year_be:period.academic_year_be,
    term_no:period.term_no,
    school_phone:lecMetaFind(matrix,headerStart,["โทรศัพท์สถานศึกษา","โทรศัพท์โรงเรียน","โทรศัพท์","เบอร์โทรศัพท์"]),
    school_email:lecMetaFind(matrix,headerStart,["อีเมลสถานศึกษา","อีเมลโรงเรียน","E-mail","Email"]),
    school_website_url:lecMetaFind(matrix,headerStart,["เว็บไซต์สถานศึกษา","เว็บไซต์โรงเรียน","เว็บไซต์","Website"]),
    school_address_text:lecMetaFind(matrix,headerStart,["ที่อยู่สถานศึกษา","ที่อยู่โรงเรียน"]),
    report_heading:texts.find(x=>x.includes("รายงานรายละเอียดข้อมูลนักเรียน"))||null,
    school_metadata_conflicts:conflicts,
    period_conflicts:period.period_conflicts
  };
}
function lecSheetProfile(wb,sheetName){
  const ws=wb.Sheets[sheetName];
  if(!ws)return null;
  const matrix=lecWorksheetMatrix(ws);
  const headerStart=lecFindHeaderStart(matrix);
  if(headerStart<0)return {sheetName,valid:false,rowCount:0,missing:["หัวตาราง LEC"]};
  let flat;
  try{flat=lecFlattenHeaders(matrix,headerStart);}catch(e){
    return {sheetName,valid:false,rowCount:0,missing:["เลขประจำตัวนักเรียน"]};
  }
  const headers=flat.headers,map=lecBuildMap(headers);
  const required=["school_province","school_district","organization_name_th","school_name_th","student_no","first_name_th","last_name_th"];
  const missing=required.filter(k=>map[k]==null);
  const period=lecPeriodFromSheet(matrix,headerStart,map,flat.dataStart);
  if(!period.academic_year_be)missing.push("ปีการศึกษา");
  if(!period.term_no)missing.push("ภาคเรียน");
  if(period.period_conflicts&&period.period_conflicts.length)missing.push(...period.period_conflicts.map(x=>x+"ไม่สอดคล้อง"));
  let rowCount=0;
  for(let r=flat.dataStart;r<matrix.length;r++)if(lecMappedValue(matrix[r],map,"student_no"))rowCount++;
  const score=(required.length+2-missing.length)*100000+Math.min(rowCount,99999);
  return {sheetName,valid:missing.length===0&&rowCount>0,rowCount,missing,score,matrix,headerStart,flat,headers,map};
}
async function parseLecFile(file){
  if(!window.XLSX)throw new Error("ไม่สามารถโหลดตัวอ่านไฟล์ Excel ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่");
  const buffer=await file.arrayBuffer();
  const wb=XLSX.read(buffer,{type:"array",cellDates:true});
  if(!wb.SheetNames.length)throw new Error("ไฟล์ไม่มีแผ่นงาน");

  const profiles=wb.SheetNames.map(name=>lecSheetProfile(wb,name)).filter(Boolean);
  const candidates=profiles.filter(x=>x.valid).sort((a,b)=>b.score-a.score);
  if(!candidates.length){
    const scanned=profiles.map(x=>x.sheetName).join(", ");
    throw new Error("ไม่พบชีตข้อมูล LEC ที่มีข้อมูลสถานศึกษาครบ ต้องมีข้อมูล จังหวัด, อำเภอ, อปท., สถานศึกษา, ปีการศึกษา, ภาคเรียน, เลขประจำตัวนักเรียน, ชื่อ และนามสกุล"+(scanned?" (ตรวจแล้ว: "+scanned+")":""));
  }

  const selected=candidates[0],matrix=selected.matrix,headers=selected.headers,map=selected.map,flat=selected.flat;
  const missing=["school_province","school_district","organization_name_th","school_name_th","student_no","first_name_th","last_name_th"].filter(k=>map[k]==null);
  const rows=[];
  for(let r=flat.dataStart;r<matrix.length;r++){
    const canonical=lecBuildCanonical(matrix[r],map);
    if(!canonical.student_no)continue;
    rows.push({source_row_no:r+1,raw:lecRowObject(headers,matrix[r]),canonical});
  }
  if(!rows.length)throw new Error("ไม่พบข้อมูลนักเรียนในชีต "+selected.sheetName);

  const metadata=lecDetectMetadata(matrix,selected.headerStart,map,flat.dataStart);
  if(metadata.school_metadata_conflicts&&metadata.school_metadata_conflicts.length){
    throw new Error("ชีต "+selected.sheetName+" มีข้อมูลมากกว่าหนึ่งค่าในช่อง "+metadata.school_metadata_conflicts.join(", ")+" จึงไม่สามารถผูกกับสถานศึกษาเดียวได้");
  }
  if(metadata.period_conflicts&&metadata.period_conflicts.length){
    throw new Error("ชีต "+selected.sheetName+" มี "+metadata.period_conflicts.join(" และ ")+" มากกว่าหนึ่งค่า กรุณาดาวน์โหลดข้อมูล LEC ของรอบที่ถูกต้องใหม่");
  }
  if(!metadata.academic_year_be||!metadata.term_no){
    throw new Error("ไม่พบปีการศึกษาและภาคเรียนครบในข้อมูล LEC ระบบจึงไม่ให้ระบุเองเพื่อป้องกันข้อมูลคลาดเคลื่อน");
  }

  metadata.selected_sheet_name=selected.sheetName;
  metadata.sheet_selection_rule="complete_school_identity_columns";

  return {
    fileName:file.name,fileSize:file.size,sha256:await lecSha256(buffer),
    sheetName:selected.sheetName,
    ignoredSheetCount:Math.max(0,wb.SheetNames.length-1),
    ignoredSheets:wb.SheetNames.filter(name=>name!==selected.sheetName),
    sheetScan:profiles.map(x=>({sheetName:x.sheetName,valid:x.valid,rowCount:x.rowCount,missing:x.missing})),
    headers,map,headerMap:lecHeaderMapForServer(headers,map),
    missingRequired:missing,rows,metadata
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
    !state.isPlatformAdmin &&
    state.pendingInvitation &&
    state.pendingInvitation.status==="onboarding" &&
    state.pendingInvitation.invitation_mode==="platform_first_admin" &&
    state.pendingInvitation.role_code==="school_admin" &&
    !state.pendingInvitation.school_id
  );
  const activeSchoolAdmin=Boolean(!state.isPlatformAdmin&&school&&hasRole("school_admin"));

  if(!onboarding&&!activeSchoolAdmin){
    return '<section class="panel"><div class="empty-state"><div class="empty-icon">🔒</div><h3>หน้านี้สำหรับ School Admin เท่านั้น</h3><p>ผู้ดูแลสถานศึกษาที่ได้รับการอนุมัติจาก Platform Admin จึงจะสามารถนำเข้าข้อมูล LEC ได้</p><a class="secondary-btn" href="#/overview">กลับหน้าหลัก</a></div></section>';
  }

  let historyRows="";
  if(school){
    const history=await supabase.from("lao_lec_import_batches")
      .select("id,academic_year_be,term_no,source_file_name,source_sheet_name,source_row_count,imported_row_count,new_student_count,updated_student_count,missing_from_latest_count,issue_count,status,imported_at")
      .eq("school_id",school.id).order("imported_at",{ascending:false}).limit(30);
    if(history.error)throw history.error;
    historyRows=(history.data||[]).map(b=>'<tr><td><strong>'+b.academic_year_be+' / '+b.term_no+'</strong><br><small>'+new Date(b.imported_at).toLocaleString("th-TH")+'</small></td><td>'+esc(b.source_file_name)+'<br><small>'+esc(b.source_sheet_name||"ชีตข้อมูล LEC")+'</small></td><td>'+b.imported_row_count+' / '+b.source_row_count+'</td><td>'+b.new_student_count+'</td><td>'+b.updated_student_count+'</td><td>'+b.missing_from_latest_count+'</td><td>'+(b.issue_count?'<span class="pill danger">'+b.issue_count+'</span>':'<span class="pill success">0</span>')+'</td></tr>').join("");
  }

  const title=onboarding?"นำเข้า LEC ครั้งแรก":"นำเข้าข้อมูล LEC";
  const sub=onboarding
    ?"บัญชี School Admin ของคุณได้รับการอนุมัติแล้ว สามารถเลือกไฟล์ LEC และนำเข้าได้ทันที"
    :"เลือกไฟล์จาก LEC ระบบจะตรวจสอบและอัปเดตข้อมูลตามแหล่งต้นทางโดยอัตโนมัติ";

  const sourceInfo='<article class="panel lec-source-info"><div class="panel-head"><div><p class="eyebrow">แหล่งที่มาของข้อมูล</p><h2>ระบบสารสนเทศทางการศึกษาท้องถิ่น (LEC)</h2><p class="panel-sub">LAO-EMS ใช้ไฟล์ XLS/XLSX ที่ดาวน์โหลดจากระบบ LEC เป็นแหล่งข้อมูลต้นทางสำหรับข้อมูล อปท. สถานศึกษา ปีการศึกษา ภาคเรียน ชั้น ห้อง และข้อมูลนักเรียน เพื่อให้ข้อมูลในระบบสอดคล้องกับระบบกลางขององค์กรปกครองส่วนท้องถิ่น</p></div><span class="source-lock">🔒 LEC เท่านั้น</span></div><div class="lec-source-actions"><a class="primary-btn" href="https://lec.dla.go.th/index.jsp" target="_blank" rel="noopener noreferrer">เปิดระบบ LEC ↗</a><small>เว็บไซต์: lec.dla.go.th · ดาวน์โหลดไฟล์ข้อมูลจาก LEC แล้วกลับมานำเข้าที่หน้านี้</small></div></article>';

  const importBox='<article class="panel"><div class="panel-head"><div><p class="eyebrow">LEC → LAO-EMS</p><h2>'+title+'</h2><p class="panel-sub">'+sub+'</p></div><span class="pill success">School Admin</span></div><form id="lec-import-form" class="form-grid" style="margin-top:18px"><div class="span-2 auto-source-note"><div class="auto-source-icon">✓</div><div><strong>ไม่ต้องกรอกข้อมูลซ้ำ</strong><p>ระบบอ่านสถานศึกษา จังหวัด อำเภอ อปท. ปีการศึกษา ภาคเรียน ชั้น ห้อง และข้อมูลนักเรียนจากไฟล์ LEC โดยอัตโนมัติ</p></div></div><label class="lec-drop span-2"><input id="lec-file" name="file" type="file" accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required><span class="lec-drop-icon">⇧</span><strong>เลือกไฟล์ XLS / XLSX จาก LEC</strong><small>ระบบจะเลือกชีตข้อมูลที่ครบและแสดงข้อมูลให้ตรวจสอบก่อนบันทึก</small></label><div id="lec-preview" class="span-2"></div><div class="span-2"><button class="primary-btn" type="submit" disabled data-lec-import>ยืนยันนำเข้าจาก LEC</button></div></form></article>';

  const hist=school?'<article class="panel"><div class="panel-head"><div><p class="eyebrow">Import history</p><h2>ประวัติการนำเข้า LEC · '+esc(school.name_th)+'</h2><p class="panel-sub">ข้อมูลเดิมไม่ถูกลบ เมื่อเด็กหายจากไฟล์รอบใหม่จะบันทึกว่า “ไม่พบใน LEC รอบล่าสุด” เท่านั้น</p></div></div>'+(historyRows?'<div class="table-wrap"><table><thead><tr><th>ปี / ภาค</th><th>ไฟล์</th><th>นำเข้า / ทั้งหมด</th><th>นักเรียนใหม่</th><th>อัปเดต</th><th>ไม่พบรอบล่าสุด</th><th>ปัญหา</th></tr></thead><tbody>'+historyRows+'</tbody></table></div>':'<div class="empty-state"><div class="empty-icon">⇧</div><h3>ยังไม่เคยนำเข้า LEC</h3></div>')+'</article>':'';

  return '<section class="source-banner"><div><span class="badge">School Admin · Approved</span><h2>นำเข้าข้อมูลจาก LEC</h2><p>บัญชี School Admin ที่ได้รับการอนุมัติจาก Platform Admin สามารถนำเข้าไฟล์ LEC ได้โดยตรง</p></div><div class="banner-status"><span class="status-pill success">XLS/XLSX</span><span class="status-pill success">ไม่ต้องกรอกเอง</span><span class="status-pill success">เลือกชีตอัตโนมัติ</span></div></section><section class="content-grid">'+sourceInfo+importBox+hist+'</section>';
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
function renderLecPreview(preview){
  const box=q("#lec-preview"),btn=q("[data-lec-import]"); if(!box||!btn)return;
  const missing=preview.missingRequired||[],check=preview.schoolCheck||{};
  const sample=preview.rows.slice(0,5).map(r=>'<tr><td>'+esc(r.canonical.student_no||"-")+'</td><td>'+esc([r.canonical.prefix,r.canonical.first_name_th,r.canonical.last_name_th].filter(Boolean).join(" "))+'</td><td>'+esc(lecMaskId(r.canonical.citizen_id))+'</td><td>'+esc(r.canonical.grade_level||"-")+'</td><td>'+esc(r.canonical.classroom||"-")+'</td></tr>').join("");
  const ignored=preview.ignoredSheets.length?preview.ignoredSheets.map(esc).join(", "):"ไม่มี";
  const sourceOk=check.can_import!==false;
  const confirmOk=!check.requires_confirmation||preview.schoolResolution==="accept_new_lec";
  box.innerHTML='<div class="lec-preview-card"><div class="lec-preview-head"><div><strong>'+esc(preview.fileName)+'</strong><small>แท็บที่ใช้: '+esc(preview.sheetName)+' · '+preview.rows.length+' รายการ</small></div>'+(missing.length||!sourceOk?'<span class="pill danger">ยังนำเข้าไม่ได้</span>':confirmOk?'<span class="pill success">พร้อมนำเข้า</span>':'<span class="pill warning">รอยืนยัน</span>')+'</div><div class="lec-period-summary"><div><small>ปีการศึกษา</small><strong>'+esc(preview.metadata.academic_year_be||"-")+'</strong></div><div><small>ภาคเรียน</small><strong>'+(preview.metadata.term_no?("ภาคเรียนที่ "+esc(preview.metadata.term_no)):"-")+'</strong></div><div><small>นักเรียน</small><strong>'+preview.rows.length+' คน</strong></div></div><div class="lec-facts"><span>เลือกชีตอัตโนมัติ: '+esc(preview.sheetName)+'</span><span>อ่านคอลัมน์ '+preview.headers.length+' ช่อง</span><span>ข้ามชีต: '+ignored+'</span><span>SHA-256: '+esc((preview.sha256||"").slice(0,12))+'…</span></div>'+lecSchoolInfoHtml(preview)+(missing.length?'<div class="notice danger">ไม่พบคอลัมน์จำเป็น: '+missing.map(esc).join(", ")+' กรุณาดาวน์โหลดรายงาน LEC รูปแบบ RPT318 ที่ถูกต้องอีกครั้ง</div>':'<div class="notice success">สถานศึกษา ปีการศึกษา ภาคเรียน และข้อมูลนักเรียนจะนำเข้าตรงจาก LEC ไม่มีช่องให้กรอกหรือแก้ค่าต้นทางก่อนนำเข้า</div>')+'<div class="table-wrap"><table><thead><tr><th>รหัสนักเรียน</th><th>ชื่อ-สกุล</th><th>เลขประชาชน</th><th>ชั้น</th><th>ห้อง</th></tr></thead><tbody>'+sample+'</tbody></table></div></div>';
  btn.disabled=missing.length>0||!sourceOk||!confirmOk;
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
    if(p.schoolCheck&&p.schoolCheck.can_import===false){toast("ข้อมูลสถานศึกษาในไฟล์ไม่ตรงกับโรงเรียนนี้","error");return;}
    if(p.schoolCheck&&p.schoolCheck.requires_confirmation&&p.schoolResolution!=="accept_new_lec"){toast("กรุณายืนยันว่าจะใช้ข้อมูลสถานศึกษาจาก LEC ใหม่ก่อน","error");return;}
    if(!confirm("ยืนยันนำเข้า LEC ปีการศึกษา "+p.metadata.academic_year_be+" ภาคเรียนที่ "+p.metadata.term_no+" จำนวน "+p.rows.length+" คน? ระบบจะรักษาประวัติเดิมไว้"))return;
    const btn=q("[data-lec-import]");
    setBusy(btn,true,"กำลังนำเข้า LEC...");
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
    const res=await supabase.rpc(rpcName,rpcArgs);
    setBusy(btn,false);
    if(res.error){toast(res.error.message,"error");return;}
    const x=res.data||{};
    toast((onboarding?"สร้างสถานศึกษาและนำเข้า LEC สำเร็จ: ":"นำเข้า LEC สำเร็จ: ")+(x.imported_rows||0)+" รายการ","success");
    state.lecPreview=null;
    await loadContext();
    if(onboarding)location.hash="#/setup";
    renderRoute();
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
  form.addEventListener("submit",async e=>{
    e.preventDefault();
    const fd=new FormData(form),btn=form.querySelector("button[type=submit]");
    const password=String(fd.get("password")||""),confirmPassword=String(fd.get("confirm_password")||"");
    const mustSet=!state.memberships.some(m=>m.status==="active");
    if(mustSet&&!password){toast("กรุณากำหนดรหัสผ่านใหม่","error");return;}
    if(password&&password.length<8){toast("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร","error");return;}
    if(password!==confirmPassword){toast("รหัสผ่านทั้งสองช่องไม่ตรงกัน","error");return;}
    setBusy(btn,true,"กำลังเปิดใช้งานบัญชี...");
    const prefix=String(fd.get("prefix")||"").trim(),first=String(fd.get("first_name")||"").trim(),last=String(fd.get("last_name")||"").trim(),phone=String(fd.get("phone")||"").trim();
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
  form.addEventListener("submit",async e=>{
    e.preventDefault();
    const fd=new FormData(form),btn=form.querySelector("button[type=submit]");
    const password=String(fd.get("password")||""),confirmPassword=String(fd.get("confirm_password")||"");
    if(password&&password.length<8){toast("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร","error");return;}
    if(password!==confirmPassword){toast("รหัสผ่านทั้งสองช่องไม่ตรงกัน","error");return;}
    const prefix=String(fd.get("prefix")||"").trim(),first=String(fd.get("first_name")||"").trim(),last=String(fd.get("last_name")||"").trim(),phone=String(fd.get("phone")||"").trim();
    setBusy(btn,true,"กำลังบันทึก...");
    const pr=await supabase.rpc("lao_ensure_profile",{p_prefix:prefix||null,p_first_name_th:first,p_last_name_th:last,p_display_name:[prefix,first,last].filter(Boolean).join(" "),p_phone:phone||null});
    if(pr.error){setBusy(btn,false);toast(pr.error.message,"error");return;}
    const update={data:{prefix,first_name_th:first,last_name_th:last,display_name:[prefix,first,last].filter(Boolean).join(" "),phone}};
    if(password)update.password=password;
    const au=await supabase.auth.updateUser(update);
    setBusy(btn,false);
    if(au.error){toast(authMessage(au.error.message),"error");return;}
    await loadContext();toast("บันทึกโปรไฟล์แล้ว","success");renderRoute();
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
    setBusy(refresh,true,"กำลังตรวจสอบ...");
    try{await loadSchoolSetupStatus();toast("อัปเดตสถานะ Google Drive แล้ว","success");renderRoute();}
    catch(e){toast(e.message||String(e),"error");}
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

async function renderRoute(){
  if(!state.user)return;
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
  main.innerHTML='<section class="panel"><div class="loading-inline"><span class="spinner"></span>กำลังโหลด...</div></section>';
  try{
    if(route==="overview"){main.innerHTML=(state.isPlatformAdmin&&state.viewMode==="admin")?adminOverviewHtml():overviewHtml();bindOverview();}
    else if(route==="membership"){main.innerHTML=membershipHtml();}
    else if(route==="activate"){main.innerHTML=activationHtml();bindActivation();}
    else if(route==="profile"){main.innerHTML=profileHtml();bindProfile();}
    else if(route==="notifications"){main.innerHTML=notificationsHtml();bindNotifications();}
    else if(route==="setup"){main.innerHTML=await setupHtml();bindSetup();}
    else if(route==="organization"){main.innerHTML=await organizationHtml();bindOrganizationForms();}
    else if(route==="lec"){main.innerHTML=await lecHtml();bindLec();}
    else if(route==="users"){main.innerHTML=await usersHtml();bindInvites();}
    else main.innerHTML=placeholderHtml(route);
  }catch(e){
    console.error(e);
    main.innerHTML='<section class="panel"><div class="notice danger"><strong>โหลดข้อมูลไม่สำเร็จ</strong><br>'+esc(e.message||e)+'</div></section>';
  }
}
async function showApp(session){
  state.session=session;state.user=session.user;
  q("#auth-screen").classList.add("hidden");q("#app-shell").classList.remove("hidden");
  try{
    await loadContext();
    if(!location.hash)location.hash=state.pendingInvitation?"#/activate":"#/overview";
    await renderRoute();
    const driveNotice=sessionStorage.getItem("lao_drive_notice");
    if(driveNotice){
      sessionStorage.removeItem("lao_drive_notice");
      const msg=sessionStorage.getItem("lao_drive_message");sessionStorage.removeItem("lao_drive_message");
      toast(driveNotice==="connected"?"เชื่อม Google Drive และเตรียม /LAO-EMS/ แล้ว":(msg||"เชื่อม Google Drive ไม่สำเร็จ"),driveNotice==="connected"?"success":"error");
    }
  }
  catch(e){
    console.error(e);
    if(e&&e.message==="LAO_ACCESS_REQUIRED"){
      localStorage.setItem("lao_legacy_session_rejected","1");
      sessionStorage.setItem("lao_access_denied_notice","1");
      clearLaoAuthSession();
      location.reload();
      return;
    }
    toast("โหลดข้อมูลผู้ใช้ไม่สำเร็จ: "+e.message,"error");
  }
}
function showAuth(){
  q("#app-shell").classList.add("hidden");q("#auth-screen").classList.remove("hidden");
  const token=schoolAdminApplyToken(),signin=q("#signin-form"),application=q("#school-admin-application");
  if(token){if(signin)signin.classList.add("hidden");if(application){application.classList.remove("hidden");renderPublicSchoolAdminApplication(token);}}
  else{if(signin)signin.classList.remove("hidden");if(application)application.classList.add("hidden");}
}

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
  const query=new URLSearchParams(location.search);
  const driveResult=query.get("drive");
  if(driveResult){
    history.replaceState(null,"",location.pathname+location.hash);
    sessionStorage.setItem("lao_drive_notice",driveResult==="connected"?"connected":"error");
    if(query.get("message"))sessionStorage.setItem("lao_drive_message",query.get("message"));
  }
  if(res.data.session)await showApp(res.data.session);else{
    showAuth();
    if(sessionStorage.getItem("lao_access_denied_notice")==="1"){
      sessionStorage.removeItem("lao_access_denied_notice");
      toast("บัญชีนี้ยังไม่ได้รับคำเชิญจากผู้ดูแล LAO-EMS","error");
    }
  }
  supabase.auth.onAuthStateChange(async(event,session)=>{
    if(event==="SIGNED_OUT"||!session){state.session=state.user=state.profile=state.currentMembership=null;state.memberships=[];showAuth();return;}
    if(event==="SIGNED_IN")await showApp(session);
  });
}
init();
