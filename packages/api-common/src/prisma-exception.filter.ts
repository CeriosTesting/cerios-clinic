import { ArgumentsHost, Catch, ExceptionFilter } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { Response } from "express";

/**
 * Maps PrismaClientKnownRequestError codes to proper NestJS HTTP exceptions
 * so internal DB details never leak as raw 500 responses.
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
	catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost): void {
		const ctx = host.switchToHttp();
		const response = ctx.getResponse<Response>();

		let httpException: { status: number; message: string };

		switch (exception.code) {
			case "P2002":
				// Unique constraint violation
				httpException = { status: 409, message: "A record with this value already exists" };
				break;
			case "P2025":
				// Record not found for update/delete
				httpException = { status: 404, message: "Record not found" };
				break;
			case "P2003":
				// Foreign key constraint violation
				httpException = { status: 400, message: "Referenced record does not exist" };
				break;
			case "P2014":
				// Relation violation
				httpException = { status: 400, message: "Invalid relation" };
				break;
			default:
				httpException = { status: 500, message: "An unexpected database error occurred" };
				break;
		}

		response.status(httpException.status).json({
			statusCode: httpException.status,
			message: httpException.message,
		});
	}
}
