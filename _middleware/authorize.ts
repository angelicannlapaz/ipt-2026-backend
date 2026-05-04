import { expressjwt as jwt } from 'express-jwt';
import config from '../config.json';
import db from '../_helpers/db';

const { secret } = config;

export default function authorize(roles: any = []) {
    // roles can be a single string or array
    if (typeof roles === 'string') {
        roles = [roles];
    }

    return [
        // authenticate JWT token
        jwt({ secret, algorithms: ['HS256'] }),

        // authorize based on role
        async (req: any, res: any, next: any) => {
           try {
    if (!req.auth) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    const account = await db.Account.findByPk(req.auth.id);

    if (!account || (roles.length && !roles.includes(account.role))) {
        return res.status(403).json({ message: 'Forbidden' });
    }

    req.auth.role = account.role;

    const refreshTokens = await account.getRefreshTokens();

    req.auth.ownsToken = (token: any) =>
        !!refreshTokens.find((x: any) => x.token === token);

    next();
} catch (err) {
    next(err);
}
        }
    ];
}