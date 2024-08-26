import { ICity } from "../types/types";
import { City } from "../schemas/schema";
import { CustomRequest } from "../server";
import CustomError from "../errors/customError";
import asyncHandler from "../errors/asyncHandler";
import { response200 } from "../lib/helpers/utils";
import { Request, Response, Router } from "express";
import verifyJWT from "../middlewares/authentication";
import { FilterQuery, SortOrder, Types } from 'mongoose';
import { add, menus, remove, update, view } from "../middlewares/permission";
import { validateArrayData, validateObjectData, validateStringData } from "../lib/helpers/validation";
import { add_city_schema, fetch_cities_schema, get_city_schema, remove_city_schema, update_city_schema } from "../validation/cityValidation";

interface CityQuery extends FilterQuery<ICity> {
    $or?: Array<{ [key: string]: any }>;
    is_active?: boolean;
    _id?: Types.ObjectId;
}

const router = Router();

router.post('/add-city', [verifyJWT, add(menus.Cities)], add(menus.Cities), asyncHandler(async (req: CustomRequest, res: Response) => {
    const cityName = req.body.name;
    const user = req.user;

    //Validating requested data
    const validation = validateStringData(add_city_schema, cityName);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    //Finding duplicate entry
    const findExisting = await City.find({ name: cityName.toUpperCase(), soft_delete: false });
    if (findExisting.length != 0) throw new CustomError("City already exists", 409);

    //Creating new entry
    const newCity = new City({
        name: cityName.toUpperCase()
    });

    await newCity.save()
    const response = response200("City added successfully", { id: newCity._id });
    return res.status(response[0]).json(response[1]);
}));

router.get('/get-cities', [verifyJWT, view(menus.Cities)], view(menus.Cities), asyncHandler(async (req: CustomRequest, res: Response) => {
    const reqQuery = req.query;

    //Validating requested data
    const validation = validateObjectData(get_city_schema, reqQuery);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    let where: CityQuery = {
        soft_delete: false
    };

    // Preparing where clause for the query
    if (reqQuery.search) {
        where.$or = [{ name: { $regex: String(reqQuery.search), $options: 'i' } }];
    }
    var regExp = new RegExp("true");
    reqQuery.is_active && (where.is_active = regExp.test(String(reqQuery.is_active)));
    reqQuery.id && (where._id = new Types.ObjectId(String(reqQuery.id)));

    //Sorting for the query
    const sortOptions: string | { [key: string]: SortOrder | { $meta: any; }; } | [string, SortOrder][] | null | undefined = [];
    if (reqQuery.orderBy) {
        sortOptions.push([String(reqQuery.orderBy), reqQuery.sort === 'asc' ? 1 : -1]);
    } else {
        sortOptions.push(["createdAt", 1]);
    }

    //Fetching data from database
    const cities = (await City.find(where)
        .sort(sortOptions)
        .skip(Number(reqQuery.offset))
        .limit(Number(reqQuery.limit))).map((city) => {
            return {
                id: city._id,
                name: city.name,
                is_active: city.is_active
            }
        });
    const count = await City.countDocuments(where);

    const response = response200("All cities fetched successfully", { count, cities });
    return res.status(response[0]).json(response[1]);
}));

router.post('/update-city', [verifyJWT, update(menus.Cities)], asyncHandler(async (req: Request, res: Response) => {
    const reqData = req.body;

    //Validating requested data
    const validation = validateObjectData(update_city_schema, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    //Preparing data for update
    const data = {
        name: reqData.name && reqData.name.toUpperCase(),
        is_active: reqData?.is_active
    }

    //Updating data in database
    await City.updateOne(
        { _id: reqData.id },
        { $set: data }
    );

    const response = response200("City updated successfully", {});
    return res.status(response[0]).json(response[1]);
}));

router.post('/remove-cities', [verifyJWT, remove(menus.Cities)], asyncHandler(async (req: Request, res: Response) => {
    const reqIds = req.body.cityIds;

    //Validating requested data
    const validation = validateArrayData(remove_city_schema, reqIds);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    //Removing  the city from database

    await City.updateMany(
        { _id: { $in: reqIds } },
        { $set: { soft_delete: true } }
    );

    const response = response200("City removed successfully", {});
    return res.status(response[0]).json(response[1]);
}));

router.get('/fetch-cities', asyncHandler(async (req: CustomRequest, res: Response) => {
    const reqQuery = req.query;
    const user = req.user;

    const validation = validateObjectData(fetch_cities_schema, reqQuery);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const where: CityQuery = {
        soft_delete: false,
        is_active: true,
    }

    if (reqQuery.search) {
        where.$or = [{ name: { $regex: String(reqQuery.search), $options: 'i' } }];
    }
    if (user && 'city' in user && user.city) {
        where._id = user.city._id;
    }

    const cities = (await City.find(where)).map((city) => {
        return {
            id: city.id,
            name: city.name
        }
    });

    const response = response200("Cities fetched successfully", { cities });
    return res.status(response[0]).json(response[1]);
}));

export default router;