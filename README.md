# CloudChat

CloudChat is a Discord-like AWS course project built with Node.js, Express, EJS, PostgreSQL, and local file uploads.

The local version includes:

- Register, login, and logout
- Password hashing with bcrypt
- PostgreSQL-backed sessions
- Channel list and channel creation
- Message sending, editing, and deleting
- File attachments saved locally in `uploads/`
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
```

This project currently runs the non-cloud application logic. The code keeps separate service files so S3 and Secrets Manager can be connected cleanly later.
