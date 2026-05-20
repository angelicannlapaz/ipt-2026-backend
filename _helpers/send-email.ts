import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import config from '../config.json';

function getEmailFrom() {
    return process.env.EMAIL_FROM || config.emailFrom;
}

function getSmtpOptions() {
    if (process.env.SMTP_HOST) {
        return {
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        };
    }

    return config.smtpOptions;
}

async function sendWithResend({ to, subject, html, from }: any) {
    const resend = new Resend(process.env.RESEND_API_KEY);

    await resend.emails.send({
        from: from || getEmailFrom(),
        to,
        subject,
        html
    });
}

export default async function sendEmail({
    to,
    subject,
    html,
    from
}: any) {
    const hasResend = !!process.env.RESEND_API_KEY;

    if (hasResend) {
        return await sendWithResend({ to, subject, html, from });
    }

    const transporter = nodemailer.createTransport(getSmtpOptions() as any);

    await transporter.sendMail({
        from: from || getEmailFrom(),
        to,
        subject,
        html
    });
}