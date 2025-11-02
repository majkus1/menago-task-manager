@description('Static Web App module for MiniTrello Frontend')

param location string = resourceGroup().location
param environment string = 'prod'
param repositoryUrl string
param repositoryBranch string = 'main'
param appLocation string = 'frontend-vite'
param outputLocation string = 'dist'
param apiBackendUrl string

var staticWebAppName = '${environment}-minitrello-frontend'

resource staticWebApp 'Microsoft.Web/staticSites@2022-03-01' = {
  name: staticWebAppName
  location: location
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    repositoryUrl: repositoryUrl
    branch: repositoryBranch
    buildProperties: {
      appLocation: appLocation
      outputLocation: outputLocation
      apiLocation: ''
    }
  }
}

resource staticWebAppAppSettings 'Microsoft.Web/staticSites/config@2022-03-01' = {
  parent: staticWebApp
  name: 'appsettings'
  properties: {
    VITE_API_BASE_URL: apiBackendUrl
  }
}

output staticWebAppName string = staticWebApp.name
output staticWebAppUrl string = 'https://${staticWebApp.properties.defaultHostname}'

