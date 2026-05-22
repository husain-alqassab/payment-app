# OpenShift Developer Sandbox Monitoring Guide

## Issue with Current Setup

The Prometheus configuration you're using requires cluster-level permissions that are not available in OpenShift developer sandboxes. The errors show:

- `nodes is forbidden` - Cannot access cluster-scoped node resources
- `pods is forbidden` - Limited pod discovery permissions

## Solution: Simplified Monitoring for Developer Sandbox

### Option 1: Use Fixed Prometheus Configuration (Recommended)

I've updated the monitoring configuration to work within sandbox constraints:

**Changes Made:**
1. **Simplified Prometheus config** - Only scrapes services with annotations
2. **Added RBAC permissions** - ServiceAccount with namespace-scoped permissions
3. **Removed cluster discovery** - No node exporter or cluster-wide pod discovery
4. **Namespace-specific** - Configured for your namespace `hussain-alqasab-dev`

**Deploy the fixed version:**
```bash
# Apply RBAC permissions first
oc apply -f monitoring/prometheus-rbac.yaml

# Apply updated Prometheus configuration
oc apply -f monitoring/prometheus-config.yaml

# Restart Prometheus to apply changes
oc rollout restart deployment/prometheus
```

### Option 2: Direct Metrics Endpoint (Simplest)

For development, you can access metrics directly without Prometheus:

```bash
# Port-forward to your application
oc port-forward svc/payment-app 8080:80

# Access metrics endpoint
curl http://localhost:8080/metrics
```

This gives you raw Prometheus metrics that you can view or process manually.

### Option 3: Use OpenShift Built-in Monitoring

OpenShift developer sandbox includes built-in monitoring that you can leverage:

```bash
# View your application's metrics using OpenShift tools
oc top pods
oc logs -f deployment/payment-app

# Check resource usage
oc describe pod <pod-name>
```

### Option 4: Simple Metrics Viewer

Create a simple metrics viewer by adding this to your application:

**Add this route to server.js:**
```javascript
// Simple metrics viewer page
app.get('/metrics-viewer', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Payment App Metrics</title>
      <style>
        body { font-family: Arial; padding: 20px; background: #1a1a2e; color: #eee; }
        .metric { margin: 10px 0; padding: 10px; background: #16213e; border-radius: 5px; }
        .help { color: #0f3460; font-style: italic; }
        h2 { color: #e94560; }
      </style>
    </head>
    <body>
      <h2>Payment Application Metrics</h2>
      <p><a href="/metrics">Raw Prometheus Metrics</a></p>
      <div id="metrics"></div>
      <script>
        fetch('/metrics')
          .then(r => r.text())
          .then(data => {
            const lines = data.split('\n');
            const metricsDiv = document.getElementById('metrics');
            lines.forEach(line => {
              if (line && !line.startsWith('#')) {
                const div = document.createElement('div');
                div.className = 'metric';
                div.textContent = line;
                metricsDiv.appendChild(div);
              }
            });
          });
      </script>
    </body>
    </html>
  `);
});
```

Access at: `http://your-app-url/metrics-viewer`

## Verification Steps

After applying the fixes:

1. **Check Prometheus logs:**
```bash
oc logs -f deployment/prometheus
```

2. **Verify Prometheus targets:**
```bash
oc port-forward svc/prometheus 9090:9090
# Open http://localhost:9090/targets
```

3. **Check if payment-app is being scraped:**
```bash
oc get service payment-app -o yaml
# Verify prometheus.io annotations are present
```

## Updated Deployment Commands

```bash
# 1. Apply RBAC (important for sandbox)
oc apply -f monitoring/prometheus-rbac.yaml

# 2. Apply monitoring configurations
oc apply -f monitoring/

# 3. Verify everything is running
oc get pods -l app=prometheus
oc get svc prometheus

# 4. Check Prometheus logs for errors
oc logs -f deployment/prometheus
```

## Alternative: Skip Prometheus for Development

If you continue to face permission issues, consider:

1. **Use the metrics endpoint directly** - `/metrics` provides all the data
2. **Monitor logs** - `oc logs -f deployment/payment-app` for structured logging
3. **Use OpenShift console** - Built-in monitoring for basic metrics
4. **Add a simple metrics viewer** - As shown in Option 4 above

## Production Considerations

For production deployment outside the developer sandbox:

- Use cluster-admin permissions
- Deploy full monitoring stack with Prometheus Operator
- Add persistent storage for Prometheus data
- Configure alerting rules
- Set up Grafana with persistent dashboards

The simplified configuration provided here is specifically designed to work within the constraints of OpenShift developer sandboxes.