import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import config from '../config.json';

function getEmailFrom() {
    return process.env.EMAIL_FROM || config.emailFrom;
}

function getSmtpOptions() {
    return config.smtpOptions;
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

export default async function sendEmail({
    to,
    subject,
    html,
    from
}: any) {

    console.log("RESEND KEY EXISTS:", !!process.env.RESEND_API_KEY);

    // USE RESEND FIRST
    if (process.env.RESEND_API_KEY) {
        return await sendWithResend({
            to,
            subject,
            html,
            from
        });
    }

    // FALLBACK SMTP
    const transporter = nodemailer.createTransport(getSmtpOptions());

    await transporter.sendMail({
        from: from || getEmailFrom(),
        to,
        subject,
        html
    });
}