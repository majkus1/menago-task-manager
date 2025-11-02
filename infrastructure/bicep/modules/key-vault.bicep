@description('Key Vault module for storing secrets securely')

param location string = resourceGroup().location
param environment string = 'prod'
param appServicePrincipalId string = ''

var keyVaultName = '${environment}-minitrello-kv'

// Only create Key Vault if appServicePrincipalId is provided
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = if (!empty(appServicePrincipalId)) {
  name: keyVaultName
  location: location
  properties: {
    tenantId: subscription().tenantId
    sku: {
      name: 'standard'
      family: 'A'
    }
    enabledForDeployment: false
    enabledForTemplateDeployment: true
    enabledForDiskEncryption: false
    accessPolicies: [
      {
        tenantId: subscription().tenantId
        objectId: appServicePrincipalId
        permissions: {
          keys: []
          secrets: ['get', 'list']
          certificates: []
        }
      }
    ]
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
    enableRbacAuthorization: false
  }
}

output keyVaultName string = !empty(appServicePrincipalId) ? keyVault!.name : ''

output keyVaultUri string = !empty(appServicePrincipalId) ? keyVault!.properties.vaultUri : ''

