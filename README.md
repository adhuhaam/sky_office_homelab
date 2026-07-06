<div align="center">

<img src="https://img.shields.io/badge/🏢_Sky_Office-Official_Homelab-0f172a?style=for-the-badge&labelColor=1e293b" alt="Sky Office Homelab" />

<br /><br />

# Sky Office Homelab

**Official repository · Employment agency operations platform**

*Passport onboarding → work permits → payroll → billing — one system for Leo Employment Services*

<br />

[![Node](https://img.shields.io/badge/Node-22+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-PWA-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Expo](https://img.shields.io/badge/Expo-Mobile-000020?style=flat-square&logo=expo&logoColor=white)](https://expo.dev/)
[![Express](https://img.shields.io/badge/Express-API-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)](https://docs.docker.com/compose/)
[![pnpm](https://img.shields.io/badge/pnpm-workspace-F69220?style=flat-square&logo=pnpm&logoColor=white)](https://pnpm.io/)

</div>

---

## ✨ Purpose

**Sky Office** *(LEO OS)* is the internal operations platform for **Leo Employment Services** — built to run the full lifecycle of overseas workers in the Maldives, from first passport scan through payroll and client invoicing.

<table>
<tr>
<td width="50%" valign="top">

### 🛂 Onboarding
- AI **passport OCR** → employee records
- Auto-generated **Letters of Appointment**
- Emergency contact capture & LOA sync

</td>
<td width="50%" valign="top">

### 📋 Operations
- **Master list** with work permits & job titles
- **Xpat** integration & expiry alerts
- Company-linked credentials & permissions

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 💰 Finance
- Invoices, quotations & expense vouchers
- Salary roster with margin tracking
- Client billing with import from payroll

</td>
<td width="50%" valign="top">

### 📊 Insight & access
- Dashboard KPIs, charts & task board
- Installable **web PWA** for admins
- **Expo mobile** app for field staff

</td>
</tr>
</table>

---

## 🏗 Architecture

```mermaid
flowchart TB
  subgraph clients["Clients"]
    Web["🌐 Web PWA"]
    Mobile["📱 Expo Mobile"]
  end

  subgraph homelab["Homelab Stack"]
  Proxy["🔒 leo-proxy · TLS"]
  Static["📦 react-app · nginx"]
  API["⚡ leo-api · Node"]
  DB["🐘 PostgreSQL"]
  end

  Web --> Proxy
  Mobile --> Proxy
  Proxy --> Static
  Proxy --> API
  Static --> API
  API --> DB
```

| Layer | Technology |
|:------|:-----------|
| 🖥 **Web** | React 19 · Vite · shadcn/ui · TanStack Query |
| 📱 **Mobile** | Expo · React Native |
| ⚡ **API** | Express · Drizzle ORM · OpenAI OCR |
| 🗄 **Data** | PostgreSQL 17 |
| 🚀 **Deploy** | Docker Compose · nginx reverse proxy |

---

<div align="center">

<br />

**Sky Office** · Leo Employment Services

*Self-hosted homelab deployment*

<br />

</div>
