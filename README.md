# Media Inbox - File Upload Service

A production-ready Media Inbox backend system with async file processing pipeline built with Nest.js, Redis, BullMQ, and AWS S3.

## Features

- 🔐 **Authentication & Authorization**: JWT + refresh tokens with role-based access control
- 📤 **Secure File Uploads**: Pre-signed S3 URLs for direct uploads
- ⚡ **Async Processing**: Background job processing with thumbnail generation
- 🗄️ **Asset Management**: Complete CRUD operations with pagination
- 👑 **Admin Controls**: Job monitoring and management
- 🐳 **Docker Ready**: Complete development environment
- 📚 **API Documentation**: OpenAPI/Swagger at `/docs`

## Prerequisites

- Docker and Docker Compose
- Node.js 18+ and npm
- AWS S3 bucket and credentials

## Quick Start

### 1. Clone and Setup

```bash
git clone <repository-url>
cd file-uploader
npm install
```

### 2. Configure AWS S3

Create a `.env` file based on `env.example`:

```bash
# AWS S3 Configuration
S3_ACCESS_KEY="your-aws-access-key"
S3_SECRET_KEY="your-aws-secret-key"
S3_BUCKET="your-s3-bucket-name"
S3_REGION="ap-south-1"

# Other configurations...
```

**Important**:

- Ensure your AWS credentials have S3 permissions
- Create the S3 bucket before running the application
- The bucket should be in the region specified in `S3_REGION`

### 3. Start Services

```bash
# Start PostgreSQL and Redis
docker compose up -d postgres redis

# Run database migrations
npm run db:migrate

# Seed the database
npm run db:seed

# Start the application
npm run start:dev
```

### 4. Access the Application

- **API**: http://localhost:3000
- **Swagger Docs**: http://localhost:3000/docs
- **Health Check**: http://localhost:3000/health

## Environment Variables

| Variable             | Description                  | Default      |
| -------------------- | ---------------------------- | ------------ |
| `S3_ACCESS_KEY`      | AWS Access Key ID            | Required     |
| `S3_SECRET_KEY`      | AWS Secret Access Key        | Required     |
| `S3_BUCKET`          | S3 Bucket Name               | Required     |
| `S3_REGION`          | AWS Region                   | `ap-south-1` |
| `DATABASE_URL`       | PostgreSQL connection string | Required     |
| `REDIS_URL`          | Redis connection string      | Required     |
| `JWT_SECRET`         | JWT signing secret           | Required     |
| `JWT_REFRESH_SECRET` | JWT refresh secret           | Required     |

## API Endpoints

### Authentication

- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `POST /auth/refresh` - Token refresh

### File Uploads

- `POST /uploads/presign` - Generate presigned upload URL
- `POST /uploads/complete` - Complete file upload

### Assets

- `GET /assets` - List user assets (with pagination)
- `GET /assets/:id` - Get asset details
- `DELETE /assets/:id` - Delete asset

### Admin (Admin role required)

- `GET /jobs/stats` - Queue statistics
- `GET /jobs/:id` - Job status
- `POST /jobs/:id/retry` - Retry failed job
- `DELETE /jobs/:id` - Delete job

## Development

### Running Tests

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

### Database Operations

```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# Seed database
npm run db:seed

# Open Prisma Studio
npm run db:studio
```

## Architecture

The system uses a single Nest.js application that handles both HTTP requests and background job processing:

### System Overview

```mermaid
graph TB
    subgraph "Client Applications"
        Web[Web Client]
        Mobile[Mobile App]
        API[API Client]
    end

    subgraph "Media Inbox API"
        Gateway[API Gateway]
        Auth[Authentication Module]
        Uploads[Uploads Module]
        Assets[Assets Module]
        Jobs[Jobs Module]
        Admin[Admin Module]
    end

    subgraph "Background Processing"
        Queue[Redis Queue]
        Processor[Media Processing]
        Thumbnails[Thumbnail Generation]
        Metadata[Metadata Extraction]
    end

    subgraph "External Services"
        S3[AWS S3]
        DB[(PostgreSQL)]
        Redis[(Redis)]
    end

    Web --> Gateway
    Mobile --> Gateway
    API --> Gateway

    Gateway --> Auth
    Gateway --> Uploads
    Gateway --> Assets
    Gateway --> Jobs
    Gateway --> Admin

    Uploads --> S3
    Assets --> S3
    Jobs --> Queue
    Queue --> Processor
    Processor --> S3
    Processor --> Thumbnails
    Processor --> Metadata

    Auth --> DB
    Uploads --> DB
    Assets --> DB
    Jobs --> DB
    Admin --> DB

    Auth --> Redis
    Jobs --> Redis
    Queue --> Redis
```

### Module Architecture

```mermaid
graph LR
    subgraph "Nest.js Application"
        App[App Module]

        subgraph "Core Modules"
            Auth[Auth Module]
            Uploads[Uploads Module]
            Assets[Assets Module]
            Jobs[Jobs Module]
        end

        subgraph "Shared Services"
            Prisma[Prisma Service]
            Config[Config Service]
            Health[Health Controller]
        end
    end

    subgraph "External Dependencies"
        S3[S3 Service]
        BullMQ[BullMQ]
        JWT[JWT Strategy]
        Guards[Role Guards]
    end

    App --> Auth
    App --> Uploads
    App --> Assets
    App --> Jobs
    App --> Prisma
    App --> Config
    App --> Health

    Auth --> JWT
    Auth --> Guards
    Uploads --> S3
    Assets --> S3
    Jobs --> BullMQ
    Jobs --> S3
```

### Data Flow Architecture

```mermaid
sequenceDiagram
    participant Client
    participant API as Media Inbox API
    participant S3 as AWS S3
    participant Queue as Redis Queue
    participant Worker as Background Worker
    participant DB as PostgreSQL

    Note over Client,DB: File Upload Flow

    Client->>API: 1. Request Presigned URL
    API->>S3: 2. Generate Presigned URL
    API->>Client: 3. Return Presigned URL

    Client->>S3: 4. Upload File Directly
    Client->>API: 5. Complete Upload

    API->>DB: 6. Create Asset Record
    API->>Queue: 7. Enqueue Processing Job

    Queue->>Worker: 8. Process Job
    Worker->>S3: 9. Download File
    Worker->>Worker: 10. Generate Thumbnail
    Worker->>Worker: 11. Extract Metadata
    Worker->>S3: 12. Upload Thumbnail
    Worker->>DB: 13. Update Asset Status

    API->>Client: 14. Return Asset Details
```

### Database Schema Overview

```mermaid
erDiagram
    User {
        string id PK
        string email UK
        string password_hash
        enum role
        datetime created_at
        datetime updated_at
    }

    Session {
        string id PK
        string user_id FK
        string refresh_token_hash
        datetime expires_at
        datetime revoked_at
        datetime created_at
    }

    Asset {
        string id PK
        string owner_id FK
        string object_key UK
        string mime
        int size
        enum status
        string thumb_key
        json meta
        datetime created_at
        datetime updated_at
    }

    Job {
        string id PK
        string asset_id FK
        enum state
        int attempts
        string last_error
        datetime created_at
        datetime updated_at
    }

    AuditLog {
        string id PK
        string actor_id FK
        string action
        string subject
        json payload
        datetime created_at
    }

    User ||--o{ Session : "has"
    User ||--o{ Asset : "owns"
    User ||--o{ AuditLog : "performs"
    Asset ||--o{ Job : "triggers"
```

### Technology Stack

```mermaid
graph TB
    subgraph "Backend Framework"
        NestJS[Nest.js v10+]
        TypeScript[TypeScript 5.7+]
        Prisma[Prisma ORM]
    end

    subgraph "Authentication"
        JWT[JWT Tokens]
        Passport[Passport.js]
        Bcrypt[Bcrypt Hashing]
    end

    subgraph "File Processing"
        Sharp[Sharp Image Processing]
        BullMQ[BullMQ Job Queue]
        Redis[Redis Cache/Queue]
    end

    subgraph "Storage"
        S3[AWS S3]
        PostgreSQL[PostgreSQL 15]
    end

    subgraph "Development"
        Docker[Docker Compose]
        Swagger[OpenAPI/Swagger]
        Jest[Jest Testing]
    end

    NestJS --> TypeScript
    NestJS --> Prisma
    NestJS --> JWT
    NestJS --> Sharp
    NestJS --> BullMQ
    NestJS --> S3
    NestJS --> PostgreSQL
    NestJS --> Redis
```

### Security Architecture

```mermaid
graph TB
    subgraph "API Security"
        RateLimit[Rate Limiting]
        Validation[Input Validation]
        CORS[CORS Protection]
        Helmet[Security Headers]
    end

    subgraph "Authentication"
        JWTStrategy[JWT Strategy]
        RefreshTokens[Token Rotation]
        SessionMgmt[Session Management]
        RoleGuard[Role-Based Access]
    end

    subgraph "Data Security"
        UserIsolation[User Data Isolation]
        S3Presigned[Presigned URLs]
        SQLInjection[SQL Injection Prevention]
        XSS[XSS Protection]
    end

    subgraph "Infrastructure"
        EnvVars[Environment Variables]
        Secrets[Secret Management]
        Network[Network Security]
        Container[Container Security]
    end

    RateLimit --> JWTStrategy
    Validation --> UserIsolation
    JWTStrategy --> RoleGuard
    S3Presigned --> EnvVars
    RoleGuard --> SessionMgmt
```

### Performance & Scalability

```mermaid
graph LR
    subgraph "Performance Features"
        Async[Async Processing]
        Caching[Redis Caching]
        Pagination[Cursor Pagination]
        Indexing[Database Indexes]
    end

    subgraph "Scalability"
        Queue[Job Queues]
        Workers[Background Workers]
        LoadBalancing[Load Balancing Ready]
        Microservices[Microservices Ready]
    end

    subgraph "Monitoring"
        Health[Health Checks]
        Metrics[Performance Metrics]
        Logging[Structured Logging]
        Tracing[Request Tracing]
    end

    Async --> Queue
    Caching --> Performance
    Pagination --> Scalability
    Indexing --> Performance
    Queue --> Workers
    Health --> Monitoring
```

- **HTTP Layer**: Controllers, services, and middleware
- **Job Processing**: BullMQ processors for async file operations
- **Storage**: AWS S3 for file storage, PostgreSQL for metadata
- **Caching**: Redis for job queues and caching
- **Authentication**: JWT with refresh token rotation

## Security Features

- JWT token rotation and invalidation
- Role-based access control (USER/ADMIN)
- Secure file uploads via presigned URLs
- Input validation and sanitization
- User isolation for assets

## Performance

- Async file processing with background jobs
- Cursor-based pagination for asset listings
- Efficient database queries with proper indexing
- Redis-backed job queues for scalability

## Troubleshooting

### S3 Connection Issues

1. Verify AWS credentials are correct
2. Ensure S3 bucket exists and is accessible
3. Check IAM permissions for S3 operations
4. Verify region configuration matches bucket region

### Database Connection Issues

1. Ensure PostgreSQL container is running
2. Check database credentials in `.env`
3. Verify database exists and migrations are applied

## License

This project is licensed under the MIT License.
