# Security Policy

## Supported versions

The ActivityWatch MCP server is currently in active development. We aim to
support the latest released version (main branch) and encourage all users to
stay up to date. Security fixes will typically target the `main` branch and may
be backported at the maintainers' discretion.

| Version | Supported |
|---------|-----------|
| main    | ✅        |
| older releases | ⚠️ best-effort (please upgrade) |

## Reporting a vulnerability

We take security issues seriously. If you discover a vulnerability:

1. **Do not create a public GitHub issue.**
2. Report the vulnerability via GitHub's
   [private vulnerability reporting](https://github.com/auriora/activitywatch-mcp/security/advisories/new)
   so only the maintainers are notified.
3. Alternatively, email the maintainer (@auriora) using the contact
   address listed on their GitHub profile with the subject line "Security
   report: ActivityWatch MCP".
4. Provide as much detail as possible: affected versions, reproduction steps,
   potential impact, and any suggested fixes.

We will acknowledge receipt within 72 hours, provide a status update within 7
days, and keep you informed as we investigate and remediate the issue. If a fix
requires coordination with the ActivityWatch project or other downstream
consumers, we will work with them privately before public disclosure.

## Public disclosure

We prefer to disclose vulnerabilities only after a fix has been released and
users have had a reasonable time to upgrade. If you believe a vulnerability is
being exploited in the wild, please mention this in your report so we can
prioritize accordingly.

## Security updates

- Security advisories and release notes will be published via the GitHub
  Security Advisories interface and highlighted in the CHANGELOG when fixes are
  released.
- If you maintain downstream forks or deployments, consider subscribing to
  repository notifications for new advisories.

Thank you for helping keep the ActivityWatch MCP community safe.
