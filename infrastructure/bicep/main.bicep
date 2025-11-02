targetScope = 'resourceGroup'

@description('Environment name (prod, dev, staging)')
param environment string = 'prod'

@description('Azure region')
param location string = resourceGroup().location

@description('PostgreSQL admin username')
param postgresAdminLogin string

@description('PostgreSQL admin password')
@secure()
param postgresAdminPassword string

@description('JWT signing key (must be at least 32 characters)')
@secure()
param jwtKey string

@description('JWT issuer')
param jwtIssuer string = 'MiniTrello-API'

@description('Frontend URL (for CORS)')
param frontendUrl string

@description('Application Base URL (for email links)')
param applicationBaseUrl string

@description('Resend API Key')
@secure()
param resendApiKey string = ''

@description('Resend From Email')
param resendFromEmail string = ''

@description('Email SMTP Host (optional, if not using Resend)')
param emailSmtpHost string = ''

@description('Email SMTP Port')
param emailSmtpPort int = 587

@description('Email Username (optional, if not using Resend)')
param emailUsername string = ''

@description('Email Password (optional, if not using Resend)')
@secure()
param emailPassword string = ''

@description('Email From Email')
param emailFromEmail string = ''

@description('GitHub repository URL for Static Web App')
param repositoryUrl string = 'https://github.com/majkus1/menago-task-manager'

@description('GitHub repository branch')
param repositoryBranch string = 'main'

@description('App Service Principal ID (for Key Vault access, optional - leave empty to skip Key Vault)')
param appServicePrincipalId string = ''

// Deploy Application Insights
module appInsights 'modules/app-insights.bicep' = {
  name: 'appInsights'
  params: {
    location: location
    environment: environment
  }
}

// Deploy PostgreSQL Flexible Server
module postgresql 'modules/postgresql.bicep' = {
  name: 'postgresql'
  params: {
    location: location
    environment: environment
    adminLogin: postgresAdminLogin
    adminPassword: postgresAdminPassword
    dbName: 'minitrello_db'
    skuName: 'Standard_B1ms'
    tier: 'Burstable'
  }
}

// Deploy App Service for Backend
module appService 'modules/app-service.bicep' = {
  name: 'appService'
  params: {
    location: location
    environment: environment
    appServicePlanSku: 'B1'
    appServicePlanTier: 'Basic'
    postgresConnectionString: postgresql.outputs.connectionString
    appInsightsInstrumentationKey: appInsights.outputs.instrumentationKey
    jwtKey: jwtKey
    jwtIssuer: jwtIssuer
    frontendUrl: frontendUrl
    resendApiKey: resendApiKey
    resendFromEmail: resendFromEmail
    emailSmtpHost: emailSmtpHost
    emailSmtpPort: emailSmtpPort
    emailUsername: emailUsername
    emailPassword: emailPassword
    emailFromEmail: emailFromEmail
    applicationBaseUrl: applicationBaseUrl
  }
}

// Deploy Key Vault (optional - only if appServicePrincipalId is provided)
module keyVault 'modules/key-vault.bicep' = if (!empty(appServicePrincipalId)) {
  name: 'keyVault'
  params: {
    location: location
    environment: environment
    appServicePrincipalId: appServicePrincipalId
  }
}

// Deploy Static Web App for Frontend
module staticWebApp 'modules/static-web-app.bicep' = {
  name: 'staticWebApp'
  params: {
    location: location
    environment: environment
    repositoryUrl: repositoryUrl
    repositoryBranch: repositoryBranch
    appLocation: 'frontend-vite'
    outputLocation: 'dist'
    apiBackendUrl: appService.outputs.appServiceUrl
  }
}

// Outputs
output backendUrl string = appService.outputs.appServiceUrl
output frontendUrl string = staticWebApp.outputs.staticWebAppUrl
output staticWebAppName string = staticWebApp.outputs.staticWebAppName
output postgresServerName string = postgresql.outputs.serverName
output postgresServerFqdn string = postgresql.outputs.serverFqdn
output appInsightsInstrumentationKey string = appInsights.outputs.instrumentationKey
@description('Key Vault name (empty if Key Vault is not deployed)')
output keyVaultName string = !empty(appServicePrincipalId) ? keyVault!.outputs.keyVaultName : ''

@description('Key Vault URI (empty if Key Vault is not deployed)')
output keyVaultUri string = !empty(appServicePrincipalId) ? keyVault!.outputs.keyVaultUri : ''

