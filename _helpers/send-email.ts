import nodemailer from 'nodemailer';
import { Resend } from 'resend';

function getEmailFrom() {
    return process.env.EMAIL_FROM || 'no-reply@demo.com';
}

function getSmtpOptions() {
    return {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    };
}

async function sendWithResend({ to, subject, html, from }: any) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    return await resend.emails.send({
        from: from || getEmailFrom(),
        to,
        subject,
        html
    });
}

export default async function sendEmail({ to, subject, html, from }: any) {
    console.log("RESEND KEY EXISTS:", !!process.env.RESEND_API_KEY);

    if (process.env.RESEND_API_KEY) {
        return await sendWithResend({ to, subject, html, from });
    }

    const transporter = nodemailer.createTransport(getSmtpOptions());
    await transporter.sendMail({
        from: from || getEmailFrom(),
        to,
        subject,
        html
    });
}