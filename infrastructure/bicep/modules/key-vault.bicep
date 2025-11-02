@description('Key Vault module for storing secrets securely')

param location string = resourceGroup().location
param environment string = 'prod'
param appServicePrincipalId string

var keyVaultName = '${environment}-minitrello-kv'

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
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
    enabledForSoftDelete: true
    softDeleteRetentionInDays: 7
    enableRbacAuthorization: false
  }
}

output keyVaultName string = keyVault.name
output keyVaultUri string = keyVault.properties.vaultUri

