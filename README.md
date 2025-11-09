# MENAGO – Team Task Boards on Azure

Live app: [https://kind-pond-0c788f703.3.azurestaticapps.net](https://kind-pond-0c788f703.3.azurestaticapps.net)

## Overview
MENAGO is a Trello-style board manager for teams. Users can create teams, invite members, organise work on drag-and-drop boards, and stay productive on desktop and mobile. The project was built end-to-end with a cloud-first mindset: IaC, automated deployments, secure authentication, and production hosting on Azure.

## Product Highlights
- Team workspaces with role-based access (owner, admin, member) and member invitations.
- Boards, lists, cards, labels, comments, and attachments with drag-and-drop powered by `@dnd-kit`.
- Secure auth (email/password, HttpOnly cookies, server-side logout) backed by ASP.NET Core + PostgreSQL.
- Responsive, mobile-friendly UI with PL/EN localisation and accessible keyboard navigation.
- Email workflows (password reset, invitations) via Resend or SMTP providers.

## Tech Stack
- **Frontend:** React 19 (Vite, TypeScript), Tailwind CSS, Radix UI, TanStack Query, React Hook Form, i18next.
- **Backend:** ASP.NET Core 9 Web API, Entity Framework Core (PostgreSQL), Serilog, JWT + cookie auth, rate limiting.
- **Infrastructure & DevOps:** Azure Static Web Apps (linked backend proxy), Azure App Service, Azure Database for PostgreSQL Flexible Server, Application Insights, optional Key Vault, GitHub Actions CI/CD, Bicep IaC (`infrastructure/bicep`). Scripts (`scripts/deploy-infrastructure.ps1`) bootstrap the full environment from scratch.

## Cloud & DevOps Skills Demonstrated
- Modelled every Azure resource (frontend, backend, database, monitoring, optional secrets) in Bicep with environment-aware parameters.
- Automated infrastructure rollout and updates via PowerShell + Bicep and GitHub Actions workflow triggers.
- Implemented SWA ↔ App Service integration to keep cookies first-party, enabling secure SameSite=Lax auth on mobile.
- Enforced secure defaults: HTTPS-only cookies, rate limiting, security headers, structured logging to Azure.
- Managed secrets through Azure App Settings / Key Vault and GitHub Encrypted Secrets.

## Local Development
```bash
# Frontend
cd frontend-vite
npm install
npm run dev

# Backend (requires .NET 9 and PostgreSQL connection string in appsettings.Development.json)
cd backend
dotnet restore
dotnet ef database update
dotnet run
```
Frontend dev server proxies API calls to `/api` (configured in `vite.config.ts`). Authentication uses cookies, so run both apps on HTTPS or adjust `appsettings.Development.json` accordingly.

## Infrastructure Deployment (IaC)
```powershell
cd infrastructure\bicep
New-AzResourceGroup -Name <rg-name> -Location <azure-region>
New-AzResourceGroupDeployment `
  -ResourceGroupName <rg-name> `
  -TemplateFile main.bicep `
  -TemplateParameterFile parameters\prod.bicepparam `
  -postgresAdminLogin <user> `
  -postgresAdminPassword (Read-Host -AsSecureString) `
  -jwtKey (Read-Host -AsSecureString) `
  -frontendUrl https://kind-pond-0c788f703.3.azurestaticapps.net `
  -applicationBaseUrl https://kind-pond-0c788f703.3.azurestaticapps.net
```
This deploys PostgreSQL, App Service, Static Web App, Application Insights, and (optionally) Key Vault, then links the SWA to the backend for same-origin API calls.

## CI/CD
- **Frontend:** GitHub Actions (`.github/workflows/deploy-frontend.yml`) builds Vite assets and publishes to Azure Static Web Apps. SWA proxies `/api` traffic to the linked App Service.
- **Backend:** Workflow builds and deploys the ASP.NET Core API to App Service with migrations.
- Static web config (`frontend-vite/public/staticwebapp.config.json`) handles SPA routing and 404 fallbacks.

## Contact
If you’d like to talk about MENAGO or my Azure/IaC experience, feel free to connect on LinkedIn: [Michał Majkus](https://www.linkedin.com/in/michal-majkus/). 


