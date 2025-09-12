# Shopify Data Ingestion Service

## Deployed URL
https://shopify-backend-serviccee.onrender.com

---

## Tech Stack / Libraries Used

- **Backend Framework**: [Express.js](https://expressjs.com/) – lightweight Node.js web framework.  
- **ORM**: [Prisma](https://www.prisma.io/) – type-safe database access.  
- **Database**: [PostgreSQL](https://www.postgresql.org/) hosted on [Neon](https://neon.tech/) – serverless cloud Postgres.  
- **Caching Layer**: [Redis](https://redis.io/) via [Upstash Redis Cloud](https://upstash.com/) – low-latency caching of income queries.  
- **Hosting**: [Render](https://render.com/) – deployed backend service.  
- **Frontend (Charts)**: [Recharts](https://recharts.org/en-US/) with React – for data visualization.  
- **Cron Job**: External scheduler hitting the backend **every 15 minutes** to keep the Render free-tier dyno alive.  

---

## ⚙️ Installation

Clone the repository:
```bash
git clone https://github.com/your-username/shopify-frontend.git
cd shopify-frontend
```

Install Dependencies:
```bash
npm install
```

Run Command :
```bash
npm start
```

---

## Visuals
### System Workflow Diagram
<img src="./assets/workflow.jpg" alt="System Workflow Diagram" width="600"/>

---
### Architecture Diagram
<img src="./assests/cronjob.png" alt="Cron Job" width="600"/>

---
### Redis CLI (Caching)
<img src="./assests/redis_cli.png" alt="caching" width="600"/>



