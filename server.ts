// node/npm modules
import config from 'config';
import { Server } from 'socket.io';
import { createServer } from 'http';
import routes from './startup/routes';
import { JwtPayload } from 'jsonwebtoken';
import { clearData } from './lib/helpers/utils';
import setupSocket from './socket/socketConnection';
import express, { Request, Response, NextFunction } from 'express';

export interface CustomRequest extends Request {
    io?: Server,
    user?: JwtPayload
}

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        credentials: true
    },
    transports: ['websocket', 'polling']
})
const PORT = config.get('port') || 5000;

// (async function () {
//     await clearData('chat');    
// })()

app.use((req: CustomRequest, res: Response, next: NextFunction) => {
    req.io = io;
    next();
});

setupSocket(io);

routes(app);


server.listen(PORT, () => {
    console.log(`[+] Server is running on port ${PORT} [+]`);
});