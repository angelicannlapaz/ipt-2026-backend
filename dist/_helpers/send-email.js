"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = sendEmail;
const nodemailer_1 = __importDefault(require("nodemailer"));
const config_json_1 = __importDefault(require("../config.json"));
async function sendEmail({ to, subject, html, from }) {
    try {
        const transporter = nodemailer_1.default.createTransport(config_json_1.default.smtpOptions);
        const info = await transporter.sendMail({
            from: from || config_json_1.default.emailFrom,
            to,
            subject,
            html
        });
        console.log("✅ EMAIL SENT");
        console.log("Preview URL:", nodemailer_1.default.getTestMessageUrl(info));
    }
    catch (err) {
        console.error("❌ EMAIL ERROR:", err);
    }
}
