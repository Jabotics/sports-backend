import CustomError from "../errors/customError";
import asyncHandler from "../errors/asyncHandler";
import { Request, Response, Router } from "express";
import { validateArrayData, validateObjectData, validateStringData } from "../lib/helpers/validation";
import { add_venue_expense, download_expense_report, get_venue_expenses, remove_venue_expenses, update_venue_expense } from "../validation/venueExpensesValidation";
import { City, Venue, VenueExpense } from "../schemas/schema";
import { response200 } from "../lib/helpers/utils";
import { FilterQuery, Types } from "mongoose";
import { IVenueExpenses } from "../types/types";
import { CustomRequest } from "../server";
import verifyJWT from "../middlewares/authentication";
import { add, menus, remove, update, view } from "../middlewares/permission";
import { resolve } from 'node:path';

const puppeteer = require('puppeteer')
const hbs = require('handlebars');
const fs = require('fs');
const path = require('path');

interface ExpenseQuery extends FilterQuery<IVenueExpenses> {
    $or?: Array<{ [key: string]: any }>;
    city?: Types.ObjectId;
    venue?: {
        $in: Array<Types.ObjectId>;
    };
}

const docHeight = () => {
    if (document !== undefined) {
        const body = document.body;
        const html = document.documentElement;
        return Math.max(body.scrollHeight, body.offsetHeight, html.clientHeight, html.scrollHeight, html.offsetHeight);
    }
}

const router = Router();

router.post('/add-venue-expense', [verifyJWT, add(menus.Expenses)], asyncHandler(async (req: CustomRequest, res: Response) => {
    const reqData = req.body;
    const user = req.user;

    if (!user) throw new CustomError("Permission denied", 403);

    const validation = validateObjectData(add_venue_expense, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const currentYear = new Date().getFullYear();
    if (currentYear < Number(reqData.year)) throw new CustomError("Year should not be greater than current year", 406);

    const exp = await VenueExpense.findOne({ month: reqData.month, year: reqData.year });
    if (exp) throw new CustomError("Expense already added for this month", 406);

    const city = await City.findOne({ _id: reqData.city, is_active: true, soft_delete: false });
    if (!city) throw new CustomError("City does not exist or is disabled", 406);

    const venue = await Venue.findOne({ _id: reqData.venue, is_active: true, soft_delete: false });
    if (!venue) throw new CustomError("Venue does not exist or is disabled", 406);

    if ('city' in user && user.city) {
        if (String(user.city._id) != reqData.city) throw new CustomError("Permission denied", 403);
    }

    if ('venue' in user && Array.isArray(user.venue) && user.venue.length != 0) {
        if (!user.venue.includes(reqData.venue)) throw new CustomError("Permission denied", 403);
    }

    if (venue.city != reqData.city) throw new CustomError("The city doesn't have the venue you selected", 406);

    const expense = await VenueExpense.create({
        city: reqData.city,
        venue: reqData.venue,
        month: reqData.month,
        year: reqData.year,
        expenses: reqData.expenses
    });

    const response = response200("Expense added successfully", { id: expense._id });
    return res.status(response[0]).json(response[1]);
}));

router.get('/get-venue-expenses', [verifyJWT, view(menus.Expenses)], asyncHandler(async (req: CustomRequest, res: Response) => {
    const reqQuery = req.query;
    const user = req.user;

    const validation = validateObjectData(get_venue_expenses, reqQuery);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    if (!user) throw new CustomError("Permission denied", 403);

    const where: ExpenseQuery = {};

    if ('city' in user && user.city) {
        where.city = user.city._id
    }

    reqQuery.month && (where.month = String(reqQuery.month));
    reqQuery.year && (where.year = String(reqQuery.year));
    reqQuery.search && (where.$or = [
        { month: { $regex: String(reqQuery.search), $options: 'i' } },
        { year: { $regex: String(reqQuery.search), $options: 'i' } },
    ]);

    if ('venue' in user && Array.isArray(user.venue) && user.venue.length != 0) {
        const venueIds = user.venue.map((id) => {
            return new Types.ObjectId(String(id));
        });
        where.venue = { $in: venueIds }
    }

    const outlays = (await VenueExpense.find(where)
        .populate({ path: 'city', select: ['name'], options: { strictPopulate: false } })
        .populate({ path: 'venue', select: ['name'], options: { strictPopulate: false } })
        .skip(Number(reqQuery.offset) || 0)
        .limit(Number(reqQuery.limit) || 10000)
    ).map((expense) => {
        let total_exp = expense.expenses.reduce((amount: number, expense: any) => {
            return amount + expense.amount;
        }, 0);
        return {
            id: expense._id,
            city: expense.city,
            venue: expense.venue,
            month: expense.month,
            year: expense.year,
            expenses: expense.expenses,
            total_exp
        }
    });

    const count = await VenueExpense.countDocuments(where);

    const response = response200("Expenses fetched successfully", { count, outlays });
    return res.status(response[0]).json(response[1]);
}));

router.post('/update-venue-expense', [verifyJWT, update(menus.Expenses)], asyncHandler(async (req: CustomRequest, res: Response) => {
    const reqData = req.body;
    const user = req.user;

    if (!user) throw new CustomError("Permission denied", 403);

    const validation = validateObjectData(update_venue_expense, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    if (reqData.year) {
        const currentYear = new Date().getFullYear();
        if (currentYear < Number(reqData.year)) throw new CustomError("Year should not be greater than current year", 406);
    }

    const city = await City.findOne({ _id: reqData.city, is_active: true, soft_delete: false });
    if (!city) throw new CustomError("City does not exist or is disabled", 406);

    const venue = await Venue.findOne({ _id: reqData.venue, is_active: true, soft_delete: false });
    if (!venue) throw new CustomError("Venue does not exist or is disabled", 406);

    if ('city' in user && user.city) {
        if (String(user.city._id) != reqData.city) throw new CustomError("Permission denied", 403);
    }

    if ('venue' in user && Array.isArray(user.venue) && user.venue.length != 0) {
        if (!user.venue.includes(reqData.venue)) throw new CustomError("Permission denied", 403);
    }

    if (venue.city != reqData.city) throw new CustomError("The city doesn't have the venue you selected", 406);

    const data = {
        city: reqData.city,
        year: reqData?.year,
        venue: reqData.venue,
        month: reqData?.month,
        expenses: reqData.expenses
    };

    await VenueExpense.updateMany(
        { _id: reqData.id },
        { $set: data }
    );

    const response = response200("Expense updated successfully", { id: reqData._id });
    return res.status(response[0]).json(response[1]);
}));

router.post('/remove-venue-expenses', [verifyJWT, remove(menus.Expenses)], asyncHandler(async (req: Request, res: Response) => {
    const reqIds = req.body.expenseIds;

    const validation = validateArrayData(remove_venue_expenses, reqIds);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    await VenueExpense.deleteMany({ _id: { $in: reqIds } });

    const response = response200("Expenses removed successfully", {});
    return res.status(response[0]).json(response[1]);
}));

router.get('/download-expense-report', [verifyJWT, view(menus.Expenses)], asyncHandler(async (req: Request, res: Response) => {
    const id = req.query.reportId;

    const validation = validateStringData(download_expense_report, String(id));
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const report = (await VenueExpense.findById(id)
        .populate({ path: 'city', select: 'name', options: { strictPopulate: false } })
        .populate({ path: 'venue', select: 'name', options: { strictPopulate: false } }));
    if (!report) throw new CustomError("Report not found", 404);

    const report_data = {
        city: report.city,
        year: report.year,
        venue: report.venue,
        month: report.month,
        expenses: report.expenses.map(exp => ({ desc: exp.desc, amount: exp.amount })),
        total: report.expenses.reduce((amount: number, exp: any) => {
            return amount + exp.amount
        }, 0)
    }

    let data = {
        report_data: report_data
    }

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    const templateDir = resolve(path.join(__dirname, "..", "templates"), "venueExpense.hbs");
    const file = fs.readFileSync(templateDir, 'utf-8');

    const fileCompiled = hbs.compile(file);
    const fileHTML = fileCompiled(data);
    await page.setContent(fileHTML);
    const height = await page.evaluate(docHeight);
    const savePath = path.join(__dirname, `../downloads/venue-expense-report.pdf`);
    const pdfOptions = {
        path: savePath,
        height,
        printBackground: true
    };
    await page.pdf(pdfOptions);
    const filepath = path.join(__dirname, "../downloads", "venue-expense-report.pdf");
    const filename = 'venue-expense-report.pdf';
    res.download(filepath, filename, async (err) => {
        if (err) {
            return res.status(500).json({ status: "fail", message: "Could not download the file" });
        }
        else {
            console.log("Report downloaded");
            await browser.close();
        }
    })
}));

export default router;