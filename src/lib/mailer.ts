import "server-only";

import nodemailer from "nodemailer";

import { getIntegrationSecretsForOrg, getIntegrationSettingsForOrg } from "@/lib/integration-settings";

export type OutgoingMailPayload = {
  attachments?: Array<{
    content: Buffer;
    contentType?: string;
    filename: string;
  }>;
  html?: string;
  subject: string;
  text?: string;
  to: string;
};

function getBooleanEnv(name: string, fallback: boolean) {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const normalized = raw.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export function getMailTransport() {
  const host = process.env.MOVESCOUT_SMTP_HOST?.trim() || "";
  const port = Number.parseInt(process.env.MOVESCOUT_SMTP_PORT?.trim() || "", 10);
  const user = process.env.MOVESCOUT_SMTP_USER?.trim() || "";
  const pass = process.env.MOVESCOUT_SMTP_PASS?.trim() || "";
  const secure = getBooleanEnv("MOVESCOUT_SMTP_SECURE", false);

  if (!host || !Number.isFinite(port) || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

export async function sendOutgoingMail(payload: OutgoingMailPayload) {
  const transport = getMailTransport();
  if (!transport) {
    throw new Error("SMTP ist nicht konfiguriert (MOVESCOUT_SMTP_*).");
  }

  const from = process.env.MOVESCOUT_MAIL_FROM?.trim() || process.env.MOVESCOUT_SMTP_USER?.trim() || "";
  if (!from) {
    throw new Error("Absender fehlt (MOVESCOUT_MAIL_FROM).");
  }

  return transport.sendMail({
    from,
    to: payload.to,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
    attachments: payload.attachments?.map((attachment) => ({
      filename: attachment.filename,
      content: attachment.content,
      contentType: attachment.contentType,
    })),
  });
}

export async function sendOutgoingMailForOrg(orgKey: string, payload: OutgoingMailPayload) {
  const settings = await getIntegrationSettingsForOrg(orgKey);
  const secrets = await getIntegrationSecretsForOrg(orgKey);

  if (!settings || !settings.smtpHost || !settings.smtpUser || !secrets) {
    // Fall back to env-based transport.
    return sendOutgoingMail(payload);
  }

  const port = settings.smtpPort || 587;
  const transport = nodemailer.createTransport({
    host: settings.smtpHost,
    port,
    secure: Boolean(settings.smtpSecure),
    auth: {
      user: settings.smtpUser,
      pass: secrets.smtpPassword,
    },
  });

  const from =
    settings.mailFrom.trim() ||
    settings.smtpUser.trim() ||
    process.env.MOVESCOUT_MAIL_FROM?.trim() ||
    process.env.MOVESCOUT_SMTP_USER?.trim() ||
    "";

  if (!from) {
    throw new Error("Absender fehlt (mailFrom).");
  }

  return transport.sendMail({
    from,
    to: payload.to,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
    attachments: payload.attachments?.map((attachment) => ({
      filename: attachment.filename,
      content: attachment.content,
      contentType: attachment.contentType,
    })),
  });
}
