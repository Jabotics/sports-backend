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
    partnerRequestRoutes,
    groundReviewRoutes,
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
    let routes = [faqRoutes, empRoutes, cityRoutes, menuRoutes, blogRoutes, chatRoutes, roleRoutes, authRoutes, adminRoutes, sportRoutes, venueRoutes, eventRoutes, memberRoutes, bannerRoutes, groundRoutes, paymentRoutes, settingRoutes, inquiryRoutes, academyRoutes, slotTimeRoutes, customerRoutes, feedbackRoutes, promoCodeRoutes, dashboardRoutes, membershipRoutes, slotBookingRoutes, reserveSlotRoutes, venueExpenseRoutes, eventRequestRoutes, happyCustomerRoutes, academyStudentRoutes, partnerRequestRoutes, groundReviewRoutes];

    for (let i in routes) {
        app.use('/api', routes[i]);
    }

    //Lost routes
    app.use((req: Request, res: Response) => {
        res.json("You're lost, check your route !");
    });

    //Error handler
    app.use(handleError)
}