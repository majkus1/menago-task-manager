@description('App Service module for MiniTrello Backend')

param location string = resourceGroup().location
param environment string = 'prod'
param appServicePlanSku string = 'B1'
param appServicePlanTier string = 'Basic'
param postgresConnectionString string @secure()
param appInsightsInstrumentationKey string
param jwtKey string @secure()
param jwtIssuer string
param frontendUrl string
param resendApiKey string @secure()
param resendFromEmail string
param emailSmtpHost string = ''
param emailSmtpPort int = 587
param emailUsername string = ''
param emailPassword string @secure()
param emailFromEmail string = ''
param applicationBaseUrl string

var appServicePlanName = '${environment}-minitrello-asp'
var appServiceName = '${environment}-minitrello-backend'

resource appServicePlan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: appServicePlanName
  location: location
  kind: 'linux'
  properties: {
    reserved: true
  }
  sku: {
    name: appServicePlanSku
    tier: appServicePlanTier
  }
}

resource appService 'Microsoft.Web/sites@2023-01-01' = {
  name: appServiceName
  location: location
  kind: 'app,linux'
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      linuxFxVersion: 'DOTNETCORE|9.0'
      appSettings: [
        {
          name: 'APPINSIGHTS_INSTRUMENTATIONKEY'
          value: appInsightsInstrumentationKey
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: 'InstrumentationKey=${appInsightsInstrumentationKey}'
        }
        {
          name: 'Jwt__Key'
          value: jwtKey
        }
        {
          name: 'Jwt__Issuer'
          value: jwtIssuer
        }
        {
          name: 'Frontend__Url'
          value: frontendUrl
        }
        {
          name: 'Resend__ApiKey'
          value: resendApiKey
        }
        {
          name: 'Resend__FromEmail'
          value: resendFromEmail
        }
        {
          name: 'Email__SmtpHost'
          value: emailSmtpHost
        }
        {
          name: 'Email__SmtpPort'
          value: string(emailSmtpPort)
        }
        {
          name: 'Email__Username'
          value: emailUsername
        }
        {
          name: 'Email__Password'
          value: emailPassword
        }
        {
          name: 'Email__FromEmail'
          value: emailFromEmail
        }
        {
          name: 'Application__BaseUrl'
          value: applicationBaseUrl
        }
        {
          name: 'ASPNETCORE_ENVIRONMENT'
          value: 'Production'
        }
      ]
      connectionStrings: [
        {
          name: 'DefaultConnection'
          connectionString: postgresConnectionString
          type: 'PostgreSQL'
        }
      ]
      http20Enabled: true
      httpLoggingEnabled: true
      logsDirectorySizeLimit: 35
      detailedErrorLoggingEnabled: true
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
    }
    httpsOnly: true
  }
}

output appServiceName string = appService.name
output appServiceUrl string = 'https://${appService.properties.defaultHostName}'

