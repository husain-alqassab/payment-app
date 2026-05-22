# Monitoring Deployment Script for OpenShift Developer Sandbox (PowerShell)

Write-Host "🚀 Deploying Monitoring Stack for OpenShift Developer Sandbox" -ForegroundColor Cyan
Write-Host "==============================================================" -ForegroundColor Cyan

# Check if oc command is available
$ocCommand = Get-Command oc -ErrorAction SilentlyContinue
if (-not $ocCommand) {
    Write-Host "❌ Error: oc CLI not found. Please install OpenShift CLI." -ForegroundColor Red
    exit 1
}

# Check if we're logged in
$loggedIn = oc whoami 2>&1
if (-not $?) {
    Write-Host "❌ Error: Not logged in to OpenShift. Please run 'oc login' first." -ForegroundColor Red
    exit 1
}

Write-Host "✅ Logged in as: $loggedIn" -ForegroundColor Green
$namespace = oc project -q
Write-Host "📁 Current namespace: $namespace" -ForegroundColor Green
Write-Host ""

# Apply RBAC permissions
Write-Host "📝 Applying RBAC permissions..." -ForegroundColor Yellow
oc apply -f monitoring/prometheus-rbac.yaml
if ($?) {
    Write-Host "✅ RBAC permissions applied successfully" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to apply RBAC permissions" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Apply Prometheus configuration
Write-Host "📝 Applying Prometheus configuration..." -ForegroundColor Yellow
oc apply -f monitoring/prometheus-config.yaml
if ($?) {
    Write-Host "✅ Prometheus configuration applied successfully" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to apply Prometheus configuration" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Apply other monitoring components
Write-Host "📝 Applying monitoring components..." -ForegroundColor Yellow
oc apply -f monitoring/prometheus-deployment.yaml
oc apply -f monitoring/prometheus-service.yaml
oc apply -f monitoring/prometheus-route.yaml
oc apply -f monitoring/grafana-deployment.yaml
oc apply -f monitoring/grafana-service.yaml
oc apply -f monitoring/grafana-route.yaml
oc apply -f monitoring/grafana-datasource.yaml
oc apply -f monitoring/grafana-dashboard.yaml
oc apply -f monitoring/grafana-secret.yaml

Write-Host "✅ Monitoring components applied" -ForegroundColor Green
Write-Host ""

# Wait for deployments to be ready
Write-Host "⏳ Waiting for deployments to be ready..." -ForegroundColor Yellow
Write-Host "This may take 1-2 minutes..." -ForegroundColor Yellow
Write-Host ""

oc rollout status deployment/prometheus --timeout=120s 2>&1 | Out-Null
if (-not $?) {
    Write-Host "⚠️  Prometheus deployment timeout, but continuing..." -ForegroundColor Yellow
}

oc rollout status deployment/grafana --timeout=120s 2>&1 | Out-Null
if (-not $?) {
    Write-Host "⚠️  Grafana deployment timeout, but continuing..." -ForegroundColor Yellow
}

Write-Host ""

# Check pod status
Write-Host "📊 Checking pod status..." -ForegroundColor Yellow
Write-Host "Prometheus pods:" -ForegroundColor Cyan
oc get pods -l app=prometheus
Write-Host ""
Write-Host "Grafana pods:" -ForegroundColor Cyan
oc get pods -l app=grafana
Write-Host ""

# Get routes
Write-Host "🔗 Access URLs:" -ForegroundColor Yellow
$prometheusRoute = oc get route prometheus -o jsonpath='{.spec.host}' 2>&1
$grafanaRoute = oc get route grafana -o jsonpath='{.spec.host}' 2>&1
Write-Host "Prometheus: $prometheusRoute" -ForegroundColor Green
Write-Host "Grafana: $grafanaRoute" -ForegroundColor Green
Write-Host ""

# Check for errors in Prometheus logs
Write-Host "🔍 Checking Prometheus logs for errors..." -ForegroundColor Yellow
$promLogs = oc logs deployment/prometheus --tail=20 2>&1
if ($promLogs -match "ERROR") {
    Write-Host "⚠️  Found errors in Prometheus logs:" -ForegroundColor Yellow
    $promLogs | Select-String "ERROR"
    Write-Host ""
    Write-Host "💡 If you see permission errors, the monitoring stack may still work" -ForegroundColor Cyan
    Write-Host "   using service annotations. Check the Prometheus targets page." -ForegroundColor Cyan
} else {
    Write-Host "✅ No errors found in Prometheus logs" -ForegroundColor Green
}

Write-Host ""
Write-Host "==============================================================" -ForegroundColor Cyan
Write-Host "🎉 Monitoring stack deployment completed!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Access Grafana: http://$grafanaRoute" -ForegroundColor White
Write-Host "   (Default credentials: admin/admin123)" -ForegroundColor White
Write-Host ""
Write-Host "2. Check Prometheus targets: http://$prometheusRoute/targets" -ForegroundColor White
Write-Host ""
Write-Host "3. If you see permission errors, read monitoring/README-sandbox.md" -ForegroundColor White
Write-Host "   for alternative monitoring approaches." -ForegroundColor White
Write-Host ""
Write-Host "4. Your application metrics are available at: /metrics endpoint" -ForegroundColor White
Write-Host "==============================================================" -ForegroundColor Cyan