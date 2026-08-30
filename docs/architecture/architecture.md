# BaSa3D Architecture

## Default shape
Browser → Next.js app → domain/service layer → PostgreSQL/Supabase

Use server-side access for privileged operations. Keep provider-specific code isolated behind small adapters where practical.

## Principles
- modular monolith first;
- one database;
- one deployable app;
- explicit domain boundaries;
- no microservices in MVP;
- background jobs only when a real need appears.
