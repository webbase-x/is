# Initial Administrator Bootstrap

LAO-EMS ไม่อนุญาตให้ “ผู้สมัครคนแรก” ได้สิทธิ์ผู้ดูแลอัตโนมัติ เพราะเว็บสาธารณะอาจถูกเปิดก่อนผู้ดูแลจริงสมัครบัญชี

ขั้นตอนเปิดระบบครั้งแรก:

1. เปิดหน้า LAO-EMS และสมัครบัญชีผู้ดูแลคนแรกด้วยบัญชีจริง
2. ยืนยันอีเมลและเข้าสู่ระบบอย่างน้อยหนึ่งครั้ง เพื่อให้มี `lao_profiles`
3. นำ `auth.users.id` ของบัญชีที่ตรวจสอบแล้ว เพิ่มใน `lao_platform_admins` ผ่าน Supabase Admin/SQL ที่เชื่อถือได้
4. ผู้ดูแลเข้าสู่ระบบใหม่
5. เมนู “อปท. และสถานศึกษา” จะเปิดฟอร์มเพิ่ม อปท. และโรงเรียน
6. จากนั้นบุคลากรคนอื่นสมัครและส่ง Membership Request ตามปกติ

ตัวอย่าง SQL สำหรับ bootstrap ครั้งแรก:

```sql
insert into public.lao_platform_admins(user_id)
values ('<VERIFIED_AUTH_USER_UUID>')
on conflict (user_id) do nothing;
```

หลังมี Platform Admin คนแรกแล้ว การเพิ่ม Platform Admin คนถัดไปใช้ RPC `lao_grant_platform_admin(uuid)` ซึ่งตรวจสิทธิ์ผู้เรียกก่อนทุกครั้ง

ห้ามสร้างระบบ “คนแรกที่สมัคร = admin” ใน production
