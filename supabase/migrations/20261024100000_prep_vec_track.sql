-- Second exam track: ครูผู้ช่วย สังกัด สอศ. (อาชีวศึกษา), next to the existing สพฐ. track.
-- The ก.ค.ศ. syllabus for สอศ. has the same shape as สพฐ. (ภาค ก 100/50/50, ภาค ข 75/100/25), so the six mock
-- subjects stay; what changes per track is which topics feed them and which majors can be chosen.
--   prep.profiles.track   'obec' (สพฐ., default) or 'vec' (สอศ.)
--   prep.topics.track     null = both tracks, otherwise only that track
--   prep.mock_quota.track the topic mix of each mock subject, per track
-- Syllabus and sources: docs/prep-vocational-blueprint.md

alter table prep.profiles add column if not exists track text not null default 'obec' check (track in ('obec', 'vec'));
alter table prep.topics   add column if not exists track text check (track in ('obec', 'vec'));

-- สพฐ.-only content. สามัญ majors that สอศ. also recruits for (ไทย อังกฤษ คณิต วิทย์ สังคม พลศึกษา ชีวะ ฟิสิกส์ จีน)
-- stay shared, as do ภาค ก, the rest of ภาค ข วิชาชีพครู and the education laws.
update prep.topics set track = 'obec' where code = 'B1-CURR';
update prep.topics set track = 'obec'
 where grp = 'B3' and code not in ('B3-THAI', 'B3-ENG', 'B3-MATH', 'B3-SCI', 'B3-SOC', 'B3-PE', 'B3-BIO', 'B3-PHYS', 'B3-CHN');

insert into prep.topics (code, section, grp, name, sort, track) values
  ('B1-VEC-CURR', 'B', 'B1', 'หลักสูตรอาชีวศึกษา / ทวิภาคี', 68, 'vec'),
  ('B1-VEC-QA',   'B', 'B1', 'ประกันคุณภาพการศึกษาอาชีวศึกษา', 69, 'vec'),
  ('B1-VEC-SEP',  'B', 'B1', 'บริบทโลก สังคม และปรัชญาของเศรษฐกิจพอเพียง', 70, 'vec'),
  ('B2-VECACT',   'B', 'B2', 'พ.ร.บ.การอาชีวศึกษา', 77, 'vec'),
  ('B3-V-ELEC',   'B', 'B3', 'ช่างไฟฟ้ากำลัง', 110, 'vec'),
  ('B3-V-AUTO',   'B', 'B3', 'ช่างยนต์', 111, 'vec'),
  ('B3-V-BIZIT',  'B', 'B3', 'คอมพิวเตอร์ธุรกิจและเทคโนโลยีสารสนเทศ', 112, 'vec'),
  ('B3-V-ACC',    'B', 'B3', 'การบัญชี', 113, 'vec'),
  ('B3-V-MECH',   'B', 'B3', 'ช่างกลโรงงานและเทคนิคการผลิต', 114, 'vec')
on conflict (code) do nothing;

-- Sub-topics (weights per 100 questions of the topic). They drive the question writer and the mock draw.
insert into prep.subtopics (code, topic, name, kind, weight, sort, keywords) values
  ('B3-V-ELEC-CIRC',  'B3-V-ELEC', 'วงจรไฟฟ้ากระแสตรงและกระแสสลับ', 'content', 14, 1, 'กฎของโอห์ม กฎของเคอร์ชอฟฟ์ กำลังไฟฟ้า ตัวประกอบกำลัง วงจร RLC ไฟฟ้า 3 เฟส'),
  ('B3-V-ELEC-MACH',  'B3-V-ELEC', 'เครื่องกลไฟฟ้า', 'content', 14, 2, 'หม้อแปลงไฟฟ้า มอเตอร์เหนี่ยวนำ มอเตอร์ไฟฟ้ากระแสตรง เครื่องกำเนิดไฟฟ้า'),
  ('B3-V-ELEC-INST',  'B3-V-ELEC', 'การติดตั้งไฟฟ้าในอาคารและมาตรฐาน', 'content', 14, 3, 'มาตรฐานการติดตั้งทางไฟฟ้า การเลือกขนาดสาย เซอร์กิตเบรกเกอร์ การต่อลงดิน การคำนวณโหลด'),
  ('B3-V-ELEC-CTRL',  'B3-V-ELEC', 'การควบคุมมอเตอร์และ PLC', 'content', 12, 4, 'วงจรควบคุมมอเตอร์ แมกเนติกคอนแทกเตอร์ รีเลย์ตั้งเวลา สตาร์-เดลต้า PLC แลดเดอร์'),
  ('B3-V-ELEC-MEAS',  'B3-V-ELEC', 'เครื่องวัดไฟฟ้า', 'content', 8, 5, 'มัลติมิเตอร์ แคลมป์มิเตอร์ เมกะโอห์มมิเตอร์ วัตต์มิเตอร์ การวัดค่าความเป็นฉนวน'),
  ('B3-V-ELEC-POWER', 'B3-V-ELEC', 'ระบบไฟฟ้ากำลังและพลังงาน', 'content', 10, 6, 'ระบบส่งและจ่ายไฟฟ้า หม้อแปลงจำหน่าย โซลาร์เซลล์ พลังงานทดแทน การประหยัดพลังงาน'),
  ('B3-V-ELEC-ELEX',  'B3-V-ELEC', 'อิเล็กทรอนิกส์สำหรับงานไฟฟ้า', 'content', 8, 7, 'ไดโอด ทรานซิสเตอร์ วงจรเรียงกระแส SCR อุปกรณ์อิเล็กทรอนิกส์กำลัง'),
  ('B3-V-ELEC-SAFE',  'B3-V-ELEC', 'ความปลอดภัยในงานไฟฟ้า', 'content', 8, 8, 'อันตรายจากไฟฟ้า การช่วยเหลือผู้ถูกไฟฟ้าดูด อุปกรณ์ป้องกันส่วนบุคคล การตัดวงจรก่อนปฏิบัติงาน'),
  ('B3-V-ELEC-PED',   'B3-V-ELEC', 'การจัดการเรียนรู้วิชาชีพช่างไฟฟ้า', 'pedagogy', 12, 9, 'การสอนงานปฏิบัติ ใบงาน การประเมินทักษะปฏิบัติ ความปลอดภัยในโรงฝึกงาน ระบบทวิภาคี'),

  ('B3-V-AUTO-ENG',   'B3-V-AUTO', 'เครื่องยนต์แก๊สโซลีนและดีเซล', 'content', 16, 1, 'วัฏจักร 4 จังหวะ 2 จังหวะ ส่วนประกอบเครื่องยนต์ อัตราส่วนกำลังอัด ระบบหล่อลื่น ระบบระบายความร้อน'),
  ('B3-V-AUTO-FUEL',  'B3-V-AUTO', 'ระบบเชื้อเพลิงและระบบฉีดเชื้อเพลิงอิเล็กทรอนิกส์', 'content', 12, 2, 'หัวฉีด EFI คอมมอนเรล เซนเซอร์ ECU'),
  ('B3-V-AUTO-ELEC',  'B3-V-AUTO', 'ไฟฟ้ารถยนต์', 'content', 12, 3, 'แบตเตอรี่ ระบบสตาร์ท ระบบประจุไฟ ระบบจุดระเบิด ระบบแสงสว่าง'),
  ('B3-V-AUTO-DRV',   'B3-V-AUTO', 'ระบบส่งกำลัง', 'content', 12, 4, 'คลัตช์ เกียร์ธรรมดา เกียร์อัตโนมัติ เพลากลาง เฟืองท้าย'),
  ('B3-V-AUTO-CHAS',  'B3-V-AUTO', 'ระบบช่วงล่าง เบรก และบังคับเลี้ยว', 'content', 12, 5, 'ระบบรองรับ ศูนย์ล้อ ระบบเบรก ABS พวงมาลัยเพาเวอร์'),
  ('B3-V-AUTO-EV',    'B3-V-AUTO', 'ยานยนต์ไฟฟ้าและไฮบริด', 'content', 10, 6, 'ยานยนต์ไฟฟ้า แบตเตอรี่แรงดันสูง มอเตอร์ขับเคลื่อน ความปลอดภัยไฟฟ้าแรงสูง'),
  ('B3-V-AUTO-MAINT', 'B3-V-AUTO', 'การบำรุงรักษาและวิเคราะห์ปัญหา', 'content', 8, 7, 'การตรวจเช็กตามระยะ เครื่องมือวัด OBD การวิเคราะห์อาการเสีย'),
  ('B3-V-AUTO-SAFE',  'B3-V-AUTO', 'ความปลอดภัยและเครื่องมือในงานยานยนต์', 'content', 6, 8, 'เครื่องมือช่างยนต์ แม่แรง ลิฟต์ยกรถ ความปลอดภัยในโรงซ่อม'),
  ('B3-V-AUTO-PED',   'B3-V-AUTO', 'การจัดการเรียนรู้วิชาชีพช่างยนต์', 'pedagogy', 12, 9, 'การสอนงานปฏิบัติ ใบงาน การประเมินทักษะปฏิบัติ ความปลอดภัยในโรงฝึกงาน ระบบทวิภาคี'),

  ('B3-V-BIZIT-FUND',   'B3-V-BIZIT', 'พื้นฐานคอมพิวเตอร์และระบบปฏิบัติการ', 'content', 10, 1, 'ฮาร์ดแวร์ ซอฟต์แวร์ หน่วยความจำ ระบบเลขฐาน ระบบปฏิบัติการ'),
  ('B3-V-BIZIT-PROG',   'B3-V-BIZIT', 'การเขียนโปรแกรม', 'content', 16, 2, 'อัลกอริทึม ผังงาน ตัวแปร เงื่อนไข การวนซ้ำ ฟังก์ชัน Python'),
  ('B3-V-BIZIT-DB',     'B3-V-BIZIT', 'ระบบฐานข้อมูล', 'content', 12, 3, 'แบบจำลอง ER คีย์หลัก คีย์นอก นอร์มัลไลซ์ SQL'),
  ('B3-V-BIZIT-NET',    'B3-V-BIZIT', 'เครือข่ายและความปลอดภัยข้อมูล', 'content', 12, 4, 'แบบจำลอง OSI TCP/IP IP address อุปกรณ์เครือข่าย มัลแวร์ การเข้ารหัส'),
  ('B3-V-BIZIT-WEB',    'B3-V-BIZIT', 'การพัฒนาเว็บและแอปพลิเคชัน', 'content', 12, 5, 'HTML CSS JavaScript เว็บที่รองรับทุกหน้าจอ'),
  ('B3-V-BIZIT-OFFICE', 'B3-V-BIZIT', 'โปรแกรมสำนักงานเพื่องานธุรกิจ', 'content', 10, 6, 'สเปรดชีต ฟังก์ชัน กราฟ งานเอกสาร งานนำเสนอ'),
  ('B3-V-BIZIT-DIGBIZ', 'B3-V-BIZIT', 'ธุรกิจดิจิทัลและพาณิชย์อิเล็กทรอนิกส์', 'content', 10, 7, 'พาณิชย์อิเล็กทรอนิกส์ การตลาดดิจิทัล ระบบชำระเงินออนไลน์'),
  ('B3-V-BIZIT-LAW',    'B3-V-BIZIT', 'จริยธรรมและกฎหมายดิจิทัล', 'content', 6, 8, 'กฎหมายว่าด้วยการกระทำความผิดเกี่ยวกับคอมพิวเตอร์ การคุ้มครองข้อมูลส่วนบุคคล ลิขสิทธิ์ซอฟต์แวร์'),
  ('B3-V-BIZIT-PED',    'B3-V-BIZIT', 'การจัดการเรียนรู้วิชาคอมพิวเตอร์ธุรกิจ', 'pedagogy', 12, 9, 'การสอนเขียนโปรแกรม การเรียนรู้จากโครงงาน การประเมินชิ้นงาน ระบบทวิภาคี'),

  ('B3-V-ACC-PRIN',  'B3-V-ACC', 'หลักการบัญชีเบื้องต้น', 'content', 16, 1, 'สมการบัญชี วงจรบัญชี การบันทึกบัญชีคู่ สมุดรายวัน บัญชีแยกประเภท งบทดลอง'),
  ('B3-V-ACC-ADJ',   'B3-V-ACC', 'รายการปรับปรุงและงบการเงิน', 'content', 14, 2, 'รายการปรับปรุง กระดาษทำการ งบกำไรขาดทุน งบแสดงฐานะการเงิน การปิดบัญชี'),
  ('B3-V-ACC-MERCH', 'B3-V-ACC', 'บัญชีธุรกิจซื้อขายสินค้าและสินค้าคงเหลือ', 'content', 10, 3, 'ระบบสินค้าคงเหลือ เข้าก่อนออกก่อน ถัวเฉลี่ย ต้นทุนขาย'),
  ('B3-V-ACC-PART',  'B3-V-ACC', 'บัญชีห้างหุ้นส่วนและบริษัท', 'content', 10, 4, 'การแบ่งกำไรขาดทุน ทุนเรือนหุ้น เงินปันผล'),
  ('B3-V-ACC-COST',  'B3-V-ACC', 'การบัญชีต้นทุน', 'content', 12, 5, 'ต้นทุนการผลิต ต้นทุนงานสั่งทำ ต้นทุนช่วง จุดคุ้มทุน'),
  ('B3-V-ACC-TAX',   'B3-V-ACC', 'ภาษีอากร', 'content', 10, 6, 'ภาษีมูลค่าเพิ่ม ภาษีเงินได้หัก ณ ที่จ่าย ภาษีเงินได้บุคคลธรรมดา'),
  ('B3-V-ACC-STD',   'B3-V-ACC', 'มาตรฐานการรายงานทางการเงินและกฎหมายการบัญชี', 'content', 8, 7, 'กรอบแนวคิดสำหรับการรายงานทางการเงิน มาตรฐานสำหรับกิจการที่ไม่มีส่วนได้เสียสาธารณะ กฎหมายว่าด้วยการบัญชี'),
  ('B3-V-ACC-SOFT',  'B3-V-ACC', 'การบัญชีด้วยคอมพิวเตอร์และการวิเคราะห์งบการเงิน', 'content', 8, 8, 'โปรแกรมบัญชี อัตราส่วนทางการเงิน'),
  ('B3-V-ACC-PED',   'B3-V-ACC', 'การจัดการเรียนรู้วิชาการบัญชี', 'pedagogy', 12, 9, 'การสอนบันทึกบัญชี กรณีศึกษา การประเมินชิ้นงาน ระบบทวิภาคี'),

  ('B3-V-MECH-DRAW',  'B3-V-MECH', 'เขียนแบบเทคนิคและการอ่านแบบ', 'content', 12, 1, 'การฉายภาพ มาตรฐานงานเขียนแบบ สัญลักษณ์ผิวงาน ค่าพิกัดความเผื่อ'),
  ('B3-V-MECH-MEAS',  'B3-V-MECH', 'งานวัดละเอียด', 'content', 10, 2, 'เวอร์เนียร์คาลิปเปอร์ ไมโครมิเตอร์ ไดอัลเกจ งานสวม'),
  ('B3-V-MECH-LATHE', 'B3-V-MECH', 'งานกลึง', 'content', 14, 3, 'ความเร็วตัด อัตราป้อน มีดกลึง การกลึงเกลียว การกลึงเรียว'),
  ('B3-V-MECH-MILL',  'B3-V-MECH', 'งานกัด เจาะ และเจียระไน', 'content', 12, 4, 'เครื่องกัด หัวแบ่ง ดอกกัด เครื่องเจาะ เครื่องเจียระไน'),
  ('B3-V-MECH-CNC',   'B3-V-MECH', 'เครื่องจักรกลซีเอ็นซีและ CAD/CAM', 'content', 14, 5, 'G-code M-code ระบบพิกัด การเขียนโปรแกรมซีเอ็นซี CAD/CAM'),
  ('B3-V-MECH-MAT',   'B3-V-MECH', 'วัสดุช่างและกรรมวิธีทางความร้อน', 'content', 10, 6, 'เหล็กกล้า โลหะนอกกลุ่มเหล็ก การชุบแข็ง การอบอ่อน'),
  ('B3-V-MECH-BENCH', 'B3-V-MECH', 'งานฝึกฝีมือและเครื่องมือกล', 'content', 8, 7, 'ตะไบ เลื่อย ต๊าป ไดส์ การร่างแบบงาน'),
  ('B3-V-MECH-SAFE',  'B3-V-MECH', 'ความปลอดภัยและการบำรุงรักษาเครื่องจักร', 'content', 8, 8, 'ความปลอดภัยในโรงงาน การหล่อลื่น การบำรุงรักษาเชิงป้องกัน'),
  ('B3-V-MECH-PED',   'B3-V-MECH', 'การจัดการเรียนรู้วิชาชีพช่างกลโรงงาน', 'pedagogy', 12, 9, 'การสอนงานปฏิบัติ ใบงาน การประเมินทักษะปฏิบัติ ความปลอดภัยในโรงฝึกงาน ระบบทวิภาคี'),

  ('B1-VEC-CURR-STRUCT', 'B1-VEC-CURR', 'โครงสร้างหลักสูตร ปวช. และ ปวส.', 'content', 40, 1, 'หลักสูตรประกาศนียบัตรวิชาชีพ หลักสูตรประกาศนียบัตรวิชาชีพชั้นสูง หมวดสมรรถนะแกนกลาง หมวดสมรรถนะวิชาชีพ หมวดวิชาเลือกเสรี กิจกรรมเสริมหลักสูตร'),
  ('B1-VEC-CURR-QUAL',   'B1-VEC-CURR', 'กรอบคุณวุฒิอาชีวศึกษาและมาตรฐานคุณวุฒิ', 'content', 30, 2, 'กรอบคุณวุฒิอาชีวศึกษาแห่งชาติ มาตรฐานคุณวุฒิอาชีวศึกษา สมรรถนะ มาตรฐานอาชีพ'),
  ('B1-VEC-CURR-DUAL',   'B1-VEC-CURR', 'การจัดการเรียนรู้ระบบทวิภาคีและความร่วมมือกับสถานประกอบการ', 'pedagogy', 30, 3, 'ระบบทวิภาคี ครูฝึกในสถานประกอบการ การฝึกอาชีพ การประเมินผลร่วมกับสถานประกอบการ'),
  ('B1-VEC-QA-INT',      'B1-VEC-QA', 'การประกันคุณภาพภายในและมาตรฐานการอาชีวศึกษา', 'content', 50, 1, 'มาตรฐานการอาชีวศึกษา การประกันคุณภาพภายใน บทบาทครูในงานประกันคุณภาพ'),
  ('B1-VEC-QA-EXT',      'B1-VEC-QA', 'การประกันคุณภาพภายนอก', 'content', 25, 2, 'การประเมินคุณภาพภายนอก หน่วยงานที่ประเมิน ความสัมพันธ์กับการประกันคุณภาพภายใน'),
  ('B1-VEC-QA-SAR',      'B1-VEC-QA', 'การประเมินตนเองและวงจรพัฒนาคุณภาพ', 'pedagogy', 25, 3, 'รายงานการประเมินตนเอง วงจร PDCA การใช้ผลประเมินพัฒนาการเรียนการสอน'),
  ('B1-VEC-SEP-SEP',     'B1-VEC-SEP', 'ปรัชญาของเศรษฐกิจพอเพียงในสถานศึกษา', 'content', 50, 1, 'ความพอประมาณ ความมีเหตุผล การมีภูมิคุ้มกัน เงื่อนไขความรู้ เงื่อนไขคุณธรรม การประยุกต์ในการจัดการเรียนรู้'),
  ('B1-VEC-SEP-WORLD',   'B1-VEC-SEP', 'การเปลี่ยนแปลงบริบทโลกและสังคม', 'content', 50, 2, 'ทักษะแห่งศตวรรษที่ 21 เทคโนโลยีดิจิทัล อุตสาหกรรมเป้าหมาย สังคมสูงวัย การพัฒนาที่ยั่งยืน'),
  ('B2-VECACT-LAW',      'B2-VECACT', 'พระราชบัญญัติการอาชีวศึกษา พ.ศ. 2551', 'content', 70, 1, 'รูปแบบการจัดการอาชีวศึกษา ในระบบ นอกระบบ ระบบทวิภาคี สถาบันการอาชีวศึกษา คณะกรรมการการอาชีวศึกษา'),
  ('B2-VECACT-DUAL',     'B2-VECACT', 'การจัดการอาชีวศึกษาระบบทวิภาคีตามกฎหมาย', 'content', 30, 2, 'ความร่วมมือกับสถานประกอบการ สิทธิและหน้าที่ของผู้เรียนระบบทวิภาคี')
on conflict (code) do nothing;

-- Mock mix per track. สอศ. keeps ภาค ก and the major as is; ภาค ข follows its own syllabus
-- (ก.ค.ศ. หลักสูตรการสอบ สอศ.: 1.1 บริบทโลก/เศรษฐกิจพอเพียง 1.2 จิตวิทยา 1.3 หลักสูตร ศาสตร์การสอน เทคโนโลยีดิจิทัล
--  1.4 วัดผลและวิจัย 1.5 ประกันคุณภาพ; กฎหมาย 8 ฉบับ + แนวทางปฏิรูปการศึกษา).
alter table prep.mock_quota add column if not exists track text not null default 'obec' check (track in ('obec', 'vec'));
alter table prep.mock_quota drop constraint if exists mock_quota_pkey;
alter table prep.mock_quota add primary key (track, subject, topic);
insert into prep.mock_quota (track, subject, topic, n)
select 'vec', subject, topic, n from prep.mock_quota where track = 'obec' and subject in ('A-THINK', 'A-ENG', 'A-CIVIL', 'B-MAJOR')
on conflict do nothing;
insert into prep.mock_quota (track, subject, topic, n) values
  ('vec', 'B-LEARN', 'B1-VEC-SEP', 8), ('vec', 'B-LEARN', 'B1-PSY', 12), ('vec', 'B-LEARN', 'B1-VEC-CURR', 10),
  ('vec', 'B-LEARN', 'B1-INSTR', 10), ('vec', 'B-LEARN', 'B1-INNOV', 8), ('vec', 'B-LEARN', 'B1-EVAL', 9),
  ('vec', 'B-LEARN', 'B1-RESEARCH', 7), ('vec', 'B-LEARN', 'B1-VEC-QA', 8), ('vec', 'B-LEARN', 'B1-CLASSMGT', 3),
  ('vec', 'B-LAW', 'B2-VECACT', 4), ('vec', 'B-LAW', 'B2-NEA', 5), ('vec', 'B-LAW', 'B2-TEACHERCIVIL', 4),
  ('vec', 'B-LAW', 'B2-POLICY', 4), ('vec', 'B-LAW', 'B2-COMPULSORY', 2), ('vec', 'B-LAW', 'B2-COUNCIL', 2),
  ('vec', 'B-LAW', 'B2-MOEADMIN', 2), ('vec', 'B-LAW', 'B2-CHILD', 2)
on conflict do nothing;

-- Mock helpers take the track (default สพฐ., so existing callers keep their behaviour).
drop function if exists prep.mock_available(text, text);
drop function if exists prep.mock_draw(text, text);
drop function if exists prep.mock_topics(text, text);

create function prep.mock_topics(p_subject text, p_major text, p_track text default 'obec') returns text[]
language sql stable set search_path = '' as $$
  select coalesce(array_agg(case when topic = '*MAJOR*' then p_major else topic end), '{}')
    from prep.mock_quota where subject = p_subject and track = coalesce(p_track, 'obec')
$$;

create function prep.mock_available(p_subject text, p_major text, p_track text default 'obec') returns integer
language sql stable set search_path = '' as $$
  select count(*)::int from prep.questions q
   where q.status = 'approved' and q.topic = any (prep.mock_topics(p_subject, p_major, p_track))
$$;

create function prep.mock_draw(p_subject text, p_major text, p_track text default 'obec') returns integer[]
language plpgsql set search_path = '' as $$
declare
  need int;
  ids  int[] := '{}';
  got  int[];
  r    record;
  s    record;
  t    text;
  tot  int;
begin
  select questions into need from prep.mock_subjects where code = p_subject;
  for r in select topic, n from prep.mock_quota where subject = p_subject and track = coalesce(p_track, 'obec') loop
    t := case when r.topic = '*MAJOR*' then p_major else r.topic end;
    got := '{}';
    select sum(weight) into tot from prep.subtopics where topic = t;
    if tot is not null then
      for s in select code, weight from prep.subtopics where topic = t order by sort loop
        got := got || coalesce((select array_agg(x.id) from (
                 select q.id from prep.questions q
                  where q.subtopic = s.code and q.status = 'approved' and q.id <> all (ids || got)
                  order by random() limit round(r.n * s.weight::numeric / tot)::int) x), '{}');
      end loop;
      got := got[1:r.n];                        -- rounding can overshoot by a question or two
    end if;
    got := got || coalesce((select array_agg(x.id) from (
             select q.id from prep.questions q
              where q.topic = t and q.status = 'approved' and q.id <> all (ids || got)
              order by random() limit greatest(0, r.n - cardinality(got))) x), '{}');
    ids := ids || got;
  end loop;
  if cardinality(ids) < need then
    ids := ids || coalesce((select array_agg(x.id) from (
             select q.id from prep.questions q
              where q.topic = any (prep.mock_topics(p_subject, p_major, p_track)) and q.status = 'approved' and q.id <> all (ids)
              order by random() limit need - cardinality(ids)) x), '{}');
  end if;
  if cardinality(ids) < need then raise exception 'not_enough_questions'; end if;
  return (select array_agg(x order by random()) from unnest(ids) x);
end $$;

revoke execute on function prep.mock_topics(text, text, text), prep.mock_available(text, text, text),
                           prep.mock_draw(text, text, text) from public;

-- Topics the caller can use: shared ones plus those of their track.
create or replace function public.prep_topics()
returns table(code text, section text, grp text, name text, sort integer, available integer)
language sql stable security definer set search_path = '' as $$
  select t.code, t.section, t.grp, t.name, t.sort,
         (select count(*)::int from prep.questions q where q.topic = t.code and q.status = 'approved')
    from prep.topics t
   where t.track is null
      or t.track = coalesce((select p.track from prep.profiles p where p.user_id = prep.uid()), 'obec')
   order by t.sort
$$;

create or replace function public.prep_profile() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare p prep.profiles := prep.lock_profile(prep.uid());
begin
  return jsonb_build_object('major', p.major, 'track', p.track,
    'major_name', (select name from prep.topics where code = p.major));
end $$;

create or replace function public.prep_set_major(p_code text) returns void
language plpgsql security definer set search_path = '' as $$
declare u uuid := prep.uid(); p prep.profiles;
begin
  p := prep.lock_profile(u);
  if p_code is not null and not exists (
       select 1 from prep.topics where code = p_code and grp = 'B3' and (track is null or track = p.track)) then
    raise exception 'invalid_topic';
  end if;
  update prep.profiles set major = p_code where user_id = u;
end $$;

-- Switch exam track. A major that only exists in the other track is cleared so the picker asks again.
create function public.prep_set_track(p_track text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := prep.uid(); p prep.profiles;
begin
  if p_track not in ('obec', 'vec') then raise exception 'invalid_track'; end if;
  p := prep.lock_profile(u);
  update prep.profiles
     set track = p_track,
         major = case when exists (select 1 from prep.topics t where t.code = p.major and (t.track is null or t.track = p_track))
                      then p.major end
   where user_id = u;
  return public.prep_profile();
end $$;
revoke execute on function public.prep_set_track(text) from public, anon;
grant execute on function public.prep_set_track(text) to authenticated;

create or replace function public.prep_mock_overview() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u    uuid := prep.uid();
  p    prep.profiles;
  pkgs text[];
  r    record;
  out  jsonb := '[]'::jsonb;
  av   int;
  reason text;
  acc  text;
  op   prep.mock_attempts;
begin
  p := prep.lock_profile(u);
  pkgs := prep.active_packages(u);
  for r in select id from prep.mock_attempts where user_id = u and submitted_at is null and deadline < now() loop
    perform prep.mock_finalize(r.id);
  end loop;

  for r in select * from prep.mock_subjects order by sort loop
    av := prep.mock_available(r.code, p.major, p.track);
    reason := case when r.code = 'B-MAJOR' and p.major is null then 'no_major'
                   when av < r.questions then 'not_enough_questions' end;
    acc := case when 'ALL' = any (pkgs) or r.section = any (pkgs) then 'pack'
                when r.code = 'A-ENG' and not p.free_mock_used then 'free_trial'
                else 'locked' end;
    select * into op from prep.mock_attempts where user_id = u and subject = r.code and submitted_at is null;
    out := out || jsonb_build_object(
      'code', r.code, 'section', r.section, 'name', r.name, 'questions', r.questions, 'minutes', r.minutes,
      'available', av, 'reason', reason, 'access', acc,
      'best', (select max(score) from prep.mock_attempts where user_id = u and subject = r.code and submitted_at is not null),
      'tries', (select count(*) from prep.mock_attempts where user_id = u and subject = r.code and submitted_at is not null),
      'open', case when op.id is null then null else jsonb_build_object('id', op.id, 'deadline', op.deadline) end);
  end loop;
  return jsonb_build_object('subjects', out, 'server_now', now(), 'track', p.track,
                            'major_name', (select name from prep.topics where code = p.major));
end $$;

create or replace function public.prep_mock_start(p_subject text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u     uuid := prep.uid();
  p     prep.profiles;
  s     prep.mock_subjects;
  pkgs  text[];
  oid   uuid;
  trial boolean := false;
  ids   int[];
  aid   uuid;
begin
  p := prep.lock_profile(u);
  select * into s from prep.mock_subjects where code = p_subject;
  if s.code is null then raise exception 'invalid_subject'; end if;

  select id into oid from prep.mock_attempts where user_id = u and subject = p_subject and submitted_at is null;
  if oid is not null then
    if (select deadline from prep.mock_attempts where id = oid) >= now() then
      return prep.mock_payload(oid);                -- resume
    end if;
    perform prep.mock_finalize(oid);
  end if;

  pkgs := prep.active_packages(u);
  if not ('ALL' = any (pkgs) or s.section = any (pkgs)) then
    if p_subject = 'A-ENG' and not p.free_mock_used then trial := true;
    else raise exception 'mock_locked'; end if;
  end if;
  if p_subject = 'B-MAJOR' and p.major is null then raise exception 'no_major'; end if;

  ids := prep.mock_draw(p_subject, p.major, p.track);
  insert into prep.mock_attempts (user_id, subject, question_ids, answers, deadline, free_trial)
  values (u, p_subject, ids, array_fill(null::smallint, array[cardinality(ids)]),
          now() + make_interval(mins => s.minutes), trial)
  returning id into aid;
  if trial then update prep.profiles set free_mock_used = true where user_id = u; end if;
  return prep.mock_payload(aid);
end $$;

create or replace function public.prep_readiness() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  u     uuid := prep.uid();
  major text := (select p.major from prep.profiles p where p.user_id = u);
  trk   text := coalesce((select p.track from prep.profiles p where p.user_id = u), 'obec');
begin
  return (
    with q as (
      select s.code as subject, s.name as subject_name, s.section, s.questions, s.sort,
             case when m.topic = '*MAJOR*' then major else m.topic end as topic, m.n as w
        from prep.mock_subjects s join prep.mock_quota m on m.subject = s.code and m.track = trk),
    e as (
      select q.subject, q.subject_name, q.section, q.questions, q.sort, q.topic, null::text as sub, tp.name as topic_name,
             q.w::numeric as w, coalesce(st.n, 0) as n, coalesce(st.correct, 0) as correct
        from q join prep.topics tp on tp.code = q.topic
        left join prep.user_topic_stats st on st.user_id = u and st.topic = q.topic
       where not exists (select 1 from prep.subtopics x where x.topic = q.topic)
      union all
      select q.subject, q.subject_name, q.section, q.questions, q.sort, q.topic, sb.code, sb.name,
             q.w * sb.weight::numeric / sum(sb.weight) over (partition by q.subject, q.topic),
             coalesce(us.n, 0), coalesce(us.c, 0)
        from q join prep.subtopics sb on sb.topic = q.topic
        left join lateral (select count(*) as n, count(*) filter (where x.wrong = 0) as c
                             from prep.user_question_state x join prep.questions qq on qq.id = x.question_id
                            where x.user_id = u and qq.subtopic = sb.code) us on true),
    t as (select e.*, (correct + 1.25) / (n + 5.0) as acc from e),
    subj as (
      select subject, subject_name, section, questions, sort,
             round(100 * sum(w * acc) / sum(w), 1) as pct, sum(n)::int as n
        from t group by subject, subject_name, section, questions, sort),
    sec as (
      select section, round(sum(questions * pct) / sum(questions), 1) as pct, sum(n)::int as n, count(*) as subjects
        from subj group by section)
    select jsonb_build_object(
      'has_major', major is not null,
      'answered', coalesce((select sum(n) from sec), 0),
      'overall', (select round(sum(s2.questions * s2.pct) / nullif(sum(s2.questions), 0), 1) from subj s2),
      'sections', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'section', sec.section, 'pct', sec.pct, 'n', sec.n,
                 'subjects', (select jsonb_agg(jsonb_build_object('code', subject, 'name', subject_name, 'questions', questions,
                                                                 'pct', pct, 'n', n) order by sort)
                                from subj where subj.section = sec.section))
               order by sec.section) from sec), '[]'::jsonb),
      -- Where practice pays most: items still under 60% first, then questions the item carries x share still missed.
      'focus', coalesce((
        select jsonb_agg(f.item order by f.rk)
          from (select jsonb_build_object('code', topic, 'sub', sub, 'name', topic_name, 'subject', subject_name,
                                          'w', round(w), 'pct', round(100 * acc), 'n', n) as item,
                       row_number() over (order by acc < 0.6 desc, w * (1 - acc) desc) as rk
                  from t) f where f.rk <= 3), '[]'::jsonb)));
end $$;

-- Question writer: a sub-topic's target is 3x the questions it carries in one mock. Majors carry 100; the smaller
-- ภาค ข topics carry their quota (at least 20, so practice sets still have enough).
create function prep.gen_goal(p_subtopic text) returns int
language sql stable set search_path = '' as $$
  select (3 * round(greatest(coalesce((select max(m.n) from prep.mock_quota m where m.topic = s.topic), 100), 20)
                    * s.weight::numeric / (select sum(w.weight) from prep.subtopics w where w.topic = s.topic)))::int
    from prep.subtopics s where s.code = p_subtopic
$$;
revoke execute on function prep.gen_goal(text) from public;

create or replace function public.prep_gen_next(p_limit integer default 5) returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(x.code order by x.gap desc, x.code), '{}')
    from (select s.code,
                 prep.gen_goal(s.code)
                   - (select count(*) from prep.questions q where q.subtopic = s.code and q.status in ('approved', 'review')) as gap
            from prep.subtopics s, prep.gen_settings g
           where g.id = 1 and g.enabled and s.topic = any (g.topics)
           order by 2 desc limit greatest(1, least(coalesce(p_limit, 5), 12))) x
   where x.gap > 0
$$;

create or replace function public.prep_gen_work(p_subtopic text, p_force boolean default false) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare s prep.subtopics; g prep.gen_settings; t prep.topics; have int; goal int;
begin
  select * into s from prep.subtopics where code = p_subtopic;
  if not found then return null; end if;
  select * into g from prep.gen_settings where id = 1;
  if not p_force and not (g.enabled and s.topic = any (g.topics)) then return null; end if;
  select * into t from prep.topics where code = s.topic;
  select count(*) into have from prep.questions q where q.subtopic = s.code and q.status in ('approved', 'review');
  goal := prep.gen_goal(s.code);
  return jsonb_build_object(
    'subtopic', s.code, 'topic', s.topic, 'major', t.name, 'grp', t.grp, 'track', coalesce(t.track, 'obec'),
    'name', s.name, 'kind', s.kind, 'keywords', s.keywords, 'need', greatest(goal - have, 0),
    'stems', coalesce((select jsonb_agg(left(regexp_replace(q.stem, '\s+', ' ', 'g'), 90))
                         from (select stem from prep.questions where subtopic = s.code and status in ('approved', 'review')
                                order by id desc limit 60) q), '[]'::jsonb),
    'sibling_names', coalesce((select jsonb_agg(o.name order by o.sort) from prep.subtopics o where o.topic = s.topic and o.code <> s.code), '[]'::jsonb));
end $$;

create or replace function public.prep_admin_gen_get() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare g prep.gen_settings;
begin
  perform prep.require_admin();
  select * into g from prep.gen_settings where id = 1;
  return jsonb_build_object(
    'enabled', g.enabled, 'topics', to_jsonb(g.topics), 'review_topics', to_jsonb(g.review_topics),
    'made_24h', (select count(*) from prep.questions where source like 'gen:%' and created_at > now() - interval '24 hours'),
    'made_total', (select count(*) from prep.questions where source like 'gen:%'),
    'held', (select count(*) from prep.questions where source like 'gen:%' and status = 'review'),
    'majors', coalesce((
      select jsonb_agg(jsonb_build_object(
               'topic', t.code, 'name', case when t.track = 'vec' then t.name || ' (สอศ.)' else t.name end,
               'have', (select count(*) from prep.questions q where q.topic = t.code and q.status = 'approved'),
               'held', (select count(*) from prep.questions q where q.topic = t.code and q.status = 'review' and q.source like 'gen:%'),
               'goal', (select sum(prep.gen_goal(s.code)) from prep.subtopics s where s.topic = t.code),
               'filled', (select sum(least(prep.gen_goal(s.code),
                                           (select count(*) from prep.questions q where q.subtopic = s.code and q.status in ('approved', 'review'))))
                            from prep.subtopics s where s.topic = t.code))
             order by t.sort)
        from prep.topics t where exists (select 1 from prep.subtopics s where s.topic = t.code)), '[]'::jsonb));
end $$;
