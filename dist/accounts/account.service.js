"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const config_json_1 = __importDefault(require("../config.json"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
const sequelize_1 = require("sequelize");
const send_email_1 = __importDefault(require("../_helpers/send-email"));
const db_1 = __importDefault(require("../_helpers/db"));
const role_1 = __importDefault(require("../_helpers/role"));
exports.default = {
    authenticate,
    refreshToken,
    revokeToken,
    register,
    verifyEmail,
    forgotPassword,
    validateResetToken,
    resetPassword,
    getAll,
    getById,
    create,
    update,
    delete: _delete
};
// ================= AUTH =================
async function authenticate({ email, password }, ipAddress) {
    const account = await db_1.default.Account.scope('withHash').findOne({ where: { email } });
    if (!account || !account.isVerified || !(await bcryptjs_1.default.compare(password, account.passwordHash))) {
        throw 'Email or password is incorrect';
    }
    const jwtToken = generateJwtToken(account);
    const refreshToken = generateRefreshToken(account, ipAddress);
    await refreshToken.save();
    return {
        ...basicDetails(account),
        jwtToken,
        refreshToken: refreshToken.token
    };
}
async function refreshToken({ token }, ipAddress) {
    const refreshToken = await getRefreshToken(token);
    const account = await refreshToken.getAccount();
    const newRefreshToken = generateRefreshToken(account, ipAddress);
    refreshToken.revoked = Date.now();
    refreshToken.revokedByIp = ipAddress;
    refreshToken.replacedByToken = newRefreshToken.token;
    await refreshToken.save();
    await newRefreshToken.save();
    const jwtToken = generateJwtToken(account);
    return {
        ...basicDetails(account),
        jwtToken,
        refreshToken: newRefreshToken.token
    };
}
async function revokeToken({ token }, ipAddress) {
    const refreshToken = await getRefreshToken(token);
    refreshToken.revoked = Date.now();
    refreshToken.revokedByIp = ipAddress;
    await refreshToken.save();
}
// ================= REGISTER =================
async function register(params, origin) {
    if (await db_1.default.Account.findOne({ where: { email: params.email } })) {
        await sendAlreadyRegisteredEmail(params.email, origin);
        return;
    }
    const account = new db_1.default.Account(params);
    const isFirstAccount = (await db_1.default.Account.count()) === 0;
    account.role = isFirstAccount ? role_1.default.Admin : role_1.default.User;
    account.verificationToken = randomTokenString();
    account.passwordHash = await hash(params.password);
    await account.save();
    console.log("VERIFICATION TOKEN:", account.verificationToken);
    return {
        email: account.email,
        verificationToken: account.verificationToken
    };
}
// ================= VERIFY EMAIL =================
async function verifyEmail({ token }) {
    const account = await db_1.default.Account.findOne({ where: { verificationToken: token } });
    if (!account)
        throw 'Verification failed';
    account.verified = Date.now();
    account.verificationToken = null;
    await account.save();
}
// ================= PASSWORD =================
async function forgotPassword({ email }, origin) {
    const account = await db_1.default.Account.findOne({ where: { email } });
    if (!account)
        return;
    account.resetToken = randomTokenString();
    account.resetTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await account.save();
    await sendPasswordResetEmail(account, origin);
}
async function validateResetToken({ token }) {
    const account = await db_1.default.Account.findOne({
        where: {
            resetToken: token,
            resetTokenExpires: { [sequelize_1.Op.gt]: Date.now() }
        }
    });
    if (!account)
        throw 'Invalid token';
    return account;
}
async function resetPassword({ token, password }) {
    const account = await validateResetToken({ token });
    account.passwordHash = await hash(password);
    account.passwordReset = Date.now();
    account.resetToken = null;
    await account.save();
}
// ================= CRUD =================
async function getAll() {
    const accounts = await db_1.default.Account.findAll();
    return accounts.map((x) => basicDetails(x));
}
async function getById(id) {
    const account = await getAccount(id);
    return basicDetails(account);
}
async function create(params) {
    if (await db_1.default.Account.findOne({ where: { email: params.email } })) {
        throw `Email ${params.email} is already registered`;
    }
    const account = new db_1.default.Account(params);
    account.verified = Date.now();
    account.passwordHash = await hash(params.password);
    await account.save();
    return basicDetails(account);
}
async function update(id, params) {
    const account = await getAccount(id);
    if (params.email &&
        account.email !== params.email &&
        await db_1.default.Account.findOne({ where: { email: params.email } })) {
        throw `Email ${params.email} is already taken`;
    }
    if (params.password) {
        params.passwordHash = await hash(params.password);
    }
    Object.assign(account, params);
    account.updated = Date.now();
    await account.save();
    return basicDetails(account);
}
async function _delete(id) {
    const account = await getAccount(id);
    await account.destroy();
}
// ================= HELPERS =================
async function getAccount(id) {
    const account = await db_1.default.Account.findByPk(id);
    if (!account)
        throw 'Account not found';
    return account;
}
async function getRefreshToken(token) {
    const refreshToken = await db_1.default.RefreshToken.findOne({ where: { token } });
    if (!refreshToken || !refreshToken.isActive)
        throw 'Invalid token';
    return refreshToken;
}
async function hash(password) {
    return await bcryptjs_1.default.hash(password, 10);
}
function generateJwtToken(account) {
    return jsonwebtoken_1.default.sign({ sub: account.id, id: account.id }, config_json_1.default.secret, { expiresIn: '15m' });
}
function generateRefreshToken(account, ipAddress) {
    return new db_1.default.RefreshToken({
        accountId: account.id,
        token: randomTokenString(),
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdByIp: ipAddress
    });
}
function randomTokenString() {
    return crypto_1.default.randomBytes(40).toString('hex');
}
function basicDetails(account) {
    const { id, title, firstName, lastName, email, role, created, updated, isVerified } = account;
    return { id, title, firstName, lastName, email, role, created, updated, isVerified };
}
// ================= EMAIL =================
async function sendAlreadyRegisteredEmail(email, origin) {
    let message;
    if (origin) {
        message = `<p>Forgot password? <a href="${origin}/account/forgot-password">Reset here</a></p>`;
    }
    else {
        message = `<p>Use /account/forgot-password API</p>`;
    }
    await (0, send_email_1.default)({
        to: email,
        subject: 'Email Already Registered',
        html: `<h4>Email already registered</h4>${message}`
    });
}
async function sendPasswordResetEmail(account, origin) {
    let message;
    if (origin) {
        const resetUrl = `${origin}/account/reset-password?token=${account.resetToken}`;
        message = `<p>Reset your password:</p><a href="${resetUrl}">${resetUrl}</a>`;
    }
    else {
        message = `<p>Token: ${account.resetToken}</p>`;
    }
    await (0, send_email_1.default)({
        to: account.email,
        subject: 'Reset Password',
        html: `<h4>Password Reset</h4>${message}`
    });
}
