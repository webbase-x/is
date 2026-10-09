import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.8/+esm';
const db=createClient('https://xnpzkhjodokvcgzovlxx.supabase.co','sb_publishable_r0M5jKyJcrQAKstRlmYOdQ_J_0aLofN',{auth:{storageKey:'p1-classroom-auth',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const check=r=>{if(r.error)throw Error(r.error.message);return r.data};
export async function profile(){const {data,error}=await db.auth.getSession();if(error)throw error;if(!data.session)return null;const p=check(await db.rpc('p1_classroom',{action:'profile',args:{}}));if(p.role!=='teacher')throw Error('บัญชีนี้ยังไม่มีสิทธิ์ครู กรุณาใช้บัญชีครูที่ได้รับอนุมัติ');return data.session.user}
export async function signin(email,password){check(await db.auth.signInWithPassword({email,password}));return profile()}
export async function google(){check(await db.auth.signInWithOAuth({provider:'google',options:{redirectTo:new URL('index.html',import.meta.url).href}}))}
export async function signout(){check(await db.auth.signOut())}
export async function rooms(){await profile();return check(await db.from('rt_classrooms').select('id,name,revision,updated_at').order('updated_at',{ascending:false}))}
export async function load(id){await profile();return check(await db.from('rt_classrooms').select('*').eq('id',id).single())}
export async function save(state,old){const user=await profile();if(!user)throw Error('กรุณาเข้าสู่ระบบครู');const payload={name:state.name,state,updated_at:new Date().toISOString()};if(new TextEncoder().encode(JSON.stringify(state)).length>1800000)throw Error('ข้อมูลลายเขียนมากเกินไป กรุณาสำรองและลดลายเขียนก่อนบันทึก');if(old){const rows=check(await db.from('rt_classrooms').update({...payload,revision:old.revision+1}).eq('id',old.id).eq('revision',old.revision).select());if(!rows.length)throw Error('ห้องนี้เปลี่ยนบนอีกเครื่องแล้ว ส่งออกข้อมูลบนเครื่องนี้ก่อน แล้วโหลดห้องใหม่');return rows[0]}return check(await db.from('rt_classrooms').insert({...payload,owner_id:user.id}).select().single())}
export async function p1Rooms(){await profile();return check(await db.from('p1_rooms').select('id,name').order('created_at'))}
export async function p1Pupils(id){await profile();return check(await db.from('p1_pupils').select('id,number,name,active').eq('room_id',id).order('number'))}
