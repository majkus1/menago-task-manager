using '../main.bicep'

param environment = 'prod'
param location = 'westeurope'
param postgresAdminLogin = 'minitrello_admin'
param postgresAdminPassword = '' // Will be provided during deployment
param jwtKey = '' // Will be provided during deployment
param jwtIssuer = 'MiniTrello-API'
param frontendUrl = '' // Will be set after Static Web App is created
param applicationBaseUrl = '' // Will be set after App Service is created
param resendApiKey = ''
param resendFromEmail = ''
param emailSmtpHost = ''
param emailSmtpPort = 587
param emailUsername = ''
param emailPassword = ''
param emailFromEmail = ''
param repositoryUrl = 'https://github.com/majkus1/menago-task-manager'
param repositoryBranch = 'main'
param appServicePrincipalId = ''

