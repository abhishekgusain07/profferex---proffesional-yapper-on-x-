# Barebone tRPC Setup

A minimal, production-ready setup with tRPC, Server Actions, Better-auth, Jest testing, and Tailwind CSS.

## Features

✅ **tRPC Integration**
- End-to-end type-safe API with React Server Components
- Client-side mutations with optimistic updates
- Server-side prefetching and hydration

✅ **Server Actions**
- Progressive enhancement with form submissions
- Works without JavaScript enabled
- Type-safe server-side mutations

✅ **Testing Suite**
- Jest configuration with TypeScript support
- Unit tests for validation logic
- Integration tests for API functionality
- Test coverage reporting

✅ **Modern Stack**
- Next.js 15 with App Router
- TypeScript for full type safety
- Tailwind CSS for styling
- Drizzle ORM with PostgreSQL
- React Query for state management

## Quick Start

1. **Install dependencies**
   ```bash
   bun install
   # or
   npm install
   ```

2. **Set up environment variables**
   ```bash
   cp .env.local.example .env.local
   # Edit .env.local with your database URL
   ```

3. **Run database migrations**
   ```bash
   npm run db:generate
   npm run db:push
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```
   Your app will be available at [http://localhost:3000](http://localhost:3000) (or 3001 if 3000 is in use)

5. **Run tests**
   ```bash
   npm run test          # Run tests once
   npm run test:watch    # Run tests in watch mode
   npm run test:ci       # Run tests with coverage
   ```

## Project Structure

```
src/
├── actions/           # Server Actions for form handling
├── app/              # Next.js App Router pages and layouts
├── db/               # Database schema and configuration
├── trpc/             # tRPC setup, routers, and client/server code
├── __tests__/        # Jest tests (unit and integration)
└── components/       # Reusable UI components
```

## Key Implementation Details

### tRPC Setup

- **Server-side**: RSC-compatible setup with prefetching
- **Client-side**: React Query integration with devtools
- **Type safety**: Full end-to-end TypeScript types

### Server Actions

- **Progressive enhancement**: Forms work without JavaScript
- **Type validation**: Zod schemas for input validation
- **Error handling**: Proper error states and user feedback

### Testing

- **Jest configuration**: TypeScript + Next.js support
- **Unit tests**: Validation logic and utility functions
- **Integration tests**: API endpoints and data flow
- **Mocking**: Proper mocks for external dependencies

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run test` - Run Jest tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:ci` - Run tests with coverage
- `npm run db:generate` - Generate database migrations
- `npm run db:push` - Push database schema
- `npm run db:studio` - Open Drizzle Studio
- `npm run cors:generate` - Generate CORS policy for R2 bucket
- `npm run cors:apply` - Apply CORS policy to R2 bucket
- `npm run cors:setup` - Generate and apply CORS policy (combined)

## Environment Variables

Create a `.env.local` file with:

```env
DATABASE_URL="your-postgresql-connection-string"

# R2 Configuration (for file uploads)
R2_ACCOUNT_ID="your-cloudflare-account-id"
R2_ACCESS_KEY_ID="your-r2-access-key-id"
R2_SECRET_ACCESS_KEY="your-r2-secret-access-key"
R2_BUCKET_NAME="your-r2-bucket-name"
R2_ENDPOINT="https://your-account-id.r2.cloudflarestorage.com"

# Production domain (for CORS policy)
NEXT_PUBLIC_APP_URL="https://yourdomain.com"

# Custom CORS origins (optional, comma-separated)
CORS_ALLOWED_ORIGINS="https://staging.yourdomain.com,https://preview.yourdomain.com"
```

## R2 CORS Configuration

This project includes automated CORS policy management for Cloudflare R2 buckets to enable direct file uploads from the browser.

### Quick Setup

1. **Install and authenticate wrangler CLI** (if not done already):
   ```bash
   npm install -g wrangler
   wrangler auth login
   ```

2. **Set up your R2 environment variables** in `.env.local` (see above)

3. **Generate and apply CORS policy**:
   ```bash
   npm run cors:setup
   ```

### Manual CORS Management

- **Generate policy only**: `npm run cors:generate`
- **Apply existing policy**: `npm run cors:apply`
- **Apply to specific bucket**: `npm run cors:apply cors-policy.json my-bucket-name`

### CORS Policy Features

- ✅ **Dynamic Origins**: Automatically includes production and staging domains
- ✅ **Development Ready**: Includes localhost:3000 and :3001 by default
- ✅ **Proper Headers**: Configured for R2 presigned POST uploads
- ✅ **File Upload Support**: Optimized for image, video, and document uploads

### Troubleshooting CORS

If you encounter CORS errors:

1. **Check origins match exactly**: Use browser dev tools to see the Origin header
2. **Verify policy is applied**: Run `wrangler r2 bucket cors list your-bucket-name`
3. **Test with curl**: Use the generated presigned URLs directly
4. **Check wrangler auth**: Run `wrangler auth whoami` to verify authentication

## Database Setup

The project uses PostgreSQL with Drizzle ORM. You can use:
- **Neon** (recommended for development)
- **Supabase**
- **PlanetScale**
- **Local PostgreSQL**

## Contributing

1. Run tests: `npm run test`
2. Check types: `npm run build`
3. Run linting: `npm run lint`

## Technologies Used

- **Framework**: Next.js 15
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL + Drizzle ORM
- **API**: tRPC
- **Testing**: Jest + Testing Library
- **Package Manager**: Bun (with npm fallback)

---

Built with ❤️ using modern web technologies for maximum type safety and developer experience.
