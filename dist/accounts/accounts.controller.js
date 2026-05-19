"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
console.log("ACCOUNTS CONTROLLER LOADED");
const express_1 = __importDefault(require("express"));
const joi_1 = __importDefault(require("joi"));
const validate_request_1 = __importDefault(require("../_middleware/validate-request"));
const authorize_1 = __importDefault(require("../_middleware/authorize"));
const role_1 = __importDefault(require("../_helpers/role"));
const account_service_1 = __importDefault(require("./account.service"));
const send_email_1 = __importDefault(require("../_helpers/send-email"));
const router = express_1.default.Router();
exports.default = router;
// ================= SCHEMAS (MUST BE FIRST) =================
function authenticateSchema(req, res, next) {
    const schema = joi_1.default.object({
        email: joi_1.default.string().required(),
        password: joi_1.default.string().required()
    });
    (0, validate_request_1.default)(schema)(req, res, next);
}
function registerSchema(req, res, next) {
    const schema = joi_1.default.object({
        title: joi_1.default.string().required(),
        firstName: joi_1.default.string().required(),
        lastName: joi_1.default.string().required(),
        email: joi_1.default.string().email().required(),
        password: joi_1.default.string().min(6).required(),
        confirmPassword: joi_1.default.string().valid(joi_1.default.ref('password')).required(),
        acceptTerms: joi_1.default.boolean().valid(true).required()
    });
    (0, validate_request_1.default)(schema)(req, res, next);
}
function verifyEmailSchema(req, res, next) {
    const schema = joi_1.default.object({
        token: joi_1.default.string().required()
    });
    (0, validate_request_1.default)(schema)(req, res, next);
}
function revokeTokenSchema(req, res, next) {
    const schema = joi_1.default.object({
        token: joi_1.default.string().empty('')
    });
    (0, validate_request_1.default)(schema)(req, res, next);
}
// ================= ROUTES =================
router.post('/authenticate', authenticateSchema, authenticate);
router.post('/refresh-token', refreshToken);
router.post('/revoke-token', (0, authorize_1.default)(), revokeTokenSchema, revokeToken);
router.post('/reset-password', resetPassword);
router.post('/register', registerSchema, register);
router.post('/forgot-password', forgotPassword);
router.post('/verify-email', verifyEmailSchema, verifyEmail);
router.get('/', (0, authorize_1.default)(role_1.default.Admin), getAll);
router.put('/:id', (0, authorize_1.default)(), updateSchema, update);
router.delete('/:id', (0, authorize_1.default)(role_1.default.Admin), _delete);
//====delete
function _delete(req, res, next) {
    account_service_1.default.delete(req.params.id)
        .then(() => res.json({ message: 'Account deleted' }))
        .catch(next);
}
//======update schema=====
function update(req, res, next) {
    account_service_1.default.update(req.params.id, req.body)
        .then(account => res.json(account))
        .catch(next);
}
function updateSchema(req, res, next) {
    const schema = joi_1.default.object({
        title: joi_1.default.string().empty(''),
        firstName: joi_1.default.string().empty(''),
        lastName: joi_1.default.string().empty(''),
        email: joi_1.default.string().email().empty(''),
        password: joi_1.default.string().min(6).empty('')
    });
    (0, validate_request_1.default)(schema)(req, res, next);
}
// ================= AUTH =================
function authenticate(req, res, next) {
    const { email, password } = req.body;
    const ipAddress = req.ip;
    account_service_1.default.authenticate({ email, password }, ipAddress)
        .then(({ refreshToken, ...account }) => {
        setTokenCookie(res, refreshToken);
        res.json(account);
    })
        .catch(next);
}
/////////===RESET PASSWORDD-------
function resetPassword(req, res, next) {
    account_service_1.default.resetPassword(req.body)
        .then(() => res.json({ message: 'Password reset successful' }))
        .catch(next);
}
// ================= FORGOT PASSWORD =================
function forgotPassword(req, res, next) {
    account_service_1.default.forgotPassword(req.body, req.get('origin'))
        .then(() => res.json({
        message: 'Password reset link/token sent to your email'
    }))
        .catch(next);
}
function refreshToken(req, res, next) {
    const token = req.cookies.refreshToken;
    const ipAddress = req.ip;
    account_service_1.default.refreshToken({ token }, ipAddress)
        .then(({ refreshToken, ...account }) => {
        setTokenCookie(res, refreshToken);
        res.json(account);
    })
        .catch(next);
}
// ================= REGISTER (FIXED) =================
function register(req, res, next) {
    console.log("REGISTER HIT 🔥");
    account_service_1.default.register(req.body, req.get('origin'))
        .then(async (account) => {
        console.log("TOKEN FROM SERVICE:", account?.verificationToken);
        if (account?.verificationToken) {
            await (0, send_email_1.default)({
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
function verifyEmail(req, res, next) {
    account_service_1.default.verifyEmail(req.body)
        .then(() => res.json({ message: 'Verification successful' }))
        .catch(next);
}
//=========GET========
function getAll(req, res, next) {
    account_service_1.default.getAll()
        .then((accounts) => res.json(accounts))
        .catch(next);
}
// ================= REVOKE =================
function revokeToken(req, res, next) {
    const token = req.body.token || req.cookies.refreshToken;
    const ipAddress = req.ip;
    if (!token) {
        return res.status(400).json({ message: 'Token is required' });
    }
    account_service_1.default.revokeToken({ token }, ipAddress)
        .then(() => res.json({ message: 'Token revoked' }))
        .catch(next);
}
// ================= COOKIE =================
function setTokenCookie(res, token) {
    res.cookie('refreshToken', token, {
        httpOnly: true,
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });
}
