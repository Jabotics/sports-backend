import { Schema, model } from "mongoose";
import {
    ICity,
    IMenu,
    IRole,
    Gender,
    IAdmin,
    IVenue,
    ISport,
    IEvent,
    IGround,
    AddedBy,
    IInquiry,
    IAcademy,
    ICustomer,
    ISlotTime,
    IEmployee,
    EventStatus,
    ISlotBooking,
    IVerification,
    VerificationType,
    SlotBookingStatus,
    IBlacklistedToken,
    EventRegistrationStatus,
    IVenueExpenses,
    GroundType,
    IAcademyStudents,
    IPromoCode,
    IAcademyFee,
    SubscriptionType,
    IMembers,
    IMembershipFee,
    PaymentMode,
    PromoCodeApplicableFor,
    IReservation,
    IReservationSlot,
    IMembership,
    IChat,
    IMessage,
    IHomepageBanner,
    IEventRequest,
    IFAQs,
    FAQType,
    IBlog,
    IFeedback,
    FeedbackTopic,
    IHappyCustomer,
    IPartnerRequest,
    PartnerRequestStatus,
    IGroundReview,
} from "../types/types";
import {
    roleDeleteMiddleware,
    cityDeleteMiddleware,
    venueDeleteMiddleware,
    groundDeleteMiddleware,
    slotTimeDeleteMiddleware
} from "../middlewares/dbmiddleware";

//Admin Schema
const adminSchema = new Schema<IAdmin>({
    first_name: {
        type: String,
        default: ""
    },
    last_name: {
        type: String,
        default: ""
    },
    email: {
        type: String,
        required: true,
    },
    password: {
        type: String,
        default: ""
    },
    mobile: {
        type: String,
        default: ""
    },
    email_verified: {
        type: Boolean,
        default: false
    },
    profile_image: {
        type: String,
        required: false
    },
    address: {
        type: String,
        default: ""
    },
    gender: {
        type: String,
        enum: Gender
    },
    is_superadmin: {
        type: Boolean,
        default: false
    },
    is_admin: {
        type: Boolean,
        default: false
    },
    partner: {
        type: Boolean,
        default: false
    },
    is_active: {
        type: Boolean,
        default: true
    },
    soft_delete: {
        type: Boolean,
        default: false
    },
    city: {
        type: Schema.Types.ObjectId,
        ref: 'City'
    },
    venue: [{
        type: Schema.Types.ObjectId,
        ref: 'Venue'
    }],
    salary: {
        type: Number,
        required: false
    }
}, { timestamps: true });

//Employee Schema
const employeeSchema = new Schema<IEmployee>({
    first_name: {
        type: String,
        default: ""
    },
    last_name: {
        type: String,
        default: ""
    },
    email: {
        type: String,
        required: true
    },
    password: {
        type: String,
        default: ""
    },
    mobile: {
        type: String,
        default: ""
    },
    email_verified: {
        type: Boolean,
        default: false
    },
    profile_image: {
        type: String,
        required: false
    },
    address: {
        type: String,
        default: ""
    },
    gender: {
        type: String,
        enum: Gender
    },
    is_active: {
        type: Boolean,
        default: true
    },
    soft_delete: {
        type: Boolean,
        default: false
    },
    city: {
        type: Schema.Types.ObjectId,
        ref: 'City'
    },
    role: {
        type: Schema.Types.ObjectId,
        ref: 'Role'
    },
    ground: [{
        type: Schema.Types.ObjectId,
        ref: 'Ground'
    }],
    venue: [{
        type: Schema.Types.ObjectId,
        ref: 'Venue'
    }],
    added_by: {
        type: String,
        enum: AddedBy
    },
    salary: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

//Verification Schema
const verificationSchema = new Schema<IVerification>({
    employeeId: {
        type: Schema.Types.ObjectId,
        ref: 'Employee',
        required: true
    },
    type: {
        type: String,
        enum: VerificationType,
        required: true
    },
    token: {
        type: String,
        required: true
    },
    soft_delete: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

//City Schema
const citySchema = new Schema<ICity>({
    name: {
        type: String,
        required: true
    },
    is_active: {
        type: Boolean,
        default: true
    },
    soft_delete: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

//Menu Schema
const menuSchema = new Schema<IMenu>({
    name: {
        type: String,
        required: true,
        max: 20
    },
    is_active: {
        type: Boolean,
        default: true
    },
    soft_delete: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

//Role Schema
const roleSchema = new Schema<IRole>({
    city: {
        type: Schema.Types.ObjectId,
        ref: 'City',
        required: false
    },
    venue: {
        type: Schema.Types.ObjectId,
        ref: 'Venue',
        required: false
    },
    added_by: {
        type: String,
        enum: AddedBy
    },
    name: {
        type: String,
        required: true
    },
    permissions: [{
        menu: {
            type: Schema.Types.ObjectId,
            ref: 'Menu',
            required: true
        },
        add: {
            type: Boolean,
            default: false
        },
        view: {
            type: Boolean,
            default: false
        },
        update: {
            type: Boolean,
            default: false
        },
        delete: {
            type: Boolean,
            default: false
        }
    }],
    is_active: {
        type: Boolean,
        default: true
    },
    soft_delete: {
        type: Boolean,
        default: false
    },
}, { timestamps: true });

//Venue Schema
const venueSchema = new Schema<IVenue>({
    city: {
        type: Schema.Types.ObjectId,
        ref: 'City'
    },
    name: {
        type: String,
        required: true
    },
    address: {
        type: String,
        default: ""
    },
    image: [{
        type: String,
    }],
    video: [{
        type: String
    }],
    supported_sports: [{
        type: Schema.Types.ObjectId,
        ref: 'Sport'
    }],
    geo_location: {
        type: String,
        default: ""
    },
    is_active: {
        type: Boolean,
        default: true
    },
    soft_delete: {
        type: Boolean,
        default: false
    },
}, { timestamps: true });

//Ground Schema
const groundSchema = new Schema<IGround>({
    city: {
        type: Schema.Types.ObjectId,
        ref: 'City',
        required: true
    },
    venue: {
        type: Schema.Types.ObjectId,
        ref: 'Venue',
        required: true
    },
    name: {
        type: String,
        required: true
    },
    dimensions: {
        boundary_type: {
            type: String,
            default: "Not available"
        },
        length: {
            type: String,
            default: "Not available"
        },
        width: {
            type: String,
            default: "Not available"
        }
    },
    amenities: [{
        type: String,
        required: false
    }],
    images: [{
        type: String,
    }],
    video: {
        type: String
    },
    slots: {
        type: Boolean,
        default: true
    },
    academy: {
        type: Boolean,
        default: false
    },
    membership: {
        type: Boolean,
        default: false
    },
    multisports_support: {
        type: Boolean,
        default: false
    },
    rules: {
        allowed: [{
            type: String,
            required: false
        }],
        not_allowed: [{
            type: String,
            required: false
        }]
    },
    supported_sports: [{
        type: Schema.Types.ObjectId,
        ref: 'Sport'
    }],
    ground_type: {
        type: String,
        enum: GroundType,
    },
    is_popular: {
        type: Boolean,
        default: false
    },
    is_active: {
        type: Boolean,
        default: true
    },
    soft_delete: {
        type: Boolean,
        default: false
    },
}, { timestamps: true });

//Inquiry Schema
const inquirySchema = new Schema<IInquiry>({
    first_name: {
        type: String,
        required: true,
    },
    last_name: {
        type: String,
        required: true,
    },
    inquiry_type: {
        type: String,
        required: true
    },
    mobile: {
        type: String,
        required: true,
    },
    solved: {
        type: Boolean,
        default: false
    },
    description: {
        type: String,
        required: true,
        max: 250
    }
}, { timestamps: true });

//Sport Schema
const sportSchema = new Schema<ISport>({
    name: {
        type: String,
        required: true
    },
    icon: {
        type: String,
        required: false
    },
    is_active: {
        type: Boolean,
        default: true
    },
    soft_delete: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

//Slot Time Schema
const slotTimeSchema = new Schema<ISlotTime>({
    city: {
        type: Schema.Types.ObjectId,
        ref: 'City',
        required: true
    },
    venue: {
        type: Schema.Types.ObjectId,
        ref: 'Venue',
        required: true
    },
    ground: {
        type: Schema.Types.ObjectId,
        ref: 'Ground',
        required: true
    },
    slot: {
        type: String,
        required: true
    },
    price: {
        sun: {
            type: Number,
            default: 0
        },
        mon: {
            type: Number,
            default: 0
        },
        tue: {
            type: Number,
            default: 0
        },
        wed: {
            type: Number,
            default: 0
        },
        thu: {
            type: Number,
            default: 0
        },
        fri: {
            type: Number,
            default: 0
        },
        sat: {
            type: Number,
            default: 0
        },
    },
    is_active: {
        type: Boolean,
        default: true
    },
    soft_delete: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

//Academy Schema
const academySchema = new Schema<IAcademy>({
    city: {
        type: Schema.Types.ObjectId,
        ref: 'City',
        required: true
    },
    venue: {
        type: Schema.Types.ObjectId,
        ref: 'Venue',
        required: true
    },
    ground: {
        type: Schema.Types.ObjectId,
        ref: 'Ground',
        required: true
    },
    sport: {
        type: Schema.Types.ObjectId,
        ref: 'Sport',
        required: true
    },
    slots: {
        morning: [{
            type: Schema.Types.ObjectId,
            ref: 'SlotTime',
            required: false
        }],
        evening: [{
            type: Schema.Types.ObjectId,
            ref: 'SlotTime',
            required: false
        }]
    },
    name: {
        type: String,
        required: true
    },
    admission_fee: {
        type: Number,
        required: true
    },
    monthly_fee: {
        type: Number,
        default: 0
    },
    quarterly_fee: {
        type: Number,
        default: 0
    },
    half_yearly_fee: {
        type: Number,
        default: 0
    },
    yearly_fee: {
        type: Number,
        default: 0
    },
    active_days: [{
        type: String,
        required: true
    }],
    description: {
        type: String,
        default: ""
    },
    images: [{
        type: String,
        required: false
    }],
    video: {
        type: String,
        required: false
    },
    max_buffer_days: {
        type: Number,
        default: 0
    },
    is_active: {
        type: Boolean,
        default: true
    },
    soft_delete: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

//Membership Schema
const membershipSchema = new Schema<IMembership>({
    city: {
        type: Schema.Types.ObjectId,
        ref: 'City',
        required: true
    },
    venue: {
        type: Schema.Types.ObjectId,
        ref: 'Venue',
        required: true
    },
    ground: {
        type: Schema.Types.ObjectId,
        ref: 'Ground',
        required: true
    },
    sport: {
        type: Schema.Types.ObjectId,
        ref: 'Sport',
        required: true
    },
    slots: {
        morning: [{
            type: Schema.Types.ObjectId,
            ref: 'SlotTime',
            required: false
        }],
        evening: [{
            type: Schema.Types.ObjectId,
            ref: 'SlotTime',
            required: false
        }]
    },
    admission_fee: {
        type: Number,
        required: true
    },
    monthly_fee: {
        type: Number,
        default: 0
    },
    quarterly_fee: {
        type: Number,
        default: 0
    },
    half_yearly_fee: {
        type: Number,
        default: 0
    },
    yearly_fee: {
        type: Number,
        default: 0
    },
    max_buffer_days: {
        type: Number,
        default: 0
    },
    is_active: {
        type: Boolean,
        default: true
    },
    soft_delete: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

//Event Schema
const eventSchema = new Schema<IEvent>({
    name: {
        type: String,
        required: true,
    },
    duration: {
        type: String,
        required: true,
    },
    grounds: [{
        type: Schema.Types.ObjectId,
        ref: 'Ground',
        required: true
    }],
    sports: [{
        type: Schema.Types.ObjectId,
        ref: 'Sport'
    }],
    registration_status: {
        type: String,
        enum: EventRegistrationStatus,
        default: EventRegistrationStatus.CLOSED
    },
    slots: [{
        type: Schema.Types.ObjectId,
        ref: 'SlotTime',
    }],
    event_status: {
        type: String,
        enum: EventStatus,
        default: EventStatus.UPCOMING
    },
    start_date: {
        type: Date,
        required: true
    },
    end_date: {
        type: Date,
        required: true
    },
    image: {
        type: String,
        default: null
    },
    income: [{
        desc: {
            type: String,
            required: true
        },
        amount: {
            type: Number,
            required: true
        },
    }],
    expenses: [{
        desc: {
            type: String,
            required: true
        },
        amount: {
            type: Number,
            required: true
        },
    }],
    description: {
        type: String,
        default: ""
    },
    is_active: {
        type: Boolean,
        default: true
    },
    soft_delete: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

//Slot Booking Schema
const slotBookingSchema = new Schema<ISlotBooking>({
    city: {
        type: Schema.Types.ObjectId,
        ref: 'City',
        required: true
    },
    venue: {
        type: Schema.Types.ObjectId,
        ref: 'Venue',
        required: true
    },
    ground: {
        type: Schema.Types.ObjectId,
        ref: 'Ground',
        required: true
    },
    promo_code: [{
        type: Schema.Types.ObjectId,
        ref: 'PromoCode',
        required: false
    }],
    booking_amount: {
        type: Number,
        required: true
    },
    customer: {
        type: Schema.Types.ObjectId,
        ref: 'Customer',
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    slots: [{
        type: Schema.Types.ObjectId,
        ref: 'SlotTime',
        required: true
    }],
    booking_status: {
        type: String,
        enum: SlotBookingStatus,
        default: SlotBookingStatus.BOOKED
    },
    is_active: {
        type: Boolean,
        default: true
    },
    soft_delete: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

//Blacklisted Token Schema
const blacklistedTokenSchema = new Schema<IBlacklistedToken>({
    token: {
        type: String,
        required: true
    }
}, { timestamps: true });

//Customer Schema
const customerSchema = new Schema<ICustomer>({
    city: {
        type: Schema.Types.ObjectId,
        ref: 'City',
        required: false
    },
    first_name: {
        type: String,
        required: false
    },
    last_name: {
        type: String,
        required: false
    },
    "guardian's_name": {
        type: String,
        required: false
    },
    "guardian's_mobile": {
        type: String,
        required: false
    },
    address: {
        type: String,
        required: false
    },
    email: {
        type: String,
        required: false
    },
    mobile: {
        type: String,
        required: true
    },
    favorites: [{
        type: String,
        required: false
    }],
    otp: {
        type: Number,
        required: false
    },
    otp_time: {
        type: String,
        required: false
    },
    attempt: {
        type: Number,
        required: false
    },
    profile_img: {
        type: String,
        default: ""
    },
    doc_img: {
        type: String,
        default: ""
    },
    joined_academies: [{
        type: String,
        required: false
    }],
    joined_memberships: [{
        type: String,
        required: false
    }],
    is_active: {
        type: Boolean,
        default: true
    },
    soft_delete: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

//Venue Expense Schema
const venueExpensesSchema = new Schema<IVenueExpenses>({
    month: {
        type: String,
        required: true
    },
    year: {
        type: String,
        required: true
    },
    city: {
        type: Schema.Types.ObjectId,
        ref: 'City',
        required: true
    },
    venue: {
        type: Schema.Types.ObjectId,
        ref: 'Venue',
        required: true
    },
    expenses: [{
        desc: {
            type: String,
            required: true
        },
        amount: {
            type: Number,
            required: true
        }
    }]
}, { timestamps: true });

//Academy Student Schema
const studentsSchema = new Schema<IAcademyStudents>({
    student_unique_id: {
        type: String,
        required: true
    },
    city: {
        type: Schema.Types.ObjectId,
        ref: 'City',
        required: true
    },
    ground: {
        type: Schema.Types.ObjectId,
        ref: 'Ground',
        required: true
    },
    venue: {
        type: Schema.Types.ObjectId,
        ref: 'Venue',
        required: true
    },
    sport: {
        type: Schema.Types.ObjectId,
        ref: 'Sport',
        required: true
    },
    customer: {
        type: Schema.Types.ObjectId,
        ref: 'Customer',
        required: true
    },
    academy: {
        type: Schema.Types.ObjectId,
        ref: 'Academy',
        required: true
    },
    payment_date: {
        type: Date,
        required: true
    },
    due_date: {
        type: Date,
        required: true
    },
    shift: {
        type: String,
        required: true
    },
    is_active: {
        type: Boolean,
        default: true
    },
    soft_delete: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

//Promo Code Schema
const promoCodeSchema = new Schema<IPromoCode>({
    grounds: [{
        type: Schema.Types.ObjectId,
        ref: 'Ground',
        required: true
    }],
    venue: {
        type: Schema.Types.ObjectId,
        ref: 'Venue',
        required: true
    },
    city: {
        type: Schema.Types.ObjectId,
        ref: 'City',
        required: true
    },
    code: {
        type: String,
        required: true
    },
    discount_percentage: {
        type: Number,
        default: 0
    },
    discount_amount: {
        type: Number,
        default: 0
    },
    minimum_amount: {
        type: Number,
        required: true
    },
    terms_and_conditions: [{
        type: String,
        required: false
    }],
    max_use_limit: {
        type: String,
        enum: ['Single', 'Multiple'],
        required: true
    },
    valid_upto: {
        type: Date,
        required: true
    },
    applicable_for: {
        type: String,
        enum: PromoCodeApplicableFor,
        required: true
    },
    academies: [{
        type: String,
        required: false
    }],
    memberships: [{
        type: String,
        required: false
    }],
    is_active: {
        type: Boolean,
        default: true
    },
    soft_delete: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

//Academy Fee Schema
const academyFeeSchema = new Schema<IAcademyFee>({
    student: {
        type: Schema.Types.ObjectId,
        ref: 'Student',
        required: true
    },
    academy: {
        type: String,
        required: true
    },
    subscription_type: {
        type: String,
        enum: SubscriptionType,
        required: true
    },
    payment_date: {
        type: Date,
        required: true
    },
    due_date: {
        type: Date,
        required: true
    },
    academy_fee: {
        type: Number,
        required: true
    },
    admission_fee: {
        type: Number,
        default: 0,
    },
    payment_mode: {
        type: String,
        enum: PaymentMode,
        required: true
    }
});

//Member Schema
const membersSchema = new Schema<IMembers>({
    member_unique_id: {
        type: String,
        required: true
    },
    city: {
        type: Schema.Types.ObjectId,
        ref: 'City',
        required: true
    },
    ground: {
        type: Schema.Types.ObjectId,
        ref: 'Ground',
        required: true
    },
    venue: {
        type: Schema.Types.ObjectId,
        ref: 'Venue',
        required: true
    },
    sport: {
        type: Schema.Types.ObjectId,
        ref: 'Sport',
        required: true
    },
    customer: {
        type: Schema.Types.ObjectId,
        ref: 'Customer',
        required: true
    },
    membership: {
        type: Schema.Types.ObjectId,
        ref: 'Membership',
        required: true
    },
    shift: {
        type: String,
        required: true
    },
    payment_date: {
        type: Date,
        required: true
    },
    due_date: {
        type: Date,
        required: true
    },
    is_active: {
        type: Boolean,
        default: true
    },
    soft_delete: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

//Membership Fee Schema
const membershipFeeSchema = new Schema<IMembershipFee>({
    member: {
        type: Schema.Types.ObjectId,
        ref: 'Member',
        required: true
    },
    membership: {
        type: String,
        required: true
    },
    subscription_type: {
        type: String,
        enum: SubscriptionType,
        required: true
    },
    payment_date: {
        type: Date,
        required: true
    },
    due_date: {
        type: Date,
        required: true
    },
    membership_fee: {
        type: Number,
        required: true
    },
    joining_fee: {
        type: Number,
        default: 0,
    },
    other_charges: {
        type: Number,
        default: 0
    },
    payment_mode: {
        type: String,
        enum: PaymentMode,
        required: true
    }
});

//Reservation Schema
const reservationSchema = new Schema<IReservation>({
    customer: {
        type: Schema.Types.ObjectId,
        ref: 'Customer',
        required: true
    },
    city: {
        type: String,
        required: true
    },
    venue: {
        type: Schema.Types.ObjectId,
        ref: 'Venue',
        required: true
    },
    ground: {
        type: Schema.Types.ObjectId,
        ref: 'Ground',
        required: true
    },
    total_amount: {
        type: Number,
        required: true,
    },
    discount: {
        type: Number,
        default: 0
    },
    payment_details: [{
        payment_date: {
            type: Date,
            required: true
        },
        amount: {
            type: Number,
            required: true
        },
        payment_mode: {
            type: String,
            enum: PaymentMode,
            required: true
        },
    }],
    soft_delete: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

//Reservation Slot Schema
const reservationSlot = new Schema<IReservationSlot>({
    reservation: {
        type: String,
        required: true
    },
    ground: {
        type: String,
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    slots: [{
        type: Schema.Types.ObjectId,
        ref: 'SlotTime',
        required: true
    }],
    booking_status: {
        type: String,
        enum: SlotBookingStatus,
        default: SlotBookingStatus.BOOKED
    },
}, { timestamps: true });

//Message Schema
const messageSchema = new Schema<IMessage>({
    sender: {
        type: String,
        required: true
    },
    text: {
        type: String,
        required: true
    },
    seen: {
        type: Boolean,
        default: false
    }
}, { timestamps: true })

//Chat Schema
const chatSchema = new Schema<IChat>({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'Customer',
        required: true
    },
    super_admin: {
        type: Schema.Types.ObjectId,
        ref: 'Admin',
        required: true
    },
    employee: [{
        type: Schema.Types.ObjectId,
        ref: 'Employee',
        required: false
    }],
    messages: [messageSchema],
    chat_status: {
        type: String,
        default: 'Unsolved'
    },
    resolved: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

//Homepage Banner Schema
const homepageBannerSchema = new Schema<IHomepageBanner>({
    url: {
        type: String,
        default: ""
    },
    image: {
        type: String,
        default: ""
    },
    type: {
        type: String,
        required: true
    },
    is_active: {
        type: Boolean,
        default: true
    },
    soft_delete: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

//Event Request Schema
const eventRequestSchema = new Schema<IEventRequest>({
    event: {
        type: Schema.Types.ObjectId,
        ref: 'Event',
        required: true
    },
    name: {
        type: String,
        required: true
    },
    mobile: {
        type: String,
        required: true
    },
    is_active: {
        type: Boolean,
        default: true
    },
    soft_delete: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

//FAQ Schema
const faqSchema = new Schema<IFAQs>({
    question: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: FAQType,
        required: true
    },
    answer: {
        type: String,
        required: true
    },
    is_active: {
        type: Boolean,
        default: true
    },
    soft_delete: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

//Blog Schema
const blogSchema = new Schema<IBlog>({
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    quotation: {
        type: String,
        required: true
    },
    details: [{
        sub_title: {
            type: String,
            required: false
        },
        description: {
            type: String,
            required: false
        }
    }],
    image: {
        type: String,
        required: false
    },
    featured: {
        type: Boolean,
        default: false
    },
    view_count: {
        type: Number,
        default: 0
    },
    is_active: {
        type: Boolean,
        default: true
    },
    soft_delete: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

//Customer Feedback Schema
const feedbackSchema = new Schema<IFeedback>({
    first_name: {
        type: String,
        required: true
    },
    last_name: {
        type: String,
        required: true
    },
    mobile: {
        type: String,
        required: true
    },
    topic: {
        type: String,
        enum: FeedbackTopic,
        required: true
    },
    feedback: {
        type: String,
        required: true
    },
    soft_delete: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

//Happy Customers Schema
const happyCustomerSchema = new Schema<IHappyCustomer>({
    name: {
        type: String,
        required: true
    },
    review: {
        type: String,
        required: true
    },
    is_active: {
        type: Boolean,
        default: true
    },
    soft_delete: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

const partnerRequestSchema = new Schema<IPartnerRequest>({
    city: {
        type: Schema.Types.ObjectId,
        ref: 'City',
        required: true
    },
    first_name: {
        type: String,
        required: true
    },
    last_name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    mobile: {
        type: String,
        required: true
    },
    venue_name: {
        type: String,
        required: true
    },
    address: {
        type: String,
        required: true
    },
    request_status: {
        type: String,
        enum: PartnerRequestStatus,
        default: PartnerRequestStatus.PENDING
    },
    soft_delete: {
        type: Boolean,
        default: false
    }
});

const groundReviewSchema = new Schema<IGroundReview>({
    customer: {
        type: Schema.Types.ObjectId,
        ref: 'Customer',
        required: true
    },
    ground: {
        type: Schema.Types.ObjectId,
        ref: 'Ground',
        required: true
    },
    review: {
        type: String,
        required: true
    },
    rating: {
        type: Number,
        required: true
    },
    soft_delete: {
        type: Boolean,
        default: false
    }
});

//Middlewares
citySchema.pre('updateMany', { query: true, document: false }, cityDeleteMiddleware);
roleSchema.pre('updateMany', { query: true, document: false }, roleDeleteMiddleware);
venueSchema.pre('updateMany', { query: true, document: false }, venueDeleteMiddleware);
groundSchema.pre('updateMany', { query: true, document: false }, groundDeleteMiddleware);
slotTimeSchema.pre('updateMany', { query: true, document: false }, slotTimeDeleteMiddleware);

//TTL indexing
blacklistedTokenSchema.index({ createdAt: 1 }, { expireAfterSeconds: 604800 });

//Indexing
customerSchema.index({ mobile: 'text' });

//Schema Models
const FAQ = model<IFAQs>("FAQ", faqSchema);
const Blog = model<IBlog>("Blog", blogSchema);
const City = model<ICity>("City", citySchema);
const Menu = model<IMenu>("Menu", menuSchema);
const Role = model<IRole>("Role", roleSchema);
const Chat = model<IChat>("Chat", chatSchema);
const Venue = model<IVenue>("Venue", venueSchema);
const Admin = model<IAdmin>("Admin", adminSchema);
const Sport = model<ISport>("Sport", sportSchema);
const Event = model<IEvent>("Event", eventSchema);
const Ground = model<IGround>("Ground", groundSchema);
const Member = model<IMembers>("Member", membersSchema);
const Inquiry = model<IInquiry>("Inquiry", inquirySchema);
const Academy = model<IAcademy>("Academy", academySchema);
const Employee = model<IEmployee>("Employee", employeeSchema);
const Customer = model<ICustomer>("Customer", customerSchema);
const SlotTime = model<ISlotTime>("SlotTime", slotTimeSchema);
const Feedback = model<IFeedback>("Feedback", feedbackSchema);
const PromoCode = model<IPromoCode>("PromoCode", promoCodeSchema);
const Student = model<IAcademyStudents>("Student", studentsSchema);
const Membership = model<IMembership>("Membership", membershipSchema);
const AcademyFee = model<IAcademyFee>("AcademyFee", academyFeeSchema);
const Reservation = model<IReservation>("Reservation", reservationSchema);
const SlotBooking = model<ISlotBooking>("SlotBooking", slotBookingSchema);
const EventRequest = model<IEventRequest>("EventRequest", eventRequestSchema);
const GroundReview = model<IGroundReview>("GroundReview", groundReviewSchema);
const Verification = model<IVerification>("Verification", verificationSchema);
const VenueExpense = model<IVenueExpenses>("VenueExpense", venueExpensesSchema);
const HappyCustomer = model<IHappyCustomer>("HappyCustomer", happyCustomerSchema);
const MembershipFee = model<IMembershipFee>("MembershipFee", membershipFeeSchema);
const ReservationSlot = model<IReservationSlot>("ReservationSlot", reservationSlot);
const HomepageBanner = model<IHomepageBanner>("HomepageBanner", homepageBannerSchema);
const PartnerRequest = model<IPartnerRequest>("PartnerRequest", partnerRequestSchema);
const BlacklistedToken = model<IBlacklistedToken>("BlacklistedToken", blacklistedTokenSchema);

export {
    FAQ,
    Menu,
    City, citySchema,
    Role,
    Chat,
    Blog,
    Admin,
    Sport,
    Venue, venueSchema,
    Event,
    Member,
    Ground, groundSchema,
    Inquiry,
    Academy,
    Student,
    Employee,
    SlotTime,
    Feedback,
    Customer,
    PromoCode,
    Membership,
    AcademyFee,
    SlotBooking,
    Reservation,
    Verification,
    EventRequest,
    VenueExpense,
    GroundReview,
    MembershipFee,
    HappyCustomer,
    HomepageBanner,
    PartnerRequest,
    ReservationSlot,
    BlacklistedToken,
}
