class CustomError extends Error {
    statusCode: number;
    status: string;
    key?: string | null;

    constructor(message: string, statusCode: number, key?: string) {
        super(message);
        this.statusCode = statusCode;
        this.status = statusCode >= 400 && statusCode <= 500 ? 'fail' : 'error';
        this.key = key || null

        Error.captureStackTrace(this, this.constructor);
    }
}

export default CustomError;
