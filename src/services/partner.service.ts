import prisma from '../config/database';
import { Booking } from '@prisma/client';
import logger from '../utils/logger';
import { NotFoundError, BadRequestError } from '../utils/errors';
import { PartnerMatchingService } from '../services/partner-matching.service';
import { getIO } from '../socket/socket.server';
import { hashPassword } from '../utils/encryption';

export class PartnerService {
    /**
     * Partner accepts a booking (Ola-like flow)
     * Only one partner can accept - first come first served
     */
    async acceptBookingByPartner(bookingId: string, userId: string): Promise<Booking> {
        logger.info(`Partner ${userId} attempting to accept booking ${bookingId}`);

        // Get partner record from user_id
        const partner = await prisma.servicePartner.findUnique({
            where: { user_id: userId },
            include: { user: true },
        });

        if (!partner) {
            throw new NotFoundError('Partner record not found');
        }

        if (partner.is_on_hold) {
            throw new BadRequestError('Your account is currently on hold. You cannot accept new bookings.');
        }

        if (partner.is_blacklisted) {
            throw new BadRequestError('Your account has been blacklisted. You cannot accept new bookings.');
        }

        if ((partner as any).partner_status === 'SUSPENDED' || (partner as any).partner_status === 'INACTIVE' || (partner as any).partner_status === 'REJECTED') {
            throw new BadRequestError(`Your account is currently ${(partner as any).partner_status.toLowerCase()}. You cannot accept new bookings.`);
        }

        const matching = new PartnerMatchingService();

        // Check if booking is still available (race condition protection)
        const isAvailable = await matching.isBookingAvailable(bookingId);

        if (!isAvailable) {
            throw new BadRequestError('Booking is no longer available. Another partner may have accepted it.');
        }

        // Use transaction for atomic update (prevents race conditions)
        const booking = await prisma.$transaction(async (tx) => {
            // Double-check availability inside transaction
            const currentBooking = await tx.booking.findUnique({
                where: { id: bookingId },
                select: { status: true, partner_id: true },
            });

            if (!currentBooking) {
                throw new NotFoundError('Booking not found');
            }

            if (currentBooking.partner_id ||
                (currentBooking.status !== 'SEARCHING_PARTNER' && currentBooking.status !== 'PENDING')) {
                throw new BadRequestError('Booking already assigned');
            }

            // Assign partner
            const updated = await tx.booking.update({
                where: { id: bookingId },
                data: {
                    partner_id: partner.id,
                    partner_assigned_at: new Date(),
                    status: 'PARTNER_ASSIGNED',
                },
                include: {
                    customer: {
                        select: {
                            id: true,
                            full_name: true,
                            email: true,
                        },
                    },
                    items: {
                        include: {
                            service: true,
                        },
                    },
                },
            });

            // Add status history
            await tx.bookingStatusHistory.create({
                data: {
                    booking_id: bookingId,
                    status: 'PARTNER_ASSIGNED',
                    changed_by: userId,
                    notes: `Accepted by ${partner.user.full_name}`,
                },
            });

            return updated;
        });

        logger.info(`Partner ${partner.user.full_name} successfully accepted booking ${booking.booking_number}`);

        // Notify customer via Socket.IO
        try {
            const io = getIO();
            io.to(booking.customer_id).emit('partner_assigned', {
                bookingId: booking.id,
                bookingNumber: booking.booking_number,
                partner: {
                    id: partner.id,
                    name: partner.user.full_name,
                    phone: partner.user.phone_number,
                },
            });

            // Notify other partners that booking is taken
            io.emit('booking_taken', {
                bookingId: booking.id,
            });
        } catch (error) {
            logger.error('Failed to send Socket.IO notifications:', error);
        }

        return booking;
    }

    /**
     * Partner rejects a booking
     * Booking stays in queue for other partners
     */
    async rejectBookingByPartner(bookingId: string, userId: string, reason?: string): Promise<void> {
        logger.info(`Partner ${userId} rejecting booking ${bookingId}. Reason: ${reason || 'Not specified'}`);

        // Get partner record
        const partner = await prisma.servicePartner.findUnique({
            where: { user_id: userId },
        });

        if (!partner) {
            throw new NotFoundError('Partner record not found');
        }

        // Verify booking exists and is in correct state
        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
        });

        if (!booking) {
            throw new NotFoundError('Booking not found');
        }

        // Record rejection
        const matching = new PartnerMatchingService();
        await matching.recordRejection(bookingId, partner.user_id, reason);

        // Check if there are other available partners
        try {
            const availablePartners = await matching.findAvailablePartners(bookingId);

            if (availablePartners.length > 0) {
                logger.info(`${availablePartners.length} other partners still available for booking ${bookingId}`);
                // Booking stays in SEARCHING_PARTNER status
            } else {
                logger.warn(`No more partners available for booking ${bookingId}`);
                // Update booking status to PARTNER_NOT_FOUND
                await prisma.booking.update({
                    where: { id: bookingId },
                    data: { status: 'PARTNER_NOT_FOUND' } as any,
                });

                await prisma.bookingStatusHistory.create({
                    data: {
                        booking_id: bookingId,
                        status: 'PARTNER_NOT_FOUND' as any,
                        changed_by: 'system',
                        notes: 'All available partners rejected the booking',
                    },
                });

                // Notify customer
                const io = getIO();
                io.to(booking.customer_id).emit('no_partner_found', {
                    bookingId: booking.id,
                    bookingNumber: booking.booking_number,
                });
            }
        } catch (error) {
            logger.error('Error checking available partners after rejection:', error);
        }

        logger.info(`Partner ${partner.id} rejection recorded for booking ${bookingId}`);
    }

    // =========================================================================
    // NEW METHODS ADDED TO MATCH CONTROLLER EXPECTATIONS
    // =========================================================================

    async getAllPartners(filters: any, _role: string) {
        const {
            search,
            status,
            partnerStatus,
            type,
            categoryId,
            serviceId,
            documentStatus,
            city,
            page = 1,
            limit = 10,
            per_page
        } = filters;

        const pageNum = Number(page) || 1;
        const pageSize = Number(per_page || limit) || 10;
        const skip = (pageNum - 1) * pageSize;

        const where: any = {
            role: { in: ['SERVICE_PARTNER', 'BUSINESS_PARTNER'] as any[] },
            is_deleted: false,
        };

        const andConditions: any[] = [];

        // Partner Type (Individual or Business)
        if (type) {
            if (type === 'INDIVIDUAL' || type === 'SERVICE_PARTNER') {
                where.role = 'SERVICE_PARTNER';
            } else if (type === 'BUSINESS' || type === 'BUSINESS_PARTNER') {
                where.role = 'BUSINESS_PARTNER';
            }
        }

        // Partner Status (PENDING, UNDER_REVIEW, APPROVED, ACTIVE, INACTIVE, REJECTED, SUSPENDED)
        const pStatus = partnerStatus || (['PENDING', 'UNDER_REVIEW', 'APPROVED', 'ACTIVE', 'INACTIVE', 'REJECTED', 'SUSPENDED'].includes(status?.toUpperCase()) ? status.toUpperCase() : null);
        if (pStatus) {
            andConditions.push({
                OR: [
                    { service_partner: { partner_status: pStatus as any } },
                    { business_partner: { partner_status: pStatus as any } },
                ],
            });
        }

        // Document Verification Status (PENDING, APPROVED / VERIFIED, REJECTED)
        const docStatus = documentStatus || (!pStatus && status ? status : null);
        if (docStatus) {
            const mappedStatus = docStatus.toUpperCase() === 'VERIFIED' ? 'APPROVED' : docStatus.toUpperCase();
            andConditions.push({
                OR: [
                    { service_partner: { kyc_status: mappedStatus as any } },
                    { business_partner: { kyc_status: mappedStatus as any } },
                ],
            });
        }

        // Category Filter (Primary Category or assigned services category)
        if (categoryId) {
            andConditions.push({
                OR: [
                    { service_partner: { category_id: categoryId } },
                    { service_partner: { services: { some: { service: { category_id: categoryId } } } } },
                    { business_partner: { category_id: categoryId } },
                    { business_partner: { partner_services: { some: { service: { category_id: categoryId } } } } },
                ],
            });
        }

        // Service Filter
        if (serviceId) {
            andConditions.push({
                OR: [
                    { service_partner: { services: { some: { service_id: serviceId } } } },
                    { business_partner: { partner_services: { some: { service_id: serviceId } } } },
                ],
            });
        }

        // City Filter
        if (city) {
            andConditions.push({
                OR: [
                    { profile: { city: { contains: city, mode: 'insensitive' } } },
                    { business_partner: { city: { contains: city, mode: 'insensitive' } } },
                ],
            });
        }

        // Search: Name, Mobile, Email, Partner ID
        if (search) {
            andConditions.push({
                OR: [
                    { full_name: { contains: search, mode: 'insensitive' } },
                    { email: { contains: search, mode: 'insensitive' } },
                    { phone_number: { contains: search } },
                    { id: { contains: search, mode: 'insensitive' } },
                    { service_partner: { id: { contains: search, mode: 'insensitive' } } },
                    { business_partner: { id: { contains: search, mode: 'insensitive' } } },
                ],
            });
        }

        if (andConditions.length > 0) {
            where.AND = andConditions;
        }

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                include: {
                    profile: true,
                    service_partner: {
                        include: {
                            category: true,
                            services: {
                                include: {
                                    service: {
                                        include: { category: true }
                                    }
                                }
                            },
                            kyc_documents: true,
                        }
                    },
                    business_partner: {
                        include: {
                            category: true,
                            partner_services: {
                                include: {
                                    service: {
                                        include: { category: true }
                                    }
                                }
                            },
                            kyc_documents: true,
                        }
                    },
                },
                skip,
                take: pageSize,
                orderBy: { created_at: 'desc' }
            }),
            prisma.user.count({ where })
        ]);

        // Map users to partner structure
        const partners = users.map(user => {
            const partnerData: any = user.service_partner || user.business_partner;
            const profile = user.profile;
            const assignedServices = (partnerData?.services || partnerData?.partner_services || []).map((ps: any) => ({
                id: ps.service?.id,
                name: ps.service?.name,
                categoryName: ps.service?.category?.name,
                categoryId: ps.service?.category_id,
                price: ps.custom_price || ps.service?.base_price,
            }));

            // Distinct categories
            const categoryNamesSet = new Set<string>();
            if (partnerData?.category?.name) categoryNamesSet.add(partnerData.category.name);
            assignedServices.forEach((s: any) => {
                if (s.categoryName) categoryNamesSet.add(s.categoryName);
            });

            return {
                id: partnerData?.id || user.id,
                partnerId: partnerData?.id,
                userId: user.id,
                fullName: user.full_name,
                email: user.email,
                phoneNumber: user.phone_number,
                alternatePhone: partnerData?.alternate_phone,
                role: user.role,
                partnerType: user.role === 'BUSINESS_PARTNER' ? 'BUSINESS' : 'INDIVIDUAL',
                partnerStatus: partnerData?.partner_status || 'PENDING',
                status: partnerData?.partner_status || 'PENDING',
                kycStatus: partnerData?.kyc_status || 'PENDING',
                availabilityStatus: partnerData?.availability_status || 'OFFLINE',
                createdAt: user.created_at,
                isActive: user.is_active,
                category: partnerData?.category?.name || Array.from(categoryNamesSet)[0] || 'Unassigned',
                categoryId: partnerData?.category_id,
                categoryNames: Array.from(categoryNamesSet),
                services: assignedServices,
                servicesCount: assignedServices.length,
                experienceYears: partnerData?.experience_years || 0,
                coverageAreas: partnerData?.coverage_areas || [],
                city: profile?.city || partnerData?.city || 'Chennai',
                state: profile?.state || partnerData?.state || 'Tamil Nadu',
                address: profile?.address || partnerData?.address,
                addressLine2: partnerData?.address_line2,
                postalCode: profile?.postal_code || partnerData?.postal_code,
                gender: profile?.gender,
                dateOfBirth: profile?.date_of_birth,
                avatarUrl: profile?.avatar_url,
                documentsCount: partnerData?.kyc_documents?.length || 0,
                documents: partnerData?.kyc_documents || [],
                bankDetails: {
                    accountHolderName: partnerData?.bank_account_name,
                    bankName: partnerData?.bank_name,
                    accountNumber: partnerData?.bank_account_number,
                    ifscCode: partnerData?.bank_ifsc_code,
                    upiId: partnerData?.upi_id,
                },
                isOnHold: partnerData?.is_on_hold || false,
                is_on_hold: partnerData?.is_on_hold || false,
                holdReason: partnerData?.hold_reason || null,
                isBlacklisted: partnerData?.is_blacklisted || false,
                is_blacklisted: partnerData?.is_blacklisted || false,
                blacklistReason: partnerData?.blacklist_reason || null,
                strikeCount: partnerData?.strike_count || 0,
                strike_count: partnerData?.strike_count || 0,
                adminRemarks: partnerData?.admin_remarks || null,
                admin_remarks: partnerData?.admin_remarks || null,
                totalBookings: partnerData?.total_bookings || 0,
                completedBookings: partnerData?.completed_bookings || 0,
                avgRating: partnerData?.avg_rating || 0,
            };
        });

        return {
            partners,
            pagination: {
                total,
                page: pageNum,
                limit: pageSize,
                totalPages: Math.ceil(total / pageSize)
            }
        };
    }

    async getPartnerById(id: string, _userId?: string, _role?: string) {
        // Try finding in servicePartner
        let partner: any = await prisma.servicePartner.findFirst({
            where: {
                OR: [{ id }, { user_id: id }]
            },
            include: {
                user: {
                    include: { profile: true }
                },
                category: true,
                services: {
                    include: {
                        service: {
                            include: { category: true }
                        }
                    }
                },
                kyc_documents: {
                    orderBy: { created_at: 'desc' }
                },
                status_history: {
                    orderBy: { created_at: 'desc' }
                },
                bookings: {
                    take: 10,
                    orderBy: { created_at: 'desc' },
                    include: {
                        customer: {
                            select: { id: true, full_name: true, phone_number: true, email: true }
                        },
                        items: {
                            include: { service: true }
                        }
                    }
                }
            }
        });

        let partnerType: 'INDIVIDUAL' | 'BUSINESS' = 'INDIVIDUAL';

        // If not found, try businessPartner
        if (!partner) {
            partner = await prisma.businessPartner.findFirst({
                where: {
                    OR: [{ id }, { user_id: id }]
                },
                include: {
                    user: {
                        include: { profile: true }
                    },
                    category: true,
                    partner_services: {
                        include: {
                            service: {
                                include: { category: true }
                            }
                        }
                    },
                    kyc_documents: {
                        orderBy: { created_at: 'desc' }
                    },
                    status_history: {
                        orderBy: { created_at: 'desc' }
                    },
                    bookings: {
                        take: 10,
                        orderBy: { created_at: 'desc' },
                        include: {
                            customer: {
                                select: { id: true, full_name: true, phone_number: true, email: true }
                            },
                            items: {
                                include: { service: true }
                            }
                        }
                    }
                }
            });
            partnerType = 'BUSINESS';
        }

        if (!partner) throw new NotFoundError('Partner not found');

        const user = partner.user;
        const profile = user.profile;
        const totalEarnings = await this.getTotalEarnings(partner.id, partnerType === 'BUSINESS' ? 'BUSINESS' : 'SERVICE');

        const assignedServices = (partner.services || partner.partner_services || []).map((ps: any) => ({
            id: ps.service?.id,
            partnerServiceId: ps.id,
            name: ps.service?.name,
            categoryName: ps.service?.category?.name,
            categoryId: ps.service?.category_id,
            price: ps.custom_price || ps.service?.base_price,
            duration: ps.service?.duration,
            isAvailable: ps.is_available,
        })) || [];

        return {
            id: partner.id,
            partnerId: partner.id,
            userId: user.id,
            fullName: user.full_name,
            email: user.email,
            phoneNumber: user.phone_number,
            alternatePhone: partner.alternate_phone,
            role: user.role,
            partnerType,
            partnerStatus: partner.partner_status || 'PENDING',
            status: partner.partner_status || 'PENDING',
            kycStatus: partner.kyc_status,
            kyc_status: partner.kyc_status,
            kycVerifiedAt: partner.kyc_verified_at,
            availabilityStatus: partner.availability_status || 'OFFLINE',
            availability_status: partner.availability_status || 'OFFLINE',
            serviceRadius: partner.service_radius,
            commissionRate: partner.commission_rate || 0.1,
            experienceYears: partner.experience_years || 0,
            coverageAreas: partner.coverage_areas || [],
            businessName: partner.business_name,
            businessType: partner.business_type,
            gstNumber: partner.gst_number,
            panNumber: partner.pan_number,
            
            // Address Info
            address: profile?.address || partner.address,
            addressLine1: profile?.address || partner.address,
            addressLine2: partner.address_line2,
            city: profile?.city || partner.city,
            state: profile?.state || partner.state,
            postalCode: profile?.postal_code || partner.postal_code,
            latitude: profile?.latitude || partner.current_latitude,
            longitude: profile?.longitude || partner.current_longitude,

            // Personal Info
            gender: profile?.gender,
            dateOfBirth: profile?.date_of_birth,
            avatarUrl: profile?.avatar_url,

            // Category & Services
            category: partner.category?.name,
            categoryId: partner.category_id,
            services: assignedServices,

            // Bank Details
            bankDetails: {
                accountHolderName: partner.bank_account_name || user.full_name,
                bankName: partner.bank_name,
                accountNumber: partner.bank_account_number,
                ifscCode: partner.bank_ifsc_code,
                upiId: partner.upi_id,
            },

            // Documents
            documents: partner.kyc_documents || [],
            kyc_documents: partner.kyc_documents || [],

            // History
            statusHistory: partner.status_history || [],
            status_history: partner.status_history || [],

            // Bookings
            bookings: partner.bookings || [],

            createdAt: user.created_at,
            isActive: user.is_active,
            totalBookings: partner.total_bookings || 0,
            total_bookings: partner.total_bookings || 0,
            completedBookings: partner.completed_bookings || 0,
            completed_bookings: partner.completed_bookings || 0,
            avgRating: partner.avg_rating || 0,
            avg_rating: partner.avg_rating || 0,
            completionRate: partner.completion_rate || 0,
            totalEarnings,
            total_earnings: totalEarnings,
            isOnHold: partner.is_on_hold || false,
            is_on_hold: partner.is_on_hold || false,
            holdReason: partner.hold_reason || null,
            isBlacklisted: partner.is_blacklisted || false,
            is_blacklisted: partner.is_blacklisted || false,
            blacklistReason: partner.blacklist_reason || null,
            strikeCount: partner.strike_count || 0,
            strike_count: partner.strike_count || 0,
            adminRemarks: partner.admin_remarks || null,
            admin_remarks: partner.admin_remarks || null,
        };
    }

    async createServicePartner(data: any, adminUserId?: string, _role?: string) {
        const fullName = data.fullName || data.partnerName || data.name;
        const phoneNumber = data.phoneNumber || data.mobileNumber || data.mobile;

        if (!fullName) {
            throw new BadRequestError('Partner Name is required');
        }
        if (!phoneNumber) {
            throw new BadRequestError('Mobile Number is required');
        }

        const addressLine1 = data.addressLine1 || data.address;
        const city = data.city;
        const state = data.state;
        const postalCode = data.postalCode || data.pincode;

        if (!addressLine1 || !city || !state || !postalCode) {
            throw new BadRequestError('Complete address (Address Line 1, City, State, Pincode) is required');
        }

        // Clean phone number
        const cleanedPhone = phoneNumber.replace(/\s+/g, '');

        // Check if phone already registered
        const existingUserByPhone = await prisma.user.findFirst({
            where: { phone_number: cleanedPhone, is_deleted: false }
        });
        if (existingUserByPhone) {
            throw new BadRequestError(`A user with mobile number ${cleanedPhone} already exists`);
        }

        const email = data.emailAddress || data.email || `partner.${cleanedPhone}@snearal.com`;
        const existingUserByEmail = await prisma.user.findFirst({
            where: { email: email.toLowerCase(), is_deleted: false }
        });
        if (existingUserByEmail) {
            throw new BadRequestError(`A user with email ${email} already exists`);
        }

        const isBusiness = data.partnerType === 'BUSINESS' || data.partnerType === 'BUSINESS_PARTNER';
        const userRole = isBusiness ? 'BUSINESS_PARTNER' : 'SERVICE_PARTNER';

        // Hash default password
        const hashedPassword = await hashPassword('Partner@123');

        // Resolve primary category
        let primaryCategoryId = data.categoryId;
        if (!primaryCategoryId && Array.isArray(data.categoryIds) && data.categoryIds.length > 0) {
            primaryCategoryId = data.categoryIds[0];
        }

        // Transactional creation
        const result = await prisma.$transaction(async (tx) => {
            // 1. Create User
            const user = await tx.user.create({
                data: {
                    full_name: fullName,
                    phone_number: cleanedPhone,
                    email: email.toLowerCase(),
                    password: hashedPassword,
                    role: userRole,
                    phone_verified: true,
                    email_verified: Boolean(data.emailAddress || data.email),
                    is_active: true,
                }
            });

            // 2. Create Profile
            await tx.profile.create({
                data: {
                    user_id: user.id,
                    address: addressLine1,
                    city,
                    state,
                    postal_code: postalCode,
                    gender: data.gender || null,
                    date_of_birth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
                    avatar_url: data.profilePhoto || null,
                    latitude: data.latitude ? parseFloat(data.latitude) : null,
                    longitude: data.longitude ? parseFloat(data.longitude) : null,
                }
            });

            const initialStatus = data.partnerStatus || data.status || 'ACTIVE';
            const coverageAreas = Array.isArray(data.coverageAreas) 
                ? data.coverageAreas 
                : (typeof data.coverageAreas === 'string' ? data.coverageAreas.split(',').map((s: string) => s.trim()).filter(Boolean) : []);

            let partnerRecord: any;

            if (isBusiness) {
                partnerRecord = await tx.businessPartner.create({
                    data: {
                        user_id: user.id,
                        business_name: data.businessName || fullName,
                        category_id: primaryCategoryId || null,
                        partner_status: initialStatus as any,
                        experience_years: data.experience ? parseInt(data.experience) : (data.experienceYears ? parseInt(data.experienceYears) : 0),
                        alternate_phone: data.alternateContactNumber || data.alternatePhone || null,
                        coverage_areas: coverageAreas,
                        address: addressLine1,
                        address_line2: data.addressLine2 || null,
                        city,
                        state,
                        postal_code: postalCode,
                        bank_name: data.bankName || null,
                        bank_account_name: data.accountHolderName || fullName,
                        bank_account_number: data.accountNumber || null,
                        bank_ifsc_code: data.ifscCode || null,
                        upi_id: data.upiId || null,
                    }
                });

                // Status history
                await tx.partnerStatusHistory.create({
                    data: {
                        business_partner_id: partnerRecord.id,
                        previous_status: null,
                        new_status: initialStatus,
                        remarks: data.remarks || 'Partner registered by Administrator',
                        updated_by: adminUserId || 'ADMIN',
                    }
                });
            } else {
                partnerRecord = await tx.servicePartner.create({
                    data: {
                        user_id: user.id,
                        category_id: primaryCategoryId || null,
                        partner_status: initialStatus as any,
                        availability_status: 'AVAILABLE',
                        experience_years: data.experience ? parseInt(data.experience) : (data.experienceYears ? parseInt(data.experienceYears) : 0),
                        alternate_phone: data.alternateContactNumber || data.alternatePhone || null,
                        coverage_areas: coverageAreas,
                        address_line2: data.addressLine2 || null,
                        bank_name: data.bankName || null,
                        bank_account_name: data.accountHolderName || fullName,
                        bank_account_number: data.accountNumber || null,
                        bank_ifsc_code: data.ifscCode || null,
                        upi_id: data.upiId || null,
                        current_latitude: data.latitude ? parseFloat(data.latitude) : null,
                        current_longitude: data.longitude ? parseFloat(data.longitude) : null,
                        service_radius: data.serviceRadius ? parseFloat(data.serviceRadius) : 15,
                    }
                });

                // Status history
                await tx.partnerStatusHistory.create({
                    data: {
                        service_partner_id: partnerRecord.id,
                        previous_status: null,
                        new_status: initialStatus,
                        remarks: data.remarks || 'Partner registered by Administrator',
                        updated_by: adminUserId || 'ADMIN',
                    }
                });
            }

            // 3. Assign Services (Multiple services across multiple categories)
            const serviceIds: string[] = Array.isArray(data.serviceIds) ? data.serviceIds : (Array.isArray(data.services) ? data.services : []);
            if (serviceIds.length > 0) {
                for (const sId of serviceIds) {
                    if (isBusiness) {
                        await tx.partnerService.create({
                            data: {
                                business_partner_id: partnerRecord.id,
                                service_id: sId,
                                is_available: true,
                            }
                        });
                    } else {
                        await tx.partnerService.create({
                            data: {
                                partner_id: partnerRecord.id,
                                service_id: sId,
                                is_available: true,
                            }
                        });
                    }
                }
            }

            return {
                id: partnerRecord.id,
                userId: user.id,
                fullName: user.full_name,
                phoneNumber: user.phone_number,
                email: user.email,
                role: user.role,
                partnerStatus: initialStatus,
                message: 'Partner created successfully',
            };
        });

        logger.info(`Partner ${fullName} created successfully with ID: ${result.id}`);
        return result;
    }

    async updatePartner(id: string, data: any, adminUserId?: string, _role?: string) {
        // Try finding in servicePartner
        let sp = await prisma.servicePartner.findFirst({
            where: { OR: [{ id }, { user_id: id }] },
            include: { user: { include: { profile: true } } }
        });

        if (sp) {
            // Update User details
            const userUpdate: any = {};
            if (data.fullName || data.partnerName || data.name) {
                userUpdate.full_name = data.fullName || data.partnerName || data.name;
            }
            if (data.phoneNumber || data.mobileNumber || data.mobile) {
                userUpdate.phone_number = data.phoneNumber || data.mobileNumber || data.mobile;
            }
            if (data.email || data.emailAddress) {
                userUpdate.email = (data.email || data.emailAddress).toLowerCase();
            }
            if (Object.keys(userUpdate).length > 0) {
                await prisma.user.update({
                    where: { id: sp.user_id },
                    data: userUpdate,
                });
            }

            // Update Profile details
            const profileUpdate: any = {};
            if (data.addressLine1 || data.address) profileUpdate.address = data.addressLine1 || data.address;
            if (data.city) profileUpdate.city = data.city;
            if (data.state) profileUpdate.state = data.state;
            if (data.postalCode || data.pincode) profileUpdate.postal_code = data.postalCode || data.pincode;
            if (data.gender) profileUpdate.gender = data.gender;
            if (data.dateOfBirth) profileUpdate.date_of_birth = new Date(data.dateOfBirth);
            if (data.profilePhoto || data.avatarUrl) profileUpdate.avatar_url = data.profilePhoto || data.avatarUrl;
            if (data.latitude) profileUpdate.latitude = parseFloat(data.latitude);
            if (data.longitude) profileUpdate.longitude = parseFloat(data.longitude);

            if (Object.keys(profileUpdate).length > 0) {
                await prisma.profile.upsert({
                    where: { user_id: sp.user_id },
                    update: profileUpdate,
                    create: { user_id: sp.user_id, ...profileUpdate }
                });
            }

            // Update Partner specific fields
            const partnerUpdate: any = {};
            if (data.experience !== undefined || data.experienceYears !== undefined) {
                partnerUpdate.experience_years = parseInt(data.experience ?? data.experienceYears) || 0;
            }
            if (data.alternateContactNumber !== undefined || data.alternatePhone !== undefined) {
                partnerUpdate.alternate_phone = data.alternateContactNumber ?? data.alternatePhone;
            }
            if (data.coverageAreas !== undefined) {
                partnerUpdate.coverage_areas = Array.isArray(data.coverageAreas) 
                    ? data.coverageAreas 
                    : (typeof data.coverageAreas === 'string' ? data.coverageAreas.split(',').map((s: string) => s.trim()).filter(Boolean) : []);
            }
            if (data.addressLine2 !== undefined) partnerUpdate.address_line2 = data.addressLine2;
            if (data.serviceRadius !== undefined) partnerUpdate.service_radius = parseFloat(data.serviceRadius);
            if (data.categoryId) partnerUpdate.category_id = data.categoryId;

            // Bank details
            if (data.bankName !== undefined) partnerUpdate.bank_name = data.bankName;
            if (data.accountHolderName !== undefined || data.bankAccountName !== undefined) {
                partnerUpdate.bank_account_name = data.accountHolderName ?? data.bankAccountName;
            }
            if (data.accountNumber !== undefined || data.bankAccountNumber !== undefined) {
                partnerUpdate.bank_account_number = data.accountNumber ?? data.bankAccountNumber;
            }
            if (data.ifscCode !== undefined || data.bankIfscCode !== undefined) {
                partnerUpdate.bank_ifsc_code = data.ifscCode ?? data.bankIfscCode;
            }
            if (data.upiId !== undefined) partnerUpdate.upi_id = data.upiId;

            // Sanctions & Status
            const newStatus = data.partnerStatus || data.status;
            if (newStatus && newStatus !== sp.partner_status) {
                partnerUpdate.partner_status = newStatus;
                if (newStatus === 'SUSPENDED' || newStatus === 'INACTIVE' || newStatus === 'REJECTED') {
                    partnerUpdate.availability_status = 'OFFLINE';
                }
                // Record status change history
                await prisma.partnerStatusHistory.create({
                    data: {
                        service_partner_id: sp.id,
                        previous_status: sp.partner_status,
                        new_status: newStatus,
                        remarks: data.remarks || 'Status updated by Administrator',
                        updated_by: adminUserId || 'ADMIN',
                    }
                });
            }

            if (data.isOnHold !== undefined || data.is_on_hold !== undefined) {
                partnerUpdate.is_on_hold = Boolean(data.isOnHold ?? data.is_on_hold);
            }
            if (data.holdReason !== undefined) partnerUpdate.hold_reason = data.holdReason;
            if (data.isBlacklisted !== undefined || data.is_blacklisted !== undefined) {
                partnerUpdate.is_blacklisted = Boolean(data.isBlacklisted ?? data.is_blacklisted);
                if (partnerUpdate.is_blacklisted) partnerUpdate.availability_status = 'OFFLINE';
            }
            if (data.blacklistReason !== undefined) partnerUpdate.blacklist_reason = data.blacklistReason;
            if (data.strikeCount !== undefined) partnerUpdate.strike_count = parseInt(data.strikeCount) || 0;
            if (data.adminRemarks !== undefined) partnerUpdate.admin_remarks = data.adminRemarks;

            // Sync Service assignments if serviceIds provided
            if (Array.isArray(data.serviceIds)) {
                await this.syncPartnerServices(sp.id, data.serviceIds, 'INDIVIDUAL');
            }

            return await prisma.servicePartner.update({
                where: { id: sp.id },
                data: partnerUpdate,
                include: { user: { include: { profile: true } } }
            });
        }

        // Try businessPartner
        let bp = await prisma.businessPartner.findFirst({
            where: { OR: [{ id }, { user_id: id }] },
            include: { user: { include: { profile: true } } }
        });

        if (bp) {
            // Update User details
            const userUpdate: any = {};
            if (data.fullName || data.partnerName || data.name) {
                userUpdate.full_name = data.fullName || data.partnerName || data.name;
            }
            if (data.phoneNumber || data.mobileNumber || data.mobile) {
                userUpdate.phone_number = data.phoneNumber || data.mobileNumber || data.mobile;
            }
            if (data.email || data.emailAddress) {
                userUpdate.email = (data.email || data.emailAddress).toLowerCase();
            }
            if (Object.keys(userUpdate).length > 0) {
                await prisma.user.update({
                    where: { id: bp.user_id },
                    data: userUpdate,
                });
            }

            // Update Profile details
            const profileUpdate: any = {};
            if (data.addressLine1 || data.address) profileUpdate.address = data.addressLine1 || data.address;
            if (data.city) profileUpdate.city = data.city;
            if (data.state) profileUpdate.state = data.state;
            if (data.postalCode || data.pincode) profileUpdate.postal_code = data.postalCode || data.pincode;
            if (data.gender) profileUpdate.gender = data.gender;
            if (data.dateOfBirth) profileUpdate.date_of_birth = new Date(data.dateOfBirth);
            if (data.profilePhoto || data.avatarUrl) profileUpdate.avatar_url = data.profilePhoto || data.avatarUrl;

            if (Object.keys(profileUpdate).length > 0) {
                await prisma.profile.upsert({
                    where: { user_id: bp.user_id },
                    update: profileUpdate,
                    create: { user_id: bp.user_id, ...profileUpdate }
                });
            }

            const bpUpdate: any = {};
            if (data.businessName) bpUpdate.business_name = data.businessName;
            if (data.experience !== undefined || data.experienceYears !== undefined) {
                bpUpdate.experience_years = parseInt(data.experience ?? data.experienceYears) || 0;
            }
            if (data.alternateContactNumber !== undefined || data.alternatePhone !== undefined) {
                bpUpdate.alternate_phone = data.alternateContactNumber ?? data.alternatePhone;
            }
            if (data.coverageAreas !== undefined) {
                bpUpdate.coverage_areas = Array.isArray(data.coverageAreas) 
                    ? data.coverageAreas 
                    : (typeof data.coverageAreas === 'string' ? data.coverageAreas.split(',').map((s: string) => s.trim()).filter(Boolean) : []);
            }
            if (data.addressLine2 !== undefined) bpUpdate.address_line2 = data.addressLine2;
            if (data.city) bpUpdate.city = data.city;
            if (data.state) bpUpdate.state = data.state;
            if (data.postalCode || data.pincode) bpUpdate.postal_code = data.postalCode || data.pincode;
            if (data.categoryId) bpUpdate.category_id = data.categoryId;

            // Bank details
            if (data.bankName !== undefined) bpUpdate.bank_name = data.bankName;
            if (data.accountHolderName !== undefined || data.bankAccountName !== undefined) {
                bpUpdate.bank_account_name = data.accountHolderName ?? data.bankAccountName;
            }
            if (data.accountNumber !== undefined || data.bankAccountNumber !== undefined) {
                bpUpdate.bank_account_number = data.accountNumber ?? data.bankAccountNumber;
            }
            if (data.ifscCode !== undefined || data.bankIfscCode !== undefined) {
                bpUpdate.bank_ifsc_code = data.ifscCode ?? data.bankIfscCode;
            }
            if (data.upiId !== undefined) bpUpdate.upi_id = data.upiId;

            // Status
            const newStatus = data.partnerStatus || data.status;
            if (newStatus && newStatus !== bp.partner_status) {
                bpUpdate.partner_status = newStatus;
                await prisma.partnerStatusHistory.create({
                    data: {
                        business_partner_id: bp.id,
                        previous_status: bp.partner_status,
                        new_status: newStatus,
                        remarks: data.remarks || 'Status updated by Administrator',
                        updated_by: adminUserId || 'ADMIN',
                    }
                });
            }

            if (data.isOnHold !== undefined) bpUpdate.is_on_hold = Boolean(data.isOnHold);
            if (data.holdReason !== undefined) bpUpdate.hold_reason = data.holdReason;
            if (data.isBlacklisted !== undefined) bpUpdate.is_blacklisted = Boolean(data.isBlacklisted);
            if (data.blacklistReason !== undefined) bpUpdate.blacklist_reason = data.blacklistReason;
            if (data.strikeCount !== undefined) bpUpdate.strike_count = parseInt(data.strikeCount) || 0;
            if (data.adminRemarks !== undefined) bpUpdate.admin_remarks = data.adminRemarks;

            // Sync Service assignments if serviceIds provided
            if (Array.isArray(data.serviceIds)) {
                await this.syncPartnerServices(bp.id, data.serviceIds, 'BUSINESS');
            }

            return await prisma.businessPartner.update({
                where: { id: bp.id },
                data: bpUpdate,
                include: { user: { include: { profile: true } } }
            });
        }

        throw new NotFoundError('Partner not found');
    }

    async updatePartnerStatus(id: string, newStatus: string, remarks?: string, adminUserId?: string) {
        const allowedStatuses = ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'ACTIVE', 'INACTIVE', 'REJECTED', 'SUSPENDED'];
        const normalizedStatus = newStatus?.toUpperCase();
        if (!allowedStatuses.includes(normalizedStatus)) {
            throw new BadRequestError(`Invalid partner status: ${newStatus}. Allowed: ${allowedStatuses.join(', ')}`);
        }

        // Try service partner
        let sp = await prisma.servicePartner.findFirst({
            where: { OR: [{ id }, { user_id: id }] }
        });

        if (sp) {
            const prevStatus = sp.partner_status;
            const updateData: any = { partner_status: normalizedStatus as any };

            if (normalizedStatus === 'SUSPENDED' || normalizedStatus === 'INACTIVE' || normalizedStatus === 'REJECTED') {
                updateData.availability_status = 'OFFLINE';
            }

            await prisma.servicePartner.update({
                where: { id: sp.id },
                data: updateData,
            });

            await prisma.partnerStatusHistory.create({
                data: {
                    service_partner_id: sp.id,
                    previous_status: prevStatus,
                    new_status: normalizedStatus,
                    remarks: remarks || `Status changed from ${prevStatus} to ${normalizedStatus}`,
                    updated_by: adminUserId || 'ADMIN',
                }
            });

            logger.info(`Partner ${sp.id} status updated from ${prevStatus} to ${normalizedStatus}`);
            return {
                id: sp.id,
                previousStatus: prevStatus,
                newStatus: normalizedStatus,
                message: `Partner status updated to ${normalizedStatus}`,
            };
        }

        // Try business partner
        let bp = await prisma.businessPartner.findFirst({
            where: { OR: [{ id }, { user_id: id }] }
        });

        if (bp) {
            const prevStatus = bp.partner_status;
            await prisma.businessPartner.update({
                where: { id: bp.id },
                data: { partner_status: normalizedStatus as any },
            });

            await prisma.partnerStatusHistory.create({
                data: {
                    business_partner_id: bp.id,
                    previous_status: prevStatus,
                    new_status: normalizedStatus,
                    remarks: remarks || `Status changed from ${prevStatus} to ${normalizedStatus}`,
                    updated_by: adminUserId || 'ADMIN',
                }
            });

            logger.info(`Business Partner ${bp.id} status updated from ${prevStatus} to ${normalizedStatus}`);
            return {
                id: bp.id,
                previousStatus: prevStatus,
                newStatus: normalizedStatus,
                message: `Partner status updated to ${normalizedStatus}`,
            };
        }

        throw new NotFoundError('Partner not found');
    }

    async getPartnerStatusHistory(partnerId: string) {
        return await prisma.partnerStatusHistory.findMany({
            where: {
                OR: [
                    { service_partner_id: partnerId },
                    { business_partner_id: partnerId },
                ]
            },
            orderBy: { created_at: 'desc' }
        });
    }

    async syncPartnerServices(partnerId: string, serviceIds: string[], type: 'INDIVIDUAL' | 'BUSINESS') {
        const isBusiness = type === 'BUSINESS';
        const partnerCondition = isBusiness ? { business_partner_id: partnerId } : { partner_id: partnerId };

        const existingAssignments = await prisma.partnerService.findMany({
            where: partnerCondition,
        });

        const existingServiceIds = new Set(existingAssignments.map(a => a.service_id));
        const newServiceIds = new Set(serviceIds);

        // Delete removed
        const toDelete = existingAssignments.filter(a => !newServiceIds.has(a.service_id));
        if (toDelete.length > 0) {
            await prisma.partnerService.deleteMany({
                where: { id: { in: toDelete.map(d => d.id) } }
            });
        }

        // Add new
        for (const sId of serviceIds) {
            if (!existingServiceIds.has(sId)) {
                await prisma.partnerService.create({
                    data: {
                        ...(isBusiness ? { business_partner_id: partnerId } : { partner_id: partnerId }),
                        service_id: sId,
                        is_available: true,
                    }
                });
            }
        }
    }

    async uploadPartnerDocument(partnerId: string, file: any, documentType: string, remarks?: string, _adminUserId?: string) {
        // Resolve partner
        let sp = await prisma.servicePartner.findFirst({
            where: { OR: [{ id: partnerId }, { user_id: partnerId }] }
        });
        let bp = null;
        if (!sp) {
            bp = await prisma.businessPartner.findFirst({
                where: { OR: [{ id: partnerId }, { user_id: partnerId }] }
            });
        }

        if (!sp && !bp) throw new NotFoundError('Partner not found');

        const documentUrl = `/uploads/kyc/${file.filename}`;

        const doc = await prisma.kycDocument.create({
            data: {
                ...(sp ? { service_partner_id: sp.id } : { business_partner_id: bp!.id }),
                document_type: documentType,
                document_url: documentUrl,
                original_filename: file.originalname,
                file_size: file.size,
                mime_type: file.mimetype,
                remarks: remarks || null,
                status: 'PENDING_VERIFICATION',
            }
        });

        return doc;
    }

    async verifyPartnerDocument(documentId: string, status: 'VERIFIED' | 'REJECTED', remarks?: string, adminUserId?: string) {
        const doc = await prisma.kycDocument.findUnique({
            where: { id: documentId }
        });
        if (!doc) throw new NotFoundError('Document not found');

        const kycStatus = status === 'VERIFIED' ? 'VERIFIED' : 'REJECTED';

        return await prisma.kycDocument.update({
            where: { id: documentId },
            data: {
                status: kycStatus as any,
                verified_by: adminUserId || 'ADMIN',
                verified_at: new Date(),
                remarks: remarks || null,
                rejection_reason: status === 'REJECTED' ? remarks : null,
            }
        });
    }

    async deletePartnerDocument(documentId: string) {
        const doc = await prisma.kycDocument.findUnique({
            where: { id: documentId }
        });
        if (!doc) throw new NotFoundError('Document not found');

        return await prisma.kycDocument.delete({
            where: { id: documentId }
        });
    }

    async getPartnerDocuments(partnerId: string) {
        return await prisma.kycDocument.findMany({
            where: {
                OR: [
                    { service_partner_id: partnerId },
                    { business_partner_id: partnerId }
                ]
            },
            orderBy: { created_at: 'desc' }
        });
    }

    async updateAvailability(id: string, data: any) {
        let status = data.availability_status || data.status;

        // Support { is_online: boolean } from dashboard
        if (data.is_online !== undefined) {
            status = data.is_online ? 'ONLINE' : 'OFFLINE';
        }

        // Map ONLINE to AVAILABLE (Prisma enum)
        if (status === 'ONLINE' || status === 'AVAILABLE') {
            status = 'AVAILABLE' as any;
        } else if (status === 'OFFLINE' || status === 'BUSY') {
            // Keep as is or map accordingly
        }

        if (!status) {
            throw new BadRequestError('Availability status is required');
        }

        console.log(`📡 [DEBUG] Updating partner ${id} status to ${status}`);

        const updateData: any = {
            availability_status: status as any,
            last_location_update: new Date(),
        };

        if (status === 'AVAILABLE') {
            updateData.went_offline_at = null;
            updateData.shift_started_at = new Date();
            if (data.latitude && data.longitude) {
                updateData.current_latitude = parseFloat(data.latitude);
                updateData.current_longitude = parseFloat(data.longitude);
                updateData.shift_center_latitude = parseFloat(data.latitude);
                updateData.shift_center_longitude = parseFloat(data.longitude);
            }
        } else if (status === 'OFFLINE') {
            updateData.went_offline_at = new Date();
        }

        return await prisma.servicePartner.update({
            where: { id },
            data: updateData,
        });
    }

    async getPartnerServices(id: string) {
        const services = await prisma.partnerService.findMany({
            where: { partner_id: id } as any,
            include: { service: { include: { category: true } } }
        });

        return services.map(ps => ({
            id: ps.id,
            serviceId: ps.service_id,
            serviceName: ps.service.name,
            category: ps.service.category?.name || 'Uncategorized',
            basePrice: ps.service.base_price,
            customPrice: ps.custom_price,
            duration: ps.service.duration,
            isAvailable: ps.is_available
        }));
    }

    async updatePartnerService(psId: string, data: any) {
        return await prisma.partnerService.update({
            where: { id: psId },
            data: {
                is_available: data.isAvailable !== undefined ? data.isAvailable : data.is_available,
                custom_price: data.basePrice || data.customPrice || data.custom_price
            }
        });
    }

    async getPartnerEarnings(id: string) {
        // Try to get wallet for the user associated with this partner
        const partner = await prisma.servicePartner.findUnique({
            where: { id },
            select: { user_id: true }
        }) || await prisma.businessPartner.findUnique({
            where: { id },
            select: { user_id: true }
        });

        if (!partner) return { totalEarnings: 0, currentBalance: 0, pendingPayouts: 0 };

        const wallet = await prisma.wallet.findUnique({
            where: { user_id: partner.user_id }
        });

        // Fetch recent transactions
        const transactions = await prisma.transaction.findMany({
            where: { user_id: partner.user_id },
            take: 5,
            orderBy: { created_at: 'desc' }
        });

        // Calculate total earnings (sum of all credits)
        const totalEarningsAgg = await prisma.transaction.aggregate({
            where: {
                user_id: partner.user_id,
                category: 'CREDIT',
                status: 'COMPLETED'
            },
            _sum: {
                amount: true
            }
        });

        return {
            totalEarnings: totalEarningsAgg._sum.amount || 0,
            currentBalance: wallet?.balance || 0,
            pendingPayouts: wallet?.pending_payout || 0,
            recentTransactions: transactions.map(t => ({
                id: t.id,
                type: t.type,
                amount: t.amount,
                description: t.description,
                createdAt: t.created_at,
                status: (t as any).status
            }))
        };
    }

    async getPartnerPerformance(id: string, _dateRange?: any) {
        const sp = await prisma.servicePartner.findUnique({
            where: { id },
            select: { avg_rating: true, completed_bookings: true, total_bookings: true }
        });

        if (sp) {
            return {
                rating: sp.avg_rating || 0,
                jobsCompleted: sp.completed_bookings || 0,
                totalJobs: sp.total_bookings || 0,
                responseTime: '15m'
            };
        }

        const bp = await prisma.businessPartner.findUnique({
            where: { id },
            select: { id: true }
        });

        if (!bp) return { rating: 0, jobsCompleted: 0, responseTime: 'N/A' };

        const totals = await prisma.booking.groupBy({
            by: ['status'],
            where: { business_partner_id: id },
            _count: { id: true }
        });

        const totalJobs = totals.reduce((acc, curr) => acc + curr._count.id, 0);
        const completed = totals.find(t => t.status === 'COMPLETED');
        const jobsCompleted = completed ? completed._count.id : 0;

        const reviewsObj = await prisma.review.aggregate({
            where: { booking: { business_partner_id: id } },
            _avg: { rating: true }
        });
        const rating = reviewsObj._avg.rating ? Number(reviewsObj._avg.rating.toFixed(1)) : 0;

        return {
            rating,
            jobsCompleted,
            totalJobs,
            responseTime: '15m'
        };
    }

    async addTeamMember(_partnerId: string, spId: string, _userId: string) {
        const { TeamManagementService } = await import('./team-management.service');
        const teamService = new TeamManagementService();
        return await teamService.invitePartner(_partnerId, { service_partner_id: spId });
    }

    async removeTeamMember(_partnerId: string, memberId: string, _userId: string) {
        const { TeamManagementService } = await import('./team-management.service');
        const teamService = new TeamManagementService();
        return await teamService.removeTeamMember(memberId);
    }

    async getTeamMembers(_partnerId: string) {
        const { TeamManagementService } = await import('./team-management.service');
        const teamService = new TeamManagementService();
        const result = await teamService.getTeamMembers(_partnerId);
        return result.associations;
    }

    async getTeamPerformance(_partnerId: string) {
        return { teamSize: 0, avgRating: 0 };
    }

    async assignServiceToPartner(partnerId: string, serviceId: string, options: any = {}) {
        return await prisma.partnerService.upsert({
            where: {
                service_id_partner_id: {
                    service_id: serviceId,
                    partner_id: partnerId
                }
            } as any,
            update: {
                is_available: options.isAvailable ?? options.is_available ?? true,
                custom_price: options.customPrice ?? options.custom_price
            },
            create: {
                partner_id: partnerId,
                service_id: serviceId,
                is_available: options.isAvailable ?? options.is_available ?? true,
                custom_price: options.customPrice ?? options.custom_price
            }
        });
    }

    async updateCommissionRate(_partnerId: string, _rate: number, _userId: string) {
        return { message: 'Commission rate update logic' };
    }

    async getCommissionHistory(_partnerId: string) {
        return [];
    }

    async bulkAssignServices(partnerIds: string[], serviceIds: string[]) {
        const results = [];
        for (const pid of partnerIds) {
            for (const sid of serviceIds) {
                try {
                    const res = await this.assignServiceToPartner(pid, sid);
                    results.push(res);
                } catch (e) {
                    logger.error(`Failed to assign service ${sid} to partner ${pid}:`, e);
                }
            }
        }
        return {
            message: `Bulk service assignment completed. Processed ${results.length} relations.`,
            processed: results.length
        };
    }

    async getPartnersAnalytics(_filters: any) {
        const [totalCount, activeCount, pendingCount] = await Promise.all([
            prisma.servicePartner.count(),
            prisma.servicePartner.count({ where: { availability_status: 'AVAILABLE' } as any }),
            prisma.servicePartner.count({ where: { kyc_status: 'PENDING' } as any })
        ]);

        return {
            totalPartners: totalCount,
            activePartners: activeCount,
            pendingKyc: pendingCount,
            trend: [
                { name: 'Last Week', value: Math.floor(totalCount * 0.9) },
                { name: 'This Week', value: totalCount }
            ]
        };
    }

    async getTopPerformers(_params: any) {
        return [];
    }

    async getCommissionReport(_dateRange?: any) {
        return { totalCommission: 0 };
    }

    async getAnalyticsTrends(_id: string, _metric: any, _range: any, _period: any) {
        return [];
    }

    async getDashboardStats(userId: string) {
        const partner = await prisma.servicePartner.findUnique({
            where: { user_id: userId },
            select: {
                id: true,
                avg_rating: true,
                destination_mode_active: true,
                home_address: true,
                home_latitude: true,
                home_longitude: true,
                referral_code: true,
                minimum_payout_threshold: true,
                auto_transfer_enabled: true,
                auto_transfer_schedule: true,
                skill_categories: true,
            }
        });

        if (!partner) throw new NotFoundError('Service partner not found');

        // 1. Current Job (In Progress or Accepted)
        const currentJob = await prisma.booking.findFirst({
            where: {
                partner_id: partner.id,
                status: { in: ['PARTNER_ACCEPTED', 'PARTNER_ARRIVED', 'IN_PROGRESS'] }
            },
            include: {
                items: { include: { service: true } },
                customer: { select: { full_name: true, phone_number: true, profile: true } }
            },
            orderBy: { updated_at: 'desc' }
        });

        // 2. Earnings Today & All-Time
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const [
            earningsTodayResult,
            totalEarningsResult,
            wallet,
            todayTotalOrders,
            todayCompletedOrders,
            totalCompletedOrders,
            totalOrders
        ] = await Promise.all([
            // Today's earnings
            prisma.transaction.aggregate({
                where: {
                    user_id: userId,
                    category: 'CREDIT',
                    created_at: { gte: startOfDay }
                },
                _sum: { amount: true }
            }),
            // Total earnings all time
            prisma.transaction.aggregate({
                where: {
                    user_id: userId,
                    category: 'CREDIT'
                },
                _sum: { amount: true }
            }),
            // Wallet balance
            prisma.wallet.findUnique({
                where: { user_id: userId },
                select: { balance: true }
            }),
            // Today's total orders assigned or accepted
            prisma.booking.count({
                where: {
                    partner_id: partner.id,
                    OR: [
                        { created_at: { gte: startOfDay } },
                        { partner_assigned_at: { gte: startOfDay } }
                    ]
                }
            }),
            // Today's completed orders
            prisma.booking.count({
                where: {
                    partner_id: partner.id,
                    status: 'COMPLETED',
                    completed_at: { gte: startOfDay }
                }
            }),
            // Total completed orders all-time
            prisma.booking.count({
                where: {
                    partner_id: partner.id,
                    status: 'COMPLETED'
                }
            }),
            // Total orders all-time
            prisma.booking.count({
                where: {
                    partner_id: partner.id
                }
            })
        ]);

        const earningsToday = earningsTodayResult._sum.amount || 0;
        const totalEarnings = totalEarningsResult._sum.amount || 0;
        const walletBalance = wallet?.balance || 0;

        return {
            role: 'SERVICE_PARTNER',
            current_job: currentJob ? {
                id: currentJob.id,
                bookingNumber: currentJob.booking_number,
                status: currentJob.status,
                serviceName: currentJob.items[0]?.service?.name,
                customerName: currentJob.customer.full_name,
                address: currentJob.service_address
            } : null,
            earnings_today: earningsToday,
            todayEarnings: earningsToday,
            total_earnings: totalEarnings,
            totalEarnings: totalEarnings,
            wallet_balance: walletBalance,
            walletBalance: walletBalance,
            today_total_orders: todayTotalOrders,
            todayOrders: todayTotalOrders,
            today_completed_orders: todayCompletedOrders,
            completed_orders: totalCompletedOrders,
            completedOrders: totalCompletedOrders,
            completedJobs: totalCompletedOrders,
            total_orders: totalOrders,
            totalOrders: totalOrders,
            totalJobs: totalOrders,
            rating: partner.avg_rating || 5.0,
            avgRating: partner.avg_rating || 5.0,
            destination_mode_active: partner.destination_mode_active,
            destinationModeActive: partner.destination_mode_active,
            home_address: partner.home_address,
            homeAddress: partner.home_address,
            minimum_payout_threshold: partner.minimum_payout_threshold,
            minimumPayoutThreshold: partner.minimum_payout_threshold,
            auto_transfer_enabled: partner.auto_transfer_enabled,
            autoTransferEnabled: partner.auto_transfer_enabled,
            auto_transfer_schedule: partner.auto_transfer_schedule,
            autoTransferSchedule: partner.auto_transfer_schedule,
            referral_code: partner.referral_code,
            referralCode: partner.referral_code,
            skill_categories: partner.skill_categories,
            skillCategories: partner.skill_categories,
            incentives: {
                dailyOrdersTarget: 8,
                dailyOrdersCompleted: todayCompletedOrders,
                dailyOrdersBonusAmount: 500,
                dailyOrdersProgressPercent: Math.min(100, Math.round((todayCompletedOrders / 8) * 100)),
                continuousHoursTarget: 8,
                continuousHoursBonusAmount: 300,
            }
        };
    }

    async getTotalEarnings(partnerId: string, partnerType: 'SERVICE' | 'BUSINESS') {
        const partner = partnerType === 'SERVICE'
            ? await prisma.servicePartner.findUnique({ where: { id: partnerId }, select: { user_id: true } })
            : await prisma.businessPartner.findUnique({ where: { id: partnerId }, select: { user_id: true } });

        if (!partner) return 0;

        const result = await prisma.transaction.aggregate({
            where: {
                user_id: partner.user_id,
                type: 'BOOKING_PAYMENT',
                category: 'CREDIT',
                status: 'COMPLETED'
            },
            _sum: {
                amount: true
            }
        });

        return result._sum.amount || 0;
    }

    // Payout Methods
    async getPayoutMethods(userId: string) {
        const partner = await prisma.servicePartner.findUnique({
            where: { user_id: userId },
            include: { payout_methods: { orderBy: { created_at: 'desc' } } }
        });
        if (!partner) throw new NotFoundError('Service partner not found');
        return partner.payout_methods;
    }

    async addPayoutMethod(userId: string, data: {
        type: 'BANK_ACCOUNT' | 'UPI';
        account_number?: string;
        ifsc_code?: string;
        bank_name?: string;
        account_holder_name?: string;
        upi_id?: string;
        is_default?: boolean;
    }) {
        const partner = await prisma.servicePartner.findUnique({
            where: { user_id: userId },
            include: { payout_methods: true }
        });
        if (!partner) throw new NotFoundError('Service partner not found');

        const isFirst = partner.payout_methods.length === 0;
        const shouldBeDefault = data.is_default !== undefined ? data.is_default : isFirst;

        if (shouldBeDefault) {
            await prisma.partnerPayoutMethod.updateMany({
                where: { partner_id: partner.id },
                data: { is_default: false }
            });
        }

        const newMethod = await prisma.partnerPayoutMethod.create({
            data: {
                partner_id: partner.id,
                type: data.type || (data.upi_id ? 'UPI' : 'BANK'),
                account_number: data.account_number,
                ifsc_code: data.ifsc_code ? data.ifsc_code.toUpperCase().trim() : undefined,
                bank_name: data.bank_name,
                account_holder: data.account_holder_name || (data as any).account_holder,
                upi_id: data.upi_id ? data.upi_id.trim() : undefined,
                is_default: shouldBeDefault,
                is_verified: true
            }
        });

        return newMethod;
    }

    async setDefaultPayoutMethod(userId: string, methodId: string) {
        const partner = await prisma.servicePartner.findUnique({
            where: { user_id: userId }
        });
        if (!partner) throw new NotFoundError('Service partner not found');

        await prisma.partnerPayoutMethod.updateMany({
            where: { partner_id: partner.id },
            data: { is_default: false }
        });

        const updated = await prisma.partnerPayoutMethod.update({
            where: { id: methodId },
            data: { is_default: true }
        });

        return updated;
    }

    async deletePayoutMethod(userId: string, methodId: string) {
        const partner = await prisma.servicePartner.findUnique({
            where: { user_id: userId }
        });
        if (!partner) throw new NotFoundError('Service partner not found');

        await prisma.partnerPayoutMethod.deleteMany({
            where: { id: methodId, partner_id: partner.id }
        });

        return { message: 'Payout method removed' };
    }

    async requestInstantPayout(userId: string, amount?: number, payoutMethodId?: string) {
        const partner = await prisma.servicePartner.findUnique({
            where: { user_id: userId },
            include: {
                payout_methods: true
            }
        });
        if (!partner) throw new NotFoundError('Service partner not found');

        const wallet = await prisma.wallet.findUnique({
            where: { user_id: userId }
        });
        if (!wallet) throw new NotFoundError('Wallet not found');

        const minThreshold = partner.minimum_payout_threshold || 500;
        if (wallet.balance < minThreshold) {
            throw new BadRequestError(`Minimum balance of ₹${minThreshold} required for instant payout. Current balance: ₹${wallet.balance}`);
        }

        const transferAmount = amount && amount > 0 ? Number(amount) : wallet.balance;
        if (transferAmount > wallet.balance) {
            throw new BadRequestError(`Requested amount ₹${transferAmount} exceeds current balance ₹${wallet.balance}`);
        }

        let selectedMethod = payoutMethodId
            ? partner.payout_methods.find(m => m.id === payoutMethodId)
            : partner.payout_methods.find(m => m.is_default) || partner.payout_methods[0];

        // Deduct from wallet & create transaction
        const updatedWallet = await prisma.$transaction(async (tx) => {
            const w = await tx.wallet.update({
                where: { user_id: userId },
                data: {
                    balance: { decrement: transferAmount },
                    pending_payout: { increment: transferAmount }
                }
            });

            await tx.transaction.create({
                data: {
                    user_id: userId,
                    amount: transferAmount,
                    type: 'PAYOUT',
                    category: 'DEBIT',
                    status: 'COMPLETED',
                    balance_before: wallet.balance,
                    balance_after: wallet.balance - transferAmount,
                    description: `Instant Payout to ${selectedMethod ? (selectedMethod.type === 'UPI' ? selectedMethod.upi_id : selectedMethod.account_number) : 'Primary Bank Account'}`
                }
            });

            return w;
        });

        return {
            success: true,
            amount: transferAmount,
            transferred_to: selectedMethod || { type: 'BANK', note: 'Primary Account' },
            new_balance: updatedWallet.balance,
            message: `Instant transfer of ₹${transferAmount} initiated successfully!`
        };
    }

    async updatePartnerPreferences(userId: string, data: any) {
        const partner = await prisma.servicePartner.findUnique({
            where: { user_id: userId }
        });
        if (!partner) throw new NotFoundError('Service partner not found');

        const updateData: any = {};
        if (data.destination_mode_active !== undefined) updateData.destination_mode_active = Boolean(data.destination_mode_active);
        if (data.home_address !== undefined) updateData.home_address = data.home_address;
        if (data.home_latitude !== undefined) updateData.home_latitude = Number(data.home_latitude);
        if (data.home_longitude !== undefined) updateData.home_longitude = Number(data.home_longitude);
        if (data.auto_transfer_enabled !== undefined) updateData.auto_transfer_enabled = Boolean(data.auto_transfer_enabled);
        if (data.auto_transfer_schedule !== undefined) updateData.auto_transfer_schedule = data.auto_transfer_schedule;
        if (data.minimum_payout_threshold !== undefined) updateData.minimum_payout_threshold = Number(data.minimum_payout_threshold);

        const updated = await prisma.servicePartner.update({
            where: { id: partner.id },
            data: updateData
        });

        return updated;
    }

    async getReferralInfo(userId: string) {
        let partner = await prisma.servicePartner.findUnique({
            where: { user_id: userId }
        });
        if (!partner) throw new NotFoundError('Service partner not found');

        if (!partner.referral_code) {
            const randomCode = 'SP' + Math.random().toString(36).substring(2, 7).toUpperCase();
            partner = await prisma.servicePartner.update({
                where: { id: partner.id },
                data: { referral_code: randomCode }
            });
        }

        const totalReferred = await prisma.servicePartner.count({
            where: { referred_by_code: partner.referral_code }
        });

        const completedReferred = await prisma.servicePartner.count({
            where: {
                referred_by_code: partner.referral_code,
                kyc_status: 'APPROVED'
            }
        });

        const pendingReferred = totalReferred - completedReferred;
        const totalEarned = completedReferred * 1500;

        return {
            referral_code: partner.referral_code,
            reward_per_referral: 1500,
            total_referrals: totalReferred,
            completed_referrals: completedReferred,
            pending_referrals: pendingReferred,
            total_earned: totalEarned,
            share_url: `https://snearal.com/partner/join?ref=${partner.referral_code}`,
            share_text: `Join Snearal as an On-Demand Service Partner! Use my invite code ${partner.referral_code} to get verified and earn daily instant payouts: https://snearal.com/partner/join?ref=${partner.referral_code}`
        };
    }

    async getMerchandiseKits() {
        let kits = await prisma.merchandiseKit.findMany({
            where: { is_available: true },
            orderBy: { price: 'asc' }
        });

        if (kits.length === 0) {
            const defaults = [
                {
                    name: 'Starter Pro Partner Kit',
                    description: 'Everything you need to kick off your Snearal journey: 2 Official Snearal Polos, Partner Cap & Retractable ID Badge.',
                    price: 499,
                    badge: 'POPULAR',
                    image_url: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&auto=format&fit=crop&q=60',
                    items_included: ['2x Snearal Moisture-Wicking Polo T-Shirts', '1x Official Embroidered Cap', '1x Verified Partner ID Card & Lanyard'],
                    is_available: true
                },
                {
                    name: 'Monsoon All-Weather Shield Kit',
                    description: 'Never let rain stop your daily earnings. Premium heavy-duty waterproof raincoat and water-repellent equipment bag cover.',
                    price: 899,
                    badge: 'ESSENTIAL',
                    image_url: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=800&auto=format&fit=crop&q=60',
                    items_included: ['1x Double-Layer Heavy-Duty Raincoat', '1x High-Visibility Rain Pants', '1x Waterproof Bag Rain Shield Cover'],
                    is_available: true
                },
                {
                    name: 'Master Technician Toolkit',
                    description: 'Pro-grade multi-meter, insulated screwdriver set, precision voltage detector, and ballistic nylon heavy-duty tool backpack.',
                    price: 1499,
                    badge: 'PRO TOOLS',
                    image_url: 'https://images.unsplash.com/photo-1581783898377-1c85bf937427?w=800&auto=format&fit=crop&q=60',
                    items_included: ['1x Professional Digital Multimeter', '1x 8-Piece Insulated VDE Screwdriver Set', '1x Non-Contact AC Voltage Tester Pen', '1x Multi-Pocket Ballistic Nylon Tool Bag'],
                    is_available: true
                },
                {
                    name: 'Super Partner Elite Combo Pack',
                    description: 'The ultimate kit for top performers. Complete apparel, all-weather gear, safety equipment, and priority badge branding.',
                    price: 2199,
                    badge: 'BEST VALUE',
                    image_url: 'https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?w=800&auto=format&fit=crop&q=60',
                    items_included: ['3x Snearal Pro Polos', '1x All-Weather Raincoat Set', '1x Partner Cap', '1x Complete Pro Toolkit', '1x Heavy Duty Bag', '1x Safety Gloves & Goggles Set'],
                    is_available: true
                }
            ];

            for (const item of defaults) {
                await prisma.merchandiseKit.create({ data: item });
            }

            kits = await prisma.merchandiseKit.findMany({
                where: { is_available: true },
                orderBy: { price: 'asc' }
            });
        }

        return kits;
    }

    async orderMerchandiseKit(userId: string, data: {
        kit_id: string;
        selected_size?: string;
        payment_method: 'WALLET' | 'ONLINE';
        delivery_address: string;
        delivery_city: string;
        delivery_state: string;
        delivery_pincode: string;
    }) {
        const partner = await prisma.servicePartner.findUnique({
            where: { user_id: userId }
        });
        if (!partner) throw new NotFoundError('Service partner not found');

        const kit = await prisma.merchandiseKit.findUnique({
            where: { id: data.kit_id }
        });
        if (!kit) throw new NotFoundError('Merchandise kit not found');

        if (data.payment_method === 'WALLET') {
            const wallet = await prisma.wallet.findUnique({
                where: { user_id: userId }
            });
            if (!wallet || wallet.balance < kit.price) {
                throw new BadRequestError(`Insufficient wallet balance (₹${wallet?.balance || 0}) for kit order of ₹${kit.price}`);
            }

            await prisma.$transaction(async (tx) => {
                await tx.wallet.update({
                    where: { user_id: userId },
                    data: { balance: { decrement: kit.price } }
                });

                await tx.transaction.create({
                    data: {
                        user_id: userId,
                        amount: kit.price,
                        type: 'PAYOUT',
                        category: 'DEBIT',
                        status: 'COMPLETED',
                        balance_before: wallet.balance,
                        balance_after: wallet.balance - kit.price,
                        description: `Merchandise Kit Purchase: ${kit.name}`
                    }
                });
            });
        }

        const estDate = new Date();
        estDate.setDate(estDate.getDate() + 4);

        const order = await prisma.merchandiseOrder.create({
            data: {
                partner_id: partner.id,
                kit_id: kit.id,
                kit_name: kit.name,
                amount: kit.price,
                payment_method: data.payment_method,
                payment_status: data.payment_method === 'WALLET' ? 'PAID' : 'PENDING',
                status: 'CONFIRMED',
                delivery_address: data.delivery_address,
                city: data.delivery_city,
                state: data.delivery_state,
                postal_code: data.delivery_pincode
            },
            include: { kit: true }
        });

        return order;
    }

    async getMerchandiseOrders(userId: string) {
        const partner = await prisma.servicePartner.findUnique({
            where: { user_id: userId }
        });
        if (!partner) throw new NotFoundError('Service partner not found');

        return await prisma.merchandiseOrder.findMany({
            where: { partner_id: partner.id },
            include: { kit: true },
            orderBy: { created_at: 'desc' }
        });
    }

    async getHighDemandAreas() {
        const dbSurgeAreas = await prisma.surgeArea.findMany({
            where: { is_active: true },
            orderBy: { surge_multiplier: 'desc' }
        });

        if (dbSurgeAreas.length > 0) {
            return dbSurgeAreas.map(sa => ({
                id: sa.id,
                name: sa.name,
                city: sa.city,
                latitude: sa.latitude,
                longitude: sa.longitude,
                radiusKm: sa.radius_km,
                surgeMultiplier: sa.surge_multiplier,
                bonusPerOrder: sa.bonus_per_order,
                demandLevel: sa.surge_multiplier >= 1.4 ? 'VERY_HIGH' : 'HIGH',
                activeOrdersWaiting: Math.floor(Math.random() * 8) + 5
            }));
        }

        return [
            {
                id: 'surge_1',
                name: 'Tech Park Corridor & Outer Ring Road',
                city: 'Bengaluru',
                surgeMultiplier: 1.5,
                demandLevel: 'VERY_HIGH',
                activeOrdersWaiting: 14,
                bonusPerOrder: 80,
                recommendedSkills: ['AC Technician', 'Electrician', 'Plumber']
            },
            {
                id: 'surge_2',
                name: 'Koramangala & HSR Layout Sector 1-7',
                city: 'Bengaluru',
                surgeMultiplier: 1.3,
                demandLevel: 'HIGH',
                activeOrdersWaiting: 9,
                bonusPerOrder: 50,
                recommendedSkills: ['Washing Machine Technician', 'RO Technician']
            }
        ];
    }

    /**
     * Create direct on-the-spot customer job by partner
     */
    async createDirectJob(partnerUserId: string, data: {
        customerPhone: string;
        customerName: string;
        serviceId: string;
        packageId?: string;
        hours?: number;
        customPrice?: number;
        serviceAddress?: string;
        serviceLatitude?: number;
        serviceLongitude?: number;
        notes?: string;
    }) {
        const partner = await prisma.servicePartner.findUnique({
            where: { user_id: partnerUserId },
            include: { user: true }
        });

        if (!partner) {
            throw new NotFoundError('Service partner not found');
        }

        if (partner.is_on_hold || partner.is_blacklisted) {
            throw new BadRequestError('Partner is currently restricted from creating or accepting bookings');
        }

        const cleanPhone = (data.customerPhone || '').replace(/\D/g, '').slice(-10);
        if (!cleanPhone || cleanPhone.length !== 10) {
            throw new BadRequestError('Valid 10-digit customer mobile number is required');
        }

        // 1. Find or auto-register customer
        let customer = await prisma.user.findFirst({
            where: { phone_number: cleanPhone }
        });

        if (!customer) {
            const randomCode = `CUST-${cleanPhone.slice(-4)}${Math.floor(1000 + Math.random() * 9000)}`;
            const hashedPassword = await hashPassword(`Snearal@${cleanPhone.slice(-4)}`);
            customer = await prisma.user.create({
                data: {
                    phone_number: cleanPhone,
                    full_name: data.customerName || `Customer ${cleanPhone.slice(-4)}`,
                    email: `${cleanPhone}@customer.snearal.com`,
                    password: hashedPassword,
                    role: 'CUSTOMER',
                    referral_code: randomCode,
                    referred_by_code: partner.referral_code || null,
                    phone_verified: true,
                }
            });

            // Create wallet for new customer
            await prisma.wallet.create({
                data: {
                    user_id: customer.id,
                    type: 'CUSTOMER',
                    balance: 0
                }
            }).catch(() => null);
        }

        // 2. Fetch service & package
        const service = await prisma.service.findUnique({
            where: { id: data.serviceId },
            include: { category: true }
        });

        if (!service) {
            throw new NotFoundError('Service not found');
        }

        let packageItem: any = null;
        if (data.packageId) {
            packageItem = await prisma.servicePackage.findUnique({
                where: { id: data.packageId }
            });
        }

        const agreedPrice = data.customPrice && data.customPrice > 0 
            ? data.customPrice 
            : (packageItem ? packageItem.price : service.base_price);

        const durationMinutes = packageItem 
            ? Math.round(packageItem.hours * 60) 
            : (data.hours ? Math.round(data.hours * 60) : (service.duration || 60));

        const bookingNumber = `DIR${Date.now().toString().slice(-8)}${Math.floor(100 + Math.random() * 900)}`;
        const serviceLat = data.serviceLatitude || partner.current_latitude || 12.9716;
        const serviceLng = data.serviceLongitude || partner.current_longitude || 77.5946;
        const address = data.serviceAddress || `On-Site Service (${partner.user.full_name})`;

        // 3. Create Booking directly in IN_PROGRESS
        const booking = await prisma.booking.create({
            data: {
                booking_number: bookingNumber,
                customer_id: customer.id,
                partner_id: partner.id,
                status: 'IN_PROGRESS',
                scheduled_date: new Date(),
                scheduled_time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
                service_address: address,
                service_latitude: serviceLat,
                service_longitude: serviceLng,
                total_amount: agreedPrice,
                remaining_amount: agreedPrice,
                payment_method: 'CASH',
                started_at: new Date(),
                partner_assigned_at: new Date(),
                partner_accepted_at: new Date(),
                estimated_duration: durationMinutes,
                special_instructions: data.notes || 'Direct on-the-spot booking created by partner',
                items: {
                    create: [
                        {
                            service_id: service.id,
                            package_id: packageItem ? packageItem.id : null,
                            quantity: 1,
                            unit_price: agreedPrice,
                            total_price: agreedPrice
                        }
                    ]
                },
                status_history: {
                    create: [
                        {
                            status: 'IN_PROGRESS',
                            changed_by: partner.user_id,
                            notes: `Direct booking created and started on-the-spot by ${partner.user.full_name}`
                        }
                    ]
                }
            },
            include: {
                customer: true,
                partner: { include: { user: true } },
                items: { include: { service: true } }
            }
        });

        // 4. Update Partner Status to BUSY
        await prisma.servicePartner.update({
            where: { id: partner.id },
            data: {
                availability_status: 'BUSY',
                last_location_update: new Date()
            }
        });

        // 5. Configurable App Download link & SMS text
        const appDownloadUrl = process.env.CUSTOMER_APP_DOWNLOAD_URL || 'https://play.google.com/store/apps/details?id=com.snearal.user';
        const trackingUrl = process.env.CUSTOMER_APP_URL 
            ? `${process.env.CUSTOMER_APP_URL}/booking/track?id=${booking.id}` 
            : `https://snearal.com/track/${booking.id}`;

        const notificationMessage = `Hello ${customer.full_name}! Your ${service.name} service with Snearal Pro ${partner.user.full_name} has started (Booking #${booking.booking_number}). Track job: ${trackingUrl} | Download our app for exclusive discounts: ${appDownloadUrl} | Use referral code ${partner.referral_code || 'SNEARAL100'} for ₹100 OFF on your next in-app booking!`;

        logger.info(`[DIRECT_JOB] SMS dispatched to ${cleanPhone}: ${notificationMessage}`);

        // Broadcast realtime update
        try {
            const io = getIO();
            io.of('/partner').to(partner.user_id).emit('booking:direct_started', {
                bookingId: booking.id,
                bookingNumber: booking.booking_number,
                customer: { name: customer.full_name, phone: customer.phone_number },
                serviceName: service.name,
                amount: agreedPrice,
            });
            io.of('/admin').to('admin').emit('booking:created', {
                bookingId: booking.id,
                bookingNumber: booking.booking_number,
                type: 'DIRECT_JOB',
                partner: partner.user.full_name,
            });
        } catch (e) {
            logger.warn('Socket broadcast error in direct job:', e);
        }

        return {
            booking,
            smsMessage: notificationMessage,
            appDownloadUrl,
            referralCode: partner.referral_code,
        };
    }

    formatPartnerData(partner: any) {
        return {
            id: partner.id,
            kyc_status: partner.kyc_status || partner.kycStatus,
            availability_status: partner.availability_status || partner.availabilityStatus,
            avg_rating: partner.avg_rating || partner.avgRating || 0,
            total_bookings: partner.total_bookings || partner.totalBookings || 0,
            completed_bookings: partner.completed_bookings || partner.completedBookings || 0,
            // These are for frontend compatibility (camelCase)
            kycStatus: partner.kyc_status || partner.kycStatus,
            availabilityStatus: partner.availability_status || partner.availabilityStatus,
            avgRating: partner.avg_rating || partner.avgRating || 0,
            totalBookings: partner.total_bookings || partner.totalBookings || 0,
            completedBookings: partner.completed_bookings || partner.completedBookings || 0,
        };
    }
}
