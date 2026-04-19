# Test Automation — Obtaining API Tokens

This guide explains how to obtain authentication tokens for automated API testing against the Clinic backend services.

> **Back to main docs:** [README.md](README.md) · [DEVELOPMENT.md](DEVELOPMENT.md)

---

## Overview

All three backend APIs (Patient, Doctor, Assistant) are protected by Keycloak-issued JWT tokens. Every request to a protected endpoint must include a valid Bearer token in the `Authorization` header.

For test automation, the easiest approach is the **Resource Owner Password Credentials** (direct grant) flow using the confidential `api-service-client`. This avoids browser-based login flows entirely.

### Keycloak Clients

| Client ID               | Type                      | Direct Grant | Use Case                                    |
| ----------------------- | ------------------------- | ------------ | ------------------------------------------- |
| `api-service-client`    | Confidential (has secret) | **Yes**      | API testing, automation, service-to-service |
| `patient-portal-client` | Public (PKCE)             | No           | Browser login only                          |
| `staff-portal-client`   | Public (PKCE)             | No           | Browser login only                          |
| `patient-mobile-client` | Public (PKCE)             | No           | Mobile app login only                       |

Only `api-service-client` supports programmatic token requests.

---

## Token Endpoint

```
POST http://localhost:8180/realms/clinic/protocol/openid-connect/token
```

The general form is:

```
POST {KEYCLOAK_URL}/realms/{KEYCLOAK_REALM}/protocol/openid-connect/token
```

---

## Required Parameters

| Parameter       | Value                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------ |
| `grant_type`    | `password`                                                                                       |
| `client_id`     | `api-service-client`                                                                             |
| `client_secret` | Value of `KEYCLOAK_ADMIN_CLIENT_SECRET` in `.env` (default: `api_service_secret_change_in_prod`) |
| `username`      | Email of a seeded test account                                                                   |
| `password`      | Account password (see [Test Accounts](#test-accounts))                                           |
| `scope`         | `openid`                                                                                         |

---

## Test Accounts

### Staff (Doctors & Assistants)

Default password: value of `SEED_STAFF_PASSWORD` (default `Clinic1234!`).

| Email                           | Role               | Use With API                                                     |
| ------------------------------- | ------------------ | ---------------------------------------------------------------- |
| `admin@clinic.local`            | `doctor` + `admin` | Doctor (`:3002`) and Assistant (`:3003`) — password `Admin1234!` |
| `dr.smith@clinic.local`         | `doctor`           | Doctor API (`:3002`)                                             |
| `dr.johnson@clinic.local`       | `doctor`           | Doctor API (`:3002`)                                             |
| `dr.williams@clinic.local`      | `doctor`           | Doctor API (`:3002`)                                             |
| `assistant.brown@clinic.local`  | `assistant`        | Assistant API (`:3003`)                                          |
| `assistant.davis@clinic.local`  | `assistant`        | Assistant API (`:3003`)                                          |
| `assistant.miller@clinic.local` | `assistant`        | Assistant API (`:3003`)                                          |

### Patients

Default password: value of `SEED_PATIENT_PASSWORD` (default `Patient1234!`).

| Email                          | Name           | Use With API          |
| ------------------------------ | -------------- | --------------------- |
| `patient.wilson@example.com`   | Alice Wilson   | Patient API (`:3001`) |
| `patient.moore@example.com`    | Bob Moore      | Patient API (`:3001`) |
| `patient.taylor@example.com`   | Carol Taylor   | Patient API (`:3001`) |
| `patient.anderson@example.com` | David Anderson | Patient API (`:3001`) |
| `patient.thomas@example.com`   | Eva Thomas     | Patient API (`:3001`) |

---

## Role Requirements per API

| API           | Port   | Required Role          |
| ------------- | ------ | ---------------------- |
| Patient API   | `3001` | `patient`              |
| Doctor API    | `3002` | `doctor` or `admin`    |
| Assistant API | `3003` | `assistant` or `admin` |

A token obtained for a doctor account will be rejected by the Patient API, and vice versa. Use the right account for the right API.

---

## Examples

### curl (Linux / macOS / Git Bash)

**Doctor token:**

```bash
curl -s -X POST "http://localhost:8180/realms/clinic/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=api-service-client" \
  -d "client_secret=api_service_secret_change_in_prod" \
  -d "username=dr.smith@clinic.local" \
  -d "password=Clinic1234!" \
  -d "scope=openid"
```

**Patient token:**

```bash
curl -s -X POST "http://localhost:8180/realms/clinic/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=api-service-client" \
  -d "client_secret=api_service_secret_change_in_prod" \
  -d "username=patient.wilson@example.com" \
  -d "password=Patient1234!" \
  -d "scope=openid"
```

### PowerShell

**Doctor token:**

```powershell
$body = @{
    grant_type    = "password"
    client_id     = "api-service-client"
    client_secret = "api_service_secret_change_in_prod"
    username      = "dr.smith@clinic.local"
    password      = "Clinic1234!"
    scope         = "openid"
}
$response = Invoke-RestMethod -Method Post `
    -Uri "http://localhost:8180/realms/clinic/protocol/openid-connect/token" `
    -ContentType "application/x-www-form-urlencoded" `
    -Body $body
$response.access_token
```

**Patient token:**

```powershell
$body = @{
    grant_type    = "password"
    client_id     = "api-service-client"
    client_secret = "api_service_secret_change_in_prod"
    username      = "patient.wilson@example.com"
    password      = "Patient1234!"
    scope         = "openid"
}
$response = Invoke-RestMethod -Method Post `
    -Uri "http://localhost:8180/realms/clinic/protocol/openid-connect/token" `
    -ContentType "application/x-www-form-urlencoded" `
    -Body $body
$response.access_token
```

### Response

A successful request returns a JSON object:

```json
{
	"access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6...",
	"expires_in": 300,
	"refresh_expires_in": 1800,
	"refresh_token": "eyJhbGciOiJIUzUxMiIsInR5cCI6...",
	"token_type": "Bearer",
	"scope": "openid profile email"
}
```

The `access_token` is what you pass as the Bearer token. It expires after **5 minutes** (300 seconds) by default.

---

## Using the Token

### In curl

```bash
curl -s http://localhost:3002/api/appointments \
  -H "Authorization: Bearer <access_token>"
```

### In PowerShell

```powershell
$token = $response.access_token
Invoke-RestMethod -Uri "http://localhost:3002/api/appointments" `
    -Headers @{ Authorization = "Bearer $token" }
```

### In Swagger UI

1. Open Swagger (e.g. http://localhost:3002/api/docs for the Doctor API).
2. Click the **Authorize** button (padlock icon, top right).
3. Paste the `access_token` value into the **Value** field.
4. Click **Authorize**, then **Close**.
5. All subsequent requests include the token automatically.

### In Postman

1. In the **Authorization** tab, select **Bearer Token**.
2. Paste the `access_token` value.
3. Postman adds the `Authorization: Bearer ...` header to every request.

---

## Scripting a Full Test Flow

Below is a self-contained PowerShell example that obtains a token and calls an endpoint:

```powershell
# 1. Get a doctor token
$tokenBody = @{
    grant_type    = "password"
    client_id     = "api-service-client"
    client_secret = "api_service_secret_change_in_prod"
    username      = "dr.smith@clinic.local"
    password      = "Clinic1234!"
    scope         = "openid"
}
$tokenResponse = Invoke-RestMethod -Method Post `
    -Uri "http://localhost:8180/realms/clinic/protocol/openid-connect/token" `
    -ContentType "application/x-www-form-urlencoded" `
    -Body $tokenBody

$token = $tokenResponse.access_token

# 2. Call a protected endpoint
$headers = @{ Authorization = "Bearer $token" }
$appointments = Invoke-RestMethod -Uri "http://localhost:3002/api/appointments" -Headers $headers
$appointments | ConvertTo-Json -Depth 5
```

And the equivalent in bash:

```bash
# 1. Get a doctor token
TOKEN=$(curl -s -X POST "http://localhost:8180/realms/clinic/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=api-service-client" \
  -d "client_secret=api_service_secret_change_in_prod" \
  -d "username=dr.smith@clinic.local" \
  -d "password=Clinic1234!" \
  -d "scope=openid" | jq -r '.access_token')

# 2. Call a protected endpoint
curl -s http://localhost:3002/api/appointments \
  -H "Authorization: Bearer $TOKEN" | jq .
```

---

## Troubleshooting

### 401 Unauthorized / "invalid_client"

- Verify `client_secret` matches `KEYCLOAK_ADMIN_CLIENT_SECRET` in your `.env` file.
- Make sure you are using `api-service-client`, not one of the public portal clients.

### 401 Unauthorized / "invalid_grant"

- The username or password is wrong. Check the test account tables above and your `.env` password values.

### 403 Forbidden on an API endpoint

- The token does not have the required role for that API. Use an account with the correct role (see [Role Requirements per API](#role-requirements-per-api)).

### Token expired

- Tokens are valid for 5 minutes. Request a fresh token before each test run, or use the `refresh_token` to renew without re-authenticating.

### Keycloak not reachable

- Make sure the infrastructure is running: `docker ps` should show `clinic-keycloak` as `healthy`.
- If using Docker-only mode: `docker compose -f infra/docker-compose.yml --profile apps up -d`
- If using dev mode: `pnpm run infra:up`

---

[← Back to README](README.md)
