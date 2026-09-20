# Optional authenticator rollout

Owners and admins may enroll voluntarily in Account Settings > Security. No enrollment is required to use ZestIQ. A verified factor requires AAL2 on subsequent sessions, even if the user's role changes. Pending enrollment does not enable MFA. Never publish an authenticator secret or record it in tickets/logs.

## Release gate

Use an approved private test account, not the public demo or an unapproved customer account. Before production release verify against Supabase: enrollment QR and manual-key setup, invalid/expired codes, successful verification, sign out and sign in challenge, rejection of AAL1 protected API requests, cancellation/retry of incomplete setup, and turning off a factor with a fresh code. Confirm ordinary owner/staff sign-in remains unchanged. Automated tests mock the provider; they do not replace these checks.

## Lost authenticator procedure

There is no self-service email bypass or recovery-code implementation. Before enrollment users must retain a secure backup via their authenticator's supported backup process. An accessible authenticator can be disabled with a fresh code.

For lost access, support must verify identity and company authority through independently established account/contact records, not just an incoming email or caller-provided details. Never request a password, setup secret, or live authenticator code. Escalate uncertain requests and do not remove factors while identity is unverified.

After documented approval by an authorized operator, use Supabase's administrative MFA factor controls for the exact verified user ID. Revoke that user's sessions, notify the established account contact, and record the operator, user ID, approval evidence reference and time (no secrets). Have the user sign in and enroll a replacement authenticator. Do not disable MFA globally or reset other users' factors. Rehearse this process using the approved test account before releasing enrollment.
