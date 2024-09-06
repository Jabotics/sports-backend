import config from 'config';
import { CustomRequest } from './../server';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { Response, NextFunction } from "express";
import { BlacklistedToken } from '../schemas/schema';
import { response403, response406 } from '../lib/helpers/utils';

const verifyJWT = async (req: CustomRequest, res: Response, next: NextFunction) => {
    const payload = req.headers.authorization;    
    
    if (!payload) {
        const response = response406("Authorization token not present in the header");
        return res.status(response[0]).json(response[1]);
    }

    const token = payload.split(" ");
    if (token.length != 2) {
        const response = response406("Invalid authorization token");
        return res.status(response[0]).json(response[1]);
    }

    try {
        const blacklistedToken = await BlacklistedToken.find({ token: token });
        if (blacklistedToken.length != 0) {
            let response = response403("Token blacklisted, please login again");
            return res.status(response[0]).json(response[1]);
        }

        const secretkey = String(config.get('jwt_secretkey')) || "";
        const data = jwt.verify(token[1], secretkey) as JwtPayload;
        delete data.iat;
        delete data.exp        
        req.user = data;                
        // let response = response403("Token blacklisted, please login again");
        // return res.status(response[0]).json(response[1]);
        next();
    }
    catch (err: any) {
        const response = response406(err.message);
        return res.status(response[0]).json(response[1]);
    }
}

export default verifyJWT;