# Payment Application - Agent Guidelines

## Product Overview

A simple payment generation application built for OpenShift deployment. The application provides a single-page interface where customers can generate payment requests with details such as customer name, amount, currency, and description. Each payment generates a unique ID and has a 24-hour expiry period.

**Key Features:**
- Single-page payment form with responsive design
- RESTful API for payment generation
- Unique payment ID generation using UUID v4
- Health check endpoints for OpenShift monitoring
- Docker container ready for OpenShift deployment
- Structured logging with Winston
- Prometheus metrics for monitoring
- Grafana dashboards for visualization

**Current State:**
- In-memory payment storage (no database persistence)
- Structured logging with Winston (JSON format)
- Prometheus metrics collection
- Grafana monitoring dashboards
- Basic validation on required fields
- Production-ready containerization with monitoring

## Technology Stack

### Backend
- **Runtime**: Node.js 18+ (Alpine Linux for containers)
- **Framework**: Express.js 4.18+
- **Dependencies**:
  - `express` - Web framework
  - `body-parser` - Request body parsing
  - `uuid` - Unique ID generation
  - `winston` - Structured logging
  - `prom-client` - Prometheus metrics collection

### Frontend
- **HTML5** - Semantic markup
- **CSS3** - Custom styling (no frameworks)
- **Vanilla JavaScript** - No frontend frameworks
- **Fetch API** - HTTP requests

### DevOps & Containerization
- **Container**: Docker with multi-stage builds
- **Base Image**: node:18-alpine
- **Orchestration**: Kubernetes/OpenShift 4.x+
- **Build Tools**: Docker, OpenShift BuildConfig

### Monitoring & Observability
- **Metrics Collection**: Prometheus
- **Visualization**: Grafana
- **Logging**: Winston (structured JSON logging)
- **Service Discovery**: Prometheus annotations + ServiceMonitor
- **Metrics Endpoint**: `/metrics` for Prometheus scraping
- **Health Checks**: `/health` for OpenShift probes

### Database
- **Current**: None (in-memory only)
- **Recommended for Production**: PostgreSQL, MongoDB, or Redis

## Coding Conventions

### Code Style
- **JavaScript**: Use ES6+ syntax (const/let, arrow functions, template literals)
- **Indentation**: 2 spaces (no tabs)
- **Semicolons**: Required
- **Quotes**: Single quotes for strings, double quotes only when needed
- **File Naming**: kebab-case for files (e.g., `payment-controller.js`)

### Backend Conventions
- Use Express.js middleware pattern
- Async/await for asynchronous operations
- Error handling with try-catch blocks
- Consistent response format:
  ```javascript
  {
    success: true/false,
    data/error: {...}
  }
  ```
- Route naming: `/api/resource` (RESTful conventions)
- Environment variables for configuration (PORT, NODE_ENV, LOG_LEVEL, etc.)

### Logging Conventions
- Use Winston logger for all application logging
- Structured JSON logging format with timestamps
- Log levels: error, warn, info, debug
- Include relevant context in log messages (request IDs, user info, etc.)
- Log security events and errors with appropriate severity
- Avoid logging sensitive data (passwords, tokens, personal info)

### Metrics Conventions
- Use prom-client for Prometheus metrics
- Define custom metrics for business logic
- Include default metrics (CPU, memory, etc.)
- Use appropriate metric types: Counter, Gauge, Histogram
- Label metrics with relevant dimensions (status, currency, etc.)
- Expose metrics at `/metrics` endpoint for Prometheus scraping

### Frontend Conventions
- Vanilla JavaScript (no frameworks unless explicitly requested)
- Semantic HTML5 elements
- CSS in separate files (no inline styles)
- Responsive design (mobile-first approach)
- Form validation on both client and server side
- Use Fetch API for HTTP requests

### Docker/OpenShift Conventions
- Multi-stage Docker builds for optimization
- Non-root user (UID 1001) for security
- Alpine Linux base images for smaller size
- Resource limits in deployment configs
- Health checks (liveness and readiness probes)
- Environment-specific configurations

### File Structure
```
payment-app/
├── public/           # Static frontend files
├── server.js         # Main application entry point
├── package.json      # Dependencies and scripts
├── Dockerfile        # Container configuration
├── openshift/        # OpenShift YAML configs
├── monitoring/       # Monitoring configurations
│   ├── prometheus-*.yaml
│   ├── grafana-*.yaml
│   └── servicemonitor.yaml
└── AGENTS.md         # This file
```

### Git Conventions
- Clear, descriptive commit messages
- Reference relevant issues in commits
- Never commit sensitive data (API keys, passwords)
- Use .gitignore for node_modules, .env files

### Security Best Practices
- Never hardcode credentials or API keys
- Use environment variables for sensitive data
- Run containers as non-root users
- Implement input validation and sanitization
- Use HTTPS in production (TLS termination at OpenShift router)
- Resource limits to prevent DoS
- Regular dependency updates

### Testing (When Added)
- Unit tests for business logic
- Integration tests for API endpoints
- Use testing frameworks compatible with Node.js (Jest, Mocha)
- Test coverage reporting

### Documentation
- Update README.md for feature changes
- Document API endpoints in code comments
- Keep AGENTS.md updated with stack changes
- Comment complex logic only (don't over-comment)

## Build & Deployment Commands

### Local Development
```bash
npm install
npm start          # Production mode
npm run dev        # Development mode (if nodemon added)
```

### Docker Build
```bash
docker build -t payment-app:latest .
docker run -p 8080:8080 payment-app:latest
```

### OpenShift Deployment
```bash
# Deploy application
oc apply -f openshift/
oc start-build payment-app

# Deploy monitoring stack
oc apply -f monitoring/

# Get routes
oc get route payment-app
oc get route grafana
oc get route prometheus
```

## Important Notes

- Current implementation uses in-memory storage - add database for production
- Payment data is not persisted across container restarts
- Health check endpoint is critical for OpenShift monitoring
- All API responses should follow consistent JSON format
- Keep dependencies minimal to reduce attack surface
- Test thoroughly before deploying to production
- Monitoring stack (Prometheus/Grafana) should be deployed in same namespace
- Change default Grafana credentials in production (monitoring/grafana-secret.yaml)
- Metrics are scraped every 30 seconds by default
- Logs are structured JSON for better parsing and analysis