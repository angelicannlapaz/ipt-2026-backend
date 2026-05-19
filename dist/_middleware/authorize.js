"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = authorize;
const express_jwt_1 = require("express-jwt");
const config_json_1 = __importDefault(require("../config.json"));
const db_1 = __importDefault(require("../_helpers/db"));
const { secret } = config_json_1.default;
function authorize(roles = []) {
    // roles can be a single string or array
    if (typeof roles === 'string') {
        roles = [roles];
    }
    return [
        // authenticate JWT token
        (0, express_jwt_1.expressjwt)({ secret, algorithms: ['HS256'] }),
        // authorize based on role
        async (req, res, next) => {
            try {
                if (!req.auth) {
                    return res.status(401).json({ message: 'Unauthorized' });
                }
                const account = await db_1.default.Account.findByPk(req.auth.id);
                if (!account || (roles.length && !roles.includes(account.role))) {
                    return res.status(403).json({ message: 'Forbidden' });
                }
                req.auth.role = account.role;
                const refreshTokens = await account.getRefreshTokens();
                req.auth.ownsToken = (token) => !!refreshTokens.find((x) => x.token === token);
                next();
            }
            catch (err) {
                next(err);
            }
        }
    ];
}
