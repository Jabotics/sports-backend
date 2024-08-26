import { randomUUID } from 'crypto';
import bcrypt from 'bcrypt';

const generateEmailToken = async (): Promise<string> => {
    const current_time = new Date();
    const hashedString = await bcrypt.hash(current_time.getUTCMilliseconds.toString(), 10);
    return `${randomUUID()}-${hashedString}-${randomUUID()}`;
}

export {
    generateEmailToken
}