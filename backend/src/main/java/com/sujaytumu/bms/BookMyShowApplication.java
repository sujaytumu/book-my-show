package com.sujaytumu.bms;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.*;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.core.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.web.*;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.cors.*;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.*;
import java.util.*;
import javax.crypto.SecretKey;
import org.springframework.web.server.ResponseStatusException;

@SpringBootApplication
@EnableScheduling
@RestController
public class BookMyShowApplication {
 private final JdbcTemplate db; private final PasswordEncoder encoder; private final JwtFilter jwt;
 private final String razorKey, razorSecret;
 public BookMyShowApplication(JdbcTemplate db,PasswordEncoder encoder,JwtFilter jwt,@Value("${razorpay.key}")String rk,@Value("${razorpay.secret}")String rs){this.db=db;this.encoder=encoder;this.jwt=jwt;razorKey=rk;razorSecret=rs;}

 public static void main(String[] args){SpringApplication.run(BookMyShowApplication.class,args);}

 @Bean PasswordEncoder passwordEncoder(){return new BCryptPasswordEncoder();}
 @Bean JwtFilter jwtFilter(@Value("${app.jwt.secret}")String s){return new JwtFilter(s);}
 @Bean SecurityFilterChain security(HttpSecurity h,JwtFilter f)throws Exception{
  return h.csrf(c->c.disable()).cors(c->c.configurationSource(cors())).sessionManagement(s->s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
   .authorizeHttpRequests(a->a.requestMatchers("/api/auth/**","/api/health","/api/movies/**","/api/cities/**","/api/shows/**").permitAll().requestMatchers("/api/admin/**").hasRole("ADMIN").anyRequest().authenticated())
   .addFilterBefore(f,UsernamePasswordAuthenticationFilter.class).build();
 }
 CorsConfigurationSource cors(){CorsConfiguration c=new CorsConfiguration();c.setAllowedOriginPatterns(List.of("*"));c.setAllowedMethods(List.of("*"));c.setAllowedHeaders(List.of("*"));UrlBasedCorsConfigurationSource s=new UrlBasedCorsConfigurationSource();s.registerCorsConfiguration("/**",c);return s;}

 String token(String email,String role){
  return Jwts.builder().subject(email).claim("role",role).issuedAt(new Date()).expiration(new Date(System.currentTimeMillis()+86400000))
   .signWith(jwt.key()).compact();
 }
 Map<String,Object> current(String email){return db.queryForMap("select id,name,email,password,role from users where email=?",email);}
 String email(Authentication a){return a.getName();}

 @PostMapping("/api/auth/register")
 Map<String,Object> register(@RequestBody Map<String,String> x){
  String e=x.get("email").toLowerCase();
  if(db.queryForObject("select count(*) from users where email=?",Integer.class,e)>0)throw new ResponseStatusException(org.springframework.http.HttpStatus.CONFLICT,"Email already registered");
  db.update("insert into users(name,email,password,role) values(?,?,?,'USER')",x.get("name"),e,encoder.encode(x.get("password")));
  return login(x);
 }
 @PostMapping("/api/auth/login")
 Map<String,Object> login(@RequestBody Map<String,String> x){
  var u=current(x.get("email").toLowerCase());
  if(!encoder.matches(x.get("password"),(String)u.get("password")))throw new ResponseStatusException(org.springframework.http.HttpStatus.UNAUTHORIZED,"Invalid credentials");
  return Map.of("token",token((String)u.get("email"),(String)u.get("role")),"id",u.get("id"),"name",u.get("name"),"email",u.get("email"),"role",u.get("role"));
 }
 @GetMapping("/api/health") Map<String,String> health(){return Map.of("status","UP","service","book-my-show-api");}

 @GetMapping("/api/cities") List<Map<String,Object>> cities(){return db.queryForList("select id,name from cities order by name");}
 @GetMapping("/api/movies") List<Map<String,Object>> movies(@RequestParam(required=false)String q){
  return q==null||q.isBlank()?db.queryForList("select * from movies where active=true order by title"):db.queryForList("select * from movies where active=true and title ilike ? order by title","%"+q+"%");
 }
 @GetMapping("/api/movies/{id}") Map<String,Object> movie(@PathVariable long id){return db.queryForMap("select * from movies where id=?",id);}
 @GetMapping("/api/shows") List<Map<String,Object>> shows(@RequestParam long movieId,@RequestParam(required=false)String date){
  String sql="select sh.*,t.name theatre_name,s.name screen_name from shows sh join screens s on s.id=sh.screen_id join theatres t on t.id=s.theatre_id where sh.movie_id=? ";
  return date==null?db.queryForList(sql+"order by show_date,start_time",movieId):db.queryForList(sql+"and show_date=? order by start_time",movieId,LocalDate.parse(date));
 }
 @GetMapping("/api/shows/{id}/seats") List<Map<String,Object>> seats(@PathVariable long id){return db.queryForList("select id,seat_number,seat_type,status from show_seats where show_id=? order by seat_number",id);}

 @PostMapping("/api/bookings/hold")
 @Transactional
 Map<String,Object> hold(Authentication a,@RequestBody Map<String,Object> x){
  long show=((Number)x.get("showId")).longValue();
  List<String> names=((List<?>)x.get("seatNumbers")).stream().map(Object::toString).distinct().toList();
  if(names.isEmpty()||names.size()>10)throw new ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST,"Select 1-10 seats");
  String placeholders=String.join(",",Collections.nCopies(names.size(),"?"));
  Object[] params=new Object[names.size()+1];params[0]=show;for(int i=0;i<names.size();i++)params[i+1]=names.get(i);
  List<Map<String,Object>> rows=db.queryForList("select * from show_seats where show_id=? and seat_number in ("+placeholders+") for update",params);
  if(rows.size()!=names.size())throw new ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST,"Invalid seat");
  Instant now=Instant.now();
  for(var r:rows){Timestamp t=(Timestamp)r.get("locked_until");if("BOOKED".equals(r.get("status"))||("LOCKED".equals(r.get("status"))&&t!=null&&t.toInstant().isAfter(now)))throw new ResponseStatusException(org.springframework.http.HttpStatus.CONFLICT,"Seat unavailable");}
  long uid=((Number)current(email(a)).get("id")).longValue();double price=((Number)db.queryForMap("select price from shows where id=?",show).get("price")).doubleValue();double amount=price*names.size();Instant until=now.plusSeconds(600);String ref="BMS-"+UUID.randomUUID().toString().substring(0,8).toUpperCase();
  long bid=db.queryForObject("insert into bookings(user_id,show_id,reference,status,amount,expires_at) values(?,?,?,'PENDING',?,?) returning id",Long.class,uid,show,ref,amount,until);
  for(String n:names){db.update("insert into booking_seats(booking_id,seat_number) values(?,?)",bid,n);db.update("update show_seats set status='LOCKED',locked_by=?,locked_until=? where show_id=? and seat_number=?",bid,until,show,n);}
  return Map.of("bookingId",bid,"reference",ref,"amount",amount,"expiresAt",until,"seats",names);
 }

 @PostMapping("/api/payments/create-order/{bookingId}")
 Map<String,Object> createOrder(Authentication a,@PathVariable long bookingId)throws Exception{
  var b=db.queryForMap("select b.* from bookings b join users u on u.id=b.user_id where b.id=? and u.email=?",bookingId,email(a));
  if(razorKey.isBlank()||razorSecret.isBlank())throw new ResponseStatusException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE,"Razorpay keys are not configured");
  long pa=Math.round(((Number)b.get("amount")).doubleValue()*100);
  String body="{\"amount\":"+pa+",\"currency\":\"INR\",\"receipt\":\""+b.get("reference")+"\"}";
  String auth=Base64.getEncoder().encodeToString((razorKey+":"+razorSecret).getBytes(StandardCharsets.UTF_8));
  HttpRequest req=HttpRequest.newBuilder(URI.create("https://api.razorpay.com/v1/orders")).header("Authorization","Basic "+auth).header("Content-Type","application/json").POST(HttpRequest.BodyPublishers.ofString(body)).build();
  String json=HttpClient.newHttpClient().send(req,HttpResponse.BodyHandlers.ofString()).body();
  String orderId=json.replaceAll(".*\"id\"\s*:\s*\"([^\"]+)\".*","$1");
  if(orderId.equals(json))throw new ResponseStatusException(org.springframework.http.HttpStatus.BAD_GATEWAY,"Razorpay order creation failed");
  db.update("update bookings set razorpay_order_id=? where id=?",orderId,bookingId);
  db.update("insert into payments(booking_id,razorpay_order_id,amount,status) values(?,?,?,'CREATED')",bookingId,orderId,b.get("amount"));
  return Map.of("bookingId",bookingId,"orderId",orderId,"amount",pa,"currency","INR","keyId",razorKey);
 }

 @PostMapping("/api/payments/verify")
 @Transactional
 Map<String,String> verify(Authentication a,@RequestBody Map<String,String>x)throws Exception{
  var b=db.queryForMap("select b.* from bookings b join users u on u.id=b.user_id where b.razorpay_order_id=? and u.email=?",x.get("razorpayOrderId"),email(a));
  Mac mac=Mac.getInstance("HmacSHA256");mac.init(new SecretKeySpec(razorSecret.getBytes(StandardCharsets.UTF_8),"HmacSHA256"));
  String expected=HexFormat.of().formatHex(mac.doFinal((x.get("razorpayOrderId")+"|"+x.get("razorpayPaymentId")).getBytes(StandardCharsets.UTF_8)));
  if(!MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8),x.get("razorpaySignature").getBytes(StandardCharsets.UTF_8)))throw new ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST,"Invalid payment signature");
  if(db.queryForObject("select count(*) from bookings where id=? and expires_at>now() and status='PENDING'",Integer.class,b.get("id"))==0)throw new ResponseStatusException(org.springframework.http.HttpStatus.CONFLICT,"Seat hold expired");
  long id=((Number)b.get("id")).longValue();db.update("update bookings set status='CONFIRMED',razorpay_payment_id=? where id=?",x.get("razorpayPaymentId"),id);db.update("update show_seats set status='BOOKED',locked_by=null,locked_until=null where locked_by=?",id);db.update("update payments set razorpay_payment_id=?,status='SUCCESS',paid_at=now() where razorpay_order_id=?",x.get("razorpayPaymentId"),x.get("razorpayOrderId"));
  return Map.of("status","success");
 }

 @GetMapping("/api/bookings/me")
 List<Map<String,Object>> myBookings(Authentication a){
  return db.queryForList("select b.id,b.reference,b.status,b.amount,b.created_at,m.title,sh.show_date,sh.start_time,t.name theatre_name,string_agg(bs.seat_number,', ' order by bs.seat_number) seats from bookings b join users u on u.id=b.user_id join shows sh on sh.id=b.show_id join movies m on m.id=sh.movie_id join screens sc on sc.id=sh.screen_id join theatres t on t.id=sc.theatre_id join booking_seats bs on bs.booking_id=b.id where u.email=? group by b.id,m.title,sh.show_date,sh.start_time,t.name order by b.created_at desc",email(a));
 }
 @PostMapping("/api/bookings/{id}/cancel")
 Map<String,String> cancel(Authentication a,@PathVariable long id){int n=db.update("update bookings b set status='CANCELLED' where b.id=? and b.user_id=(select id from users where email=?) and b.status='CONFIRMED'",id,email(a));if(n==0)throw new ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST,"Booking cannot be cancelled");return Map.of("message","Booking cancelled");}

 @PostMapping("/api/admin/movies")
 Map<String,String> addMovie(@RequestBody Map<String,Object>x){db.update("insert into movies(title,description,poster_url,language,genre,duration_minutes,certificate,rating) values(?,?,?,?,?,?,?,?)",x.get("title"),x.get("description"),x.get("posterUrl"),x.get("language"),x.get("genre"),x.get("durationMinutes"),x.get("certificate"),x.get("rating"));return Map.of("status","created");}

 @PostMapping("/api/admin/shows")
 Map<String,Object> addShow(@RequestBody Map<String,Object>x){
  long id=db.queryForObject("insert into shows(movie_id,screen_id,show_date,start_time,end_time,price) values(?,?,?,?,?,?) returning id",Long.class,x.get("movieId"),x.get("screenId"),LocalDate.parse(x.get("date").toString()),LocalTime.parse(x.get("start").toString()),LocalTime.parse(x.get("end").toString()),x.get("price"));
  for(int i=1;i<=60;i++)db.update("insert into show_seats(show_id,seat_number,seat_type) values(?,?,?)",id,(char)('A'+(i-1)/10)+String.valueOf((i-1)%10+1),i<=20?"PREMIUM":"REGULAR");return Map.of("id",id);
 }

 @Scheduled(fixedDelay=60000) @Transactional
 void expire(){db.update("update show_seats set status='AVAILABLE',locked_by=null,locked_until=null where status='LOCKED' and locked_until<now()");db.update("update bookings set status='EXPIRED' where status='PENDING' and expires_at<now()");}

 @Bean CommandLineRunner seedAdmin(){return a->{if(db.queryForObject("select count(*) from users where email='admin@bms.local'",Integer.class)==0)db.update("insert into users(name,email,password,role) values(?,?,?,'ADMIN')","Admin","admin@bms.local",encoder.encode("Admin@123"));};}

 static class JwtFilter extends OncePerRequestFilter{
  private final String secret;JwtFilter(String secret){this.secret=secret;}
  SecretKey key(){return Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));}
  protected void doFilterInternal(HttpServletRequest r,HttpServletResponse p,FilterChain c)throws java.io.IOException,ServletException{
   String h=r.getHeader("Authorization");if(h!=null&&h.startsWith("Bearer "))try{Claims cl=Jwts.parser().verifyWith(key()).build().parseSignedClaims(h.substring(7)).getPayload();var a=new UsernamePasswordAuthenticationToken(cl.getSubject(),null,List.of(new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_"+cl.get("role",String.class))));org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(a);}catch(Exception ignored){}c.doFilter(r,p);
  }
 }
}