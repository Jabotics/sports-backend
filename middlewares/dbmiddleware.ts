import CustomError from "../errors/customError";
import { Academy, Admin, Employee, Event, Ground, Membership, Venue } from "../schemas/schema";

const cityDeleteMiddleware = async function (this: any, next: Function) {
    const update = this.getUpdate();
    const id = this.getQuery()["_id"];

    if (update !== null) {
        if ('$set' in update) {
            if (update.$set && 'soft_delete' in update.$set) {
                try {
                    const venueCount = await Venue.countDocuments({ city: id, soft_delete: false });
                    const empCount = await Employee.countDocuments({ city: id, soft_delete: false });
                    const adminCount = await Admin.countDocuments({ city: id, soft_delete: false });
                    if (venueCount > 0 || adminCount > 0 || empCount > 0) {
                        throw new CustomError("Cannot delete city because it is referenced in another documents", 406);
                    }
                }
                catch (err) {
                    throw new CustomError("Cannot delete venue because it is referenced in another documents", 400);
                }
            }
        }
    }
    next();
};

const venueDeleteMiddleware = async function (this: any, next: Function) {
    const update = this.getUpdate();
    const id = this.getQuery()["_id"];

    if (update !== null) {
        if ('$set' in update) {
            if (update.$set && 'soft_delete' in update.$set) {
                try {
                    const groundCount = await Ground.countDocuments({ venue: id, soft_delete: false });
                    const subadminCount = await Admin.countDocuments({ venue: id, soft_delete: false });
                    if (groundCount > 0 || subadminCount > 0) {
                        throw new CustomError("Cannot delete venue because it is referenced in another documents", 406);
                    }
                }
                catch (err) {
                    throw new CustomError("Cannot delete venue because it is referenced in another documents", 400);
                }
            }
        }
    }
    next();
};

const groundDeleteMiddleware = async function (this: any, next: Function) {
    const update = this.getUpdate();
    const id = this.getQuery()["_id"];

    if (update !== null) {
        if ('$set' in update) {
            if (update.$set && 'soft_delete' in update.$set) {
                try {
                    const empCount = await Admin.countDocuments({ ground: id, soft_delete: false });
                    const academyCount = await Academy.countDocuments({ ground: id, soft_delete: false });
                    const membershipCount = await Membership.countDocuments({ ground: id, soft_delete: false });
                    if (empCount > 0 || academyCount > 0 || membershipCount > 0) {
                        throw new CustomError("Cannot delete ground because it is referenced in another documents", 406);
                    }
                }
                catch (err) {
                    throw new CustomError("Cannot delete venue because it is referenced in another documents", 400);
                }
            }
        }
    }
    next();
};

const roleDeleteMiddleware = async function (this: any, next: Function) {
    const update = this.getUpdate();
    const id = this.getQuery()["_id"];

    if (update !== null) {
        if ('$set' in update) {
            if (update.$set && 'soft_delete' in update.$set) {
                try {
                    const empCount = await Employee.countDocuments({ role: id, soft_delete: false });
                    if (empCount > 0) {
                        throw new CustomError("Cannot delete role because it is assigned to employees", 406);
                    }
                }
                catch (err) {
                    throw new CustomError("Cannot delete venue because it is referenced in another documents", 400);
                }
            }
        }
    }
    next();
};

const slotTimeDeleteMiddleware = async function (this: any, next: Function) {
    const update = this.getUpdate();
    const id = this.getQuery()["_id"];

    if (update !== null) {
        if ('$set' in update) {
            if (update.$set && 'soft_delete' in update.$set) {
                try {
                    const academyCount = await Academy.countDocuments({ slotTimes: id, soft_delete: false });
                    const membershipCount = await Membership.countDocuments({ slotTimes: id, soft_delete: false });
                    const eventCount = await Event.countDocuments({ slotTimes: id, soft_delete: false });

                    if (academyCount > 0) {
                        throw new CustomError("Cannot delete slot because it is used to academy", 406);
                    }
                    if (membershipCount > 0) {
                        throw new CustomError("Cannot delete slot because it is used to membership", 406);
                    }
                    if (eventCount > 0) {
                        throw new CustomError("Cannot delete slot because it is used to event", 406);
                    }
                }
                catch (err) {
                    throw new CustomError("Cannot delete venue because it is referenced in another documents", 400);
                }
            }
        }
    }
    next();
};


export {
    cityDeleteMiddleware,
    roleDeleteMiddleware,
    venueDeleteMiddleware,
    groundDeleteMiddleware,
    slotTimeDeleteMiddleware
}