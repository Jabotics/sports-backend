import { CustomRequest } from "../server";
import CustomError from "../errors/customError";
import asyncHandler from "../errors/asyncHandler";
import { response200 } from "../lib/helpers/utils";
import { Request, Response, Router } from "express";
import verifyJWT from "../middlewares/authentication";
import { validateObjectData } from "../lib/helpers/validation";
import { Academy, AcademyFee, City, Employee, Ground, Membership, MembershipFee, Reservation, SlotBooking, Student, Venue, VenueExpense } from "../schemas/schema";
import { city_financials_schema, finance_data_schema, ground_financials_schema, venue_financials_schema, venue_wise_salary } from "../validation/dashboardDataValidation";

const router = Router();

//For ground financials api
interface BookingQuery {
    createdAt?: {
        $gte: Date;
        $lte: Date;
    },
    ground?: string;
    venue?: {
        $in: string[];
    }
    city?: string;
    soft_delete?: boolean;
}

interface AcademyFeeQuery {
    payment_date?: {
        $gte: Date;
        $lte: Date;
    },
    academy?: {
        $in: string[];
    };
}

interface MembershipFeeQuery {
    payment_date?: {
        $gte: Date;
        $lte: Date;
    },
    membership?: {
        $in: string[];
    };
}

interface IVenueExpQuery {
    venue?: {
        $in: string[];
    }
    city?: string;
    month?: {
        $in: string[];
    },
    year?: string;
}

interface IdQuery {
    ground?: string;
    venue?: {
        $in: string[];
    }
    city?: string;
    soft_delete: boolean;
}

interface cityData {
    id: string,
    name: string
}

interface CityQuery {
    _id?: string;
    soft_delete: boolean;
}

interface EmployeeSalary {
    city?: string;
    type?: string;
    soft_delete: boolean;
}

interface json_response {
    total_income: number;
    total_exp: number;
    profit: number;
    total_salary_expenses: number;
    total_cities?: number,
    total_venues?: number;
    total_grounds?: number;
}

//Utility functions
function setEndDate(month: number, year: number) {
    if ([0, 2, 4, 6, 7, 9, 11].includes(month)) {
        return 31;
    }
    else if ([3, 5, 8, 10].includes(month)) {
        return 30;
    }
    else {
        return year % 4 == 0 ? 29 : 28;
    }
}

function dateFilter(filter_type: string, startDate?: string, endDate?: string, startYear?: string, endYear?: string) {
    let start_date = new Date();
    let end_date = new Date();

    switch (filter_type) {
        case 'one_month':
            if (start_date.getDate() === 31) {
                start_date.setDate(30);
                end_date.setDate(30);
            }
            start_date.setMonth(start_date.getMonth() - 1);
            end_date.setMonth(end_date.getMonth() - 1);
            start_date.setDate(1);
            end_date.setDate((setEndDate(start_date.getMonth(), end_date.getFullYear())));
            break;

        case 'three_month':
            if (start_date.getDate() === 31) {
                start_date.setDate(30);
                end_date.setDate(30);
            }
            start_date.setMonth(start_date.getMonth() - 3);
            end_date.setMonth(end_date.getMonth() - 1);
            start_date.setDate(1);
            end_date.setDate(setEndDate(end_date.getMonth(), end_date.getFullYear()));
            break;

        case 'six_month':
            if (start_date.getDate() === 31) {
                start_date.setDate(30);
                end_date.setDate(30);
            }
            start_date.setMonth(start_date.getMonth() - 6);
            end_date.setMonth(end_date.getMonth() - 1);
            start_date.setDate(1);
            end_date.setDate(setEndDate(end_date.getMonth(), end_date.getFullYear()));
            break;

        case 'financial_year':
            if (start_date.getDate() === 31) {
                start_date.setDate(30);
                end_date.setDate(30);
            }
            start_date.setFullYear(Number(startYear));
            end_date.setFullYear(Number(endYear));
            start_date.setMonth(3);
            start_date.setDate(1);
            end_date.setMonth(2);
            end_date.setDate(31);
            break;

        default:
            start_date = new Date(String(startDate));
            end_date = new Date(String(endDate));
    }

    start_date.setHours(0);
    start_date.setMinutes(0);
    start_date.setSeconds(0);
    start_date.setMilliseconds(0);

    end_date.setHours(23);
    end_date.setMinutes(59);
    end_date.setSeconds(59);
    end_date.setMilliseconds(999);

    return {
        start_date,
        end_date
    }
}

async function findVenueExp(dates: any, venue?: string[], venue_type?: string, city?: string) {
    const venue_exp_where: IVenueExpQuery = {};
    venue && (venue_exp_where.venue = { $in: venue });
    city && (venue_exp_where.city = city);

    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    let venue_expenses = 0;
    if (dates.start_date.getFullYear() == dates.end_date.getFullYear()) {
        const start_month = dates.start_date.getMonth();
        const end_month = dates.end_date.getMonth();
        const month_index: number[] = [];
        for (let i = start_month; i <= end_month; i++) {
            month_index.push(i);
        }
        venue_exp_where.month = {
            $in: month_index.map(i => months[i])
        }
        venue_exp_where.year = String(dates.start_date.getFullYear());
        venue_expenses = venue_type == 'Owned' ? (await VenueExpense.find(venue_exp_where)
        ).map(exp => exp.expenses.reduce((acc, current) => acc + current.amount, 0)).reduce((acc, current) => acc + current, 0) : 0;
    }
    else if (dates.start_date.getFullYear() < dates.end_date.getFullYear()) {
        let start_month = dates.start_date.getMonth();
        let end_month = 11;
        let month_index: number[] = [];
        for (let i = start_month; i <= end_month; i++) {
            month_index.push(i);
        }
        venue_exp_where.month = {
            $in: month_index.map(i => months[i])
        }
        venue_exp_where.year = String(dates.start_date.getFullYear());
        venue_expenses = venue_type == 'Owned' ? (await VenueExpense.find(venue_exp_where)
        ).map(exp => exp.expenses.reduce((acc, current) => acc + current.amount, 0)).reduce((acc, current) => acc + current, 0) : 0;

        month_index = [];
        start_month = 0;
        end_month = dates.end_date.getMonth();
        for (let i = start_month; i <= end_month; i++) {
            month_index.push(i);
        }
        venue_exp_where.month = {
            $in: month_index.map(i => months[i])
        }
        venue_exp_where.year = String(dates.end_date.getFullYear());
        venue_expenses += venue_type == 'Owned' ? (await VenueExpense.find(venue_exp_where)
        ).map(exp => exp.expenses.reduce((acc, current) => acc + current.amount, 0)).reduce((acc, current) => acc + current, 0) : 0;
    }
    return venue_expenses;
}


//Finding booking amount
async function findBookingAmount(dates: any, ground?: string, venue?: string[], city?: string) {
    const booking_where: BookingQuery = {
        createdAt: {
            $gte: dates.start_date,
            $lte: dates.end_date
        }
    }
    ground && (booking_where.ground = ground);
    venue && (booking_where.venue = { $in: venue });
    city && (booking_where.city = city);
    const booking_amount = (await SlotBooking.find(booking_where)).map(booking => booking.booking_amount).reduce((acc, current) => acc + current, 0);
    return booking_amount;
}

//Finding academy fees
async function findAcademyFees(dates: any, ground?: string, venue?: string[], city?: string) {
    const where: IdQuery = { soft_delete: false };
    ground && (where.ground = ground);
    venue && (where.venue = { $in: venue });
    city && (where.city = city);

    const owned_venues = (await Venue.find({ soft_delete: false, type: 'Owned' })).map(venue => venue._id);

    const academy_ids = (await Academy.find(where)).map(aca => String(aca._id));
    const academy_fee_where: AcademyFeeQuery = {
        payment_date: {
            $gte: dates.start_date,
            $lte: dates.end_date
        },
        academy: {
            $in: academy_ids
        }
    }
    const academy_fees = (await AcademyFee.find(academy_fee_where)).map(fee => fee.admission_fee + fee.academy_fee).reduce((acc, current) => acc + current, 0);
    return academy_fees;
}

//Finding membership fees
async function findMembershipFees(dates: any, ground?: string, venue?: string[], city?: string) {
    const where: IdQuery = { soft_delete: false };
    ground && (where.ground = ground);
    venue && (where.venue = { $in: venue });
    city && (where.city = city);

    const membership_ids = (await Membership.find(where)).map(mem => String(mem._id));
    const membership_fee_where: MembershipFeeQuery = {
        payment_date: {
            $gte: dates.start_date,
            $lte: dates.end_date
        },
        membership: {
            $in: membership_ids
        }
    }
    const membership_fees = (await MembershipFee.find(membership_fee_where)).map(fee => fee.joining_fee + fee.membership_fee).reduce((acc, current) => acc + current, 0);
    return membership_fees;
}

//Finding reservation amount
async function findReservationAmount(dates: any, ground?: string, venue?: string[], city?: string) {
    const where: BookingQuery = {
        soft_delete: false,
        createdAt: {
            $gte: dates.start_date,
            $lte: dates.end_date
        }
    };
    ground && (where.ground = ground);
    venue && (where.venue = { $in: venue });
    city && (where.city = city);

    const reservation_amount = (await Reservation.find(where)).map(res => res.total_amount).reduce((acc, current) => acc + current, 0);
    return reservation_amount;
}

router.get('/ground-financials', asyncHandler(async (req: Request, res: Response) => {
    const reqQuery = req.query;

    const validation = validateObjectData(ground_financials_schema, reqQuery);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    if (reqQuery.filter_type == 'financial_year' && !reqQuery.start_year && !reqQuery.end_year) throw new CustomError("Start and end year is required for financial year data", 406);
    if (reqQuery.filter_type == 'custom' && !reqQuery.start_date && !reqQuery.end_date) throw new CustomError("Start and end dates are required for custom filter", 406);

    const start_date = new Date(new Date().setDate(1));
    const end_date = new Date();

    const dates = dateFilter(String(reqQuery.filter_type ? reqQuery.filter_type : 'custom'), String(reqQuery.start_date ? reqQuery.start_date : start_date), String(reqQuery.end_date ? reqQuery.end_date : end_date), String(reqQuery.start_year), String(reqQuery.end_year));

    const booking_amount = await findBookingAmount(dates, String(reqQuery.ground));

    const academy_fees = await findAcademyFees(dates, String(reqQuery.ground));

    const membership_fees = await findMembershipFees(dates, String(reqQuery.ground));

    const reservation_amount = await findReservationAmount(dates, String(reqQuery.ground));

    const response = response200("Ground financials",
        {
            from: dates.start_date.toDateString(),
            to: dates.end_date.toDateString(),
            total_booking_amount: booking_amount,
            total_academy_fees: academy_fees,
            total_membership_fees: membership_fees,
            total_reservation_amount: reservation_amount,
            total_amount: booking_amount + academy_fees + membership_fees + reservation_amount
        });
    return res.status(response[0]).json(response[1]);
}));

router.get('/venue-financials', verifyJWT, asyncHandler(async (req: Request, res: Response) => {
    const reqQuery = req.query;

    const validation = validateObjectData(venue_financials_schema, reqQuery);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const venue = await Venue.findById(String(reqQuery.venue));
    if (!venue) throw new CustomError("Something went wrong", 404);

    const start_date = new Date(new Date().setDate(1));
    const end_date = new Date();

    const dates = dateFilter(String(reqQuery.filter_type ? reqQuery.filter_type : 'custom'), String(reqQuery.start_date ? reqQuery.start_date : start_date), String(reqQuery.end_date ? reqQuery.end_date : end_date), String(reqQuery.start_year), String(reqQuery.end_year));

    const booking_amount = await findBookingAmount(dates, undefined, [String(reqQuery.venue)]);

    const academy_fees = await findAcademyFees(dates, undefined, [String(reqQuery.venue)]);

    const membership_fees = await findMembershipFees(dates, undefined, [String(reqQuery.venue)]);

    const venue_expenses = await findVenueExp(dates, [String(reqQuery.venue)], venue.type);

    const reservation_amount = await findReservationAmount(dates, undefined, [String(reqQuery.venue)]);

    const employee_salary = (await Employee.find({ soft_delete: false, venue: { $in: [String(reqQuery.venue)] } })).map(emp => emp.salary).reduce((acc, current) => acc + current, 0);

    const response = response200("Venue financials",
        {
            from: dates.start_date.toDateString(),
            to: dates.end_date.toDateString(),
            total_booking_amount: booking_amount,
            total_academy_fee: academy_fees,
            total_membership_fee: membership_fees,
            total_reservation_amount: reservation_amount,
            total_income: booking_amount + academy_fees + membership_fees + reservation_amount,
            total_venue_expense: venue_expenses,
            employee_salary: employee_salary,
            profit: (booking_amount + academy_fees + membership_fees + reservation_amount) - venue_expenses
        }
    );
    return res.status(response[0]).json(response[1]);
}));

router.get('/city-financials', verifyJWT, asyncHandler(async (req: Request, res: Response) => {
    const reqQuery = req.query;

    const validation = validateObjectData(city_financials_schema, reqQuery);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const start_date = new Date(new Date().setDate(1));
    const end_date = new Date();

    const dates = dateFilter(String(reqQuery.filter_type ? reqQuery.filter_type : 'custom'), String(reqQuery.start_date ? reqQuery.start_date : start_date), String(reqQuery.end_date ? reqQuery.end_date : end_date), String(reqQuery.start_year), String(reqQuery.end_year));

    const booking_amount = await findBookingAmount(dates, undefined, undefined, String(reqQuery.city));

    const academy_fees = await findAcademyFees(dates, undefined, undefined, String(reqQuery.city));

    const membership_fees = await findMembershipFees(dates, undefined, undefined, String(reqQuery.city));

    const owned_venues = (await Venue.find({ city: String(reqQuery.city), soft_delete: false, type: 'Owned' })).map(venue => String(venue._id));

    const venue_expenses = await findVenueExp(dates, owned_venues, owned_venues.length > 0 ? 'Owned' : 'Partnership', String(reqQuery.city));

    const reservation_amount = await findReservationAmount(dates, undefined, undefined, String(reqQuery.city));

    const response = response200("City financials",
        {
            from: dates.start_date.toDateString(),
            to: dates.end_date.toDateString(),
            total_booking_amount: booking_amount,
            total_academy_fee: academy_fees,
            total_membership_fee: membership_fees,
            total_reservation_amount: reservation_amount,
            total_income: booking_amount + academy_fees + membership_fees + reservation_amount,
            total_venue_expense: venue_expenses,
            profit: (booking_amount + academy_fees + membership_fees + reservation_amount) - venue_expenses
        }
    )
    return res.status(response[0]).json(response[1]);
}));

router.get('/finance-data', verifyJWT, asyncHandler(async (req: CustomRequest, res: Response) => {
    const reqQuery = req.query;
    // const user = req.user;

    // if (!user || !user.is_superadmin || !user.is_admin || !user.is_subadmin) throw new CustomError("Permission denied", 403);

    const validation = validateObjectData(finance_data_schema, reqQuery);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    //Default start date and end date
    const sd = new Date(new Date().setDate(1));
    const ed = new Date();

    const dates = dateFilter(String(reqQuery.filter_type ? reqQuery.filter_type : 'custom'), String(reqQuery.start_date ? reqQuery.start_date : sd), String(reqQuery.end_date ? reqQuery.end_date : ed), String(reqQuery.start_year), String(reqQuery.end_year));

    const cityIds = (await City.find({ soft_delete: false })).map(city => { return { id: city._id, name: city.name } });

    cityIds.length > 0 && Promise.all(cityIds.map(async (data: cityData) => {
        const booking_amount = await findBookingAmount(dates, undefined, undefined, String(data.id));

        const academy_fees = await findAcademyFees(dates, undefined, undefined, String(data.id));

        const membership_fees = await findMembershipFees(dates, undefined, undefined, String(data.id));

        const owned_venues = (await Venue.find({ city: String(data.id), soft_delete: false, type: 'Owned' })).map(venue => String(venue._id));

        const venue_expenses = await findVenueExp(dates, owned_venues, owned_venues.length > 0 ? 'Owned' : 'Partnership', String(data.id));

        const offline_amount = (await Reservation.find({ venue: { $in: owned_venues }, city: data.id, createdAt: { $gte: dates.start_date, $lte: dates.end_date } })).map(res => res.total_amount).reduce((acc, current) => acc + current, 0);

        const partner_venues = (await Venue.find({ soft_delete: false, type: 'Partner', city: data.id })).map(venue => String(venue._id));

        const partner_booking_amount = await findBookingAmount(dates, undefined, partner_venues, String(data.id));

        const partner_academy_fees = await findAcademyFees(dates, undefined, partner_venues, String(data.id));

        const partner_membership_fees = await findMembershipFees(dates, undefined, partner_venues, String(data.id));

        const employee_salary = (await (Employee.find({ soft_delete: false, city: String(data.id), venue: { $in: owned_venues } }))).map(emp => emp.salary).reduce((acc, current) => acc + current, 0);

        return {
            city_id: data.id,
            city: data.name,
            from: dates.start_date.toDateString(),
            to: dates.end_date.toDateString(),
            total_booking_amount: booking_amount,
            total_academy_fee: academy_fees,
            total_membership_fee: membership_fees,
            total_reservation_amount: offline_amount,
            total_income: booking_amount + academy_fees + membership_fees + offline_amount,
            total_venue_expense: venue_expenses,
            profit: (booking_amount + academy_fees + membership_fees + offline_amount) - venue_expenses,
            partner_venue_total_amounts: partner_booking_amount + partner_academy_fees + partner_membership_fees,
            employee_salary: employee_salary
        };
    })).then(responseArray => {
        const response = response200("Finance data", { responseArray });
        return res.status(response[0]).json(response[1]);
    });
}));

router.get('/all-financial-data', verifyJWT, asyncHandler(async (req: CustomRequest, res: Response) => {
    const reqQuery = req.query;
    const user = req.user;
    
    if (!user || (!user.is_superadmin && !user.is_admin && !user.is_subadmin)) throw new CustomError("Permission denied", 403);

    const validation = validateObjectData(finance_data_schema, reqQuery);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    if (reqQuery.filter_type == 'custom' && (!reqQuery.start_date || !reqQuery.end_date)) throw new CustomError("Start date and end date is required for custom filter", 406);
    if (reqQuery.filter_type == 'financial_year' && (!reqQuery.start_year || !reqQuery.end_year)) throw new CustomError("Start year and end year is required for financial year filter", 406);

    //Default start date and end date
    const start_date = new Date(new Date().setDate(1));
    const end_date = new Date();

    const where: CityQuery = { soft_delete: false }
    let venue = undefined;

    user.city && user.city._id && (where._id = String(user.city._id));
    user.venue && Array.isArray(user.venue) && user.venue.length != 0 && (venue = user.venue.map(venue => String(venue)));

    const dates = dateFilter(String(reqQuery.filter_type ? reqQuery.filter_type : 'custom'), String(reqQuery.start_date ? reqQuery.start_date : start_date), String(reqQuery.end_date ? reqQuery.end_date : end_date), String(reqQuery.start_year), String(reqQuery.end_year));

    const cityIds = (await City.find(where)).map(city => { return { id: city._id, name: city.name } });

    cityIds.length > 0 && Promise.all(cityIds.map(async (data: cityData) => {
        const booking_amount = await findBookingAmount(dates, undefined, venue, String(data.id));

        const academy_fees = await findAcademyFees(dates, undefined, venue, String(data.id));

        const membership_fees = await findMembershipFees(dates, undefined, venue, String(data.id));

        const owned_venues = (await Venue.find({ city: String(data.id), soft_delete: false, type: 'Owned' })).map(venue => String(venue._id));

        const venue_expenses = await findVenueExp(dates, owned_venues, owned_venues.length > 0 ? 'Owned' : 'Partnership', String(data.id));

        const offline_amount = (await Reservation.find({ venue: { $in: owned_venues }, city: data.id, createdAt: { $gte: dates.start_date, $lte: dates.end_date } })).map(res => res.total_amount).reduce((acc, current) => acc + current, 0);

        return {
            city: data.name,
            from: dates.start_date.toDateString(),
            to: dates.end_date.toDateString(),
            total_booking_amount: booking_amount,
            total_academy_fee: academy_fees,
            total_membership_fee: membership_fees,
            total_income: booking_amount + academy_fees + membership_fees,
            total_venue_expense: venue_expenses,
            sub_total: (booking_amount + academy_fees + membership_fees) - venue_expenses,
            offline_amount: offline_amount
        };
    })).then(async (responseArray) => {
        let total_booking_amount = 0;
        let total_academy_fee = 0;
        let total_membership_fee = 0;
        let total_offline_amount = 0;
        let total_income = 0;
        let total_exp = 0;
        let profit = 0;
        responseArray.forEach(item => {
            total_booking_amount += item.total_booking_amount;
            total_academy_fee += item.total_academy_fee;
            total_membership_fee += item.total_membership_fee;
            total_exp = item.total_venue_expense;
            total_offline_amount += item.offline_amount
        });
        total_income = total_booking_amount + total_academy_fee + total_membership_fee + total_offline_amount
        profit = total_income - total_exp;
        //Finding superadmin employees salary
        const superadmin_emp_salary = (await Employee.find({ added_by: 'SA', soft_delete: false })).map(emp => emp.salary).reduce((acc, current) => acc + current, 0);

        //Finding partner venues
        const where: EmployeeSalary = { soft_delete: false, type: 'Partner' };
        user.city && (where.city = String(user.city._id));

        const partner_venues = (await Venue.find(where)).map(venue => venue._id);

        //Finding other employee salaries excepting partner venue employees
        const own_emp_salary = (await Employee.find({ soft_delete: false, venue: { $nin: partner_venues } })).map(emp => emp.salary).reduce((acc, current) => acc + current, 0);

        let partner = false;
        if (user.venue && Array.isArray(user.venue) && user.venue.length != 0) {
            const venue = await Venue.findOne({ city: user.city, _id: user.venue[0] });
            if (venue && venue.type == 'Partner') {
                partner = true;
            }
        }

        let total_salary_expenses = 0;
        if (user.is_superadmin) {
            total_salary_expenses = superadmin_emp_salary + own_emp_salary;
        }
        else if (user.is_admin) {
            total_salary_expenses = own_emp_salary;
        }
        else if (user.is_subadmin) {
            total_salary_expenses = (await Employee.find({ soft_delete: false, venue: { $in: user.venue } })).map(emp => emp.salary).reduce((acc, current) => acc + current, 0);
        }        
        
        const data: json_response = {
            total_income, 
            total_exp, 
            profit, 
            total_salary_expenses,            
        }

        let cities_count = 0;
        let venue_count = 0;
        let ground_count = 0;
        if(user.is_superadmin) {
            cities_count = await City.countDocuments({soft_delete: false});
            data.total_cities = cities_count
        }
        else if(user.is_admin) {
            venue_count = await Venue.countDocuments({soft_delete: false});
            data.total_venues = venue_count;
        }
        else {
            ground_count = await Ground.countDocuments({soft_delete: false});
            data.total_grounds = ground_count;
        }

        const response = response200("Finance data", data);
        return res.status(response[0]).json(response[1]);
    });
}));


// router.get('/all-salary-details', verifyJWT, asyncHandler(async (req: Request, res: Response) => {
//     const superadmin_emp_salary = (await Employee.find({ added_by: 'SA', soft_delete: false })).map(emp => emp.salary).reduce((acc, current) => acc + current, 0);

//     const city_ids = (await City.find({ soft_delete: false })).map(city => { return { id: city._id, name: city.name } });

//     city_ids.length > 0 && Promise.all(city_ids.map(async (city) => {
//         const partner_venues = (await Venue.find({ type: 'Partner', soft_delete: false, city: city.id })).map(venue => venue._id);

//         const employee_salary = (await Employee.find({ city: city.id, soft_delete: false, venue: { $nin: partner_venues } })).map(emp => emp.salary).reduce((acc, current) => acc + current, 0);

//         return {
//             city_id: city.id,
//             city_name: city.name,
//             emp_salary: employee_salary
//         }
//     })).then(detail => {
//         const response = response200("Salary details", { superadmin_emp_salary, detail });
//         return res.status(response[0]).json(response[1]);
//     });
// }));

// router.get('/venue-wise-salary', verifyJWT, asyncHandler(async (req: Request, res: Response) => {
//     const reqQuery = req.query;

//     const validation = validateObjectData(venue_wise_salary, reqQuery);
//     if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

//     const owned_venues = (await Venue.find({ soft_delete: false, type: 'Owned' })).map(venue => { return { id: venue._id, name: venue.name } });

//     owned_venues.length > 0 && Promise.all(owned_venues.map(async (venue) => {
//         const employee = (await Employee.find({ soft_delete: false, venue: venue.id })).map(emp => { return { id: emp._id, salary: emp.salary, venue: emp.venue } });
//         return { venue_id: venue.id, venue_name: venue.name, employee };
//     })).then((data) => {
//         let salary_details = data.map((detail) => {
//             return {
//                 venue_id: detail.venue_id,
//                 venue_name: detail.venue_name,
//                 salary_amount: detail.employee.reduce((acc, current) => {
//                     if (current.venue && current.venue.length > 1) {
//                         return acc + (current.salary / current.venue.length)
//                     }
//                     else {
//                         return acc + current.salary;
//                     }
//                 }, 0)
//             }
//         });
//         const response = response200("Salary details", { salary_details });
//         return res.status(response[0]).json(response[1]);
//     });
// }));

export default router;