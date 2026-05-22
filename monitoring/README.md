# Monitoring Setup Guide

This guide explains how to set up and configure monitoring for the Payment Application using Prometheus and Grafana on OpenShift.

## Overview

The monitoring stack includes:
- **Prometheus**: Metrics collection and storage
- **Grafana**: Visualization and dashboarding
- **Winston**: Structured logging in the application
- **Prometheus Client**: Application metrics exposition

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Payment App    │────▶│   Prometheus    │────▶│     Grafana     │
│  (node_exporter)│     │  (metrics DB)   │     │  (dashboards)   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
       │                        │
       │                        │
       └────────────────────────┘
              /metrics endpoint
```

## Prerequisites

- OpenShift cluster with admin access
- `oc` CLI tool installed
- Sufficient resources for monitoring stack
- Payment application deployed

## Quick Start

### 1. Deploy the Monitoring Stack

```bash
# Apply all monitoring configurations
oc apply -f monitoring/

# Verify deployment
oc get pods -l app=prometheus
oc get pods -l app=grafana
```

### 2. Access the Interfaces

Get the routes to access the monitoring interfaces:

```bash
# Grafana URL
oc get route grafana

# Prometheus URL
oc get route prometheus
```

### 3. Login to Grafana

Default credentials (change in production!):
- **Username**: `admin`
- **Password**: `admin123`

**Important**: Change these credentials in `monitoring/grafana-secret.yaml` before production deployment.

## Configuration Files

### Prometheus Configuration

- **prometheus-config.yaml**: Prometheus configuration with scrape targets
- **prometheus-deployment.yaml**: Prometheus deployment
- **prometheus-service.yaml**: Service for Prometheus
- **prometheus-route.yaml**: Route for external access

### Grafana Configuration

- **grafana-deployment.yaml**: Grafana deployment
- **grafana-service.yaml**: Service for Grafana
- **grafana-route.yaml**: Route for external access
- **grafana-datasource.yaml**: Prometheus datasource configuration
- **grafana-dashboard.yaml**: Pre-configured dashboards
- **grafana-secret.yaml**: Grafana credentials

### Service Discovery

- **servicemonitor.yaml**: ServiceMonitor for Prometheus Operator
- **openshift/service.yaml**: Updated with Prometheus annotations

## Application Metrics

The application exposes the following metrics at `/metrics`:

### Default Metrics (provided by prom-client)
- Node.js runtime metrics
- Event loop lag
- Heap memory usage
- CPU usage

### Custom Metrics

#### Counter Metrics
- `payment_requests_total{status}`: Total payment requests by status (success, error, validation_failed)

#### Gauge Metrics
- `payment_amount_total{currency}`: Total amount of all payments by currency
- `active_connections`: Current number of active connections

#### Histogram Metrics
- `http_request_duration_seconds{method, route, status_code}`: HTTP request duration

## Application Logging

The application uses Winston for structured logging:

### Log Levels
- `error`: Error conditions
- `warn`: Warning conditions
- `info`: Informational messages
- `debug`: Debug-level messages

### Log Format
Logs are structured JSON with the following fields:
- `timestamp`: ISO 8601 timestamp
- `level`: Log level
- `message`: Log message
- `service`: Service name (payment-app)
- Additional context-specific fields

### Environment Variables
- `LOG_LEVEL`: Set logging level (default: info)
- `NODE_ENV`: Environment mode

Example:
```bash
# Set debug logging
oc set env deployment/payment-app LOG_LEVEL=debug
```

## Grafana Dashboards

### Pre-configured Dashboard

The application includes a pre-configured Grafana dashboard (`Payment Application Monitoring`) with:

1. **Total Payment Requests**: Gauge showing total payment requests by status
2. **Payment Request Rate**: Time series showing request rate per status
3. **Total Payment Amount**: Time series showing total payment amounts by currency
4. **Active Connections**: Current number of active connections
5. **HTTP Request Duration**: Request duration by method, route, and status code

### Accessing the Dashboard

1. Login to Grafana
2. Navigate to Dashboards → Manage
3. Find "Payment Application Monitoring"
4. Click to open

### Creating Custom Dashboards

1. Login to Grafana
2. Click "+" → "Dashboard"
3. Add panels using Prometheus queries
4. Save dashboard

## Prometheus Queries

### Useful Queries

**Total payment requests:**
```promql
sum(payment_requests_total)
```

**Payment request rate:**
```promql
rate(payment_requests_total[5m])
```

**Error rate:**
```promql
rate(payment_requests_total{status="error"}[5m])
```

**Average request duration:**
```promql
rate(http_request_duration_seconds_sum[5m]) / rate(http_request_duration_seconds_count[5m])
```

**Active connections:**
```promql
active_connections
```

**Total payment amount by currency:**
```promql
payment_amount_total
```

## Troubleshooting

### Prometheus Not Scraping Metrics

**Check if metrics endpoint is accessible:**
```bash
oc port-forward svc/payment-app 8080:80
curl http://localhost:8080/metrics
```

**Check Prometheus targets:**
1. Open Prometheus UI
2. Go to Status → Targets
3. Verify payment-app target is "UP"

**Check service annotations:**
```bash
oc get service payment-app -o yaml
```

Ensure annotations are present:
```yaml
annotations:
  prometheus.io/scrape: "true"
  prometheus.io/port: "8080"
  prometheus.io/path: "/metrics"
```

### Grafana Cannot Connect to Prometheus

**Check datasource configuration:**
1. Login to Grafana
2. Go to Configuration → Data Sources
3. Verify Prometheus URL: `http://prometheus:9090`
4. Test connection

**Check Prometheus service:**
```bash
oc get svc prometheus
oc get pods -l app=prometheus
```

### No Data in Dashboards

**Verify metrics are being collected:**
```bash
# Port-forward to Prometheus
oc port-forward svc/prometheus 9090:9090

# Query metrics
curl 'http://localhost:9090/api/v1/query?query=payment_requests_total'
```

**Check application logs:**
```bash
oc logs -f deployment/payment-app
```

**Verify scraping interval:**
- Default scrape interval: 30 seconds
- Wait at least 30 seconds after deployment

### High Memory Usage

**Prometheus memory limits:**
```yaml
resources:
  limits:
    memory: "1Gi"
```

**Reduce metrics retention:**
Edit `monitoring/prometheus-deployment.yaml`:
```yaml
args:
  - '--storage.tsdb.retention.time=15d'  # Reduce from 30d
```

## Scaling and Performance

### Prometheus Scaling

For high-volume scenarios:
1. Increase memory limits
2. Use remote storage (Thanos, Cortex)
3. Consider sharding

### Grafana Scaling

For multiple users:
1. Increase CPU/memory limits
2. Use persistent storage for dashboards
3. Configure authentication

### Application Metrics Optimization

Reduce metric cardinality:
- Limit label values
- Use appropriate metric types
- Avoid high-cardinality labels

## Security

### Change Default Credentials

Edit `monitoring/grafana-secret.yaml`:
```yaml
stringData:
  admin-user: "your-secure-user"
  admin-password: "your-secure-password"
```

Apply changes:
```bash
oc apply -f monitoring/grafana-secret.yaml
oc rollout restart deployment/grafana
```

### Network Policies

Consider adding network policies to restrict access:
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: monitoring-policy
spec:
  podSelector:
    matchLabels:
      app: grafana
  policyTypes:
  - Ingress
  ingress:
  - from:
    - namespaceSelector: {}
```

### TLS Configuration

All routes use TLS termination at the OpenShift router by default.

## Maintenance

### Backup Grafana Dashboards

Export dashboards:
1. Open dashboard in Grafana
2. Click Share → Export
3. Save JSON file

### Backup Prometheus Data

Prometheus data is stored in `emptyDir` by default. For persistence:
```yaml
volumes:
  - name: storage-volume
    persistentVolumeClaim:
      claimName: prometheus-pvc
```

### Updates

Update monitoring stack:
```bash
# Update images
oc set image deployment/prometheus prometheus=prom/prometheus:latest
oc set image deployment/grafana grafana=grafana/grafana:latest

# Update configurations
oc apply -f monitoring/
```

## Advanced Configuration

### Custom Alerts

Create alerting rules in Prometheus:
```yaml
groups:
  - name: payment_alerts
    rules:
      - alert: HighErrorRate
        expr: rate(payment_requests_total{status="error"}[5m]) > 0.1
        for: 5m
        annotations:
          summary: "High payment error rate"
```

### Log Aggregation

For centralized logging, consider:
- EFK Stack (Elasticsearch, Fluentd, Kibana)
- Loki (Grafana's log aggregation system)
- OpenShift Logging (ELK)

### Distributed Tracing

For distributed tracing, consider:
- Jaeger
- Zipkin
- OpenTelemetry

## Support and Documentation

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Winston Documentation](https://github.com/winstonjs/winston)
- [prom-client Documentation](https://github.com/siimon/prom-client)

## Checklist for Production

- [ ] Change default Grafana credentials
- [ ] Configure persistent storage for Prometheus
- [ ] Set up backup procedures
- [ ] Configure alerting rules
- [ ] Review and adjust resource limits
- [ ] Set up log aggregation
- [ ] Configure network policies
- [ ] Enable TLS for all endpoints
- [ ] Set up monitoring for monitoring stack
- [ ] Document runbooks and procedures