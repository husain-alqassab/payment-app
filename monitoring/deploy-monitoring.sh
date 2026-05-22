#!/bin/bash

# Monitoring Deployment Script for OpenShift Developer Sandbox

echo "🚀 Deploying Monitoring Stack for OpenShift Developer Sandbox"
echo "=============================================================="

# Check if oc command is available
if ! command -v oc &> /dev/null; then
    echo "❌ Error: oc CLI not found. Please install OpenShift CLI."
    exit 1
fi

# Check if we're logged in
if ! oc whoami &> /dev/null; then
    echo "❌ Error: Not logged in to OpenShift. Please run 'oc login' first."
    exit 1
fi

echo "✅ Logged in as: $(oc whoami)"
echo "📁 Current namespace: $(oc project -q)"
echo ""

# Apply RBAC permissions
echo "📝 Applying RBAC permissions..."
oc apply -f monitoring/prometheus-rbac.yaml
if [ $? -eq 0 ]; then
    echo "✅ RBAC permissions applied successfully"
else
    echo "❌ Failed to apply RBAC permissions"
    exit 1
fi

echo ""

# Apply Prometheus configuration
echo "📝 Applying Prometheus configuration..."
oc apply -f monitoring/prometheus-config.yaml
if [ $? -eq 0 ]; then
    echo "✅ Prometheus configuration applied successfully"
else
    echo "❌ Failed to apply Prometheus configuration"
    exit 1
fi

echo ""

# Apply other monitoring components
echo "📝 Applying monitoring components..."
oc apply -f monitoring/prometheus-deployment.yaml
oc apply -f monitoring/prometheus-service.yaml
oc apply -f monitoring/prometheus-route.yaml
oc apply -f monitoring/grafana-deployment.yaml
oc apply -f monitoring/grafana-service.yaml
oc apply -f monitoring/grafana-route.yaml
oc apply -f monitoring/grafana-datasource.yaml
oc apply -f monitoring/grafana-dashboard.yaml
oc apply -f monitoring/grafana-secret.yaml

echo "✅ Monitoring components applied"
echo ""

# Wait for deployments to be ready
echo "⏳ Waiting for deployments to be ready..."
echo "This may take 1-2 minutes..."
echo ""

oc rollout status deployment/prometheus --timeout=120s
if [ $? -ne 0 ]; then
    echo "⚠️  Prometheus deployment timeout, but continuing..."
fi

oc rollout status deployment/grafana --timeout=120s
if [ $? -ne 0 ]; then
    echo "⚠️  Grafana deployment timeout, but continuing..."
fi

echo ""

# Check pod status
echo "📊 Checking pod status..."
echo "Prometheus pods:"
oc get pods -l app=prometheus
echo ""
echo "Grafana pods:"
oc get pods -l app=grafana
echo ""

# Get routes
echo "🔗 Access URLs:"
echo "Prometheus: $(oc get route prometheus -o jsonpath='{.spec.host}')"
echo "Grafana: $(oc get route grafana -o jsonpath='{.spec.host}')"
echo ""

# Check for errors in Prometheus logs
echo "🔍 Checking Prometheus logs for errors..."
PROM_LOGS=$(oc logs deployment/prometheus --tail=20)
if echo "$PROM_LOGS" | grep -q "ERROR"; then
    echo "⚠️  Found errors in Prometheus logs:"
    echo "$PROM_LOGS" | grep ERROR
    echo ""
    echo "💡 If you see permission errors, the monitoring stack may still work"
    echo "   using service annotations. Check the Prometheus targets page."
else
    echo "✅ No errors found in Prometheus logs"
fi

echo ""
echo "=============================================================="
echo "🎉 Monitoring stack deployment completed!"
echo ""
echo "Next steps:"
echo "1. Access Grafana: http://$(oc get route grafana -o jsonpath='{.spec.host}')"
echo "   (Default credentials: admin/admin123)"
echo ""
echo "2. Check Prometheus targets: http://$(oc get route prometheus -o jsonpath='{.spec.host}')/targets"
echo ""
echo "3. If you see permission errors, read monitoring/README-sandbox.md"
echo "   for alternative monitoring approaches."
echo ""
echo "4. Your application metrics are available at: /metrics endpoint"
echo "=============================================================="