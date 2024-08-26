import { Server } from 'socket.io';
import { Admin, Chat } from '../schemas/schema';
import { Types } from 'mongoose';

let user = new Map();

const setupSocket = (io: Server) => {
    //Socket connection event
    io.on('connection', (socket) => {
        
        //Map connected clients
        socket.on("client_ready", (data) => {                        
            user.set(data.user, data.socket);
        });

        //Create chat event
        socket.on("createChat", async ()=>{
            try {
                const super_admin = await Admin.findOne({is_superadmin: true, soft_delete: false});
                const adminSocketId = user.get(String(super_admin?._id));
                const chat = await Chat.find({resolved: false})
                .sort({createdAt: -1})
                .populate({path: 'user', select: ['first_name', 'last_name', 'mobile'], options: {strictPopulate: false}});
                let data = {
                    id: chat[0]._id,
                    user: chat[0].user,
                    messages: chat[0].messages,
                    chat_status: chat[0].chat_status,
                    resolved: chat[0].resolved
                }                                                
                io.emit('chats', data)                       
            }
            catch(err) {
                console.log(err);
            }
        });

        // Message events
        socket.on("sendMessage", async (data) => {
            const { chat_id } = data;
            try {
                const chat = await Chat.findById(chat_id);
                const message = chat?.messages[chat.messages.length - 1];
                const userSocketId = user.get(String(chat?.user));
                const adminSocketId = user.get(String(chat?.super_admin));
                const empSocketId = user.get(String(chat?.employee[0]));
                socket.to(userSocketId).emit('message', {chat_id,message});                
                socket.to(adminSocketId).emit('message', {chat_id, message});                                
                socket.to(empSocketId).emit('message', {chat_id, message});                                            
            }
            catch (err) {
                console.log(err);
            }
        });

        // Message seen event
        socket.on('messageSeen', async (data) => {
            const { chat_id } = data;
            try {
                await Chat.findByIdAndUpdate(chat_id, {
                    $set: { 'messages.$[].seen': true }
                },
                {
                    new: true
                });                     
            }
            catch (err) {
                console.log(err);
            }
        });

        //Solved chat event
        socket.on('solveChat', async (data)=>{            
            const chat = await Chat.findById(data.chat_id);
            if(chat) {
                const userSocketId = user.get(String(chat?.user));
                const adminSocketId = user.get(String(chat?.super_admin));
                const empSocketId = user.get(String(chat.employee[0]));

                socket.to(userSocketId).emit('chatSolved', data.chat_id);
                socket.to(adminSocketId).emit('chatSolved', data.chat_id);
                socket.to(empSocketId).emit('chatSolved', data.chat_id);
            }
        });

        socket.on('joinChat', async (data)=>{
            const admin = await Admin.findById(data.receiver_id);
            const empSocketId = user.get(String(data.receiver_id));
            !admin && await Chat.findByIdAndUpdate(data.chat_id, {$push: {employee: [String(data.receiver_id)]}});

            io.emit('chatJoined', {chat_joined: true, chat_id: data.chat_id});            
            // empSocketId && socket.to(data.socket_id).emit('chatJoined', {chat_joined: true});            
        });

        //Socket connection disconnected
        socket.on('disconnect', () => {
            user.forEach((socket_id, user_id) => {
                if (socket_id === socket.id) {
                    user.delete(user_id);
                }
            });
        });
    });
}

export default setupSocket;