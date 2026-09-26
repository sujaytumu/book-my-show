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

-- One show per seeded movie (idempotent per movie), spread across the evening on the existing screen.
insert into shows(movie_id,screen_id,show_date,start_time,end_time,price)
select m.id,s.id,current_date+1,'15:30','18:20',220 from movies m cross join screens s
where m.title='The Paradise' and not exists(select 1 from shows sh where sh.movie_id=m.id);

insert into shows(movie_id,screen_id,show_date,start_time,end_time,price)
select m.id,s.id,current_date+1,'18:30','21:10',220 from movies m cross join screens s
where m.title='Irumudi' and not exists(select 1 from shows sh where sh.movie_id=m.id);

insert into shows(movie_id,screen_id,show_date,start_time,end_time,price)
select m.id,s.id,current_date+1,'21:30','23:44',200 from movies m cross join screens s
where m.title='Mandaadi' and not exists(select 1 from shows sh where sh.movie_id=m.id);

insert into shows(movie_id,screen_id,show_date,start_time,end_time,price)
select m.id,s.id,current_date+2,'12:00','14:08',180 from movies m cross join screens s
where m.title='Madhuvidhu' and not exists(select 1 from shows sh where sh.movie_id=m.id);

insert into shows(movie_id,screen_id,show_date,start_time,end_time,price)
select m.id,s.id,current_date+2,'19:00','21:11',190 from movies m cross join screens s
where m.title='Sathi Leelavathi' and not exists(select 1 from shows sh where sh.movie_id=m.id);

insert into show_seats(show_id,seat_number,seat_type) select sh.id,chr(65+floor((g-1)/10)::int)||((g-1)%10+1)::text,case when g<=20 then 'PREMIUM' else 'REGULAR' end from shows sh cross join generate_series(1,60) g where not exists(select 1 from show_seats ss where ss.show_id=sh.id);