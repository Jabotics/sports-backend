import cors from 'cors';
import multer from 'multer';
import helmet from 'helmet';
import path from "node:path";
import { connectDB } from "../lib/db";
import { handleError } from '../errors/errorHandler';
import express, { Express, Request, Response } from "express";
import {
    empRoutes,
    cityRoutes,
    menuRoutes,
    roleRoutes,
    authRoutes,
    adminRoutes,
    sportRoutes,
    venueRoutes,
    eventRoutes,
    groundRoutes,
    academyRoutes,
    settingRoutes,
    inquiryRoutes,
    customerRoutes,
    slotTimeRoutes,
    membershipRoutes,
    slotBookingRoutes,
    venueExpenseRoutes,
    academyStudentRoutes,
    promoCodeRoutes,
    paymentRoutes,
    memberRoutes,
    reserveSlotRoutes,
    chatRoutes,
    bannerRoutes,
    eventRequestRoutes,
    dashboardRoutes,
    faqRoutes,
    blogRoutes,
    feedbackRoutes,
    happyCustomerRoutes,    
} from "../routes";

const multipartDataHandler = multer().any();
export default async function (app: Express) {
    //Middlewares
    app.use(cors({
        origin: "*",
        credentials: true
    }));
    app.use(multipartDataHandler);
    app.use(helmet.xXssProtection());
    app.use(express.json({ limit: '50mb' }));
    app.use(helmet({ crossOriginResourcePolicy: false }));
    app.use(express.urlencoded({ extended: true, limit: '50mb' }));
    app.use("/assets", express.static(path.join(__dirname, "..", "assets")));
    app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

    //Database connection
    await connectDB();

    //API Routes
    app.use('/api', faqRoutes);
    app.use('/api', empRoutes);
    app.use('/api', cityRoutes);
    app.use('/api', menuRoutes);
    app.use('/api', blogRoutes);
    app.use('/api', chatRoutes);
    app.use('/api', roleRoutes);
    app.use('/api', authRoutes);
    app.use('/api', adminRoutes);
    app.use('/api', sportRoutes);
    app.use('/api', venueRoutes);
    app.use('/api', eventRoutes);
    app.use('/api', memberRoutes);
    app.use('/api', bannerRoutes);
    app.use('/api', groundRoutes);
    app.use('/api', paymentRoutes);
    app.use('/api', settingRoutes);
    app.use('/api', inquiryRoutes);    
    app.use('/api', academyRoutes);
    app.use('/api', slotTimeRoutes);
    app.use('/api', customerRoutes);
    app.use('/api', feedbackRoutes);
    app.use('/api', promoCodeRoutes);
    app.use('/api', dashboardRoutes);
    app.use('/api', membershipRoutes);
    app.use('/api', slotBookingRoutes);
    app.use('/api', reserveSlotRoutes);
    app.use('/api', venueExpenseRoutes);
    app.use('/api', eventRequestRoutes);
    app.use('/api', happyCustomerRoutes);
    app.use('/api', academyStudentRoutes);

    //Lost routes
    app.use((req: Request, res: Response) => {
        res.json("You're lost, check your route !");
    });

    //Error handler
    app.use(handleError)
}