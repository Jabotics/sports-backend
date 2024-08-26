import sharp from "sharp";
import { FilterQuery } from "mongoose";
import { Blog } from "../schemas/schema";
import CustomError from "../errors/customError";
import asyncHandler from "../errors/asyncHandler";
import { BlogDetail, IBlog } from "../types/types";
import { Request, Response, Router } from "express";
import verifyJWT from "../middlewares/authentication";
import { image_validation_schema } from "../validation/imageValidation";
import { add, menus, remove, update, view } from "../middlewares/permission";
import { validateArrayData, validateObjectData } from "../lib/helpers/validation";
import { findFile, removeFile, response200, saveImage, uploadPaths } from "../lib/helpers/utils";
import { create_blog_schema, get_blogs_schema, remove_blog_schema, update_blog_schema } from "../validation/blogValidation";

interface BlogQuery extends FilterQuery<IBlog> {
    _id?: string;
    is_active?: {
        $in: boolean[];
    }
    featured?: boolean;
    soft_delete: boolean;
}

interface update_data {
    title?: string;
    image?: string;
    quotation?: string;
    featured?: boolean;
    is_active?: boolean;
    description?: string;
    details?: Array<BlogDetail>;
}

const date_option: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
}

const router = Router();

router.post('/create-blog', [verifyJWT, add(menus.Blog)], asyncHandler(async (req: Request, res: Response) => {
    let reqData = req.body;
    reqData = {
        ...reqData,
        details: reqData.details && JSON.parse(String(reqData.details))
    }
    const reqImage = req.files;

    const validation = validateObjectData(create_blog_schema, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    if (Array.isArray(reqImage) && reqImage?.length != 0) {
        const imgValidation = validateObjectData(image_validation_schema, reqImage[0]);
        if (imgValidation.error) throw new CustomError(imgValidation.error.message, 406, imgValidation.error.details[0].context?.key);
    }

    const data = {
        title: reqData.title,
        description: reqData.description,
        quotation: reqData?.quotation,
        details: reqData?.details
    }

    const newBlog = await Blog.create(data);

    let img_url = null;
    if (Array.isArray(reqImage) && reqImage.length != 0) {
        const compressedBuffer = await new Promise<Buffer>((resolve, reject) => {
            sharp(reqImage[0].buffer as Buffer)
                .jpeg({ quality: 80 })
                .toBuffer((err, compressedBuffer) => {
                    if (err) {
                        console.log(err);
                        reject(err);
                    }
                    else {
                        resolve(compressedBuffer);
                    }
                });
        });
        await saveImage(uploadPaths.blog, `${newBlog._id}-${reqImage[0].originalname}`, compressedBuffer);
        let url = await findFile(newBlog._id, uploadPaths.blog);
        img_url = url[0];
        img_url !== null && await Blog.findByIdAndUpdate(
            { _id: newBlog._id },
            { $set: { image: img_url } }
        );
    }

    const response = response200("Blog created successfully", { id: newBlog._id });
    return res.status(response[0]).json(response[1]);
}));

router.get('/get-blogs', [verifyJWT, view(menus.Blog)], asyncHandler(async (req: Request, res: Response) => {
    const reqQuery = req.query;

    const validation = validateObjectData(get_blogs_schema, reqQuery);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const where: BlogQuery = { soft_delete: false };

    const blogs = (await Blog.find(where)
        .limit(Number(reqQuery.limit) || 10000)
        .skip(Number(reqQuery.offset) || 0)
    ).map((blog: IBlog) => {
        return {
            id: blog._id,
            title: blog.title,
            description: blog.description,
            quotation: blog.quotation,
            details: blog.details,
            image: blog.image,
            createdAt: blog.createdAt.toLocaleDateString('en-GB', date_option),
            is_active: blog.is_active,
            featured: blog.featured
        }
    });

    const count = await Blog.countDocuments(where);

    const response = response200("All blogs fetched successfully", { count, blogs });
    return res.status(response[0]).json(response[1]);
}));

router.post('/update-blog', [verifyJWT, update(menus.Blog)], asyncHandler(async (req: Request, res: Response) => {
    let reqData = req.body;
    reqData = {
        ...reqData,
        details: reqData.details && JSON.parse(reqData.details)
    }
    const reqImage = req.files;

    const validation = validateObjectData(update_blog_schema, reqData);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    if (Array.isArray(reqImage) && reqImage?.length != 0) {
        const imgValidation = validateObjectData(image_validation_schema, reqImage[0]);
        if (imgValidation.error) throw new CustomError(imgValidation.error.message, 406, imgValidation.error.details[0].context?.key);
    }

    const data: update_data = {
        title: reqData?.title,
        description: reqData?.description,
        quotation: reqData?.quotation,
        details: reqData?.details,
        is_active: reqData?.is_active,
        featured: reqData?.featured
    }

    if (Array.isArray(reqImage) && reqImage.length != 0) {
        await removeFile(uploadPaths.blog, reqData.id);
        const compressedBuffer = await new Promise<Buffer>((resolve, reject) => {
            sharp(reqImage[0].buffer as Buffer)
                .jpeg({ quality: 80 })
                .toBuffer((err, compressedBuffer) => {
                    if (err) {
                        console.log(err);
                        reject(err);
                    }
                    else {
                        resolve(compressedBuffer);
                    }
                });
        });
        await saveImage(uploadPaths.blog, `${reqData.id}-${reqImage[0].originalname}`, compressedBuffer);
        let url = await findFile(reqData.id, uploadPaths.blog);
        data.image = url[0];
    }

    await Blog.findByIdAndUpdate(reqData.id, data);

    const response = response200("Blog updated successfully", { id: reqData.id });
    return res.status(response[0]).json(response[1]);
}));

router.post('/remove-blog', [verifyJWT, remove(menus.Blog)], asyncHandler(async (req: Request, res: Response) => {
    const reqIds = req.body.blogIds;

    const validation = validateArrayData(remove_blog_schema, reqIds);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    await Blog.updateMany(
        { _id: { $in: reqIds } },
        { $set: { soft_delete: true } }
    );

    const response = response200(`${reqIds.length > 1 ? "Blogs" : "Blog"} removed successfully`, {});
    return res.status(response[0]).json(response[1]);
}));

//For user side
router.get('/blogs', asyncHandler(async (req: Request, res: Response) => {
    const reqQuery = req.query;

    const validation = validateObjectData(get_blogs_schema, reqQuery);
    if (validation.error) throw new CustomError(validation.error.message, 406, validation.error.details[0].context?.key);

    const where: BlogQuery = {
        soft_delete: false,
        is_active: {
            $in: [true],
        },
    }
    if (reqQuery.id) {
        where._id = String(reqQuery.id);
        await Blog.findByIdAndUpdate(String(reqQuery.id), { $inc: { view_count: 1 } });
    }
    var regExp = new RegExp("true");
    reqQuery.featured && (where.featured = regExp.test(String(reqQuery.featured)));

    const blogs = (await Blog.find(where)
        .limit(Number(reqQuery.limit) || 10000)
        .skip(Number(reqQuery.offset) || 0)
    ).map(blog => {
        return {
            id: blog._id,
            title: blog.title,
            description: blog.description,
            quotation: blog.quotation,
            details: blog.details,
            image: blog.image,
            featured: blog.featured,
            createdAt: blog.createdAt.toLocaleDateString('en-GB', date_option),
        }
    });

    const count = await Blog.countDocuments(where);

    const response = response200("Blogs", { count, blogs });
    return res.status(response[0]).json(response[1]);
}));

router.get('/popular-blogs', asyncHandler(async (req: Request, res: Response) => {
    const where = {
        soft_delete: false,
        is_active: true,
    }

    const popular_blogs = (await Blog.find(where)
        .sort({ view_count: -1 })
        .limit(5)
        .skip(0)
    ).map(blog => {
        return {
            id: blog._id,
            title: blog.title,
            createdAt: blog.createdAt.toLocaleDateString('en-GB', date_option),
        }
    });

    const response = response200("Popular blogs", popular_blogs);
    return res.status(response[0]).json(response[1]);
}));

export default router;