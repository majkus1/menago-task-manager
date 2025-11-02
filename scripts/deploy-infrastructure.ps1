# PowerShell script to deploy MiniTrello infrastructure to Azure using Bicep
# Usage: .\scripts\deploy-infrastructure.ps1 -Environment prod

param(
    [Parameter(Mandatory=$false)]
    [string]$Environment = "prod",
    
    [Parameter(Mandatory=$false)]
    [string]$Location = "westeurope",
    
    [Parameter(Mandatory=$false)]
    [string]$ResourceGroupName = "rg-minitrello-prod",
    
    [Parameter(Mandatory=$true)]
    [string]$SubscriptionId,
    
    [Parameter(Mandatory=$true)]
    [SecureString]$PostgresAdminPassword,
    
    [Parameter(Mandatory=$true)]
    [SecureString]$JwtKey,
    
    [Parameter(Mandatory=$false)]
    [string]$JwtIssuer = "MiniTrello-API",
    
    [Parameter(Mandatory=$false)]
    [string]$FrontendUrl = "",
    
    [Parameter(Mandatory=$false)]
    [string]$ApplicationBaseUrl = ""
)

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "MiniTrello Azure Infrastructure Deployment" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Check if Azure CLI is installed
if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
    Write-Host "Azure CLI is not installed. Please install it from https://aka.ms/installazurecliwindows" -ForegroundColor Red
    exit 1
}

# Login to Azure (if not already logged in)
$account = az account show 2>$null
if (-not $account) {
    Write-Host "Logging in to Azure..." -ForegroundColor Yellow
    az login
}

# Set subscription
Write-Host "Setting subscription to: $SubscriptionId" -ForegroundColor Yellow
az account set --subscription $SubscriptionId

# Create resource group if it doesn't exist
Write-Host "Creating resource group: $ResourceGroupName" -ForegroundColor Yellow
az group create --name $ResourceGroupName --location $Location --output none

# Convert SecureString to plain text (for Bicep parameters)
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($PostgresAdminPassword)
$PlainPostgresPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($JwtKey)
$PlainJwtKey = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

# Deploy Bicep template
Write-Host ""
Write-Host "Deploying infrastructure..." -ForegroundColor Yellow
Write-Host ""

$deploymentName = "minitrello-deployment-$(Get-Date -Format 'yyyyMMdd-HHmmss')"

az deployment group create `
    --resource-group $ResourceGroupName `
    --name $deploymentName `
    --template-file "./infrastructure/bicep/main.bicep" `
    --parameters `
        environment=$Environment `
        location=$Location `
        postgresAdminLogin="minitrello_admin" `
        postgresAdminPassword=$PlainPostgresPassword `
        jwtKey=$PlainJwtKey `
        jwtIssuer=$JwtIssuer `
        frontendUrl=$FrontendUrl `
        applicationBaseUrl=$ApplicationBaseUrl `
        repositoryUrl="https://github.com/majkus1/menago-task-manager" `
        repositoryBranch="main"

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "================================================" -ForegroundColor Green
    Write-Host "Deployment completed successfully!" -ForegroundColor Green
    Write-Host "================================================" -ForegroundColor Green
    Write-Host ""
    
    # Get deployment outputs
    Write-Host "Retrieving deployment outputs..." -ForegroundColor Yellow
    $outputs = az deployment group show --resource-group $ResourceGroupName --name $deploymentName --query properties.outputs -o json | ConvertFrom-Json
    
    Write-Host ""
    Write-Host "Deployment Information:" -ForegroundColor Cyan
    Write-Host "  Backend URL: $($outputs.backendUrl.value)" -ForegroundColor White
    Write-Host "  Frontend URL: $($outputs.frontendUrl.value)" -ForegroundColor White
    Write-Host "  PostgreSQL Server: $($outputs.postgresServerFqdn.value)" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "================================================" -ForegroundColor Red
    Write-Host "Deployment failed!" -ForegroundColor Red
    Write-Host "================================================" -ForegroundColor Red
    Write-Host ""
    exit 1
}

