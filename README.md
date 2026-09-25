# Book My Show — Full Stack Movie Ticket Booking

End-to-end movie ticket booking application built with:

- Java 17 + Spring Boot 3.5
- Spring Security + JWT
- PostgreSQL
- React + Vite
- Razorpay Checkout + server-side signature verification
- Render + Vercel deployment

## Implemented

### User side
- Register / login
- JWT authentication
- Movie search
- Movie details
- City / theatre / screen / show model
- Live seat map
- Select up to 10 seats
- 10-minute seat hold
- Razorpay payment
- Payment signature verification
- Booking history
- Booking cancellation

### Backend engineering
- REST APIs
- BCrypt password hashing
- Role-based USER / ADMIN authorization
- PostgreSQL transactions
- PostgreSQL FOR UPDATE row locking for concurrent seat selection
- Expired-seat scheduler
- Central health endpoint
- Environment-based secrets
- Render deployment configuration
- GitHub Actions Maven build

## Project structure

book-my-show/
  backend/
    pom.xml
    src/main/java/com/sujaytumu/bms/
      BookMyShowApplication.java   entry point + password/admin-seed beans
      config/SecurityConfig.java   Spring Security filter chain + CORS
      security/JwtService.java     JWT issuing/parsing
      security/JwtAuthFilter.java  request-level auth from Authorization header
      controller/                 AuthController, CatalogController, BookingController,
                                   PaymentController, AdminController
      service/                    UserService, BookingService (seat locking), PaymentService
      scheduler/SeatExpiryScheduler.java  releases expired seat holds every minute
      exception/ApiExceptionHandler.java  consistent {"message": ...} error responses
    src/main/resources/schema.sql
    src/main/resources/data.sql
    src/main/resources/application.properties
  frontend/
    package.json
    src/
      main.jsx        mounts <App/> inside BrowserRouter
      App.jsx          route table
      api.js           axios instance + JWT header injection
      components/Nav.jsx
      pages/Auth.jsx, Home.jsx, Movie.jsx, Show.jsx, Bookings.jsx, Admin.jsx
      styles.css
  render.yaml
  .github/workflows/backend.yml

## Local setup

### PostgreSQL

Create a database named bookmyshow.

Set:

DATABASE_URL=jdbc:postgresql://localhost:5432/bookmyshow
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=your_password

### Backend

cd backend
mvn spring-boot:run

API:
http://localhost:8080/api

### Frontend

cd frontend
npm install
npm run dev

Set VITE_API_URL=http://localhost:8080/api

### Razorpay

Set test credentials:

RAZORPAY_KEY_ID=your_test_key
RAZORPAY_KEY_SECRET=your_test_secret

The frontend receives only the public key from the backend. The secret remains server-side.

## Payments (v1: mocked)

The checkout flow auto-detects whether `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`
are set (`GET /api/payments/mode`). Until you add real Razorpay keys, "Pay"
confirms the booking directly (`POST /api/payments/mock-confirm/{id}`) so the
full hold → pay → confirm → seat-marked-BOOKED flow works end-to-end without
a live payment-gateway account. Add the two env vars later to switch to real
Razorpay checkout with no frontend changes needed.

## Admin panel

Log in with the demo admin account below, then open `/admin` in the frontend to
add movies and schedule shows against existing screens — a UI for the
`/api/admin/**` endpoints that previously had no frontend.

## Demo admin

Email: admin@bms.local
Password: Admin@123

Change this before public deployment.

## Booking flow

1. User selects a movie and show.
2. React requests the seat map.
3. Backend locks selected PostgreSQL rows inside a transaction.
4. If the seats are available, a PENDING booking is created.
5. The seats are locked for 10 minutes.
6. Backend creates a Razorpay order.
7. Razorpay Checkout opens in React.
8. Razorpay returns order/payment/signature values.
9. Backend verifies the HMAC signature.
10. Seats become BOOKED and the booking becomes CONFIRMED.
11. A scheduler releases expired holds.

## Main APIs

POST /api/auth/register
POST /api/auth/login

GET /api/movies
GET /api/movies/{id}
GET /api/cities
GET /api/shows?movieId={id}
GET /api/shows/{id}/seats

POST /api/bookings/hold
GET /api/bookings/me
POST /api/bookings/{id}/cancel

POST /api/payments/create-order/{bookingId}
POST /api/payments/verify

POST /api/admin/movies
POST /api/admin/shows

GET /api/health

## Deployment

### Backend — Render

Use the backend directory as the root directory.

Build command:
mvn clean package -DskipTests

Start command:
java -jar target/book-my-show-api-1.0.0.jar

Configure:
DATABASE_URL
DATABASE_USERNAME
DATABASE_PASSWORD
JWT_SECRET
RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET

### Frontend — Vercel

Use frontend as the root directory.

Build command:
npm run build

Environment variable:
VITE_API_URL=https://your-render-api.onrender.com/api

## Security notes

- Never commit Razorpay secrets.
- Use a long random JWT_SECRET in production.
- Use Razorpay test keys while developing.
- Restrict CORS to the deployed frontend domain before production.
- Replace the demo admin password before deployment.

## Engineering highlight

The most important part of this project is not the UI. It is the booking consistency.

When multiple users select the same seat, the backend executes a transactional SELECT ... FOR UPDATE on the requested show-seat rows. This serializes competing booking attempts at the database level so an already-held or booked seat cannot be successfully allocated twice.

This is an independent educational implementation inspired by movie-ticket-booking workflows and is not affiliated with BookMyShow.
