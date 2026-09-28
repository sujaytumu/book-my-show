insert into cities(name) values('Hyderabad') on conflict(name) do nothing;
insert into theatres(name,address,city_id,latitude,longitude) select 'BMS Cinemas','Hitech City, Hyderabad',id,17.4435,78.3772 from cities where name='Hyderabad' and not exists(select 1 from theatres);
update theatres set latitude=17.4435,longitude=78.3772 where name='BMS Cinemas' and latitude is null;
insert into screens(name,total_seats,theatre_id) select 'Screen 1',60,id from theatres where name='BMS Cinemas' and not exists(select 1 from screens);

-- Retire the original placeholder demo movie now that real titles are seeded below.
update movies set active=false where title='The Last Journey';

-- Real, recent (2026) Indian theatrical releases, seeded idempotently by title.
insert into movies(title,description,poster_url,language,genre,duration_minutes,certificate,rating)
select 'The Paradise','Telugu action epic starring Nani and Raghav Juyal, directed by Srikanth Odela. Released 24 September 2026.','https://images.unsplash.com/photo-1478720568477-152d9b164e26?auto=format&fit=crop&w=800&q=80','Telugu','Action',170,'UA',7.7
where not exists(select 1 from movies where title='The Paradise');

insert into movies(title,description,poster_url,language,genre,duration_minutes,certificate,rating)
select 'Irumudi','Telugu action drama starring Ravi Teja and Priya Bhavani Shankar, directed by Shiva Nirvana. A father-daughter story set around the Ayyappa Deeksha pilgrimage.','https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=800&q=80','Telugu','Action Drama',160,'UA16+',8.0
where not exists(select 1 from movies where title='Irumudi');

insert into movies(title,description,poster_url,language,genre,duration_minutes,certificate,rating)
select 'Mandaadi','Tamil sports action drama starring Soori and Sathyaraj, directed by Mathimaran Pugazhendhi, set against coastal Tamil Nadu boat racing.','https://images.unsplash.com/photo-1500462918059-b1a0cb512f1d?auto=format&fit=crop&w=800&q=80','Tamil','Sports Action',154,'UA16+',7.4
where not exists(select 1 from movies where title='Mandaadi');

insert into movies(title,description,poster_url,language,genre,duration_minutes,certificate,rating)
select 'Madhuvidhu','Malayalam romantic comedy starring Sharaf U Dheen, directed by Vishnu Aravind. Released 23 April 2026.','https://images.unsplash.com/photo-1518676590629-3dcbd9c5a5c9?auto=format&fit=crop&w=800&q=80','Malayalam','Romantic Comedy',128,'UA',7.1
where not exists(select 1 from movies where title='Madhuvidhu');

insert into movies(title,description,poster_url,language,genre,duration_minutes,certificate,rating)
select 'Sathi Leelavathi','Telugu romantic comedy starring Lavanya Tripathi and Dev Mohan, directed by Tatineni Satya. Released 8 May 2026.','https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=800&q=80','Telugu','Romantic Comedy',131,'UA',6.8
where not exists(select 1 from movies where title='Sathi Leelavathi');

-- Real Hyderabad theatre network (single screens + multiplexes), concentrated around
-- KPHB/JNTU/Kukatpally/Miyapur with a few farther ones for distance variety.
-- Distance-from-me is computed live in the browser from the viewer's actual
-- geolocation (see TheatreMap.haversineKm) - nothing here is a fixed reference point.
insert into theatres(name,address,city_id,latitude,longitude)
select v.name,v.address,c.id,v.lat,v.lon from cities c cross join (values
  ('Arjun 70MM','Kukatpally, Hyderabad',17.4855,78.4095),
  ('Viswanath Theatre 70mm A/C','Kukatpally, Hyderabad',17.4862,78.4110),
  ('Mallikarjuna 70mm A/C DTS','Kukatpally, Hyderabad',17.4845,78.4080),
  ('Sri Sai 35MM','Miyapur, Hyderabad',17.4970,78.3760),
  ('Sandhya 70MM','Ameerpet, Hyderabad',17.4374,78.4487),
  ('Sudarshan 35MM','RTC X Roads, Hyderabad',17.3925,78.4972),
  ('PVR: Manjeera Trinity Mall','KPHB Colony, Hyderabad',17.4939,78.3958),
  ('INOX: The Forum Sujana Mall','Kukatpally, Hyderabad',17.4930,78.4020),
  ('Miraj Cinemas: Cinetown','Miyapur, Hyderabad',17.4959,78.3745),
  ('Miraj Cinemas: A2A Central Mall','Balanagar, Hyderabad',17.4645,78.4460),
  ('AMB Cinemas','Gachibowli, Hyderabad',17.4479,78.3489),
  ('Prasads Multiplex','Khairtabad, Hyderabad',17.4128,78.4659),
  ('Cinepolis: DSL Virtue Mall','Uppal, Hyderabad',17.4058,78.5591)
) as v(name,address,lat,lon)
where c.name='Hyderabad' and not exists(select 1 from theatres t where t.name=v.name);

insert into screens(name,total_seats,theatre_id)
select 'Screen 1',60,t.id from theatres t
where t.name in ('Arjun 70MM','Viswanath Theatre 70mm A/C','Mallikarjuna 70mm A/C DTS','Sri Sai 35MM',
                  'Sandhya 70MM','Sudarshan 35MM','PVR: Manjeera Trinity Mall','INOX: The Forum Sujana Mall',
                  'Miraj Cinemas: Cinetown','Miraj Cinemas: A2A Central Mall','AMB Cinemas','Prasads Multiplex',
                  'Cinepolis: DSL Virtue Mall')
and not exists(select 1 from screens sc where sc.theatre_id=t.id);

-- Shows: one showtime per (movie, theatre) pair below, idempotent on that exact pair
-- so re-running this file never creates duplicates. "The Paradise" (this week's big
-- release) plays widest, like a real BMS listing; the rest play at a smaller spread.
insert into shows(movie_id,screen_id,show_date,start_time,end_time,price)
select m.id,sc.id,current_date+1,v.start_time::time,v.end_time::time,v.price
from movies m join (values
  ('The Paradise','Arjun 70MM','20:30','23:24',180),
  ('The Paradise','Mallikarjuna 70mm A/C DTS','21:00','23:54',180),
  ('The Paradise','Viswanath Theatre 70mm A/C','18:00','20:54',170),
  ('The Paradise','PVR: Manjeera Trinity Mall','19:15','22:09',240),
  ('The Paradise','INOX: The Forum Sujana Mall','16:00','18:54',240),
  ('The Paradise','AMB Cinemas','19:15','22:09',280),
  ('Irumudi','Sri Sai 35MM','18:30','21:10',170),
  ('Irumudi','Miraj Cinemas: Cinetown','21:00','23:40',220),
  ('Irumudi','INOX: The Forum Sujana Mall','15:30','18:10',230),
  ('Irumudi','Prasads Multiplex','20:15','22:55',260),
  ('Mandaadi','Sandhya 70MM','19:00','21:34',160),
  ('Mandaadi','Miraj Cinemas: A2A Central Mall','16:45','19:19',210),
  ('Mandaadi','Viswanath Theatre 70mm A/C','20:30','23:04',160),
  ('Madhuvidhu','PVR: Manjeera Trinity Mall','13:00','15:08',200),
  ('Madhuvidhu','Sudarshan 35MM','17:15','19:23',150),
  ('Madhuvidhu','AMB Cinemas','20:30','22:38',250),
  ('Sathi Leelavathi','Cinepolis: DSL Virtue Mall','18:45','20:56',220),
  ('Sathi Leelavathi','Mallikarjuna 70mm A/C DTS','20:00','22:11',170),
  ('Sathi Leelavathi','Miraj Cinemas: Cinetown','14:30','16:41',210)
) as v(movie_title,theatre_name,start_time,end_time,price) on v.movie_title=m.title
join theatres t on t.name=v.theatre_name
join screens sc on sc.theatre_id=t.id
where not exists(select 1 from shows sh where sh.movie_id=m.id and sh.screen_id=sc.id);

-- Also keep each movie's original single show (from the first seeding pass) if present.
insert into shows(movie_id,screen_id,show_date,start_time,end_time,price)
select m.id,s.id,current_date+1,'15:30','18:20',220 from movies m cross join screens s join theatres t on t.id=s.theatre_id
where m.title='The Paradise' and t.name='BMS Cinemas' and not exists(select 1 from shows sh where sh.movie_id=m.id and sh.screen_id=s.id);

insert into shows(movie_id,screen_id,show_date,start_time,end_time,price)
select m.id,s.id,current_date+1,'18:30','21:10',220 from movies m cross join screens s join theatres t on t.id=s.theatre_id
where m.title='Irumudi' and t.name='BMS Cinemas' and not exists(select 1 from shows sh where sh.movie_id=m.id and sh.screen_id=s.id);

insert into shows(movie_id,screen_id,show_date,start_time,end_time,price)
select m.id,s.id,current_date+1,'21:30','23:44',200 from movies m cross join screens s join theatres t on t.id=s.theatre_id
where m.title='Mandaadi' and t.name='BMS Cinemas' and not exists(select 1 from shows sh where sh.movie_id=m.id and sh.screen_id=s.id);

insert into shows(movie_id,screen_id,show_date,start_time,end_time,price)
select m.id,s.id,current_date+2,'12:00','14:08',180 from movies m cross join screens s join theatres t on t.id=s.theatre_id
where m.title='Madhuvidhu' and t.name='BMS Cinemas' and not exists(select 1 from shows sh where sh.movie_id=m.id and sh.screen_id=s.id);

insert into shows(movie_id,screen_id,show_date,start_time,end_time,price)
select m.id,s.id,current_date+2,'19:00','21:11',190 from movies m cross join screens s join theatres t on t.id=s.theatre_id
where m.title='Sathi Leelavathi' and t.name='BMS Cinemas' and not exists(select 1 from shows sh where sh.movie_id=m.id and sh.screen_id=s.id);

insert into show_seats(show_id,seat_number,seat_type) select sh.id,chr(65+floor((g-1)/10)::int)||((g-1)%10+1)::text,case when g<=20 then 'PREMIUM' else 'REGULAR' end from shows sh cross join generate_series(1,60) g where not exists(select 1 from show_seats ss where ss.show_id=sh.id);

-- ============================================================
-- Real Hyderabad theatre network (30: 15 single screens + 15
-- multiplexes), replacing the earlier approximated list. Kept
-- idempotent by (name,address) so this is safe to re-run against
-- the already-live database; existing bookings on the previous
-- placeholder theatres are preserved (never deleted), just hidden
-- from new browsing via the active flag.
-- ============================================================
insert into theatres(name,address,city_id,latitude,longitude)
select v.name,v.address,c.id,v.lat,v.lon from cities c cross join (values
  ('Sandhya 70MM','RTC X Roads, Hyderabad',17.3908,78.4972),
  ('Devi 70MM','RTC X Roads, Hyderabad',17.3919,78.498),
  ('Sudarshan 35MM','RTC X Roads, Hyderabad',17.3925,78.4972),
  ('Mythri Vimal 70MM','Balanagar, Hyderabad',17.4644,78.4462),
  ('Sri Bhramaramba Cinema Hall','Kukatpally, Hyderabad',17.487,78.4065),
  ('Mallikarjuna Theatre','Kukatpally, Hyderabad',17.4848,78.4082),
  ('Sree Ramulu Theatre','Moosapet, Hyderabad',17.4762,78.4258),
  ('Sri Sai Ram 70MM','Malkajgiri, Hyderabad',17.456,78.529),
  ('SVC Eeshwar Theatre','Attapur, Hyderabad',17.3641,78.4189),
  ('Sree Ramana Theatre','Amberpet, Hyderabad',17.3925,78.5138),
  ('Ganga Theatre (Mythri Shiva Ganga)','Dilsukhnagar, Hyderabad',17.3685,78.5245),
  ('Konark Theatre (Asian Mukta)','Dilsukhnagar, Hyderabad',17.369,78.526),
  ('Viswanath 70MM','Kukatpally, Hyderabad',17.4862,78.411),
  ('Sensation Sunshine','Khairatabad, Hyderabad',17.411,78.463),
  ('Shanti Theatre','Narayanguda, Hyderabad',17.4021,78.4814),
  ('AMB Cinemas','Kondapur / Gachibowli, Hyderabad',17.4479,78.3489),
  ('Prasads Multiplex','Khairtabad, Hyderabad',17.4128,78.4659),
  ('AAA Cinemas','Ameerpet, Hyderabad',17.4374,78.4487),
  ('Allu Cinemas','Kokapet, Hyderabad',17.4083,78.3339),
  ('PVR Superplex (Inorbit Mall)','Madhapur, Hyderabad',17.4344,78.3915),
  ('PVR Nexus Mall','Kukatpally, Hyderabad',17.493,78.402),
  ('PVR LakeShore Mall','Kukatpally, Hyderabad',17.49,78.4005),
  ('INOX GVK One Mall','Banjara Hills, Hyderabad',17.4239,78.4483),
  ('Cinepolis Lulu Mall','Kukatpally, Hyderabad',17.4955,78.396),
  ('ART Cinemas Tattva Mall','Vanasthalipuram, Hyderabad',17.3312,78.5497),
  ('Aparna Cinemas','Nallagandla, Hyderabad',17.463,78.322),
  ('PVR ICON Next Galleria Mall','HITEC City, Hyderabad',17.4483,78.3908),
  ('PVR Cinemas Irrum Manzil','Irrum Manzil, Hyderabad',17.418,78.461),
  ('INOX Ashoka One Mall','Kukatpally, Hyderabad',17.4925,78.404),
  ('Asian CineSquare Multiplex','Uppal, Hyderabad',17.4058,78.5591)
) as v(name,address,lat,lon)
where c.name='Hyderabad' and not exists(select 1 from theatres t where t.name=v.name and t.address=v.address);

-- Reactivate + correct any pre-existing rows that are actually these same real theatres
update theatres set active=true where name in ('Sudarshan 35MM','AMB Cinemas','Prasads Multiplex');
update theatres set address='RTC X Roads, Hyderabad', latitude=17.3908, longitude=78.4972 where name='Sandhya 70MM';
update theatres set active=true where name='Sandhya 70MM';

-- Retire theatres that were placeholders/approximations, now superseded by the real list above.
-- Not deleted (existing bookings still reference their shows) - just hidden from new browsing.
update theatres set active=false where name in (
  'Arjun 70MM',
  'Viswanath Theatre 70mm A/C',
  'Mallikarjuna 70mm A/C DTS',
  'Sri Sai 35MM',
  'PVR: Manjeera Trinity Mall',
  'INOX: The Forum Sujana Mall',
  'Miraj Cinemas: Cinetown',
  'Miraj Cinemas: A2A Central Mall',
  'Cinepolis: DSL Virtue Mall',
  'BMS Cinemas'
);

insert into screens(name,total_seats,theatre_id)
select 'Screen 1',60,t.id from theatres t where t.active=true and not exists(select 1 from screens sc where sc.theatre_id=t.id);

insert into shows(movie_id,screen_id,show_date,start_time,end_time,price)
select m.id,sc.id,current_date+v.day_offset,v.start_time::time,v.end_time::time,v.price
from movies m join (values
  ('The Paradise','Sandhya 70MM',1,'13:00','15:30',180),
  ('The Paradise','Devi 70MM',1,'15:30','18:00',130),
  ('The Paradise','Sudarshan 35MM',1,'17:15','19:45',140),
  ('The Paradise','Mythri Vimal 70MM',1,'19:00','21:30',140),
  ('The Paradise','Sri Bhramaramba Cinema Hall',1,'21:00','23:30',180),
  ('The Paradise','Mallikarjuna Theatre',1,'13:45','16:15',170),
  ('The Paradise','Sree Ramulu Theatre',1,'15:00','17:30',130),
  ('The Paradise','Sri Sai Ram 70MM',1,'17:15','19:45',130),
  ('The Paradise','SVC Eeshwar Theatre',1,'19:00','21:30',140),
  ('Irumudi','Sree Ramulu Theatre',1,'13:15','15:45',170),
  ('Irumudi','Sri Sai Ram 70MM',1,'15:45','18:15',180),
  ('Irumudi','SVC Eeshwar Theatre',1,'17:45','20:15',140),
  ('Irumudi','Sree Ramana Theatre',1,'19:30','22:00',170),
  ('Irumudi','Ganga Theatre (Mythri Shiva Ganga)',1,'21:00','23:30',190),
  ('Irumudi','Konark Theatre (Asian Mukta)',1,'13:15','15:45',190),
  ('Irumudi','Viswanath 70MM',1,'15:45','18:15',180),
  ('Irumudi','Sensation Sunshine',1,'17:30','20:00',150),
  ('Irumudi','Shanti Theatre',1,'19:15','21:45',140),
  ('Mandaadi','Viswanath 70MM',1,'13:30','16:00',190),
  ('Mandaadi','Sensation Sunshine',1,'15:00','17:30',130),
  ('Mandaadi','Shanti Theatre',1,'17:00','19:30',160),
  ('Mandaadi','AMB Cinemas',1,'19:30','22:00',220),
  ('Mandaadi','Prasads Multiplex',1,'21:30','23:59',240),
  ('Mandaadi','AAA Cinemas',1,'13:00','15:30',260),
  ('Mandaadi','Allu Cinemas',1,'15:45','18:15',250),
  ('Mandaadi','PVR Superplex (Inorbit Mall)',1,'17:00','19:30',240),
  ('Mandaadi','PVR Nexus Mall',1,'19:00','21:30',230),
  ('Madhuvidhu','Allu Cinemas',2,'13:30','16:00',240),
  ('Madhuvidhu','PVR Superplex (Inorbit Mall)',2,'15:30','18:00',260),
  ('Madhuvidhu','PVR Nexus Mall',2,'17:15','19:45',240),
  ('Madhuvidhu','PVR LakeShore Mall',2,'19:00','21:30',250),
  ('Madhuvidhu','INOX GVK One Mall',2,'21:15','23:45',200),
  ('Madhuvidhu','Cinepolis Lulu Mall',2,'13:30','16:00',260),
  ('Madhuvidhu','ART Cinemas Tattva Mall',2,'15:15','17:45',200),
  ('Madhuvidhu','Aparna Cinemas',2,'17:00','19:30',260),
  ('Madhuvidhu','PVR ICON Next Galleria Mall',2,'19:30','22:00',230),
  ('Sathi Leelavathi','ART Cinemas Tattva Mall',2,'13:30','16:00',230),
  ('Sathi Leelavathi','Aparna Cinemas',2,'15:30','18:00',210),
  ('Sathi Leelavathi','PVR ICON Next Galleria Mall',2,'17:15','19:45',220),
  ('Sathi Leelavathi','PVR Cinemas Irrum Manzil',2,'19:30','22:00',250),
  ('Sathi Leelavathi','INOX Ashoka One Mall',2,'21:00','23:30',250),
  ('Sathi Leelavathi','Asian CineSquare Multiplex',2,'13:15','15:45',240),
  ('Sathi Leelavathi','Sandhya 70MM',2,'15:15','17:45',170),
  ('Sathi Leelavathi','Devi 70MM',2,'17:45','20:15',140),
  ('Sathi Leelavathi','Sudarshan 35MM',2,'19:30','22:00',160)
) as v(movie_title,theatre_name,day_offset,start_time,end_time,price) on v.movie_title=m.title
join theatres t on t.name=v.theatre_name and t.active=true
join screens sc on sc.theatre_id=t.id
where not exists(select 1 from shows sh where sh.movie_id=m.id and sh.screen_id=sc.id);

insert into show_seats(show_id,seat_number,seat_type) select sh.id,chr(65+floor((g-1)/10)::int)||((g-1)%10+1)::text,case when g<=20 then 'PREMIUM' else 'REGULAR' end from shows sh cross join generate_series(1,60) g where not exists(select 1 from show_seats ss where ss.show_id=sh.id);
