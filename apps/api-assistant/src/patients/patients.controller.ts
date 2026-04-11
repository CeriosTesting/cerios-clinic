import {
	BadRequestException,
	Controller,
	Get,
	NotFoundException,
	Param,
	ParseUUIDPipe,
	Patch,
	Query,
	UploadedFile,
	UseGuards,
	UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBody, ApiConsumes, ApiOperation, ApiQuery, ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { Prisma } from "@prisma/client";
import { IsOptional, IsString, MaxLength } from "class-validator";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { PrismaService } from "../prisma/prisma.service";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FILE_BYTES = 1 * 1024 * 1024; // 1 MB

type PatientWithUser = Prisma.PatientGetPayload<{ include: { user: true } }>;
type DoctorWithUser = Prisma.DoctorGetPayload<{ include: { user: true } }>;
type UserWithPatient = Prisma.UserGetPayload<{ include: { patient: true } }>;

class SearchPatientsQuery {
	@IsOptional()
	@IsString()
	@MaxLength(100)
	q?: string;
}

@ApiTags("patients")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("assistant", "admin")
@Controller("patients")
export class PatientsController {
	constructor(private readonly prisma: PrismaService) {}

	@Get()
	@ApiOperation({ summary: "Search patients by name or email" })
	@ApiQuery({ name: "q", required: false, description: "Search by name or email" })
	async search(@Query() query: SearchPatientsQuery): Promise<{ data: PatientWithUser[] }> {
		const q = query.q;
		let whereClause: object;
		if (q) {
			const parts = q.trim().split(/\s+/);
			const orConditions: object[] = [
				{ firstName: { contains: q, mode: "insensitive" } },
				{ lastName: { contains: q, mode: "insensitive" } },
				{ email: { contains: q, mode: "insensitive" } },
			];
			if (parts.length >= 2) {
				orConditions.push(
					{
						AND: [
							{ firstName: { contains: parts[0], mode: "insensitive" } },
							{ lastName: { contains: parts.slice(1).join(" "), mode: "insensitive" } },
						],
					},
					{
						AND: [
							{ firstName: { contains: parts.slice(0, -1).join(" "), mode: "insensitive" } },
							{ lastName: { contains: parts[parts.length - 1], mode: "insensitive" } },
						],
					}
				);
			}
			whereClause = { user: { deletedAt: null, OR: orConditions } };
		} else {
			whereClause = { user: { deletedAt: null } };
		}
		const patients = await this.prisma.patient.findMany({
			where: whereClause,
			include: { user: true },
			take: 50,
			orderBy: { user: { lastName: "asc" } },
		});
		return { data: patients };
	}

	@Get("doctors")
	@ApiOperation({ summary: "List all active doctors (for appointment creation dropdown)" })
	async listDoctors(): Promise<{ data: DoctorWithUser[] }> {
		const doctors = await this.prisma.doctor.findMany({
			where: { user: { deletedAt: null } },
			include: { user: true },
			orderBy: { user: { lastName: "asc" } },
		});
		return { data: doctors };
	}

	@Get(":id")
	@ApiOperation({ summary: "Get patient detail by user ID" })
	async getById(@Param("id", ParseUUIDPipe) id: string): Promise<{ data: UserWithPatient }> {
		const user = await this.prisma.user.findFirst({
			where: { id, role: "patient", deletedAt: null },
			include: { patient: true },
		});
		if (!user) throw new NotFoundException("Patient not found");
		return { data: user };
	}

	@Patch(":id/photo")
	@ApiOperation({ summary: "Upload patient photo (1 MB max, portrait JPEG)" })
	@ApiConsumes("multipart/form-data")
	@ApiBody({
		schema: {
			type: "object",
			properties: { photo: { type: "string", format: "binary" } },
		},
	})
	@UseInterceptors(FileInterceptor("photo", { limits: { fileSize: MAX_FILE_BYTES } }))
	async uploadPhoto(
		@Param("id", ParseUUIDPipe) id: string,
		@UploadedFile() file: { mimetype: string; size: number; buffer: Buffer }
	): Promise<{ data: { photo: string } }> {
		if (!file) throw new BadRequestException("No file uploaded");
		if (!ALLOWED_MIME.has(file.mimetype)) {
			throw new BadRequestException("Only JPEG, PNG, or WebP images are allowed");
		}
		if (file.size > MAX_FILE_BYTES) {
			throw new BadRequestException("File exceeds 1 MB limit");
		}

		const patient = await this.prisma.patient.findFirst({
			where: { user: { id, role: "patient", deletedAt: null } },
		});
		if (!patient) throw new NotFoundException("Patient not found");

		const photo = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
		await this.prisma.patient.update({
			where: { id: patient.id },
			data: { photo },
		});

		return { data: { photo } };
	}
}
