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
-- All distances are computed live from JNTU College metro station, not stored.
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
select m.id,sc.id,current_date+1,v.start_time,v.end_time,v.price
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
