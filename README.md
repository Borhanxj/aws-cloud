# CloudChat

CloudChat is a Discord-like AWS course project built with Node.js, Express, EJS, PostgreSQL, and local file uploads.

The local version includes:

- Register, login, and logout
- Password hashing with bcrypt
- PostgreSQL-backed sessions
- Channel list and channel creation
- Message sending, editing, and deleting
- File attachments saved locally in `uploads/`
- S3-backed private attachments in AWS mode
- Health endpoint for load balancer checks
- Server name display for EC2/ALB testing

## Local Setup

Install dependencies:

```powershell
npm.cmd install
```

Create a local `.env` file:

```env
PORT=3000
APP_MODE=local

DB_HOST=localhost
DB_PORT=5432
DB_NAME=discord_local
DB_USER=postgres
DB_PASSWORD=your-local-postgres-password
DB_SSL=false

SESSION_SECRET=change-this-local-session-secret
SERVER_NAME=local-dev-server

AWS_REGION=us-east-1
S3_BUCKET_NAME=
SECRET_NAME=
MAX_UPLOAD_MB=20

ADMIN_USERNAME=cloud_admin
ADMIN_PASSWORD=change-this-admin-password
ADMIN_DISPLAY_NAME=Cloud Admin
ADMIN_EMAIL=admin@example.com
```

Create the local PostgreSQL database:

```sql
CREATE DATABASE discord_local;
```

Run the app:

```powershell
npm.cmd start
```

Open:

```text
http://localhost:3000
```

Health check:

```text
http://localhost:3000/health
```

## Production Notes

For EC2 deployment, each instance should have its own `.env` file. Use the same GitHub code on both servers, but set a different `SERVER_NAME` on each instance so the ALB can prove traffic is reaching both targets.

For RDS PostgreSQL, use SSL:

```env
APP_MODE=aws
DB_SSL=true
AWS_REGION=eu-west-1
S3_BUCKET_NAME=your-private-attachments-bucket
```

In AWS mode, uploaded attachments are saved in S3 and served back through authenticated app routes.

To bootstrap the first admin account, set `ADMIN_USERNAME` and `ADMIN_PASSWORD`
in `.env`, then restart the app. The app will create or update that account as
an admin during startup.
