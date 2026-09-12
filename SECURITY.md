# Security Architecture

## Authentication
- Passwords hashed via `bcryptjs` (Cost: 10)
- JSON Web Tokens (JWT) for stateless authentication.

## API Security
- Input validation via Zod
- Cross-Origin Resource Sharing (CORS) restricted to frontend domain
- SQL Injection protected by Drizzle ORM parameterized queries
