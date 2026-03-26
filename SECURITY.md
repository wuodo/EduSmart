# Security & Authentication

## Login Rate Limiting

To prevent brute-force attacks, login attempts are rate-limited:

- **Tenant login** (`/api/users/login`): After **3 failed attempts** (same Institution ID + email + IP), the account is locked for **15 minutes**.
- **Super admin login** (`/api/cpanel/login`): Same 3 attempts / 15-minute lockout per IP + email.

Locked users receive a `429` response with a message indicating how long to wait. Successful login clears the attempt counter.

## Password Reset

### Self-Service (Pre-Login)

Users who forgot their password can request a reset link:

1. Go to **Forgot password** (link on login page).
2. Enter **Institution ID** and **Email**.
3. A reset link is generated (see Email Setup below).

**Important**: The reset link includes `token` and `tenant` in the URL. Both are required. If email delivery is not configured, the link is logged in development only.

### Email Setup (Required for Production)

The backend now sends OTP/reset emails via SMTP when configured. If SMTP is not configured, development fallback logs are used.

**Environment variables:**

- `RESET_SECRET` – Required. Secret for signing reset tokens.
- `FRONTEND_BASE_URL` – Base URL for reset links (e.g. `https://app.example.com`).
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` – Required for real email delivery.
- `SMTP_SECURE` – Optional (`true`/`false`).
- `SMTP_FROM` – Optional sender email address.

### Admin / Super Admin Password Reset

| Role | How to Reset | Location |
|------|--------------|----------|
| **Tenant Admin** | Change password for users in their tenant | Settings → User Management → Change Password (per user) |
| **Super Admin** | Reset any user's password | cPanel → Users → Reset Password (requires super admin password confirmation for deactivate; password reset does not) |

- **Tenant admin** uses the User Management table in Settings. Each user row has a "Change Password" button. This calls `PUT /api/users/:id` with a new password.
- **Super admin** uses cPanel → Users. The "Reset Password" action calls `PUT /api/cpanel/users/:id/password` and requires super admin authentication.

## Generic Error Messages

The frontend shows only generic messages to avoid information leakage:

- Login failure: `Invalid login credentials`
- Lockout: `Too many failed attempts. Please try again in X minute(s).`

Never expose whether an email/tenant exists or which field was wrong.

## RESET_SECRET

Set `RESET_SECRET` in your environment. If missing, forgot-password and reset-password will fail. Use a long, random string (e.g. 32+ chars).
