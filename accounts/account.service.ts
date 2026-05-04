import config from '../config.json';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Op } from 'sequelize';
import sendEmail from '../_helpers/send-email';
import db from '../_helpers/db';
import Role from '../_helpers/role';

export default {
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

async function authenticate({ email, password }: any, ipAddress: any) {
    const account = await db.Account.scope('withHash').findOne({ where: { email } });

    if (!account || !account.isVerified || !(await bcrypt.compare(password, account.passwordHash))) {
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

async function refreshToken({ token }: any, ipAddress: any) {
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

async function revokeToken({ token }: any, ipAddress: any) {
    const refreshToken = await getRefreshToken(token);

    refreshToken.revoked = Date.now();
    refreshToken.revokedByIp = ipAddress;

    await refreshToken.save();
}

// ================= REGISTER =================

async function register(params: any, origin: any) {
    if (await db.Account.findOne({ where: { email: params.email } })) {
        await sendAlreadyRegisteredEmail(params.email, origin);
        return;
    }

    const account = new db.Account(params);

    const isFirstAccount = (await db.Account.count()) === 0;
    account.role = isFirstAccount ? Role.Admin : Role.User;

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

async function verifyEmail({ token }: any) {
    const account = await db.Account.findOne({ where: { verificationToken: token } });

    if (!account) throw 'Verification failed';

    account.verified = Date.now();
    account.verificationToken = null;

    await account.save();
}

// ================= PASSWORD =================

async function forgotPassword({ email }: any, origin: any) {
    const account = await db.Account.findOne({ where: { email } });
    if (!account) return;

    account.resetToken = randomTokenString();
    account.resetTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await account.save();
    await sendPasswordResetEmail(account, origin);
}

async function validateResetToken({ token }: any) {
    const account = await db.Account.findOne({
        where: {
            resetToken: token,
            resetTokenExpires: { [Op.gt]: Date.now() }
        }
    });

    if (!account) throw 'Invalid token';
    return account;
}

async function resetPassword({ token, password }: any) {
    const account = await validateResetToken({ token });

    account.passwordHash = await hash(password);
    account.passwordReset = Date.now();
    account.resetToken = null;

    await account.save();
}

// ================= CRUD =================

async function getAll() {
    const accounts = await db.Account.findAll();
    return accounts.map((x: any) => basicDetails(x));
}

async function getById(id: any) {
    const account = await getAccount(id);
    return basicDetails(account);
}

async function create(params: any) {
    if (await db.Account.findOne({ where: { email: params.email } })) {
        throw `Email ${params.email} is already registered`;
    }

    const account = new db.Account(params);

    account.verified = Date.now();
    account.passwordHash = await hash(params.password);

    await account.save();

    return basicDetails(account);
}

async function update(id: any, params: any) {
    const account = await getAccount(id);

    if (
        params.email &&
        account.email !== params.email &&
        await db.Account.findOne({ where: { email: params.email } })
    ) {
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

async function _delete(id: any) {
    const account = await getAccount(id);
    await account.destroy();
}

// ================= HELPERS =================

async function getAccount(id: any) {
    const account = await db.Account.findByPk(id);
    if (!account) throw 'Account not found';
    return account;
}

async function getRefreshToken(token: any) {
    const refreshToken = await db.RefreshToken.findOne({ where: { token } });

    if (!refreshToken || !refreshToken.isActive) throw 'Invalid token';

    return refreshToken;
}

async function hash(password: any) {
    return await bcrypt.hash(password, 10);
}

function generateJwtToken(account: any) {
    return jwt.sign(
        { sub: account.id, id: account.id },
        config.secret,
        { expiresIn: '15m' }
    );
}

function generateRefreshToken(account: any, ipAddress: any) {
    return new db.RefreshToken({
        accountId: account.id,
        token: randomTokenString(),
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdByIp: ipAddress
    });
}

function randomTokenString() {
    return crypto.randomBytes(40).toString('hex');
}

function basicDetails(account: any) {
    const { id, title, firstName, lastName, email, role, created, updated, isVerified } = account;
    return { id, title, firstName, lastName, email, role, created, updated, isVerified };
}

// ================= EMAIL =================

async function sendAlreadyRegisteredEmail(email: any, origin: any) {
    let message;

    if (origin) {
        message = `<p>Forgot password? <a href="${origin}/account/forgot-password">Reset here</a></p>`;
    } else {
        message = `<p>Use /account/forgot-password API</p>`;
    }

    await sendEmail({
        to: email,
        subject: 'Email Already Registered',
        html: `<h4>Email already registered</h4>${message}`
    });
}

async function sendPasswordResetEmail(account: any, origin: any) {
    let message;

    if (origin) {
        const resetUrl = `${origin}/account/reset-password?token=${account.resetToken}`;
        message = `<p>Reset your password:</p><a href="${resetUrl}">${resetUrl}</a>`;
    } else {
        message = `<p>Token: ${account.resetToken}</p>`;
    }

    await sendEmail({
        to: account.email,
        subject: 'Reset Password',
        html: `<h4>Password Reset</h4>${message}`
    });
}