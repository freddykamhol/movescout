import "server-only";

import { sendOutgoingMailForOrg } from "@/lib/mailer";

function escapeHtml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDateTime(value: Date | null) {
  if (!value) return "Noch kein Termin";
  return value.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function sendMoveCreatedMailForOrg(options: {
  orgKey: string;
  to: string;
  customerName: string;
  moveNumber: string;
  originAddress: string;
  destinationAddress: string;
}) {
  const subject = `Umzug angelegt: ${options.moveNumber}`;
  const text = [
    `Hallo ${options.customerName},`,
    "",
    `wir haben deinen Umzug angelegt (${options.moveNumber}).`,
    "",
    `Route: ${options.originAddress} -> ${options.destinationAddress}`,
    "",
    "Wir melden uns mit der Terminplanung.",
  ].join("\n");

  const html = `
  <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; line-height: 1.5; color: #111827;">
    <h2 style="margin: 0 0 12px;">Umzug angelegt</h2>
    <p style="margin: 0 0 8px;">Hallo <strong>${escapeHtml(options.customerName)}</strong>,</p>
    <p style="margin: 0 0 12px;">wir haben deinen Umzug angelegt (<strong>${escapeHtml(options.moveNumber)}</strong>).</p>
    <div style="border: 1px solid #E5E7EB; border-radius: 14px; padding: 12px 14px; background: #F9FAFB;">
      <p style="margin: 0; font-size: 13px; color: #6B7280;">Route</p>
      <p style="margin: 4px 0 0; font-weight: 600;">${escapeHtml(options.originAddress)} &rarr; ${escapeHtml(options.destinationAddress)}</p>
    </div>
    <p style="margin: 14px 0 0;">Wir melden uns mit der Terminplanung.</p>
  </div>`;

  await sendOutgoingMailForOrg(options.orgKey, { to: options.to, subject, text, html });
}

export async function sendMovePlannedMailForOrg(options: {
  orgKey: string;
  to: string;
  customerName: string;
  moveNumber: string;
  plannedStart: Date | null;
  plannedEnd: Date | null;
}) {
  const plannedLabel = formatDateTime(options.plannedStart);
  const plannedEndLabel = options.plannedEnd ? formatDateTime(options.plannedEnd) : "";
  const timeLabel = plannedEndLabel ? `${plannedLabel} – ${plannedEndLabel}` : plannedLabel;

  const subject = `Termin geplant: ${options.moveNumber}`;
  const text = [
    `Hallo ${options.customerName},`,
    "",
    `der Umzugstermin für ${options.moveNumber} wurde geplant:`,
    timeLabel,
  ].join("\n");

  const html = `
  <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; line-height: 1.5; color: #111827;">
    <h2 style="margin: 0 0 12px;">Termin geplant</h2>
    <p style="margin: 0 0 8px;">Hallo <strong>${escapeHtml(options.customerName)}</strong>,</p>
    <p style="margin: 0 0 12px;">der Umzugstermin für <strong>${escapeHtml(options.moveNumber)}</strong> wurde geplant:</p>
    <div style="border: 1px solid #E5E7EB; border-radius: 14px; padding: 12px 14px; background: #F9FAFB;">
      <p style="margin: 0; font-size: 13px; color: #6B7280;">Termin</p>
      <p style="margin: 4px 0 0; font-weight: 600;">${escapeHtml(timeLabel)}</p>
    </div>
  </div>`;

  await sendOutgoingMailForOrg(options.orgKey, { to: options.to, subject, text, html });
}

export async function sendMoveCompletedMailForOrg(options: {
  orgKey: string;
  to: string;
  customerName: string;
  moveNumber: string;
}) {
  const subject = `Umzug abgeschlossen: ${options.moveNumber}`;
  const text = [
    `Hallo ${options.customerName},`,
    "",
    `wir bestätigen den Abschluss des Umzugs ${options.moveNumber}.`,
    "",
    "Vielen Dank für Ihr Vertrauen.",
  ].join("\n");

  const html = `
  <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; line-height: 1.5; color: #111827;">
    <h2 style="margin: 0 0 12px;">Umzug abgeschlossen</h2>
    <p style="margin: 0 0 8px;">Hallo <strong>${escapeHtml(options.customerName)}</strong>,</p>
    <p style="margin: 0 0 12px;">wir bestätigen den Abschluss des Umzugs <strong>${escapeHtml(options.moveNumber)}</strong>.</p>
    <p style="margin: 0;">Vielen Dank für Ihr Vertrauen.</p>
  </div>`;

  await sendOutgoingMailForOrg(options.orgKey, { to: options.to, subject, text, html });
}

