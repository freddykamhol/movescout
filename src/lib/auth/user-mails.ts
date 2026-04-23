import "server-only";

import { sendOutgoingMailForOrg } from "@/lib/mailer";
import { signInviteToken, signPasswordResetToken } from "@/lib/auth/tokens";

export async function sendUserInviteMailForOrg(orgKey: string, user: { id: string; displayName: string; email: string }, origin: string) {
  const token = await signInviteToken({ orgKey, userId: user.id, email: user.email });
  const url = `${origin}/login/invite?token=${encodeURIComponent(token)}`;

  const subject = `MoveScout: Einladung für ${user.displayName}`;
  const text = [
    `Hallo ${user.displayName},`,
    "",
    "du wurdest als Benutzer in MoveScout angelegt.",
    "Bitte bestätige die Einladung und setze dein Passwort:",
    url,
    "",
    "Wenn du diese Mail nicht erwartest, kannst du sie ignorieren.",
  ].join("\n");

  const html = `
  <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; line-height: 1.5; color: #111827;">
    <h2 style="margin: 0 0 12px;">MoveScout Einladung</h2>
    <p style="margin: 0 0 8px;">Hallo <strong>${escapeHtml(user.displayName)}</strong>,</p>
    <p style="margin: 0 0 12px;">du wurdest als Benutzer in MoveScout angelegt. Bitte bestätige die Einladung und setze dein Passwort:</p>
    <p style="margin: 0 0 16px;"><a href="${url}" style="display: inline-block; background: #FF007F; color: white; padding: 10px 14px; border-radius: 10px; text-decoration: none;">Einladung annehmen</a></p>
    <p style="margin: 0; font-size: 13px; color: #6B7280;">Falls der Button nicht funktioniert, öffne diesen Link:</p>
    <p style="margin: 8px 0 0; font-size: 13px;"><a href="${url}">${url}</a></p>
  </div>`;

  await sendOutgoingMailForOrg(orgKey, { to: user.email, subject, text, html });
}

export async function sendUserPasswordResetMailForOrg(orgKey: string, user: { id: string; displayName: string; email: string }, origin: string) {
  const token = await signPasswordResetToken({ orgKey, userId: user.id });
  const url = `${origin}/login/reset?token=${encodeURIComponent(token)}`;

  const subject = "MoveScout: Passwort zurücksetzen";
  const text = [
    `Hallo ${user.displayName},`,
    "",
    "über diesen Link kannst du dein Passwort zurücksetzen:",
    url,
    "",
    "Der Link ist zeitlich begrenzt gültig.",
  ].join("\n");

  const html = `
  <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; line-height: 1.5; color: #111827;">
    <h2 style="margin: 0 0 12px;">Passwort zurücksetzen</h2>
    <p style="margin: 0 0 8px;">Hallo <strong>${escapeHtml(user.displayName)}</strong>,</p>
    <p style="margin: 0 0 12px;">über diesen Link kannst du dein Passwort zurücksetzen:</p>
    <p style="margin: 0 0 16px;"><a href="${url}" style="display: inline-block; background: #FF007F; color: white; padding: 10px 14px; border-radius: 10px; text-decoration: none;">Passwort setzen</a></p>
    <p style="margin: 0; font-size: 13px; color: #6B7280;">Falls der Button nicht funktioniert, öffne diesen Link:</p>
    <p style="margin: 8px 0 0; font-size: 13px;"><a href="${url}">${url}</a></p>
  </div>`;

  await sendOutgoingMailForOrg(orgKey, { to: user.email, subject, text, html });
}

function escapeHtml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

