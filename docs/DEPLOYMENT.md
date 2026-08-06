# Deployment

Use Node.js 22+, an HTTPS reverse proxy, and a MongoDB replica set. Railway may use `npm start`; the application honors `PORT` and trusts one proxy hop in production.

Set all required variables from `.env.example` in the platform secret store. `APP_ORIGIN` and `CLIENT_ORIGIN` must be the same public HTTPS origin. Configure SMTP and Cloudinary, run `npm ci --omit=dev`, then start the service. Verify `/api/health` returns 200 and `/api/ready` returns 200 after MongoDB connects.

MongoDB schema indexes are created through Mongoose. Review index creation load before first production rollout. Do not run `reset:questions` against production. Seed only an empty database.

For rollback, stop traffic, deploy the previous application artifact, and retain the database. This release adds collections/indexes but performs no destructive migration. Restore the database only from a verified backup when data itself is corrupt.

Troubleshooting: startup errors name missing configuration without printing values; readiness 503 means MongoDB is disconnected; cookie failures usually indicate HTTP instead of HTTPS, an origin mismatch, or incorrect proxy configuration; quiz transaction errors usually mean MongoDB is not a replica set.
