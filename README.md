# Payment Application - OpenShift Deployment

A simple payment generation application built with Node.js/Express, designed for deployment on OpenShift.

## Features

- Single-page application for generating payment requests
- RESTful API for payment generation
- Responsive web interface
- Health check endpoints for OpenShift monitoring
- Docker container ready for OpenShift deployment

## Project Structure

```
payment-app/
├── public/
│   ├── index.html      # Main HTML page
│   ├── styles.css      # Styling
│   └── script.js       # Frontend JavaScript
├── openshift/
│   ├── buildconfig.yaml    # OpenShift BuildConfig
│   ├── deployment.yaml     # Kubernetes Deployment
│   ├── imagestream.yaml    # OpenShift ImageStream
│   ├── route.yaml          # OpenShift Route
│   └── service.yaml        # Kubernetes Service
├── server.js           # Express server
├── package.json        # Node.js dependencies
├── Dockerfile          # Docker configuration
└── .dockerignore       # Docker ignore rules
```

## Prerequisites

- OpenShift cluster (v4.x or higher)
- `oc` CLI tool installed and configured
- Docker (for local testing)
- Node.js 18+ (for local development)

## Local Development

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Access the application at `http://localhost:8080`

## OpenShift Deployment

### Option 1: Using OpenShift CLI (oc)

1. **Login to your OpenShift cluster:**
```bash
oc login <your-cluster-url>
```

2. **Create a new project (optional):**
```bash
oc new-project payment-app
```

3. **Update the BuildConfig:**
   Edit `openshift/buildconfig.yaml` and replace `<YOUR_GIT_REPO_URL>` with your actual Git repository URL.

4. **Apply the OpenShift configurations:**
```bash
oc apply -f openshift/imagestream.yaml
oc apply -f openshift/buildconfig.yaml
oc apply -f openshift/deployment.yaml
oc apply -f openshift/service.yaml
oc apply -f openshift/route.yaml
```

5. **Start the build:**
```bash
oc start-build payment-app
```

6. **Monitor the build:**
```bash
oc logs -f bc/payment-app
```

7. **Get the route URL:**
```bash
oc get route payment-app
```

### Option 2: Using Source-to-Image (S2I)

If you prefer to use OpenShift's S2I builder instead of Docker:

```bash
oc new-app https://github.com/your-username/payment-app.git --name=payment-app
oc expose svc/payment-app
```

### Option 3: Manual Docker Build and Push

1. **Build the Docker image locally:**
```bash
docker build -t payment-app:latest .
```

2. **Tag the image for your OpenShift registry:**
```bash
docker tag payment-app:latest <your-registry>/payment-app:latest
```

3. **Push to your registry:**
```bash
docker push <your-registry>/payment-app:latest
```

4. **Update the deployment to use your image:**
```bash
oc set image deployment/payment-app payment-app=<your-registry>/payment-app:latest
```

## Configuration

### Environment Variables

The application supports the following environment variables:

- `PORT`: Application port (default: 8080)
- `NODE_ENV`: Environment mode (default: production)

### Resource Limits

Default resource limits configured in deployment.yaml:
- Memory: 128Mi request, 256Mi limit
- CPU: 100m request, 500m limit

Adjust these values based on your requirements.

## API Endpoints

### Health Check
- **GET** `/health` - Health check endpoint for OpenShift probes

### Payment API
- **POST** `/api/payments` - Generate a new payment

  Request body:
  ```json
  {
    "customerName": "John Doe",
    "amount": "100.00",
    "currency": "USD",
    "description": "Payment for services"
  }
  ```

  Response:
  ```json
  {
    "success": true,
    "payment": {
      "paymentId": "uuid-v4",
      "customerName": "John Doe",
      "amount": 100.00,
      "currency": "USD",
      "description": "Payment for services",
      "status": "pending",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "expiryDate": "2024-01-02T00:00:00.000Z"
    }
  }
  ```

## Monitoring and Logs

### View application logs:
```bash
oc logs -f deployment/payment-app
```

### Check pod status:
```bash
oc get pods -l app=payment-app
```

### Describe deployment:
```bash
oc describe deployment payment-app
```

## Troubleshooting

### Pods not starting
- Check resource limits and requests
- Verify the image build completed successfully
- Review logs: `oc logs <pod-name>`

### Build failures
- Ensure Git repository URL is correct in BuildConfig
- Check Dockerfile syntax
- Verify all dependencies are in package.json

### Route not accessible
- Verify the route was created: `oc get route`
- Check if the route is configured for TLS
- Ensure the service is running: `oc get svc`

## Security Considerations

- Application runs as non-root user (UID 1001)
- Health checks configured for liveness and readiness
- Resource limits prevent resource exhaustion
- TLS termination at the router level

## Scaling

To scale the application:

```bash
oc scale deployment payment-app --replicas=3
```

## Cleanup

To remove the application from OpenShift:

```bash
oc delete route payment-app
oc delete service payment-app
oc delete deployment payment-app
oc delete buildconfig payment-app
oc delete imagestream payment-app
```

Or delete the entire project:

```bash
oc delete project payment-app
```

## License

ISC