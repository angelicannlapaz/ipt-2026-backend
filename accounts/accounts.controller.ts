console.log("ACCOUNTS CONTROLLER LOADED");

import express from 'express';
import Joi from 'joi';

import validateRequest from '../_middleware/validate-request';
import authorize from '../_middleware/authorize';
import Role from '../_helpers/role';
import accountService from './account.service';
import sendEmail from '../_helpers/send-email';


const router = express.Router();
export default router;

// ================= SCHEMAS (MUST BE FIRST) =================

function authenticateSchema(req: any, res: any, next: any) {
    const schema = Joi.object({
        email: Joi.string().required(),
        password: Joi.string().required()
    });

    validateRequest(schema)(req, res, next);
}

function registerSchema(req: any, res: any, next: any) {
    const schema = Joi.object({
        title: Joi.string().required(),
        firstName: Joi.string().required(),
        lastName: Joi.string().required(),
        email: Joi.string().email().required(),
        password: Joi.string().min(6).required(),
        confirmPassword: Joi.string().valid(Joi.ref('password')).required(),
        acceptTerms: Joi.boolean().valid(true).required()
    });

    validateRequest(schema)(req, res, next);
}

function verifyEmailSchema(req: any, res: any, next: any) {
    const schema = Joi.object({
        token: Joi.string().required()
    });

    validateRequest(schema)(req, res, next);
}

function revokeTokenSchema(req: any, res: any, next: any) {
    const schema = Joi.object({
        token: Joi.string().empty('')
    });

    validateRequest(schema)(req, res, next);
}

// ================= ROUTES =================

router.post('/authenticate', authenticateSchema, authenticate);
router.post('/refresh-token', refreshToken);
router.post('/revoke-token', authorize(), revokeTokenSchema, revokeToken);
router.post('/reset-password', resetPassword);
router.post('/register', registerSchema, register);
router.post('/forgot-password', forgotPassword);
router.post('/verify-email', verifyEmailSchema, verifyEmail);
router.get('/', authorize(Role.Admin), getAll);
router.put('/:id', authorize(), updateSchema, update);
router.delete('/:id', authorize(Role.Admin), _delete);


//====delete

function _delete(req: any, res: any, next: any) {
    accountService.delete(req.params.id)
        .then(() => res.json({ message: 'Account deleted' }))
        .catch(next);
}


//======update schema=====

function update(req: any, res: any, next: any) {
    accountService.update(req.params.id, req.body)
        .then(account => res.json(account))
        .catch(next);
}

function updateSchema(req: any, res: any, next: any) {
    const schema = Joi.object({
        title: Joi.string().empty(''),
        firstName: Joi.string().empty(''),
        lastName: Joi.string().empty(''),
        email: Joi.string().email().empty(''),
        password: Joi.string().min(6).empty('')
    });

    validateRequest(schema)(req, res, next);
}

// ================= AUTH =================

function authenticate(req: any, res: any, next: any) {
    const { email, password } = req.body;
    const ipAddress = req.ip;

    accountService.authenticate({ email, password }, ipAddress)
        .then(({ refreshToken, ...account }: any) => {
            setTokenCookie(res, refreshToken);
            res.json(account);
        })
        .catch(next);
}


/////////===RESET PASSWORDD-------

function resetPassword(req: any, res: any, next: any) {
    accountService.resetPassword(req.body)
        .then(() => res.json({ message: 'Password reset successful' }))
        .catch(next);
}

// ================= FORGOT PASSWORD =================

function forgotPassword(req: any, res: any, next: any) {
    accountService.forgotPassword(req.body, req.get('origin'))
        .then(() =>
            res.json({
                message: 'Password reset link/token sent to your email'
            })
        )
        .catch(next);
}

function refreshToken(req: any, res: any, next: any) {
    const token = req.cookies.refreshToken;
    const ipAddress = req.ip;

    accountService.refreshToken({ token }, ipAddress)
        .then(({ refreshToken, ...account }: any) => {
            setTokenCookie(res, refreshToken);
            res.json(account);
        })
        .catch(next);
}

// ================= REGISTER (FIXED) =================

function register(req: any, res: any, next: any) {
    console.log("REGISTER HIT 🔥");

    accountService.register(req.body, req.get('origin'))
        .then(async (account: any) => {

            console.log("TOKEN FROM SERVICE:", account?.verificationToken);

            if (account?.verificationToken) {
                await sendEmail({
                    to: account.email,
                    subject: "Verify your account",
                    html: `
                        <h2>Welcome!</h2>
                        <p>Your verification token is:</p>
                        <h1>${account.verificationToken}</h1>
                    `
                });

                console.log("EMAIL SENT 🔥");
            }

            res.json({
                message: 'Registration successful, please check your email'
            });
        })
        .catch(next);
}

// ================= VERIFY EMAIL =================

function verifyEmail(req: any, res: any, next: any) {
    accountService.verifyEmail(req.body)
        .then(() => res.json({ message: 'Verification successful' }))
        .catch(next);
}

//=========GET========
function getAll(req: any, res: any, next: any) {
    accountService.getAll()
        .then((accounts: any) => res.json(accounts))
        .catch(next);
}


// ================= REVOKE =================

function revokeToken(req: any, res: any, next: any) {
    const token = req.body.token || req.cookies.refreshToken;
    const ipAddress = req.ip;

    if (!token) {
        return res.status(400).json({ message: 'Token is required' });
    }

    accountService.revokeToken({ token }, ipAddress)
        .then(() => res.json({ message: 'Token revoked' }))
        .catch(next);
}

// ================= COOKIE =================

function setTokenCookie(res: any, token: string) {
    res.cookie('refreshToken', token, {
        httpOnly: true,
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });
}