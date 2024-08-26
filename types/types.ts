import { extend } from 'joi';
import { Document, Types } from 'mongoose';


//Enums
enum VerificationType {
    FORGOT_PASSWORD = 'FORGOT_PASSWORD',
    USER_REGISTRATION = 'USER_REGISTRATION'
}

enum Gender {
    MALE = 'Male',
    FEMALE = 'Female'
}

enum AddedBy {
    SA = 'SA', // SA (Super Admin)
    AD = 'AD', // AD (Admin) 
    SUB = 'SUB'
}

enum EventRegistrationStatus {
    OPEN = 'Open',
    CLOSED = 'Closed'
}

enum SlotBookingStatus {
    BOOKED = 'Booked',
    COMPLETED = 'Completed',
    CANCELLED = 'Cancelled'
}

enum EventStatus {
    UPCOMING = 'Upcoming',
    COMPLETED = 'Completed'
}

enum GroundType {
    INDOOR = 'Indoor',
    OUTDOOR = 'Outdoor'
}

enum SubscriptionType {
    MONTHLY = 'Monthly',
    QUARTERLY = 'Quarterly',
    HALF_YEARLY = 'Half_Yearly',
    YEARLY = 'Yearly'
}

enum PaymentMode {
    ONLINE = 'Online',
    OFFLINE = 'Cash'
}

enum PromoCodeApplicableFor {
    BOOKINGS = 'Bookings',
    ACADEMY = 'Academy',
    MEMBERSHIP = 'Membership'
}

enum FAQType {
    BOOKING = 'Booking',
    ACADEMY = 'Academy',
    MEMBERSHIP = 'Membership',
    OTHERS = 'Others'
}

enum FeedbackTopic {
    'PAY & PLAY' = 'Pay & Play',
    ACADEMY = 'Academy',
    MEMBERSHIP = 'Membership',
    OTHER = 'Other'
}


//Interfaces
interface IAdmin extends Document {
    email: string;
    gender: Gender
    mobile?: string;
    address?: string;
    is_admin: boolean;
    password?: string;
    last_name?: string;
    is_active: boolean;
    first_name?: string;
    is_subadmin: boolean;
    soft_delete: boolean;
    city?: Types.ObjectId;
    profile_image?: string;
    is_superadmin: boolean;
    email_verified: boolean;
    venue?: Array<Types.ObjectId>;
    salary: number;
}
interface IEmployee extends Document {
    email: string;
    gender: Gender
    mobile?: string;
    address?: string;
    added_by: AddedBy;
    password?: string;
    last_name?: string;
    is_active: boolean;
    first_name?: string;
    soft_delete: boolean;
    city?: Types.ObjectId;
    role?: Types.ObjectId;
    profile_image?: string;
    email_verified: boolean;
    ground?: Array<Types.ObjectId>;
    venue?: Array<Types.ObjectId>;
    salary: number;
}

interface IVerification extends Document {
    token: string;
    soft_delete: boolean;
    type: VerificationType;
    employeeId: Types.ObjectId;
}

interface ICity extends Document {
    name: string;
    is_active: boolean;
    soft_delete: boolean;
}

interface IMenu extends Document {
    name: string;
    is_active: boolean;
    soft_delete: boolean;
}

interface IRole extends Document {
    city: Types.ObjectId;
    venue: Types.ObjectId;
    ground: Types.ObjectId;
    added_by: AddedBy;
    name: string;
    permissions: [{
        menu: Types.ObjectId;
        add: boolean;
        view: boolean;
        update: boolean;
        delete: boolean;
    }],
    is_active: boolean;
    soft_delete: boolean;
}

interface IVenue extends Document {
    name: string;
    type: string;
    address: string;
    image?: string[];
    video?: string[];
    is_active: boolean;
    soft_delete: boolean;
    geo_location: string;
    city: Types.ObjectId;
    supported_sports: Array<Types.ObjectId>;
}

interface IDimension {
    width?: string;
    length?: string;
    boundry_type?: string;
}
interface IGround extends Document {
    name: string;
    video?: string;
    slots: boolean;
    academy: boolean;
    createdAt?: Date;
    is_popular: boolean;
    rules?: {
        allowed: string[];
        not_allowed: string[];
    };
    images?: string[];
    is_active: boolean;
    membership: boolean;
    amenities: string[];
    venue: IVenue["_id"];
    city: Types.ObjectId;
    soft_delete: boolean;
    dimensions: IDimension;
    ground_type: GroundType;
    multisports_support: boolean;
    supported_sports?: Array<Types.ObjectId>;
}

interface IInquiry extends Document {
    first_name: string;
    last_name: string;
    mobile: string;
    inquiry_type: string;
    solved: boolean;
    description: string;
}

interface ISport extends Document {
    name: string;
    icon?: string;
    is_active: boolean;
    soft_delete: boolean;
}

interface ISlotTime extends Document {
    slot: string;
    price: {
        sun: number;
        mon: number;
        tue: number;
        wed: number;
        thu: number;
        fri: number;
        sat: number;
    };
    is_active: boolean;
    city: Types.ObjectId;
    soft_delete: boolean;
    venue: Types.ObjectId;
    ground: Types.ObjectId;
}

interface IAcademy extends Document {
    name: string;
    fees: number;
    video: string;
    images: string[];
    yearly_fee: number;
    is_active: boolean;
    monthly_fee: number;
    description: string;
    soft_delete: boolean;
    city: Types.ObjectId;
    active_days: string[];
    quarterly_fee: number;
    admission_fee: number;
    sport: Types.ObjectId;
    venue: Types.ObjectId;
    ground: Types.ObjectId;
    half_yearly_fee: number;
    max_buffer_days: number;
    slots: {
        morning: Types.ObjectId[];
        evening: Types.ObjectId[];
    };
}

interface IMembership extends Document {
    fees: number;
    is_active: boolean;
    yearly_fee: number;
    monthly_fee: number;
    soft_delete: boolean;
    city: Types.ObjectId;
    admission_fee: number;
    quarterly_fee: number;
    sport: Types.ObjectId;
    venue: Types.ObjectId;
    ground: Types.ObjectId;
    half_yearly_fee: number;
    max_buffer_days: number;
    slots: {
        morning: Types.ObjectId[];
        evening: Types.ObjectId[];
    }
}

interface IEvent extends Document {
    name: string;
    image: string;
    end_date: Date;
    income: [{
        desc: string;
        amount: number;
    }];
    expenses: [{
        desc: string;
        amount: number
    }];
    duration: string;
    start_date: Date;
    is_active: boolean;
    soft_delete: boolean;
    event_status: EventStatus;
    slots: Array<Types.ObjectId>;
    sports?: Array<Types.ObjectId>;
    grounds: Array<Types.ObjectId>;
    registration_status: EventRegistrationStatus;
    createdAt: Date;
    description: string;
}

interface ISlotBooking extends Document {
    date: Date;
    is_active: boolean;
    soft_delete: boolean;
    city: Types.ObjectId;
    venue: Types.ObjectId;
    ground: Types.ObjectId;
    booking_amount: number;
    customer: Types.ObjectId;
    slots: Array<Types.ObjectId>;
    promo_code: Array<Types.ObjectId>;
    booking_status: SlotBookingStatus;
}

interface IBlacklistedToken extends Document {
    token: string;
}

interface ICustomer extends Document {
    otp?: number;
    first_name?: string;
    last_name?: string;
    "guardian's_name"?: string;
    "guardian's_mobile"?: string;
    address?: string;
    email?: string;
    mobile: string;
    attempt: number;
    otp_time?: string;
    is_active: boolean;
    soft_delete: boolean;
    city: Types.ObjectId;
    favorites: string[];
    profile_img: string;
    doc_img: string;
    joined_academies: string[];
    joined_memberships: string[];
}

interface IVenueExpenses extends Document {
    month: string;
    year: string;
    expenses: [{
        desc: string;
        amount: number;
    }];
    city: Types.ObjectId;
    venue: Types.ObjectId;
}

interface IAcademyStudents extends Document {
    shift: string;
    due_date: Date;
    createdAt: Date;
    is_active: boolean;
    payment_date: Date;    
    soft_delete: boolean;
    city: Types.ObjectId;
    sport: Types.ObjectId;
    venue: Types.ObjectId;
    ground: Types.ObjectId;
    academy: Types.ObjectId;
    customer: Types.ObjectId;
    student_unique_id: string;    
}

interface IPromoCode extends Document {
    code: string;
    valid_upto: Date;
    is_active: boolean;
    soft_delete: boolean;
    city: Types.ObjectId;
    max_use_limit: string;
    venue: Types.ObjectId;
    grounds: Types.ObjectId[];
    minimum_amount: number;
    discount_amount: number;
    discount_percentage: number;
    terms_and_conditions: string[];
    applicable_for: PromoCodeApplicableFor;
    academies: string[];
    memberships: string[];
}

interface IAcademyFee extends Document {
    due_date: Date;
    academy: string;
    payment_date: Date;
    academy_fee: number;    
    admission_fee: number;
    student: Types.ObjectId;
    payment_mode: PaymentMode;
    subscription_type: SubscriptionType;
}

interface IMembers extends Document {
    shift: string;
    due_date: Date;
    createdAt: Date;
    is_active: boolean;
    payment_date: Date;
    soft_delete: boolean;
    city: Types.ObjectId;
    sport: Types.ObjectId;
    venue: Types.ObjectId;
    ground: Types.ObjectId;
    member_unique_id: string;
    customer: Types.ObjectId;    
    membership: Types.ObjectId;    
}

interface IMembershipFee extends Document {
    due_date: Date;
    payment_date: Date;
    membership: string;
    joining_fee: number;
    other_charges: number;
    member: Types.ObjectId;
    membership_fee: number;
    subscription_type: SubscriptionType;
    payment_mode: PaymentMode;
}

interface IReservation extends Document {
    city: string;
    total_amount: number;
    discount: number;
    venue: Types.ObjectId;
    ground: Types.ObjectId;    
    customer: Types.ObjectId;
    payment_details: [{
        amount: number;
        payment_date: Date;
        payment_mode: PaymentMode;
    }],
    soft_delete: boolean;
}

interface IReservationSlot extends Document {
    reservation: string;
    date: Date;
    slots: Types.ObjectId;
    booking_status: SlotBookingStatus;
    ground: string;
}

interface IMessage extends Document {
    sender: string;
    text: string;
    createdAt?: Date;
    updatedAt?: Date;
    seen: boolean;
}

interface IChat extends Document {
    user: Types.ObjectId;
    super_admin: Types.ObjectId;
    employee: Types.ObjectId[];
    messages: [IMessage],
    chat_status: string;
    resolved: boolean;
}

interface IHomepageBanner extends Document {
    url: string;
    type: string;
    image: string;
    is_active: boolean;
    soft_delete: boolean;
}

interface IEventRequest extends Document {
    name: string;
    mobile: string;
    is_active: boolean;
    soft_delete: boolean;
    event: Types.ObjectId;
}

interface IFAQs extends Document {
    question: string;
    answer: string;
    type: FAQType;
    is_active: boolean;
    soft_delete: boolean;
}

interface BlogDetail {
    sub_title: string;
    description: string
}

interface IBlog extends Document {
    title: string;
    image: string;
    createdAt: Date;
    quotation: string;
    featured: boolean;
    view_count: number;
    is_active: boolean;
    description: string;
    soft_delete: boolean;
    details: Array<BlogDetail>;
}

interface IFeedback extends Document {
    first_name: string;
    last_name: string;
    mobile: string;
    topic: FeedbackTopic;
    feedback: string;
    soft_delete: boolean;
}

interface IHappyCustomer extends Document {
    name: string;
    review: string;
    is_active: boolean;
    soft_delete: boolean;
}

export {
    IMenu,
    ICity,
    IChat,
    IFAQs,
    IRole,
    IBlog,
    Gender,
    ISport,
    IAdmin,
    IVenue,
    IEvent,
    AddedBy,
    FAQType,
    IGround,
    IAcademy,
    IMessage,
    IInquiry,    
    IMembers,
    IEmployee,
    ISlotTime,
    IFeedback,
    ICustomer,
    GroundType,
    BlogDetail,
    IPromoCode,
    IMembership,
    IAcademyFee,
    EventStatus,
    PaymentMode,
    IReservation,
    ISlotBooking,
    IEventRequest,
    FeedbackTopic,
    IVerification,
    IVenueExpenses,
    IHappyCustomer,
    IMembershipFee,
    IHomepageBanner,
    VerificationType,
    IAcademyStudents,
    IReservationSlot,
    SubscriptionType,
    IBlacklistedToken,
    SlotBookingStatus,
    PromoCodeApplicableFor,
    EventRegistrationStatus,    
}