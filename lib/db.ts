import mongoose from "mongoose";
import config from 'config';

export async function connectDB() {
    mongoose.connect(`mongodb+srv://${config.get('db_username')}:${config.get('db_password')}@cluster0.csv9r7j.mongodb.net/sports`)
        .then(() => console.log('Connected to mongoDB'))
        .catch((err) => console.log("Error in connecting to mongoDB", err));
}

export default mongoose;