import nodemailer from 'nodemailer';
import config from '../config.json';

export default async function sendEmail({
    to,
    subject,
    html,
    from
}: any) {
    try {
        const transporter = nodemailer.createTransport(config.smtpOptions);

        const info = await transporter.sendMail({
            from: from || config.emailFrom,
            to,
            subject,
            html
        });

        console.log("✅ EMAIL SENT");
        console.log("Preview URL:", nodemailer.getTestMessageUrl(info));

    } catch (err) {
        console.error("❌ EMAIL ERROR:", err);
    }
}